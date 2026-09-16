import { describe, it, expect } from "vitest";
import { evaluateDatasetQuality } from "../src/lib/analytics/quality-engine";
import {
  AnalyticsSnapshot,
  DatasetVersion,
  RecordWithLineage,
} from "../src/lib/domain/types";

describe("Data Quality Engine", () => {
  const sampleVersion: DatasetVersion = {
    id: "ver_test",
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

  const sampleSnapshot: AnalyticsSnapshot = {
    id: "snap_test",
    datasetVersionId: "ver_test",
    recordCount: 2,
    invalidRecordCount: 0,
    duplicateCount: 0,
    createdAt: "2026-03-01T10:00:00Z",
    columnStats: [
      { path: "instanceId", inferredType: "string", presentCount: 2, nullCount: 0, distinctEstimate: 2 },
      { path: "time.timestamp", inferredType: "number", presentCount: 2, nullCount: 0, distinctEstimate: 2 },
      { path: "locationSnapshot.lat", inferredType: "number", presentCount: 2, nullCount: 0, distinctEstimate: 2 },
      { path: "locationSnapshot.lng", inferredType: "number", presentCount: 2, nullCount: 0, distinctEstimate: 2 },
      { path: "sensorSnapshot.pressureMillibars", inferredType: "null", presentCount: 0, nullCount: 2, distinctEstimate: 0 },
    ],
  };

  it("produces high score for clean telemetry records without penalizing unavailable sensors", () => {
    const records: RecordWithLineage[] = [
      {
        instanceId: "dev-1",
        type: "CELL_INFO",
        time: { timestamp: 1789500000000 },
        observedWindowStartTimestampMs: 1789500000000,
        observedWindowEndTimestampMs: 1789500005000,
        uploadTimestamp: 1789500010000,
        locationSnapshot: { lat: 44.81, lng: 20.45, accuracy: 5.0, speed: 25.0, isMock: false, countryCode: "RS", h3Index: "617522772156088300" },
        mobileSnapshot: { dataConnectionSim: { dataState: "CONNECTED", serviceState: "IN_SERVICE" } },
      },
      {
        instanceId: "dev-2",
        type: "CELL_INFO",
        time: { timestamp: 1789500001000 },
        observedWindowStartTimestampMs: 1789500001000,
        observedWindowEndTimestampMs: 1789500006000,
        uploadTimestamp: 1789500011000,
        locationSnapshot: { lat: 44.82, lng: 20.46, accuracy: 6.0, speed: 30.0, isMock: false, countryCode: "RS", h3Index: "617522772156088301" },
        mobileSnapshot: { dataConnectionSim: { dataState: "CONNECTED", serviceState: "IN_SERVICE" } },
      },
    ];

    const quality = evaluateDatasetQuality({
      version: sampleVersion,
      records,
      snapshot: sampleSnapshot,
    });

    expect(quality.score).toBeGreaterThanOrEqual(85);
    expect(["dobro", "odlicno"]).toContain(quality.grade);
    expect(quality.dimensions.length).toBe(6);

    // Initial version has 100 on schema stability
    const schemaDim = quality.dimensions.find((d) => d.dimension === "schema_stability");
    expect(schemaDim?.score).toBe(100);
  });

  it("detects domain violations: invalid coordinates, negative speed, and window order", () => {
    const badRecords: RecordWithLineage[] = [
      {
        instanceId: "dev-bad",
        type: "CELL_INFO",
        time: { timestamp: 1789500000000 },
        observedWindowStartTimestampMs: 1789500010000,
        observedWindowEndTimestampMs: 1789500005000, // end before start!
        locationSnapshot: {
          lat: 145.0, // invalid latitude!
          lng: 20.45,
          speed: -15, // negative speed!
          accuracy: -2,
        },
      },
    ];

    const quality = evaluateDatasetQuality({
      version: sampleVersion,
      records: badRecords,
      snapshot: { ...sampleSnapshot, recordCount: 1 },
    });

    const windowRule = quality.rules.find((r) => r.ruleId === "window-end-after-start");
    expect(windowRule?.status).toBe("fail");

    const coordRule = quality.rules.find((r) => r.ruleId === "geo-coordinates-valid-range");
    expect(coordRule?.status).toBe("fail");

    const speedRule = quality.rules.find((r) => r.ruleId === "accuracy-speed-non-negative");
    expect(speedRule?.status).toBe("fail");
  });

  it("flags mock location as warning, not as total failure", () => {
    const mockRecord: RecordWithLineage[] = [
      {
        instanceId: "dev-mock",
        type: "CELL_INFO",
        time: { timestamp: 1789500000000 },
        observedWindowStartTimestampMs: 1789500000000,
        observedWindowEndTimestampMs: 1789500005000,
        locationSnapshot: { lat: 44.81, lng: 20.45, isMock: true },
      },
    ];

    const quality = evaluateDatasetQuality({
      version: sampleVersion,
      records: mockRecord,
      snapshot: { ...sampleSnapshot, recordCount: 1 },
    });

    const mockRule = quality.rules.find((r) => r.ruleId === "location-not-mocked");
    expect(mockRule?.status).toBe("warning");
  });
});
