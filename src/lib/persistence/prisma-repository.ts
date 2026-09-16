import { PrismaClient } from "@prisma/client";
import {
  AnalyticsSnapshot,
  ChatMessage,
  Dataset,
  DatasetVersion,
  FileFragment,
  SourceFile,
} from "../domain/types";
import { IRepository } from "./repository";

// Global prisma client to prevent connection exhaustion in dev hot-reload
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export class PrismaRepository implements IRepository {
  // In-memory fallback map for parsed records in MVP (DuckDB/DataFusion can replace this later)
  private parsedRecordsMap = new Map<string, Record<string, unknown>[]>();

  async listDatasets(): Promise<Dataset[]> {
    const list = await prisma.dataset.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return list.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description || undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async getDataset(id: string): Promise<Dataset | null> {
    const d = await prisma.dataset.findUnique({ where: { id } });
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      description: d.description || undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async createDataset(name: string, description?: string): Promise<Dataset> {
    const d = await prisma.dataset.create({
      data: { name, description },
    });
    return {
      id: d.id,
      name: d.name,
      description: d.description || undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  async deleteDataset(id: string): Promise<void> {
    await prisma.dataset.delete({
      where: { id },
    });
  }

  async listVersions(datasetId: string): Promise<DatasetVersion[]> {
    const list = await prisma.datasetVersion.findMany({
      where: { datasetId },
      orderBy: { versionNumber: "desc" },
    });
    return list.map(this.mapVersion);
  }

  async getVersion(id: string): Promise<DatasetVersion | null> {
    const v = await prisma.datasetVersion.findUnique({ where: { id } });
    return v ? this.mapVersion(v) : null;
  }

  async getLatestVersion(datasetId: string): Promise<DatasetVersion | null> {
    const v = await prisma.datasetVersion.findFirst({
      where: { datasetId },
      orderBy: { versionNumber: "desc" },
    });
    return v ? this.mapVersion(v) : null;
  }

  async createVersion(datasetId: string, versionNumber: number): Promise<DatasetVersion> {
    const v = await prisma.datasetVersion.create({
      data: {
        datasetId,
        versionNumber,
        status: "queued",
      },
    });
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { updatedAt: new Date() },
    });
    return this.mapVersion(v);
  }

  async updateVersion(id: string, updates: Partial<DatasetVersion>): Promise<DatasetVersion> {
    const data: any = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.schema !== undefined) data.schemaJson = JSON.stringify(updates.schema);
    if (updates.schemaHash !== undefined) data.schemaHash = updates.schemaHash;
    if (updates.totalFiles !== undefined) data.totalFiles = updates.totalFiles;
    if (updates.processedFiles !== undefined) data.processedFiles = updates.processedFiles;
    if (updates.totalRecords !== undefined) data.totalRecords = updates.totalRecords;
    if (updates.errorCount !== undefined) data.errorCount = updates.errorCount;
    if (updates.completedAt !== undefined)
      data.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;

    const v = await prisma.datasetVersion.update({
      where: { id },
      data,
    });
    return this.mapVersion(v);
  }

  async createSourceFile(file: Omit<SourceFile, "id" | "createdAt">): Promise<SourceFile> {
    const f = await prisma.sourceFile.create({
      data: {
        datasetVersionId: file.datasetVersionId,
        originalName: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        sizeBytes: BigInt(file.sizeBytes),
        checksum: file.checksum,
        status: file.status,
        storageKey: file.storageKey,
        errorMessage: file.errorMessage,
      },
    });
    return this.mapFile(f);
  }

  async listSourceFiles(versionId: string): Promise<SourceFile[]> {
    const list = await prisma.sourceFile.findMany({
      where: { datasetVersionId: versionId },
      orderBy: { createdAt: "asc" },
    });
    return list.map(this.mapFile);
  }

  async getSourceFile(id: string): Promise<SourceFile | null> {
    const f = await prisma.sourceFile.findUnique({ where: { id } });
    return f ? this.mapFile(f) : null;
  }

  async updateSourceFile(id: string, updates: Partial<SourceFile>): Promise<SourceFile> {
    const data: any = {};
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.errorMessage !== undefined) data.errorMessage = updates.errorMessage;
    if (updates.storageKey !== undefined) data.storageKey = updates.storageKey;

    const f = await prisma.sourceFile.update({
      where: { id },
      data,
    });
    return this.mapFile(f);
  }

  async createFragments(fragments: FileFragment[]): Promise<void> {
    if (fragments.length === 0) return;
    await prisma.fileFragment.createMany({
      data: fragments.map((fr) => ({
        id: fr.id,
        sourceFileId: fr.sourceFileId,
        index: fr.index,
        recordStart: fr.recordStart,
        recordEnd: fr.recordEnd,
        recordCount: fr.recordCount,
        byteStart: fr.byteStart !== undefined ? BigInt(fr.byteStart) : null,
        byteEnd: fr.byteEnd !== undefined ? BigInt(fr.byteEnd) : null,
        status: fr.status,
        createdAt: new Date(fr.createdAt),
      })),
    });
  }

  async listFragments(fileId: string): Promise<FileFragment[]> {
    const list = await prisma.fileFragment.findMany({
      where: { sourceFileId: fileId },
      orderBy: { index: "asc" },
    });
    return list.map((fr) => ({
      id: fr.id,
      sourceFileId: fr.sourceFileId,
      index: fr.index,
      recordStart: fr.recordStart,
      recordEnd: fr.recordEnd,
      recordCount: fr.recordCount,
      byteStart: fr.byteStart ? Number(fr.byteStart) : undefined,
      byteEnd: fr.byteEnd ? Number(fr.byteEnd) : undefined,
      status: fr.status as any,
      createdAt: fr.createdAt.toISOString(),
    }));
  }

  async createSnapshot(
    snapshot: Omit<AnalyticsSnapshot, "id" | "createdAt">
  ): Promise<AnalyticsSnapshot> {
    const s = await prisma.analyticsSnapshot.create({
      data: {
        datasetVersionId: snapshot.datasetVersionId,
        sourceFileId: snapshot.sourceFileId,
        periodStart: snapshot.periodStart ? new Date(snapshot.periodStart) : null,
        periodEnd: snapshot.periodEnd ? new Date(snapshot.periodEnd) : null,
        granularity: snapshot.granularity || "all",
        recordCount: snapshot.recordCount,
        duplicateCount: snapshot.duplicateCount || 0,
        invalidRecordCount: snapshot.invalidRecordCount,
        columnStatsJson: JSON.stringify(snapshot.columnStats),
      },
    });
    return this.mapSnapshot(s);
  }

  async getLatestSnapshot(versionId: string): Promise<AnalyticsSnapshot | null> {
    const s = await prisma.analyticsSnapshot.findFirst({
      where: { datasetVersionId: versionId },
      orderBy: { createdAt: "desc" },
    });
    return s ? this.mapSnapshot(s) : null;
  }

  async listSnapshots(versionId: string): Promise<AnalyticsSnapshot[]> {
    const list = await prisma.analyticsSnapshot.findMany({
      where: { datasetVersionId: versionId },
      orderBy: { createdAt: "desc" },
    });
    return list.map(this.mapSnapshot);
  }

  async saveParsedRecords(versionId: string, records: Record<string, unknown>[]): Promise<void> {
    const existing = this.parsedRecordsMap.get(versionId) || [];
    this.parsedRecordsMap.set(versionId, [...existing, ...records]);
  }

  async getParsedRecords(versionId: string): Promise<Record<string, unknown>[]> {
    return this.parsedRecordsMap.get(versionId) || [];
  }

  async listChatMessages(versionId: string): Promise<ChatMessage[]> {
    const session = await prisma.chatSession.findFirst({
      where: { datasetVersionId: versionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!session) return [];
    return session.messages.map((m) => ({
      id: m.id,
      datasetVersionId: versionId,
      role: m.role as any,
      content: m.content,
      queryPlan: m.queryPlanJson ? JSON.parse(m.queryPlanJson) : undefined,
      citations: m.citationsJson ? JSON.parse(m.citationsJson) : [],
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async saveChatMessage(msg: Omit<ChatMessage, "id" | "createdAt">): Promise<ChatMessage> {
    let session = await prisma.chatSession.findFirst({
      where: { datasetVersionId: msg.datasetVersionId },
    });
    if (!session) {
      session = await prisma.chatSession.create({
        data: { datasetVersionId: msg.datasetVersionId },
      });
    }

    const m = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        role: msg.role,
        content: msg.content,
        queryPlanJson: msg.queryPlan ? JSON.stringify(msg.queryPlan) : null,
        citationsJson: msg.citations ? JSON.stringify(msg.citations) : null,
      },
    });

    return {
      id: m.id,
      datasetVersionId: msg.datasetVersionId,
      role: m.role as any,
      content: m.content,
      queryPlan: msg.queryPlan,
      citations: msg.citations,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async logAuditEvent(event: {
    eventType: string;
    entityType: string;
    entityId?: string;
    payload?: unknown;
  }): Promise<void> {
    await prisma.auditEvent.create({
      data: {
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        payloadJson: event.payload ? JSON.stringify(event.payload) : null,
      },
    });
  }

  private mapVersion(v: any): DatasetVersion {
    return {
      id: v.id,
      datasetId: v.datasetId,
      versionNumber: v.versionNumber,
      status: v.status as any,
      schema: v.schemaJson ? JSON.parse(v.schemaJson) : null,
      schemaHash: v.schemaHash || undefined,
      totalFiles: v.totalFiles,
      processedFiles: v.processedFiles,
      totalRecords: v.totalRecords,
      errorCount: v.errorCount,
      createdAt: v.createdAt.toISOString(),
      completedAt: v.completedAt ? v.completedAt.toISOString() : undefined,
    };
  }

  private mapFile(f: any): SourceFile {
    return {
      id: f.id,
      datasetVersionId: f.datasetVersionId,
      originalName: f.originalName,
      fileType: f.fileType as any,
      mimeType: f.mimeType || undefined,
      sizeBytes: Number(f.sizeBytes),
      checksum: f.checksum || undefined,
      status: f.status as any,
      storageKey: f.storageKey || undefined,
      errorMessage: f.errorMessage || undefined,
      createdAt: f.createdAt.toISOString(),
    };
  }

  private mapSnapshot(s: any): AnalyticsSnapshot {
    return {
      id: s.id,
      datasetVersionId: s.datasetVersionId,
      sourceFileId: s.sourceFileId || undefined,
      periodStart: s.periodStart ? s.periodStart.toISOString() : undefined,
      periodEnd: s.periodEnd ? s.periodEnd.toISOString() : undefined,
      granularity: s.granularity || "all",
      recordCount: s.recordCount,
      duplicateCount: s.duplicateCount ?? undefined,
      invalidRecordCount: s.invalidRecordCount,
      columnStats: s.columnStatsJson ? JSON.parse(s.columnStatsJson) : [],
      createdAt: s.createdAt.toISOString(),
    };
  }
}
