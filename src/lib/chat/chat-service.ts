import { IRepository } from "../persistence/repository";
import { getGeminiClient, GeminiClient } from "./gemini-client";
import { ReadonlyQueryValidator } from "./readonly-query-validator";
import {
  compareSnapshots,
  executeQueryPlanOnRecords,
  QueryExecutionResult,
} from "../domain/analytics";
import { ChartSpec, ChatMessage, DataCitation, QueryPlan, RecordWithLineage } from "../domain/types";
import { compareVersions } from "../analytics/diff-engine";
import { evaluateDatasetQuality } from "../analytics/quality-engine";

export interface ChatServiceInput {
  datasetId: string;
  datasetVersionId?: string;
  message: string;
  conversation?: ChatMessage[];
}

export interface ChatServiceResponse {
  message: string;
  confidence: "high" | "medium" | "low";
  mode: string;
  citations: DataCitation[];
  queryPlan?: QueryPlan;
  chart?: ChartSpec;
  warnings: string[];
  isDemoFallback: boolean;
}

export class ChatService {
  constructor(
    private repository: IRepository,
    private geminiClient: GeminiClient = getGeminiClient()
  ) {}

  async handleChat(input: ChatServiceInput): Promise<ChatServiceResponse> {
    const warnings: string[] = [];
    const isDemo = !this.geminiClient.isConfigured();

    if (isDemo) {
      warnings.push("AI asistent radi u lokalnom demo režimu (GEMINI_API_KEY nije postavljen).");
    }

    // 1. Resolve Dataset & Version
    const dataset = await this.repository.getDataset(input.datasetId);
    if (!dataset) {
      throw new Error(`Dataset sa ID-jem '${input.datasetId}' ne postoji.`);
    }

    let version = input.datasetVersionId
      ? await this.repository.getVersion(input.datasetVersionId)
      : await this.repository.getLatestVersion(input.datasetId);

    if (!version) {
      throw new Error(`Nema dostupne verzije za dataset '${input.datasetId}'.`);
    }

    // Save user message to repository
    await this.repository.saveChatMessage({
      datasetVersionId: version.id,
      role: "user",
      content: input.message,
      citations: [],
    });

    // 2. Fetch snapshot and source files
    const snapshot =
      (await this.repository.getLatestSnapshot(version.id)) || {
        id: "empty_snap",
        datasetVersionId: version.id,
        recordCount: version.totalRecords,
        invalidRecordCount: version.errorCount,
        columnStats: [],
        createdAt: new Date().toISOString(),
      };

    const sourceFiles = await this.repository.listSourceFiles(version.id);
    const filesMap = new Map(sourceFiles.map((f) => [f.id, f.originalName]));

    // 3. Generate Query Plan via Gemini or local router
    const planResult = await this.geminiClient.createQueryPlan({
      question: input.message,
      dataset: version,
      schema: version.schema,
      analyticsSummary: snapshot,
      conversation: input.conversation || [],
    });

    if (planResult.clarification && !planResult.plan) {
      const resp: ChatServiceResponse = {
        message: planResult.clarification,
        confidence: "medium",
        mode: planResult.route || "clarification",
        citations: [],
        warnings,
        isDemoFallback: isDemo,
      };

      await this.repository.saveChatMessage({
        datasetVersionId: version.id,
        role: "assistant",
        content: resp.message,
        citations: [],
      });

      return resp;
    }

    const rawPlan = planResult.plan || {
      operation: "count",
      datasetVersionId: version.id,
    };

    // 4. Validate Query Plan
    const validation = ReadonlyQueryValidator.validate(rawPlan, version.id, version.schema);

    if (!validation.valid || !validation.sanitizedPlan) {
      const errorMsg = `Nije moguće izvršiti upit zbog sledećih pravila validacije:\n• ${validation.errors.join("\n• ")}`;

      const resp: ChatServiceResponse = {
        message: errorMsg,
        confidence: "low",
        mode: planResult.route || "clarification",
        citations: [],
        queryPlan: rawPlan,
        warnings: [...warnings, ...validation.errors],
        isDemoFallback: isDemo,
      };

      await this.repository.saveChatMessage({
        datasetVersionId: version.id,
        role: "assistant",
        content: errorMsg,
        queryPlan: rawPlan,
        citations: [],
      });

      return resp;
    }

    const validPlan = validation.sanitizedPlan;
    let executionResult: QueryExecutionResult;

    // 5. Execute Plan
    if (validPlan.operation === "describe") {
      executionResult = {
        summary: `Šema verzije v${version.versionNumber} sadrži ${version.schema?.fields?.length || 0} kolona i ${version.totalRecords} zapisa.`,
        data: {
          schema: version.schema,
          columnStats: snapshot.columnStats,
          totalFiles: version.totalFiles,
          recordCount: version.totalRecords,
        },
        recordCount: version.totalRecords,
        citations: sourceFiles.map((sf) => ({
          datasetId: dataset.id,
          datasetVersionId: version.id,
          sourceFileId: sf.id,
          fileName: sf.originalName,
        })),
        warnings: [],
      };
    } else if (planResult.route === "data_quality" || input.message.toLowerCase().includes("kvalitet") || input.message.toLowerCase().includes("pravil")) {
      const allRaw = await this.repository.getParsedRecords(version.id);
      const allVersions = await this.repository.listVersions(dataset.id);
      const prevVersion = allVersions.find((v) => v.versionNumber === version.versionNumber - 1);
      const prevSnap = prevVersion ? await this.repository.getLatestSnapshot(prevVersion.id) : null;

      const qResult = evaluateDatasetQuality({
        version,
        records: allRaw as RecordWithLineage[],
        snapshot,
        previousVersion: prevVersion || null,
        previousSnapshot: prevSnap,
      });

      const failedRules = qResult.rules.filter((r) => r.status === "fail" || r.status === "warning");
      const rulesSummary =
        failedRules.length > 0
          ? `\n\nPravila sa upozorenjima/greškama:\n` +
            failedRules
              .map(
                (r) =>
                  `• **${r.ruleName || r.ruleId}**: [${r.status.toUpperCase()}] ${r.affectedRecordCount} zapisa (${r.explanation})`
              )
              .join("\n")
          : "\n\nSva aktivna telemetrijska pravila su prošla (PASS).";

      executionResult = {
        summary: `Heuristička ocena kvaliteta za v${version.versionNumber}: **${qResult.score}/100** (${qResult.grade.toUpperCase()}).\n\nOcena po dimenzijama:\n` +
          qResult.dimensions.map((d) => `• **${d.dimension}**: ${d.score}% (težina ${Math.round(d.weight * 100)}%) — ${d.explanation}`).join("\n") +
          rulesSummary,
        data: qResult,
        recordCount: version.totalRecords,
        citations: sourceFiles.map((sf) => ({
          datasetId: dataset.id,
          datasetVersionId: version.id,
          sourceFileId: sf.id,
          fileName: sf.originalName,
        })),
        warnings: qResult.warnings,
      };
    } else if (validPlan.operation === "compare" || planResult.route === "version_comparison") {
      const allVersions = await this.repository.listVersions(dataset.id);
      const sorted = allVersions
        .filter((v) => v.status === "ready" || v.status === "partial")
        .sort((a, b) => b.versionNumber - a.versionNumber);

      const targetVer = version;
      const baseVer = sorted.find((v) => v.id !== targetVer.id) || sorted[1];

      if (!baseVer) {
        executionResult = {
          summary: `Nije pronađena prethodna verzija za poređenje sa trenutnom verzijom v${version.versionNumber}. Za poređenje je potreban uvoz najmanje dve verzije dataset-a.`,
          data: null,
          recordCount: version.totalRecords,
          citations: [],
          warnings: ["Za poređenje je potrebno imati najmanje 2 verzije u dataset-u."],
        };
      } else {
        const [baseFiles, baseSnapshot, baseRawRecords, targetRawRecords] = await Promise.all([
          this.repository.listSourceFiles(baseVer.id),
          this.repository.getLatestSnapshot(baseVer.id),
          this.repository.getParsedRecords(baseVer.id),
          this.repository.getParsedRecords(targetVer.id),
        ]);

        const diffResult = compareVersions({
          datasetId: dataset.id,
          baseVersion: baseVer,
          targetVersion: targetVer,
          baseFiles,
          targetFiles: sourceFiles,
          baseRecords: baseRawRecords as RecordWithLineage[],
          targetRecords: targetRawRecords as RecordWithLineage[],
          baseSnapshot: baseSnapshot || snapshot,
          targetSnapshot: snapshot,
        });

        const driftSummary =
          diffResult.schemaDrift.length > 0
            ? `\n\nSchema drift promene (${diffResult.schemaDrift.length}):\n` +
              diffResult.schemaDrift
                .slice(0, 5)
                .map((d) => `• \`${d.columnPath}\`: ${d.changeType} [${d.severity.toUpperCase()}] — ${d.explanation}`)
                .join("\n")
            : "\n\nNema detektovanih promena u šemi kolona.";

        executionResult = {
          summary:
            `Poređenje verzije **v${targetVer.versionNumber}** naspram bazne **v${baseVer.versionNumber}**:\n` +
            `• Ukupno zapisa: ${diffResult.kpis.recordCount.before} → ${diffResult.kpis.recordCount.after} (${diffResult.kpis.recordCount.absoluteDelta >= 0 ? "+" : ""}${diffResult.kpis.recordCount.absoluteDelta})\n` +
            `• Novi zapisi: **${diffResult.overlap.newRecords}**\n` +
            `• Identični duplikati: **${diffResult.overlap.exactDuplicateRecords}**\n` +
            `• Izmenjeni zapisi (isti business key): **${diffResult.overlap.changedRecords}**\n` +
            `• Uklonjeni zapisi: **${diffResult.overlap.removedRecords}**\n` +
            `• Preklapanje vremena: ${diffResult.overlap.temporalOverlapPercent !== null ? diffResult.overlap.temporalOverlapPercent + "%" : "Nije dostupno"}\n` +
            `• Preklapanje uređaja (instanceId): ${diffResult.overlap.deviceOverlapPercent !== null ? diffResult.overlap.deviceOverlapPercent + "%" : "Nije dostupno"}` +
            driftSummary,
          data: diffResult,
          recordCount: targetVer.totalRecords,
          citations: [
            { datasetId: dataset.id, datasetVersionId: baseVer.id },
            { datasetId: dataset.id, datasetVersionId: targetVer.id },
          ],
          warnings: [],
        };
      }
    } else {
      // In-process querying over ingested records
      const records = await this.repository.getParsedRecords(version.id);
      executionResult = executeQueryPlanOnRecords(records, validPlan, version, filesMap);
    }

    // 6. Compose Answer with Gemini or Fallback
    const finalAnswer = await this.geminiClient.composeAnswer({
      question: input.message,
      route: planResult.route,
      result: executionResult,
      citations: executionResult.citations,
      warnings: [...warnings, ...executionResult.warnings],
      language: "sr",
    });

    const response: ChatServiceResponse = {
      message: finalAnswer.message,
      confidence: finalAnswer.confidence,
      mode: planResult.route,
      citations: executionResult.citations,
      queryPlan: validPlan,
      chart: finalAnswer.chart || executionResult.chart,
      warnings: [...warnings, ...executionResult.warnings],
      isDemoFallback: isDemo,
    };

    // 7. Persist Assistant message
    await this.repository.saveChatMessage({
      datasetVersionId: version.id,
      role: "assistant",
      content: response.message,
      queryPlan: validPlan,
      citations: response.citations,
    });

    // 8. Log audit event
    await this.repository.logAuditEvent({
      eventType: "CHAT_QUERY_EXECUTED",
      entityType: "DatasetVersion",
      entityId: version.id,
      payload: {
        question: input.message,
        route: planResult.route,
        operation: validPlan.operation,
        citationsCount: response.citations.length,
      },
    });

    return response;
  }
}
