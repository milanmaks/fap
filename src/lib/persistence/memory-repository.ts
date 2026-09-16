import {
  AnalyticsSnapshot,
  ChatMessage,
  Dataset,
  DatasetVersion,
  FileFragment,
  SourceFile,
} from "../domain/types";
import { IRepository } from "./repository";
import { generateId } from "../utils/ids";
import { profileRecords } from "../ingestion/profiler";

export class MemoryRepository implements IRepository {
  private datasets = new Map<string, Dataset>();
  private versions = new Map<string, DatasetVersion>();
  private files = new Map<string, SourceFile>();
  private fragments = new Map<string, FileFragment[]>(); // fileId -> fragments
  private snapshots = new Map<string, AnalyticsSnapshot[]>(); // versionId -> snapshots
  private parsedRecords = new Map<string, Record<string, unknown>[]>(); // versionId -> records
  private chatMessages = new Map<string, ChatMessage[]>(); // versionId -> messages
  private auditEvents: Array<any> = [];

  constructor(seedDemo = true) {
    if (seedDemo) {
      this.seedDemoData();
    }
  }

  private seedDemoData() {
    const datasetId = "ds_demo_ecommerce";
    const now = new Date().toISOString();

    const ds: Dataset = {
      id: datasetId,
      name: "E-Commerce Narudžbine (Demo)",
      description: "Demo dataset sa primerom transakcija kupaca, statusa narudžbina i prihoda.",
      createdAt: now,
      updatedAt: now,
    };
    this.datasets.set(datasetId, ds);

    // Version 1 (30 demo records)
    const demoRecordsV1: Record<string, unknown>[] = [
      { id: "ORD-101", customer: "Marko Petrović", amount: 4500, status: "completed", city: "Beograd", date: "2026-03-01T10:15:00Z" },
      { id: "ORD-102", customer: "Jelena Nikolić", amount: 12000, status: "completed", city: "Novi Sad", date: "2026-03-01T11:20:00Z" },
      { id: "ORD-103", customer: "Stefan Jovanović", amount: 2300, status: "failed", city: "Niš", date: "2026-03-01T12:00:00Z" },
      { id: "ORD-104", customer: "Milica Đorđević", amount: 7800, status: "completed", city: "Beograd", date: "2026-03-02T09:30:00Z" },
      { id: "ORD-105", customer: "Nikola Lukić", amount: 15400, status: "pending", city: "Kragujevac", date: "2026-03-02T14:45:00Z" },
      { id: "ORD-106", customer: "Ana Stojanović", amount: 3100, status: "completed", city: "Subotica", date: "2026-03-03T16:10:00Z" },
      { id: "ORD-107", customer: "Milan Maksimović", amount: 9900, status: "completed", city: "Beograd", date: "2026-03-03T18:00:00Z" },
      { id: "ORD-108", customer: "Bojana Ilić", amount: 1850, status: "failed", city: "Čačak", date: "2026-03-04T10:05:00Z" },
      { id: "ORD-109", customer: "Vladimir Kostić", amount: 6400, status: "completed", city: "Novi Sad", date: "2026-03-04T12:40:00Z" },
      { id: "ORD-110", customer: "Dragana Simić", amount: 8200, status: "completed", city: "Zrenjanin", date: "2026-03-05T15:15:00Z" },
    ];

    const v1Id = "ver_demo_v1";
    const profiledV1 = profileRecords(demoRecordsV1, 0, 5000);

    const v1: DatasetVersion = {
      id: v1Id,
      datasetId,
      versionNumber: 1,
      status: "ready",
      schema: profiledV1.schema,
      totalFiles: 1,
      processedFiles: 1,
      totalRecords: demoRecordsV1.length,
      errorCount: 0,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 3590000).toISOString(),
    };
    this.versions.set(v1Id, v1);
    this.parsedRecords.set(v1Id, demoRecordsV1);

