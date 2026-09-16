import { IRepository } from "../persistence/repository";
import { getGeminiClient, GeminiClient } from "./gemini-client";
import { ReadonlyQueryValidator } from "./readonly-query-validator";
import {
  compareSnapshots,
  executeQueryPlanOnRecords,
  QueryExecutionResult,
} from "../domain/analytics";
import { ChartSpec, ChatMessage, DataCitation, QueryPlan } from "../domain/types";

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
    } else if (validPlan.operation === "compare") {
      // Find previous version
      const allVersions = await this.repository.listVersions(dataset.id);
      const prevVersion = allVersions.find((v) => v.versionNumber === version.versionNumber - 1);

      if (!prevVersion) {
        executionResult = {
          summary: `Nije pronađena prethodna verzija za poređenje sa trenutnom verzijom v${version.versionNumber}.`,
          data: null,
          recordCount: version.totalRecords,
          citations: [],
          warnings: ["Za poređenje je potrebno imati najmanje 2 verzije u dataset-u."],
        };
      } else {
        const prevSnap = await this.repository.getLatestSnapshot(prevVersion.id);
        const comp = compareSnapshots(
          prevSnap || snapshot,
          snapshot,
          prevVersion.versionNumber,
          version.versionNumber
        );

        executionResult = {
          summary: `Poređenje verzija v${prevVersion.versionNumber} i v${version.versionNumber}.`,
          data: comp,
          recordCount: version.totalRecords,
          citations: [
            { datasetId: dataset.id, datasetVersionId: prevVersion.id },
            { datasetId: dataset.id, datasetVersionId: version.id },
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
