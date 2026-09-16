import readline from "readline";
import { Readable } from "stream";
import { ParseResult } from "./json-parser";

export async function parseJsonlStream(
  input: NodeJS.ReadableStream | ReadableStream<Uint8Array> | Buffer | string
): Promise<ParseResult> {
  const result: ParseResult = {
    records: [],
    totalRecords: 0,
    invalidRecords: 0,
    errorMessages: [],
  };

  let nodeStream: NodeJS.ReadableStream;

  if (typeof input === "string") {
    nodeStream = Readable.from([input]);
  } else if (Buffer.isBuffer(input)) {
    nodeStream = Readable.from([input]);
  } else if ("getReader" in input) {
    // Convert Web ReadableStream to Node.js Readable
    const reader = (input as ReadableStream<Uint8Array>).getReader();
    nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (err) {
          this.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
  } else {
    nodeStream = input as NodeJS.ReadableStream;
  }

  const rl = readline.createInterface({
    input: nodeStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const rawLine of rl) {
    lineNumber++;
    const line = rawLine.trim();
    if (!line) {
      continue; // skip empty lines
    }

    result.totalRecords++;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        result.records.push(parsed as Record<string, unknown>);
      } else {
        result.invalidRecords++;
        if (result.errorMessages.length < 5) {
          result.errorMessages.push(`Linija ${lineNumber}: Zapis mora biti JSON objekat.`);
        }
      }
    } catch (err: unknown) {
      result.invalidRecords++;
      if (result.errorMessages.length < 5) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errorMessages.push(`Linija ${lineNumber}: Neispravan JSON (${msg}).`);
      }
    }
  }

  return result;
}
