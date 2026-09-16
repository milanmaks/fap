import crypto from "crypto";
import { IRepository } from "../persistence/repository";
import { StorageAdapter } from "../storage/storage-adapter";
import { classifyFile } from "./file-classifier";
import { parseJsonStream } from "./json-parser";
import { parseJsonlStream } from "./jsonl-parser";
import { parseAvroBuffer } from "./avro-parser";
import { inspectAndExtractZip } from "./zip-parser";
import { profileRecords } from "./profiler";
import { DatasetVersion, FileFragment, SourceFile } from "../domain/types";
import { generateId } from "../utils/ids";

export interface UploadedFileInput {
  name: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface ImportOptions {
  datasetId?: string;
  datasetName?: string;
  description?: string;
}

export interface ImportResult {
  datasetId: string;
  version: DatasetVersion;
  files: SourceFile[];
  summary: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    totalRecords: number;
    errorCount: number;
  };
}

export class ImportService {
  constructor(
    private repository: IRepository,
    private storage: StorageAdapter
  ) {}

  async processUploads(
    files: UploadedFileInput[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    if (files.length === 0) {
      throw new Error("Nijedan fajl nije prosleđen za upload.");
    }

    // 1. Resolve or create Dataset
    let datasetId = options.datasetId;
    if (!datasetId) {
      const name = options.datasetName?.trim() || `Dataset ${new Date().toLocaleDateString("sr-RS")}`;
      const ds = await this.repository.createDataset(name, options.description);
      datasetId = ds.id;
    } else {
      const existing = await this.repository.getDataset(datasetId);
      if (!existing) {
        throw new Error(`Dataset sa ID-jem '${datasetId}' nije pronađen.`);
      }
    }

    // 2. Determine new version number (incremental, never overwriting prior versions)
    const latestVersion = await this.repository.getLatestVersion(datasetId);
    const versionNumber = (latestVersion?.versionNumber || 0) + 1;

    // 3. Create DatasetVersion
    const version = await this.repository.createVersion(datasetId, versionNumber);
    await this.repository.updateVersion(version.id, { status: "processing" });

    const allSourceFiles: SourceFile[] = [];
    const allParsedRecords: Record<string, unknown>[] = [];
    let totalErrorCount = 0;
    let processedFileCount = 0;
    let skippedFileCount = 0;
    let failedFileCount = 0;

    // Helper to process an individual data file
    const processSingleFile = async (
      fileName: string,
      buffer: Buffer,
      mimeType?: string,
      parentZipName?: string
    ) => {
      const displayName = parentZipName ? `${parentZipName} → ${fileName}` : fileName;
      const classification = classifyFile(fileName, mimeType);
      const checksum = crypto.createHash("md5").update(buffer).digest("hex");

      if (!classification.isSupported) {
        skippedFileCount++;
        const sf = await this.repository.createSourceFile({
          datasetVersionId: version.id,
          originalName: displayName,
          fileType: classification.fileType,
          mimeType: classification.mimeType,
          sizeBytes: buffer.length,
          checksum,
          status: "skipped",
          errorMessage: classification.reason || "Format nije podržan.",
        });
        allSourceFiles.push(sf);
        return;
      }

      // Save raw file into storage
      const storageKey = `datasets/${datasetId}/v${versionNumber}/${generateId("f")}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      try {
        await this.storage.saveFile(storageKey, buffer);
      } catch (err: unknown) {
        console.warn("Storage save warning:", err);
      }

      try {
        let parseRes;
        if (classification.fileType === "json") {
          parseRes = await parseJsonStream(buffer);
        } else if (classification.fileType === "jsonl") {
          parseRes = await parseJsonlStream(buffer);
        } else if (classification.fileType === "avro") {
          parseRes = await parseAvroBuffer(buffer);
        } else {
          throw new Error("Nepoznat format za direktnu obradu.");
        }

        if (parseRes.invalidRecords > 0 && parseRes.records.length === 0) {
          failedFileCount++;
          totalErrorCount += parseRes.invalidRecords;
          const sf = await this.repository.createSourceFile({
            datasetVersionId: version.id,
            originalName: displayName,
            fileType: classification.fileType,
            mimeType: classification.mimeType,
            sizeBytes: buffer.length,
            checksum,
            status: "failed",
            storageKey,
            errorMessage: parseRes.errorMessages.join("; "),
          });
          allSourceFiles.push(sf);
          return;
        }

        // Success or partial success
        processedFileCount++;
        totalErrorCount += parseRes.invalidRecords;

        const sf = await this.repository.createSourceFile({
          datasetVersionId: version.id,
          originalName: displayName,
          fileType: classification.fileType,
          mimeType: classification.mimeType,
          sizeBytes: buffer.length,
          checksum,
          status: parseRes.invalidRecords > 0 ? "ready" : "ready",
          storageKey,
          errorMessage:
            parseRes.errorMessages.length > 0 ? parseRes.errorMessages.join("; ") : undefined,
        });
        allSourceFiles.push(sf);

        // Profile file fragments
        const fileProfile = profileRecords(parseRes.records, parseRes.invalidRecords);
        const fragments: FileFragment[] = fileProfile.fragments.map((fr) => ({
          ...fr,
          sourceFileId: sf.id,
        }));
        await this.repository.createFragments(fragments);

        // Attach sourceFileId tag to each record for lineage
        for (const r of parseRes.records) {
          (r as any)._fap_source_file_id = sf.id;
          (r as any)._fap_source_file_name = displayName;
        }

        allParsedRecords.push(...parseRes.records);
      } catch (err: unknown) {
        failedFileCount++;
        totalErrorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        const sf = await this.repository.createSourceFile({
          datasetVersionId: version.id,
          originalName: displayName,
          fileType: classification.fileType,
          mimeType: classification.mimeType,
          sizeBytes: buffer.length,
          checksum,
          status: "failed",
          storageKey,
          errorMessage: msg,
        });
        allSourceFiles.push(sf);
      }
    };

    // 4. Iterate over uploaded files
    for (const file of files) {
      const classification = classifyFile(file.name, file.mimeType);

      if (classification.fileType === "zip") {
        const zipResult = await inspectAndExtractZip(file.buffer);
        if (!zipResult.valid) {
          failedFileCount++;
          totalErrorCount++;
          const sf = await this.repository.createSourceFile({
            datasetVersionId: version.id,
            originalName: file.name,
            fileType: "zip",
            mimeType: file.mimeType || "application/zip",
            sizeBytes: file.buffer.length,
            status: "failed",
            errorMessage: zipResult.error || "Greška pri inspekciji ZIP arhive.",
          });
          allSourceFiles.push(sf);
          continue;
        }

        for (const entry of zipResult.entries) {
          if (!entry.isSupported || !entry.data) {
            skippedFileCount++;
            const sf = await this.repository.createSourceFile({
              datasetVersionId: version.id,
              originalName: `${file.name} → ${entry.entryPath}`,
              fileType: entry.fileType,
              sizeBytes: entry.sizeBytes,
              status: "skipped",
              errorMessage: entry.skipReason || "Preskočen nepodržan fajl.",
            });
            allSourceFiles.push(sf);
          } else {
            await processSingleFile(entry.sanitizedName, entry.data, undefined, file.name);
          }
        }
      } else {
        await processSingleFile(file.name, file.buffer, file.mimeType);
      }
    }

    // 5. Profile merged records
    const profile = profileRecords(allParsedRecords, totalErrorCount);

    // 6. Create immutable AnalyticsSnapshot
    await this.repository.createSnapshot({
      datasetVersionId: version.id,
      recordCount: profile.recordCount,
      duplicateCount: profile.duplicateCount,
      invalidRecordCount: profile.invalidRecordCount,
      columnStats: profile.columnStats,
    });

    // 7. Save parsed records in repository for query engine
    await this.repository.saveParsedRecords(version.id, allParsedRecords);

    // 8. Update DatasetVersion status
    let finalStatus: DatasetVersion["status"] = "ready";
    if (processedFileCount === 0 && failedFileCount > 0) {
      finalStatus = "failed";
    } else if (failedFileCount > 0 || totalErrorCount > 0) {
      finalStatus = "partial";
    }

    const updatedVersion = await this.repository.updateVersion(version.id, {
      status: finalStatus,
      schema: profile.schema,
      totalFiles: allSourceFiles.length,
      processedFiles: processedFileCount,
      totalRecords: profile.recordCount,
      errorCount: totalErrorCount,
      completedAt: new Date().toISOString(),
    });

    // 9. Log audit event
    await this.repository.logAuditEvent({
      eventType: "DATASET_UPLOAD_PROCESSED",
      entityType: "DatasetVersion",
      entityId: version.id,
      payload: {
        datasetId,
        versionNumber,
        totalFiles: allSourceFiles.length,
        processedFiles: processedFileCount,
        records: profile.recordCount,
        status: finalStatus,
      },
    });

    return {
      datasetId,
      version: updatedVersion,
      files: allSourceFiles,
      summary: {
        totalFiles: allSourceFiles.length,
        processedFiles: processedFileCount,
        skippedFiles: skippedFileCount,
        failedFiles: failedFileCount,
        totalRecords: profile.recordCount,
        errorCount: totalErrorCount,
      },
    };
  }
}
