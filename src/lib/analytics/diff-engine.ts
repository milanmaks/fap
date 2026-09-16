import {
  AnalyticsSnapshot,
  ColumnDiff,
  ColumnStatistics,
  DatasetVersion,
  KpiDelta,
  RecordLineage,
  RecordWithLineage,
  RowComparisonClassification,
  SourceFile,
  VersionDiff,
} from "../domain/types";
import {
  computeBusinessKeyHash,
  computeCanonicalRecordHash,
  getNestedValue,
  roundCoordinate,
} from "./hash-utils";
import { profileRecords } from "../ingestion/profiler";

export interface CompareVersionsInput {
  datasetId: string;
  baseVersion: DatasetVersion;
  targetVersion: DatasetVersion;
  baseFiles: SourceFile[];
  targetFiles: SourceFile[];
  baseRecords: RecordWithLineage[];
  targetRecords: RecordWithLineage[];
  baseSnapshot: AnalyticsSnapshot;
  targetSnapshot: AnalyticsSnapshot;
  options?: {
    maxExamples?: number;
    nullRateWarningDelta?: number; // default 5.0 (percentage points)
    nullRateCriticalDelta?: number; // default 25.0 (percentage points)
  };
}

function calcKpiDelta(before: number, after: number): KpiDelta {
  const absoluteDelta = after - before;
  const percentDelta =
    before === 0 ? (after === 0 ? 0 : null) : (absoluteDelta / before) * 100;
  return {
    before,
    after,
    absoluteDelta,
    percentDelta: percentDelta !== null ? Math.round(percentDelta * 100) / 100 : null,
  };
}

function extractTimestampMs(rec: Record<string, unknown>): number | null {
  const raw =
    getNestedValue(rec, "time.timestamp") ??
    getNestedValue(rec, "time") ??
    getNestedValue(rec, "observedWindowStartTimestampMs");
  if (typeof raw === "number" && !isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) return parsed;
    const num = Number(raw);
    if (!isNaN(num)) return num;
  }
  return null;
}

function extractDeviceIds(records: RecordWithLineage[]): Set<string> {
  const devices = new Set<string>();
  for (const r of records) {
    const dev = getNestedValue(r, "instanceId") ?? getNestedValue(r, "deviceId");
    if (dev !== null && dev !== undefined) {
      devices.add(String(dev));
    }
  }
  return devices;
}

function extractSpatialKeys(records: RecordWithLineage[]): Set<string> {
  const keys = new Set<string>();
  for (const r of records) {
    const rawH3 = getNestedValue(r, "locationSnapshot.h3Index");
    if (rawH3 !== null && rawH3 !== undefined && String(rawH3).trim()) {
      keys.add(`h3:${String(rawH3)}`);
      continue;
    }
    const lat = roundCoordinate(getNestedValue(r, "locationSnapshot.lat"), 3);
    const lng = roundCoordinate(getNestedValue(r, "locationSnapshot.lng"), 3);
    if (lat && lng) {
      keys.add(`grid:${lat},${lng}`);
    }
  }
  return keys;
}

function extractTimeRange(records: RecordWithLineage[]): { min: number; max: number } | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const r of records) {
    const ts = extractTimestampMs(r);
    if (ts !== null) {
      if (min === null || ts < min) min = ts;
      if (max === null || ts > max) max = ts;
    }
  }
  if (min === null || max === null) return null;
  return { min, max };
}

