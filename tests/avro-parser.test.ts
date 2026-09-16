import { describe, it, expect } from "vitest";
import avsc from "avsc";
import snappyjs from "snappyjs";
import fs from "fs";
import os from "os";
import path from "path";
import { ServerAvroParser, parseAvroBuffer, sanitizeAvroSchema } from "../src/lib/ingestion/avro-parser";

describe("Server-Side Avro Parser", () => {
  it("encodes and decodes a valid Avro container file", async () => {
    // 1. Create a valid Avro Object Container File (OCF) on disk
    const schema = {
      type: "record",
      name: "UserEvent",
      fields: [
        { name: "userId", type: "string" },
        { name: "event", type: "string" },
        { name: "timestamp", type: "long" },
      ],
    };

    const type = avsc.Type.forSchema(schema as any);
    const tempFile = path.join(os.tmpdir(), `test_${Date.now()}.avro`);
    const encoder = avsc.createFileEncoder(tempFile, type);

    const records = [
      { userId: "usr_1", event: "login", timestamp: 1773700000000 },
      { userId: "usr_2", event: "purchase", timestamp: 1773700005000 },
    ];

    for (const r of records) {
      encoder.write(r);
    }
    encoder.end();

    await new Promise((resolve) => encoder.on("finish", resolve));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const avroBuffer = await fs.promises.readFile(tempFile);
    await fs.promises.unlink(tempFile);

    // 2. Decode with ServerAvroParser
    const parser = new ServerAvroParser();
    const decoded: any[] = [];
    for await (const record of parser.parse(avroBuffer)) {
      decoded.push(record);
    }

    expect(decoded.length).toBe(2);
    expect(decoded[0].userId).toBe("usr_1");
    expect(decoded[1].event).toBe("purchase");
  });

  it("decodes a snappy-compressed Avro container file", async () => {
    const schema = {
      type: "record",
      name: "SpeedTest",
      fields: [
        { name: "testId", type: "string" },
        { name: "downloadSpeed", type: "double" },
      ],
    };

    const type = avsc.Type.forSchema(schema as any);
    const tempFile = path.join(os.tmpdir(), `snappy_${Date.now()}.avro`);
    const encoder = avsc.createFileEncoder(tempFile, type, {
      codec: "snappy",
      codecs: {
        snappy: (buf: Buffer, cb: any) => {
          try {
            cb(null, Buffer.from(snappyjs.compress(buf)));
          } catch (err) {
            cb(err);
          }
        },
      },
    });

    encoder.write({ testId: "ST-001", downloadSpeed: 98.5 });
    encoder.write({ testId: "ST-002", downloadSpeed: 104.2 });
    encoder.end();

    await new Promise((resolve) => encoder.on("finish", resolve));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const avroBuffer = await fs.promises.readFile(tempFile);
    await fs.promises.unlink(tempFile);

    const parser = new ServerAvroParser();
    const decoded: any[] = [];
    for await (const record of parser.parse(avroBuffer)) {
      decoded.push(record);
    }

    expect(decoded.length).toBe(2);
    expect(decoded[0].testId).toBe("ST-001");
    expect(decoded[0].downloadSpeed).toBe(98.5);
    expect(decoded[1].testId).toBe("ST-002");
  });

  it("handles malformed Avro buffer safely with descriptive error", async () => {
    const malformedBuffer = Buffer.from("Not an avro file, random garbage bytes 12345");
    const res = await parseAvroBuffer(malformedBuffer);

    expect(res.records.length).toBe(0);
    expect(res.invalidRecords).toBe(1);
    expect(res.errorMessages.length).toBeGreaterThan(0);
    expect(res.errorMessages[0]).toContain("Avro");
  });

  it("sanitizes union fields with mismatched defaults (e.g. default [] with first type null)", () => {
    const rawSchema = {
      type: "record",
      name: "SampleRecord",
      fields: [
        {
          name: "permissions",
          type: ["null", { type: "array", items: "string" }],
          default: [],
        },
        {
          name: "note",
          type: ["null", "string"],
          default: "default_note",
        },
      ],
    };

    const sanitized = sanitizeAvroSchema(rawSchema);
    expect(sanitized.fields[0].default).toBeNull();
    expect(sanitized.fields[1].default).toBeNull();
  });
});
