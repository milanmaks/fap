import { describe, it, expect } from "vitest";
import {
  computeCanonicalRecordHash,
  computeBusinessKeyHash,
  formatBusinessKey,
  roundCoordinate,
  computeFileChecksum,
} from "../src/lib/analytics/hash-utils";

describe("Hash & Business Key Utilities", () => {
  it("produces identical canonical hash for records with different key orders", () => {
    const recA = {
      instanceId: "inst-1",
      type: "CELL_INFO",
      locationSnapshot: { lat: 44.81234, lng: 20.45678 },
      time: { timestamp: 1789578600000 },
    };

    const recB = {
      time: { timestamp: 1789578600000 },
      locationSnapshot: { lng: 20.45678, lat: 44.81234 },
      type: "CELL_INFO",
      instanceId: "inst-1",
    };

    const hashA = computeCanonicalRecordHash(recA);
    const hashB = computeCanonicalRecordHash(recB);

    expect(hashA).toBe(hashB);
  });

  it("ignores FAP technical metadata (_fap_*) and uploadTimestamp in canonical hash", () => {
    const rawRecord = {
      instanceId: "inst-1",
      type: "CELL_INFO",
      cells: [{ pci: 12, rsrp: -95 }],
      time: { timestamp: 1789578600000 },
    };

    const ingestedRecord = {
      ...rawRecord,
      uploadTimestamp: 1789580000000,
      _fap_source_file_id: "file_123456",
      _fap_source_file_name: "archive.zip → cell_info.avro",
      _fap_record_index: 42,
    };

    const hashRaw = computeCanonicalRecordHash(rawRecord);
    const hashIngested = computeCanonicalRecordHash(ingestedRecord);

    expect(hashRaw).toBe(hashIngested);
  });

  it("changes canonical hash when actual business payload data changes", () => {
    const rec1 = {
      instanceId: "inst-1",
      type: "CELL_INFO",
      signal: -85,
    };

    const rec2 = {
      instanceId: "inst-1",
      type: "CELL_INFO",
      signal: -86,
    };

    expect(computeCanonicalRecordHash(rec1)).not.toBe(computeCanonicalRecordHash(rec2));
  });

  it("deterministically rounds coordinates to 5 decimals in business key", () => {
    const rec1 = {
      instanceId: "device-A",
      type: "CELL_INFO",
      time: { timestamp: 1789500000000 },
      locationSnapshot: {
        lat: 44.81234111,
        lng: 20.45678999,
        h3Index: "617522772156088300",
      },
    };

    const rec2 = {
      instanceId: "device-A",
      type: "CELL_INFO",
      time: { timestamp: 1789500000000 },
      locationSnapshot: {
        lat: 44.81234444, // within 5th decimal
        lng: 20.45678888,
        h3Index: "617522772156088300",
      },
    };

    const bk1 = computeBusinessKeyHash(rec1);
    const bk2 = computeBusinessKeyHash(rec2);

    expect(bk1).toBe(bk2);
  });

  it("CRITICAL: treats h3Index 617522772156088300 as exact string without precision loss", () => {
    const bigH3 = "617522772156088300"; // > Number.MAX_SAFE_INTEGER (9007199254740991)

    const rec = {
      instanceId: "device-001",
      type: "CELL_INFO",
      time: { timestamp: 1789500000000 },
      locationSnapshot: {
        lat: 44.81234,
        lng: 20.45678,
        h3Index: bigH3,
      },
    };

    const bkHash = computeBusinessKeyHash(rec);
    expect(bkHash).toBeTruthy();

    const formatted = formatBusinessKey(rec);
    expect(formatted).toContain(bigH3);
    // Ensure no scientific notation
    expect(formatted).not.toContain("e+");
    expect(formatted).not.toContain("E+");
  });

  it("returns null for business key when required identity fields are missing", () => {
    const incompleteRecord = {
      locationSnapshot: { lat: 44.81234, lng: 20.45678 },
      // missing instanceId, type, and timestamp
    };

    const bk = computeBusinessKeyHash(incompleteRecord);
    expect(bk).toBeNull();
  });

  it("computes deterministic file checksum", () => {
    const buf = Buffer.from("test file content for checksum");
    const sum1 = computeFileChecksum(buf);
    const sum2 = computeFileChecksum(buf);

    expect(sum1).toBe(sum2);
    expect(sum1.length).toBe(64);
  });
});