export function compareVersions(input: CompareVersionsInput): VersionDiff {
  const {
    datasetId,
    baseVersion,
    targetVersion,
    baseFiles,
    targetFiles,
    baseRecords,
    targetRecords,
    baseSnapshot,
    targetSnapshot,
    options = {},
  } = input;

  const maxExamples = options.maxExamples ?? 20;
  const nullRateWarn = options.nullRateWarningDelta ?? 5.0;
  const nullRateCrit = options.nullRateCriticalDelta ?? 25.0;

  // 1. Exact File Checksums Overlap
  const baseChecksums = new Set(baseFiles.map((f) => f.checksum).filter(Boolean));
  let exactFilesCount = 0;
  for (const tf of targetFiles) {
    if (tf.checksum && baseChecksums.has(tf.checksum)) {
      exactFilesCount++;
    }
  }

  // 2. Hash Maps for Base Records
  const baseCanonicalMap = new Map<string, RecordWithLineage>(); // canonicalHash -> record
  const baseBusinessKeyMap = new Map<string, RecordWithLineage>(); // businessKeyHash -> record

  for (const r of baseRecords) {
    const cHash = computeCanonicalRecordHash(r);
    baseCanonicalMap.set(cHash, r);

    const bHash = computeBusinessKeyHash(r);
    if (bHash) {
      baseBusinessKeyMap.set(bHash, r);
    }
  }

  // 3. Classify Target Records
  let exactDuplicateRecords = 0;
  let changedRecords = 0;
  let newRecords = 0;

  const matchedBaseBusinessKeys = new Set<string>();
  const recordExamples: VersionDiff["recordExamples"] = [];

  for (let i = 0; i < targetRecords.length; i++) {
    const r = targetRecords[i];
    const cHash = computeCanonicalRecordHash(r);
    const bHash = computeBusinessKeyHash(r);

    let classification: RowComparisonClassification;
    let prevRecord: Record<string, unknown> | undefined;

    if (baseCanonicalMap.has(cHash)) {
      classification = "exact_duplicate";
      exactDuplicateRecords++;
      if (bHash) matchedBaseBusinessKeys.add(bHash);
      prevRecord = baseCanonicalMap.get(cHash);
    } else if (bHash && baseBusinessKeyMap.has(bHash)) {
      classification = "changed";
      changedRecords++;
      matchedBaseBusinessKeys.add(bHash);
      prevRecord = baseBusinessKeyMap.get(bHash);
    } else {
      classification = "new";
      newRecords++;
    }

    if (recordExamples.length < maxExamples) {
      const lineage: RecordLineage = {
        datasetVersionId: targetVersion.id,
        sourceFileId: r._fap_source_file_id,
        sourceFileName: r._fap_source_file_name,
        recordIndex: i,
      };

      recordExamples.push({
        classification,
        businessKeyHash: bHash ?? undefined,
        canonicalHash: cHash,
        previous: prevRecord,
        current: r,
        lineage,
      });
    }
  }

  // Calculate removed records from base version
  let removedRecords = 0;
  for (const [bKey, baseRec] of baseBusinessKeyMap.entries()) {
    if (!matchedBaseBusinessKeys.has(bKey)) {
      removedRecords++;
      if (recordExamples.length < maxExamples) {
        recordExamples.push({
          classification: "removed_from_current_version",
          businessKeyHash: bKey,
          previous: baseRec,
          lineage: {
            datasetVersionId: baseVersion.id,
            sourceFileId: baseRec._fap_source_file_id,
            sourceFileName: baseRec._fap_source_file_name,
          },
        });
      }
    }
  }

  // 4. Temporal, Spatial, Device Overlap
  const baseTime = extractTimeRange(baseRecords);
  const targetTime = extractTimeRange(targetRecords);
  let temporalOverlapPercent: number | null = null;

  if (baseTime && targetTime) {
    const overlapStart = Math.max(baseTime.min, targetTime.min);
    const overlapEnd = Math.min(baseTime.max, targetTime.max);
    const targetDuration = targetTime.max - targetTime.min;

    if (overlapEnd >= overlapStart && targetDuration > 0) {
      const overlapDuration = overlapEnd - overlapStart;
      temporalOverlapPercent = Math.min(
        100,
        Math.round((overlapDuration / targetDuration) * 10000) / 100
      );
    } else {
      temporalOverlapPercent = 0;
    }
  }

  const baseDevices = extractDeviceIds(baseRecords);
  const targetDevices = extractDeviceIds(targetRecords);
  let deviceOverlapPercent: number | null = null;
  if (targetDevices.size > 0 && baseDevices.size > 0) {
    let sharedDevices = 0;
    for (const d of targetDevices) {
      if (baseDevices.has(d)) sharedDevices++;
    }
    deviceOverlapPercent =
      Math.round((sharedDevices / targetDevices.size) * 10000) / 100;
  }

  const baseSpatial = extractSpatialKeys(baseRecords);
  const targetSpatial = extractSpatialKeys(targetRecords);
  let spatialOverlapPercent: number | null = null;
  if (targetSpatial.size > 0 && baseSpatial.size > 0) {
    let sharedSpatial = 0;
    for (const s of targetSpatial) {
      if (baseSpatial.has(s)) sharedSpatial++;
    }
    spatialOverlapPercent =
      Math.round((sharedSpatial / targetSpatial.size) * 10000) / 100;
  }

  // 5. Schema Drift Analysis
  const baseCols = new Map<string, ColumnStatistics>(
    baseSnapshot.columnStats.map((c) => [c.path, c])
  );
  const targetCols = new Map<string, ColumnStatistics>(
    targetSnapshot.columnStats.map((c) => [c.path, c])
  );

  const schemaDrift: ColumnDiff[] = [];

  // Check added or modified columns
  for (const [path, tCol] of targetCols.entries()) {
    const bCol = baseCols.get(path);
    if (!bCol) {
      schemaDrift.push({
        columnPath: path,
        changeType: "added",
        severity: "info",
        after: tCol.inferredType,
        explanation: `Nova kolona '${path}' detektovana u novoj verziji (tip: ${tCol.inferredType}).`,
      });
      continue;
    }

    // Type changed
    if (bCol.inferredType !== tCol.inferredType) {
      schemaDrift.push({
        columnPath: path,
        changeType: "type_changed",
        severity: "critical",
        before: bCol.inferredType,
        after: tCol.inferredType,
        explanation: `Izmenjen tip kolone: '${bCol.inferredType}' → '${tCol.inferredType}'.`,
      });
    }

    // Null rate changed
    const bNullRate =
      baseSnapshot.recordCount > 0
        ? (bCol.nullCount / baseSnapshot.recordCount) * 100
        : 0;
    const tNullRate =
      targetSnapshot.recordCount > 0
        ? (tCol.nullCount / targetSnapshot.recordCount) * 100
        : 0;
    const deltaNullRate = tNullRate - bNullRate;

    if (deltaNullRate > nullRateWarn) {
      schemaDrift.push({
        columnPath: path,
        changeType: "null_rate_changed",
        severity: deltaNullRate > nullRateCrit ? "critical" : "warning",
        before: Math.round(bNullRate * 10) / 10,
        after: Math.round(tNullRate * 10) / 10,
        absoluteDelta: Math.round(deltaNullRate * 10) / 10,
        explanation: `Stopa praznih vrednosti porasla za ${Math.round(deltaNullRate * 10) / 10} pp (${Math.round(bNullRate)}% → ${Math.round(tNullRate)}%).`,
      });
    }

    // Numeric range or average changed
    if (
      tCol.inferredType === "number" &&
      bCol.inferredType === "number" &&
      bCol.average !== undefined &&
      tCol.average !== undefined
    ) {
      const avgDelta = tCol.average - bCol.average;
      const pctAvgDelta = bCol.average !== 0 ? Math.abs((avgDelta / bCol.average) * 100) : 0;
      if (pctAvgDelta > 20) {
        schemaDrift.push({
          columnPath: path,
          changeType: "average_changed",
          severity: "warning",
          before: bCol.average,
          after: tCol.average,
          absoluteDelta: Math.round(avgDelta * 100) / 100,
          percentDelta: Math.round(pctAvgDelta * 10) / 10,
          explanation: `Značajna promena prosečne vrednosti sa ${bCol.average.toFixed(2)} na ${tCol.average.toFixed(2)}.`,
        });
      }
    }

    // Cardinality changed significantly
    if (bCol.distinctEstimate > 0 && tCol.distinctEstimate > 0) {
      const cardDelta = tCol.distinctEstimate - bCol.distinctEstimate;
      const cardPct = (cardDelta / bCol.distinctEstimate) * 100;
      if (Math.abs(cardPct) > 50 && Math.abs(cardDelta) >= 5) {
        schemaDrift.push({
          columnPath: path,
          changeType: "cardinality_changed",
          severity: "info",
          before: bCol.distinctEstimate,
          after: tCol.distinctEstimate,
          absoluteDelta: cardDelta,
          percentDelta: Math.round(cardPct * 10) / 10,
          explanation: `Kardinalnost promenjena sa ~${bCol.distinctEstimate} na ~${tCol.distinctEstimate} (${cardPct > 0 ? "+" : ""}${Math.round(cardPct)}%).`,
        });
      }
    }
  }

  // Check removed columns
  for (const [path, bCol] of baseCols.entries()) {
    if (!targetCols.has(path)) {
      schemaDrift.push({
        columnPath: path,
        changeType: "removed",
        severity: "critical",
        before: bCol.inferredType,
        explanation: `Kolona '${path}' je uklonjena u novoj verziji (prethodno tip: ${bCol.inferredType}).`,
      });
    }
  }

  // 6. Global KPIs
  const baseTotalCells = baseSnapshot.recordCount * (baseSnapshot.columnStats.length || 1);
  const baseNullCells = baseSnapshot.columnStats.reduce((acc, c) => acc + c.nullCount, 0);
  const baseGlobalNullRate = baseTotalCells > 0 ? (baseNullCells / baseTotalCells) * 100 : 0;

  const targetTotalCells = targetSnapshot.recordCount * (targetSnapshot.columnStats.length || 1);
  const targetNullCells = targetSnapshot.columnStats.reduce((acc, c) => acc + c.nullCount, 0);
  const targetGlobalNullRate =
    targetTotalCells > 0 ? (targetNullCells / targetTotalCells) * 100 : 0;

  return {
    datasetId,
    baseVersionId: baseVersion.id,
    targetVersionId: targetVersion.id,
    comparisonType: "versions",
    baseLabel: `v${baseVersion.versionNumber}`,
    targetLabel: `v${targetVersion.versionNumber}`,
    generatedAt: new Date().toISOString(),
    kpis: {
      recordCount: calcKpiDelta(baseVersion.totalRecords, targetVersion.totalRecords),
      fileCount: calcKpiDelta(baseFiles.length, targetFiles.length),
      columnCount: calcKpiDelta(
        baseSnapshot.columnStats.length,
        targetSnapshot.columnStats.length
      ),
      overallNullRate: calcKpiDelta(
        Math.round(baseGlobalNullRate * 10) / 10,
        Math.round(targetGlobalNullRate * 10) / 10
      ),
      duplicateCount: calcKpiDelta(
        baseSnapshot.duplicateCount || 0,
        targetSnapshot.duplicateCount || 0
      ),
      uniqueDeviceCount:
        baseDevices.size > 0 || targetDevices.size > 0
          ? calcKpiDelta(baseDevices.size, targetDevices.size)
          : undefined,
      timeRange: {
        base: baseTime
          ? {
              start: new Date(baseTime.min).toISOString(),
              end: new Date(baseTime.max).toISOString(),
            }
          : undefined,
        target: targetTime
          ? {
              start: new Date(targetTime.min).toISOString(),
              end: new Date(targetTime.max).toISOString(),
            }
          : undefined,
      },
    },
    schemaDrift,
    overlap: {
      exactFiles: exactFilesCount,
      exactDuplicateRecords,
      overlappingRecords: exactDuplicateRecords + changedRecords,
      changedRecords,
      newRecords,
      removedRecords,
      temporalOverlapPercent,
      spatialOverlapPercent,
      deviceOverlapPercent,
    },
    recordExamples,
  };
}

