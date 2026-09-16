import { describe, it, expect } from "vitest";
import { ReadonlyQueryValidator } from "../src/lib/chat/readonly-query-validator";
import { DatasetSchema } from "../src/lib/domain/types";

describe("Readonly Query Validator", () => {
  const mockSchema: DatasetSchema = {
    fields: [
      { path: "id", type: "string", nullable: false, sampleValues: ["1"] },
      { path: "status", type: "string", nullable: false, sampleValues: ["active"] },
      { path: "amount", type: "number", nullable: true, sampleValues: [100] },
      { path: "createdAt", type: "date", nullable: false, sampleValues: ["2026-01-01"] },
    ],
    inferredAt: new Date().toISOString(),
    recordSampleCount: 1,
  };

  it("approves valid read-only query plan", () => {
    const plan = {
      operation: "count",
      datasetVersionId: "ver_123",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "failed",
        },
      ],
    };

    const res = ReadonlyQueryValidator.validate(plan, "ver_123", mockSchema);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.sanitizedPlan).toBeDefined();
  });

  it("rejects unauthorized or mismatched version ID", () => {
    const plan = {
      operation: "count",
      datasetVersionId: "wrong_version",
    };

    const res = ReadonlyQueryValidator.validate(plan, "ver_123", mockSchema);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Neovlašćena ili neispravna verzija");
  });

  it("rejects non-existent field", () => {
    const plan = {
      operation: "count",
      datasetVersionId: "ver_123",
      filters: [
        {
          field: "non_existent_column",
          operator: "eq",
          value: "test",
        },
      ],
    };

    const res = ReadonlyQueryValidator.validate(plan, "ver_123", mockSchema);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("ne postoji u šemi verzije");
  });

  it("strictly blocks mutation keywords (drop, delete, update)", () => {
    const plan = {
      operation: "filter",
      datasetVersionId: "ver_123",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "active; DROP TABLE users; --",
        },
      ],
    };

    const res = ReadonlyQueryValidator.validate(plan, "ver_123", mockSchema);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Nedozvoljena reč"))).toBe(true);
  });

  it("clamps limit to maximum of 100 for record-returning operations", () => {
    const plan = {
      operation: "filter",
      datasetVersionId: "ver_123",
      limit: 500,
    };

    const res = ReadonlyQueryValidator.validate(plan, "ver_123", mockSchema);
    expect(res.valid).toBe(true);
    expect(res.sanitizedPlan?.limit).toBe(100);
  });
});
