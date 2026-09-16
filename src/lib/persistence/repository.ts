import {
  AnalyticsSnapshot,
  ChatMessage,
  Dataset,
  DatasetVersion,
  FileFragment,
  SourceFile,
} from "../domain/types";

export interface IRepository {
  // Datasets
  listDatasets(): Promise<Dataset[]>;
  getDataset(id: string): Promise<Dataset | null>;
  createDataset(name: string, description?: string): Promise<Dataset>;

  // Versions
  listVersions(datasetId: string): Promise<DatasetVersion[]>;
  getVersion(id: string): Promise<DatasetVersion | null>;
  getLatestVersion(datasetId: string): Promise<DatasetVersion | null>;
  createVersion(datasetId: string, versionNumber: number): Promise<DatasetVersion>;
  updateVersion(id: string, updates: Partial<DatasetVersion>): Promise<DatasetVersion>;

  // Files
  createSourceFile(file: Omit<SourceFile, "id" | "createdAt">): Promise<SourceFile>;
  listSourceFiles(versionId: string): Promise<SourceFile[]>;
  getSourceFile(id: string): Promise<SourceFile | null>;
  updateSourceFile(id: string, updates: Partial<SourceFile>): Promise<SourceFile>;

  // Fragments
  createFragments(fragments: FileFragment[]): Promise<void>;
  listFragments(fileId: string): Promise<FileFragment[]>;

  // Analytics Snapshots
  createSnapshot(
    snapshot: Omit<AnalyticsSnapshot, "id" | "createdAt">
  ): Promise<AnalyticsSnapshot>;
  getLatestSnapshot(versionId: string): Promise<AnalyticsSnapshot | null>;
  listSnapshots(versionId: string): Promise<AnalyticsSnapshot[]>;

  // Parsed records for in-memory / local fast querying
  saveParsedRecords(versionId: string, records: Record<string, unknown>[]): Promise<void>;
  getParsedRecords(versionId: string): Promise<Record<string, unknown>[]>;

  // Chat
  listChatMessages(versionId: string): Promise<ChatMessage[]>;
  saveChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage>;

  // Audit
  logAuditEvent(event: {
    eventType: string;
    entityType: string;
    entityId?: string;
    payload?: unknown;
  }): Promise<void>;
}