export interface CompareFilesInput {
  datasetId: string;
  fileA: SourceFile;
  fileB: SourceFile;
  recordsA: RecordWithLineage[];
  recordsB: RecordWithLineage[];
  options?: {
    maxExamples?: number;
    nullRateWarningDelta?: number;
    nullRateCriticalDelta?: number;
  };
}

export function compareFiles(input: CompareFilesInput): VersionDiff {
  const { datasetId, fileA, fileB, recordsA, recordsB, options = {} } = input;

  const maxExamples = options.maxExamples ?? 20;
  const nullRateWarn = options.nullRateWarningDelta ?? 5.0;
  const nullRateCrit = options.nullRateCriticalDelta ?? 25.0;

  // 1. Exact File Checksums Overlap
  const exactFilesCount =
    fileA.checksum && fileB.checksum && fileA.checksum === fileB.checksum ? 1 : 0;

  // 2. Hash Maps for File A Records
  const baseCanonicalMap = new Map<string, RecordWithLineage>();
  const baseBusinessKeyMap = new Map<string, RecordWithLineage>();

  for (const r of recordsA) {
    const cHash = computeCanonicalRecordHash(r);
    baseCanonicalMap.set(cHash, r);

    const bHash = computeBusinessKeyHash(r);
    if (bHash) {
      baseBusinessKeyMap.set(bHash, r);
    }
  }

  // 3. Classify File B records
  const targetCanonicalSet = new Set<string>();
  const targetBusinessKeyMap = new Map<string, RecordWithLineage>();

  let exactDuplicateRecords = 0;
  let changedRecords = 0;
  let newRecords = 0;

  const recordExamples: VersionDiff["recordExamples"] = [];

  for (let idx = 0; idx < recordsB.length; idx++) {
    const r = recordsB[idx];
    const cHash = computeCanonicalRecordHash(r);
    targetCanonicalSet.add(cHash);

    const bHash = computeBusinessKeyHash(r);
    if (bHash) {
      targetBusinessKeyMap.set(bHash, r);
    }

    let classification: RowComparisonClassification;
    let prevRecord: Record<string, unknown> | undefined = undefined;

    if (baseCanonicalMap.has(cHash)) {
      exactDuplicateRecords++;
      classification = "exact_duplicate";
      prevRecord = baseCanonicalMap.get(cHash);
    } else if (bHash && baseBusinessKeyMap.has(bHash)) {
      changedRecords++;
      classification = "changed";
      prevRecord = baseBusinessKeyMap.get(bHash);
    } else {
      newRecords++;
      classification = "new";
    }

    if (recordExamples.length < maxExamples) {
      recordExamples.push({
        classification,
        canonicalHash: cHash,
        businessKeyHash: bHash || undefined,
        previous: prevRecord,
        current: r,
        lineage: {
          datasetVersionId: fileB.datasetVersionId,
          sourceFileId: fileB.id,
          sourceFileName: fileB.originalName,
          recordIndex: idx,
        },
      });
    }
  }

  // 4. Removed records (present in A, but neither canonical nor business key in B)
  let removedRecords = 0;
  for (let idx = 0; idx < recordsA.length; idx++) {
    const r = recordsA[idx];
    const cHash = computeCanonicalRecordHash(r);
    const bHash = computeBusinessKeyHash(r);

    if (!targetCanonicalSet.has(cHash) && (!bHash || !targetBusinessKeyMap.has(bHash))) {
      removedRecords++;
      if (recordExamples.length < maxExamples) {
        recordExamples.push({
          classification: "removed_from_current_version",
          canonicalHash: cHash,
          businessKeyHash: bHash || undefined,
          previous: r,
          current: undefined,
          lineage: {
            datasetVersionId: fileA.datasetVersionId,
            sourceFileId: fileA.id,
            sourceFileName: fileA.originalName,
            recordIndex: idx,
          },
        });
      }
    }
  }

  // 5. Overlap metrics
  const baseTime = extractTimeRange(recordsA);
  const targetTime = extractTimeRange(recordsB);
  let temporalOverlapPercent: number | null = null;
  if (baseTime && targetTime) {
    const overlapMin = Math.max(baseTime.min, targetTime.min);
    const overlapMax = Math.min(baseTime.max, targetTime.max);
    if (overlapMax >= overlapMin) {
      const overlapDuration = overlapMax - overlapMin;
      const unionDuration =
        Math.max(baseTime.max, targetTime.max) - Math.min(baseTime.min, targetTime.min);
      temporalOverlapPercent =
        unionDuration > 0
          ? Math.round((overlapDuration / unionDuration) * 1000) / 10
          : 100;
    } else {
      temporalOverlapPercent = 0;
    }
  }

  const baseSpatial = extractSpatialKeys(recordsA);
  const targetSpatial = extractSpatialKeys(recordsB);
  let spatialOverlapPercent: number | null = null;
  if (baseSpatial.size > 0 || targetSpatial.size > 0) {
    let intersection = 0;
    for (const k of targetSpatial) {
      if (baseSpatial.has(k)) intersection++;
    }
    const union = new Set([...baseSpatial, ...targetSpatial]).size;
    spatialOverlapPercent = union > 0 ? Math.round((intersection / union) * 1000) / 10 : 0;
  }

  const baseDevices = extractDeviceIds(recordsA);
  const targetDevices = extractDeviceIds(recordsB);
  let deviceOverlapPercent: number | null = null;
  if (baseDevices.size > 0 || targetDevices.size > 0) {
    let intersection = 0;
    for (const d of targetDevices) {
      if (baseDevices.has(d)) intersection++;
    }
    const union = new Set([...baseDevices, ...targetDevices]).size;
    deviceOverlapPercent = union > 0 ? Math.round((intersection / union) * 1000) / 10 : 0;
  }

  // 6. Profiles & Schema drift
  const snapshotA = profileRecords(recordsA, 0);
  const snapshotB = profileRecords(recordsB, 0);

  const baseColsMap = new Map<string, ColumnStatistics>(
    snapshotA.columnStats.map((c) => [c.path, c])
  );
  const targetColsMap = new Map<string, ColumnStatistics>(
    snapshotB.columnStats.map((c) => [c.path, c])
  );

  const schemaDrift: ColumnDiff[] = [];

  for (const [path, tCol] of targetColsMap.entries()) {
    const bCol = baseColsMap.get(path);
    if (!bCol) {
      schemaDrift.push({
        columnPath: path,
        changeType: "added",
        severity: "info",
        before: undefined,
        after: tCol.inferredType,
        explanation: `Kolona '${path}' postoji u fajlu '${fileB.originalName}', ali ne u '${fileA.originalName}'.`,
      });
      continue;
    }

    if (
      bCol.inferredType !== tCol.inferredType &&
      bCol.inferredType !== "null" &&
      tCol.inferredType !== "null"
    ) {
      schemaDrift.push({
        columnPath: path,
        changeType: "type_changed",
        severity: "critical",
        before: bCol.inferredType,
        after: tCol.inferredType,
        explanation: `Tip kolone promenjen iz '${bCol.inferredType}' u '${tCol.inferredType}'.`,
      });
    }

    const bNullRate = recordsA.length > 0 ? (bCol.nullCount / recordsA.length) * 100 : 0;
    const tNullRate = recordsB.length > 0 ? (tCol.nullCount / recordsB.length) * 100 : 0;
    const nullDelta = Math.round((tNullRate - bNullRate) * 10) / 10;

    if (Math.abs(nullDelta) >= nullRateWarn) {
      const severity = Math.abs(nullDelta) >= nullRateCrit ? "critical" : "warning";
      schemaDrift.push({
        columnPath: path,
        changeType: "null_rate_changed",
        severity,
        before: Math.round(bNullRate * 10) / 10,
        after: Math.round(tNullRate * 10) / 10,
        absoluteDelta: nullDelta,
        explanation: `Null stopa je promenjena sa ${bNullRate.toFixed(1)}% na ${tNullRate.toFixed(1)}% (${nullDelta > 0 ? "+" : ""}${nullDelta}%).`,
      });
    }

    if (bCol.inferredType === "number" && tCol.inferredType === "number") {
      if (bCol.average !== undefined && tCol.average !== undefined) {
        const avgDiff = Math.abs(tCol.average - bCol.average);
        const relChange = bCol.average !== 0 ? (avgDiff / Math.abs(bCol.average)) * 100 : 0;
        if (relChange > 30) {
          schemaDrift.push({
            columnPath: path,
            changeType: "average_changed",
            severity: "warning",
            before: Math.round(bCol.average * 100) / 100,
            after: Math.round(tCol.average * 100) / 100,
            absoluteDelta: Math.round((tCol.average - bCol.average) * 100) / 100,
            percentDelta: Math.round(relChange * 10) / 10,
            explanation: `Prosečna vrednost se promenila za ${relChange.toFixed(1)}% (sa ${bCol.average.toFixed(2)} na ${tCol.average.toFixed(2)}).`,
          });
        }
      }
    }
  }

  for (const [path, bCol] of baseColsMap.entries()) {
    if (!targetColsMap.has(path)) {
      schemaDrift.push({
        columnPath: path,
        changeType: "removed",
        severity: "critical",
        before: bCol.inferredType,
        after: undefined,
        explanation: `Kolona '${path}' postoji u fajlu '${fileA.originalName}', ali nedostaje u '${fileB.originalName}'.`,
      });
    }
  }

  const baseTotalCells = recordsA.length * (snapshotA.columnStats.length || 1);
  const baseNullCells = snapshotA.columnStats.reduce((acc, c) => acc + c.nullCount, 0);
  const baseGlobalNullRate = baseTotalCells > 0 ? (baseNullCells / baseTotalCells) * 100 : 0;

  const targetTotalCells = recordsB.length * (snapshotB.columnStats.length || 1);
  const targetNullCells = snapshotB.columnStats.reduce((acc, c) => acc + c.nullCount, 0);
  const targetGlobalNullRate = targetTotalCells > 0 ? (targetNullCells / targetTotalCells) * 100 : 0;

  return {
    datasetId,
    baseVersionId: fileA.id,
    targetVersionId: fileB.id,
    comparisonType: "files",
    baseLabel: fileA.originalName,
    targetLabel: fileB.originalName,
    fileAId: fileA.id,
    fileBId: fileB.id,
    generatedAt: new Date().toISOString(),
    kpis: {
      recordCount: calcKpiDelta(recordsA.length, recordsB.length),
      fileCount: calcKpiDelta(1, 1),
      columnCount: calcKpiDelta(snapshotA.columnStats.length, snapshotB.columnStats.length),
      overallNullRate: calcKpiDelta(
        Math.round(baseGlobalNullRate * 10) / 10,
        Math.round(targetGlobalNullRate * 10) / 10
      ),
      duplicateCount: calcKpiDelta(snapshotA.duplicateCount || 0, snapshotB.duplicateCount || 0),
      uniqueDeviceCount:
        baseDevices.size > 0 || targetDevices.size > 0
          ? calcKpiDelta(baseDevices.size, targetDevices.size)
          : undefined,
      timeRange: {
        base: baseTime
          ? {
              start: new Date(baseTime.min).toISOString(),
              end: new Date(baseTime.max).toISOString(),
            }
          : undefined,
        target: targetTime
          ? {
              start: new Date(targetTime.min).toISOString(),
              end: new Date(targetTime.max).toISOString(),
            }
          : undefined,
      },
    },
    schemaDrift,
    overlap: {
      exactFiles: exactFilesCount,
      exactDuplicateRecords,
      overlappingRecords: exactDuplicateRecords + changedRecords,
      changedRecords,
      newRecords,
      removedRecords,
      temporalOverlapPercent,
      spatialOverlapPercent,
      deviceOverlapPercent,
    },
    recordExamples,
  };
}
