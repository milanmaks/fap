import { Readable } from "stream";

export interface ParseResult {
  records: Record<string, unknown>[];
  totalRecords: number;
  invalidRecords: number;
  errorMessages: string[];
}

export async function parseJsonStream(
  stream: NodeJS.ReadableStream | ReadableStream<Uint8Array> | Buffer | string
): Promise<ParseResult> {
  const result: ParseResult = {
    records: [],
    totalRecords: 0,
    invalidRecords: 0,
    errorMessages: [],
  };

  let content = "";

  if (typeof stream === "string") {
    content = stream;
  } else if (Buffer.isBuffer(stream)) {
    content = stream.toString("utf-8");
  } else if ("getReader" in stream) {
    // Web ReadableStream
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      content += decoder.decode(value, { stream: true });
    }
  } else {
    // Node.js ReadableStream
    const chunks: Buffer[] = [];
    for await (const chunk of stream as NodeJS.ReadableStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    content = Buffer.concat(chunks).toString("utf-8");
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return result;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (item && typeof item === "object" && !Array.isArray(item)) {
          result.records.push(item as Record<string, unknown>);
        } else {
          result.invalidRecords++;
          if (result.errorMessages.length < 5) {
            result.errorMessages.push(`Zapis na indeksu ${i} nije JSON objekat.`);
          }
        }
      }
      result.totalRecords = parsed.length;
    } else if (parsed && typeof parsed === "object") {
      result.records.push(parsed as Record<string, unknown>);
      result.totalRecords = 1;
    } else {
      result.invalidRecords = 1;
      result.totalRecords = 1;
      result.errorMessages.push("JSON koren mora biti objekat ili niz objekata.");
    }
  } catch (err: unknown) {
    result.invalidRecords = 1;
    result.totalRecords = 0;
    const msg = err instanceof Error ? err.message : String(err);
    result.errorMessages.push(`Neispravan JSON format: ${msg}`);
  }

  return result;
}
