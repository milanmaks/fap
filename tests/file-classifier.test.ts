import { describe, it, expect } from "vitest";
import { classifyFile } from "../src/lib/ingestion/file-classifier";

describe("File Classifier", () => {
  it("correctly identifies .json files", () => {
    const res = classifyFile("orders.json");
    expect(res.isSupported).toBe(true);
    expect(res.fileType).toBe("json");
  });

  it("correctly identifies .jsonl and .ndjson files", () => {
    const res1 = classifyFile("logs.jsonl");
    expect(res1.isSupported).toBe(true);
    expect(res1.fileType).toBe("jsonl");

    const res2 = classifyFile("stream.ndjson");
    expect(res2.isSupported).toBe(true);
    expect(res2.fileType).toBe("jsonl");
  });

  it("correctly identifies .avro files", () => {
    const res = classifyFile("data.avro");
    expect(res.isSupported).toBe(true);
    expect(res.fileType).toBe("avro");
  });

  it("correctly identifies .zip archives", () => {
    const res = classifyFile("archive.zip");
    expect(res.isSupported).toBe(true);
    expect(res.fileType).toBe("zip");
  });

  it("rejects unsupported extensions", () => {
    const res = classifyFile("malware.exe");
    expect(res.isSupported).toBe(false);
    expect(res.fileType).toBe("unknown");
    expect(res.reason).toContain("Nepodržani format");
  });

  it("falls back to mime type if extension is missing", () => {
    const res = classifyFile("unnamed-file", "application/json");
    expect(res.isSupported).toBe(true);
    expect(res.fileType).toBe("json");
  });
});
