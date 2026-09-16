import { describe, it, expect } from "vitest";
import { parseJsonStream } from "../src/lib/ingestion/json-parser";
import { parseJsonlStream } from "../src/lib/ingestion/jsonl-parser";

describe("JSON and JSONL Parsers", () => {
  it("parses valid JSON array of objects", async () => {
    const raw = JSON.stringify([
      { id: 1, name: "Alice", active: true },
      { id: 2, name: "Bob", active: false },
    ]);

    const res = await parseJsonStream(raw);
    expect(res.records.length).toBe(2);
    expect(res.totalRecords).toBe(2);
    expect(res.invalidRecords).toBe(0);
    expect(res.records[0]).toEqual({ id: 1, name: "Alice", active: true });
  });

  it("handles single JSON object as root", async () => {
    const raw = JSON.stringify({ id: 100, role: "admin" });
    const res = await parseJsonStream(raw);
    expect(res.records.length).toBe(1);
    expect(res.totalRecords).toBe(1);
    expect(res.invalidRecords).toBe(0);
  });

  it("safely handles malformed JSON without crashing", async () => {
    const raw = "{ invalid json content ";
    const res = await parseJsonStream(raw);
    expect(res.records.length).toBe(0);
    expect(res.invalidRecords).toBe(1);
    expect(res.errorMessages.length).toBeGreaterThan(0);
  });

  it("parses valid JSONL stream line by line", async () => {
    const raw = `{"item": "book", "qty": 2}\n{"item": "pen", "qty": 10}\n{"item": "paper", "qty": 500}`;
    const res = await parseJsonlStream(raw);
    expect(res.records.length).toBe(3);
    expect(res.totalRecords).toBe(3);
    expect(res.invalidRecords).toBe(0);
    expect(res.records[1]).toEqual({ item: "pen", qty: 10 });
  });

  it("tracks invalid lines in JSONL without dropping valid lines", async () => {
    const raw = `{"valid": 1}\n{not a json}\n{"valid": 2}`;
    const res = await parseJsonlStream(raw);
    expect(res.records.length).toBe(2);
    expect(res.totalRecords).toBe(3);
    expect(res.invalidRecords).toBe(1);
    expect(res.errorMessages[0]).toContain("Linija 2");
  });
});