    const file1Id = "file_demo_orders_v1";
    const file1: SourceFile = {
      id: file1Id,
      datasetVersionId: v1Id,
      originalName: "orders_march_batch1.json",
      fileType: "json",
      mimeType: "application/json",
      sizeBytes: 1540,
      status: "ready",
      createdAt: v1.createdAt,
    };
    this.files.set(file1Id, file1);

    const snap1: AnalyticsSnapshot = {
      id: "snap_demo_v1",
      datasetVersionId: v1Id,
      sourceFileId: file1Id,
      recordCount: demoRecordsV1.length,
      duplicateCount: profiledV1.duplicateCount,
      invalidRecordCount: 0,
      columnStats: profiledV1.columnStats,
      createdAt: v1.createdAt,
    };
    this.snapshots.set(v1Id, [snap1]);

    // Version 2 (More records, added discount column)
    const demoRecordsV2: Record<string, unknown>[] = [
      ...demoRecordsV1,
      { id: "ORD-111", customer: "Igor Todorović", amount: 5600, status: "completed", city: "Kraljevo", discount: 10, date: "2026-03-06T09:00:00Z" },
      { id: "ORD-112", customer: "Sara Pavlović", amount: 11200, status: "failed", city: "Beograd", discount: 0, date: "2026-03-06T11:45:00Z" },
      { id: "ORD-113", customer: "Miloš Popović", amount: 3900, status: "completed", city: "Pančevo", discount: 5, date: "2026-03-07T14:30:00Z" },
      { id: "ORD-114", customer: "Katarina Savić", amount: 14000, status: "completed", city: "Novi Sad", discount: 15, date: "2026-03-07T17:10:00Z" },
    ];

    const v2Id = "ver_demo_v2";
    const profiledV2 = profileRecords(demoRecordsV2, 0, 5000);

    const v2: DatasetVersion = {
      id: v2Id,
      datasetId,
      versionNumber: 2,
      status: "ready",
      schema: profiledV2.schema,
      totalFiles: 2,
      processedFiles: 2,
      totalRecords: demoRecordsV2.length,
      errorCount: 0,
      createdAt: now,
      completedAt: now,
    };
    this.versions.set(v2Id, v2);
    this.parsedRecords.set(v2Id, demoRecordsV2);

    const file2Id = "file_demo_orders_v2";
    const file2: SourceFile = {
      id: file2Id,
      datasetVersionId: v2Id,
      originalName: "orders_march_batch2.jsonl",
      fileType: "jsonl",
      mimeType: "application/x-ndjson",
      sizeBytes: 2850,
      status: "ready",
      createdAt: now,
    };
    this.files.set(file2Id, file2);

