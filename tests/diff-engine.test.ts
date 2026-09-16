import { describe, it, expect } from "vitest";
import { compareVersions, compareFiles } from "../src/lib/analytics/diff-engine";
import {
  AnalyticsSnapshot,
  DatasetVersion,
  RecordWithLineage,
  SourceFile,
} from "../src/lib/domain/types";

describe("Diff Engine - Version Comparison & Schema Drift", () => {
  const baseVersion: DatasetVersion = {
    id: "ver_1",
    datasetId: "ds_test",
    versionNumber: 1,
    status: "ready",
    schema: null,
    totalFiles: 1,
    processedFiles: 1,
    totalRecords: 2,
    errorCount: 0,
    createdAt: "2026-03-01T10:00:00Z",
  };

  const targetVersion: DatasetVersion = {
    id: "ver_2",
    datasetId: "ds_test",
    versionNumber: 2,
    status: "ready",
    schema: null,
    totalFiles: 2,
    processedFiles: 2,
    totalRecords: 3,
    errorCount: 0,
    createdAt: "2026-03-02T10:00:00Z",
  };

  const baseFiles: SourceFile[] = [
    {
      id: "f_1",
      datasetVersionId: "ver_1",
      originalName: "batch_1.avro",
      fileType: "avro",
      sizeBytes: 1000,
      checksum: "sha256_file_a",
      status: "ready",
      createdAt: "2026-03-01T10:00:00Z",
    },
  ];

  const targetFiles: SourceFile[] = [
    {
      id: "f_2",
      datasetVersionId: "ver_2",
      originalName: "batch_1.avro",
      fileType: "avro",
      sizeBytes: 1000,
      checksum: "sha256_file_a", // identical file checksum
      status: "ready",
      createdAt: "2026-03-02T10:00:00Z",
    },
    {
      id: "f_3",
      datasetVersionId: "ver_2",
      originalName: "batch_2.avro",
      fileType: "avro",
      sizeBytes: 1500,
      checksum: "sha256_file_b",
      status: "ready",
      createdAt: "2026-03-02T10:00:00Z",
    },
  ];

  const baseRecords: RecordWithLineage[] = [
    // Rec 1: exact duplicate in v2
    {
      instanceId: "device-1",
      type: "CELL_INFO",
      time: { timestamp: 1789500000000 },
      locationSnapshot: { lat: 44.81, lng: 20.45, h3Index: "617522772156088300" },
      signal: -80,
    },
    // Rec 2: will be changed in v2 (same business key, different signal)
    {
      instanceId: "device-2",
      type: "CELL_INFO",
      time: { timestamp: 1789500010000 },
      locationSnapshot: { lat: 44.82, lng: 20.46, h3Index: "617522772156088301" },
      signal: -90,
    },
    // Rec 3: removed in v2
    {
      instanceId: "device-3",
      type: "CELL_INFO",
      time: { timestamp: 1789500020000 },
      locationSnapshot: { lat: 44.83, lng: 20.47, h3Index: "617522772156088302" },
      signal: -95,
    },
  ];

  const targetRecords: RecordWithLineage[] = [
    // Exact duplicate of Rec 1
    {
      instanceId: "device-1",
      type: "CELL_INFO",
      time: { timestamp: 1789500000000 },
      locationSnapshot: { lat: 44.81, lng: 20.45, h3Index: "617522772156088300" },
      signal: -80,
    },
    // Changed version of Rec 2 (signal changed to -82)
    {
      instanceId: "device-2",
      type: "CELL_INFO",
      time: { timestamp: 1789500010000 },
      locationSnapshot: { lat: 44.82, lng: 20.46, h3Index: "617522772156088301" },
      signal: -82,
    },
    // Rec 4: Brand new in v2
    {
      instanceId: "device-4",
      type: "CELL_INFO",
      time: { timestamp: 1789500030000 },
      locationSnapshot: { lat: 44.84, lng: 20.48, h3Index: "617522772156088303" },
      signal: -75,
    },
  ];

  const baseSnapshot: AnalyticsSnapshot = {
    id: "snap_1",
    datasetVersionId: "ver_1",
    recordCount: 3,
    invalidRecordCount: 0,
    duplicateCount: 0,
    createdAt: "2026-03-01T10:00:00Z",
    columnStats: [
      { path: "instanceId", inferredType: "string", presentCount: 3, nullCount: 0, distinctEstimate: 3 },
      { path: "signal", inferredType: "number", presentCount: 3, nullCount: 0, distinctEstimate: 3, average: -88.3 },
      { path: "oldCol", inferredType: "string", presentCount: 3, nullCount: 0, distinctEstimate: 2 },
    ],
  };

  const targetSnapshot: AnalyticsSnapshot = {
    id: "snap_2",
    datasetVersionId: "ver_2",
    recordCount: 3,
    invalidRecordCount: 0,
    duplicateCount: 0,
    createdAt: "2026-03-02T10:00:00Z",
    columnStats: [
      { path: "instanceId", inferredType: "string", presentCount: 3, nullCount: 0, distinctEstimate: 3 },
      { path: "signal", inferredType: "number", presentCount: 3, nullCount: 0, distinctEstimate: 3, average: -79.0 },
      { path: "newCol", inferredType: "boolean", presentCount: 3, nullCount: 0, distinctEstimate: 2 },
    ],
  };

  it("correctly classifies rows into exact_duplicate, changed, new, and removed", () => {
    const diff = compareVersions({
      datasetId: "ds_test",
      baseVersion,
      targetVersion,
      baseFiles,
      targetFiles,
      baseRecords,
      targetRecords,
      baseSnapshot,
      targetSnapshot,
    });

    expect(diff.overlap.exactFiles).toBe(1);
    expect(diff.overlap.exactDuplicateRecords).toBe(1);
    expect(diff.overlap.changedRecords).toBe(1);
    expect(diff.overlap.newRecords).toBe(1);
    expect(diff.overlap.removedRecords).toBe(1);
    expect(diff.overlap.overlappingRecords).toBe(2); // exact (1) + changed (1)
  });

  it("detects added, removed and average_changed in schema drift with proper severities", () => {
    const diff = compareVersions({
      datasetId: "ds_test",
      baseVersion,
      targetVersion,
      baseFiles,
      targetFiles,
      baseRecords,
      targetRecords,
      baseSnapshot,
      targetSnapshot,
    });

    const added = diff.schemaDrift.find((d) => d.changeType === "added");
    expect(added).toBeDefined();
    expect(added?.columnPath).toBe("newCol");
    expect(added?.severity).toBe("info");

    const removed = diff.schemaDrift.find((d) => d.changeType === "removed");
    expect(removed).toBeDefined();
    expect(removed?.columnPath).toBe("oldCol");
    expect(removed?.severity).toBe("critical");
  });

  it("computes spatial, device and temporal overlap percentages", () => {
    const diff = compareVersions({
      datasetId: "ds_test",
      baseVersion,
      targetVersion,
      baseFiles,
      targetFiles,
      baseRecords,
      targetRecords,
      baseSnapshot,
      targetSnapshot,
    });

    expect(diff.overlap.deviceOverlapPercent).toBeGreaterThan(0);
    expect(diff.overlap.spatialOverlapPercent).toBeGreaterThan(0);
    expect(diff.overlap.temporalOverlapPercent).not.toBeNull();
  });

  it("compares two individual Avro files correctly with schema drift and overlap", () => {
    const fileA: SourceFile = {
      id: "file_cell_1",
      datasetVersionId: "ver_1",
      originalName: "export_CELL_INFO_1789578664964.avro",
      fileType: "avro",
      sizeBytes: 56600,
      checksum: "checksum_avro_a",
      status: "ready",
      createdAt: "2026-03-01T10:00:00Z",
    };

    const fileB: SourceFile = {
      id: "file_cell_2",
      datasetVersionId: "ver_1",
      originalName: "export_CELL_INFO_1789581616396.avro",
      fileType: "avro",
      sizeBytes: 38300,
      checksum: "checksum_avro_b",
      status: "ready",
      createdAt: "2026-03-01T11:00:00Z",
    };

    const recordsA: RecordWithLineage[] = [
      {
        instanceId: "dev-01",
        type: "CELL_INFO",
        time: { timestamp: 1789578666805 },
        locationSnapshot: { lat: 44.87, lng: 19.8, h3Index: "617522780852453375" },
        signalDb: -85,
      },
      {
        instanceId: "dev-01",
        type: "CELL_INFO",
        time: { timestamp: 1789578676800 },
        locationSnapshot: { lat: 44.86, lng: 19.81, h3Index: "617522780852453376" },
        signalDb: -90,
      },
    ];

    const recordsB: RecordWithLineage[] = [
      // Duplicate of first record
      {
        instanceId: "dev-01",
        type: "CELL_INFO",
        time: { timestamp: 1789578666805 },
        locationSnapshot: { lat: 44.87, lng: 19.8, h3Index: "617522780852453375" },
        signalDb: -85,
      },
      // New record in file B with an extra column
      {
        instanceId: "dev-02",
        type: "CELL_INFO",
        time: { timestamp: 1789578686784 },
        locationSnapshot: { lat: 44.85, lng: 19.82, h3Index: "617522780852453377" },
        signalDb: -78,
        lteBand: 20,
      },
    ];

    const diff = compareFiles({
      datasetId: "ds_test",
      fileA,
      fileB,
      recordsA,
      recordsB,
    });

    expect(diff.comparisonType).toBe("files");
    expect(diff.baseLabel).toBe(fileA.originalName);
    expect(diff.targetLabel).toBe(fileB.originalName);
    expect(diff.kpis.recordCount.before).toBe(2);
    expect(diff.kpis.recordCount.after).toBe(2);
    expect(diff.overlap.exactDuplicateRecords).toBe(1);
    expect(diff.overlap.newRecords).toBe(1);
    expect(diff.overlap.removedRecords).toBe(1);

    // Schema drift check: lteBand should be added in file B
    const addedCol = diff.schemaDrift.find((c) => c.columnPath === "lteBand");
    expect(addedCol).toBeDefined();
    expect(addedCol?.changeType).toBe("added");
  });
});