    const snap2: AnalyticsSnapshot = {
      id: "snap_demo_v2",
      datasetVersionId: v2Id,
      recordCount: demoRecordsV2.length,
      duplicateCount: profiledV2.duplicateCount,
      invalidRecordCount: 0,
      columnStats: profiledV2.columnStats,
      createdAt: now,
    };
    this.snapshots.set(v2Id, [snap2]);
  }

  // Datasets
  async listDatasets(): Promise<Dataset[]> {
    return Array.from(this.datasets.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getDataset(id: string): Promise<Dataset | null> {
    return this.datasets.get(id) || null;
  }

  async createDataset(name: string, description?: string): Promise<Dataset> {
    const id = generateId("ds");
    const now = new Date().toISOString();
    const ds: Dataset = { id, name, description, createdAt: now, updatedAt: now };
    this.datasets.set(id, ds);
    return ds;
  }

  // Versions
  async listVersions(datasetId: string): Promise<DatasetVersion[]> {
    return Array.from(this.versions.values())
      .filter((v) => v.datasetId === datasetId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async getVersion(id: string): Promise<DatasetVersion | null> {
    return this.versions.get(id) || null;
  }

  async getLatestVersion(datasetId: string): Promise<DatasetVersion | null> {
    const list = await this.listVersions(datasetId);
    return list.length > 0 ? list[0] : null;
  }

  async createVersion(datasetId: string, versionNumber: number): Promise<DatasetVersion> {
    const id = generateId("ver");
    const now = new Date().toISOString();
    const ver: DatasetVersion = {
      id,
      datasetId,
      versionNumber,
      status: "queued",
      schema: null,
      totalFiles: 0,
      processedFiles: 0,
      totalRecords: 0,
      errorCount: 0,
      createdAt: now,
    };
    this.versions.set(id, ver);

    // Update dataset updatedAt
    const ds = this.datasets.get(datasetId);
    if (ds) {
      ds.updatedAt = now;
    }

    return ver;
  }

  async updateVersion(id: string, updates: Partial<DatasetVersion>): Promise<DatasetVersion> {
    const existing = this.versions.get(id);
    if (!existing) throw new Error(`Verzija ${id} ne postoji.`);
    const updated = { ...existing, ...updates };
    this.versions.set(id, updated);
    return updated;
  }

  // Files
  async createSourceFile(file: Omit<SourceFile, "id" | "createdAt">): Promise<SourceFile> {
    const id = generateId("file");
    const sf: SourceFile = {
      ...file,
      id,
      createdAt: new Date().toISOString(),
    };
    this.files.set(id, sf);
    return sf;
  }

  async listSourceFiles(versionId: string): Promise<SourceFile[]> {
    return Array.from(this.files.values()).filter((f) => f.datasetVersionId === versionId);
  }

  async getSourceFile(id: string): Promise<SourceFile | null> {
    return this.files.get(id) || null;
  }

  async updateSourceFile(id: string, updates: Partial<SourceFile>): Promise<SourceFile> {
    const existing = this.files.get(id);
    if (!existing) throw new Error(`Fajl ${id} ne postoji.`);
    const updated = { ...existing, ...updates };
    this.files.set(id, updated);
    return updated;
  }

  // Fragments
  async createFragments(frags: FileFragment[]): Promise<void> {
    if (frags.length === 0) return;
    const fileId = frags[0].sourceFileId;
    const list = this.fragments.get(fileId) || [];
    this.fragments.set(fileId, [...list, ...frags]);
  }

  async listFragments(fileId: string): Promise<FileFragment[]> {
    return this.fragments.get(fileId) || [];
  }

  // Snapshots
  async createSnapshot(
    snapshot: Omit<AnalyticsSnapshot, "id" | "createdAt">
  ): Promise<AnalyticsSnapshot> {
    const id = generateId("snap");
    const s: AnalyticsSnapshot = {
      ...snapshot,
      id,
      createdAt: new Date().toISOString(),
    };
    const list = this.snapshots.get(s.datasetVersionId) || [];
    list.unshift(s);
    this.snapshots.set(s.datasetVersionId, list);
    return s;
  }

  async getLatestSnapshot(versionId: string): Promise<AnalyticsSnapshot | null> {
    const list = this.snapshots.get(versionId);
    return list && list.length > 0 ? list[0] : null;
  }

  async listSnapshots(versionId: string): Promise<AnalyticsSnapshot[]> {
    return this.snapshots.get(versionId) || [];
  }

  // Parsed records
  async saveParsedRecords(versionId: string, records: Record<string, unknown>[]): Promise<void> {
    const existing = this.parsedRecords.get(versionId) || [];
    this.parsedRecords.set(versionId, [...existing, ...records]);
  }

  async getParsedRecords(versionId: string): Promise<Record<string, unknown>[]> {
    return this.parsedRecords.get(versionId) || [];
  }

  // Chat
  async listChatMessages(versionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(versionId) || [];
  }

  async saveChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage> {
    const id = generateId("msg");
    const m: ChatMessage = {
      ...msg,
      id,
      createdAt: new Date().toISOString(),
    };
    const list = this.chatMessages.get(msg.datasetVersionId) || [];
    list.push(m);
    this.chatMessages.set(msg.datasetVersionId, list);
    return m;
  }

  // Audit
  async logAuditEvent(event: {
    eventType: string;
    entityType: string;
    entityId?: string;
    payload?: unknown;
  }): Promise<void> {
    this.auditEvents.push({
      id: generateId("audit"),
      ...event,
      createdAt: new Date().toISOString(),
    });
  }
}
