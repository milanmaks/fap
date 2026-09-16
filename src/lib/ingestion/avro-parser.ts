import avsc from "avsc";
import { Readable } from "stream";
import { ParseResult } from "./json-parser";

export interface AvroParser {
  parse(
    input: ReadableStream<Uint8Array> | NodeJS.ReadableStream | Buffer
  ): AsyncIterable<Record<string, unknown>>;
  getSchema?(input: NodeJS.ReadableStream | Buffer): Promise<unknown>;
}

function toNodeStream(
  input: ReadableStream<Uint8Array> | NodeJS.ReadableStream | Buffer
): NodeJS.ReadableStream {
  if (Buffer.isBuffer(input)) {
    return Readable.from([input]);
  }
  if ("getReader" in input) {
    const reader = (input as ReadableStream<Uint8Array>).getReader();
    return new Readable({
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
  }
  return input as NodeJS.ReadableStream;
}

export class ServerAvroParser implements AvroParser {
  async *parse(
    input: ReadableStream<Uint8Array> | NodeJS.ReadableStream | Buffer
  ): AsyncIterable<Record<string, unknown>> {
    const stream = toNodeStream(input);

    let decoder: any;
    try {
      decoder = (stream as any).pipe(new (avsc as any).streams.BlockDecoder());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Greška pri inicijalizaciji Avro dekodera: ${msg}`);
    }

    const queue: Record<string, unknown>[] = [];
    let isEnded = false;
    let streamError: Error | null = null;
    let notifyResolver: (() => void) | null = null;

    const notify = () => {
      if (notifyResolver) {
        const resolve = notifyResolver;
        notifyResolver = null;
        resolve();
      }
    };

    decoder.on("data", (record: any) => {
      if (record && typeof record === "object") {
        queue.push(record as Record<string, unknown>);
      }
      notify();
    });

    decoder.on("end", () => {
      isEnded = true;
      notify();
    });

    decoder.on("error", (err: Error) => {
      streamError = new Error(
        `Greška pri parsiranju Avro kontejnera: ${err.message || "Nepodržan codec ili neispravan format"}`
      );
      isEnded = true;
      notify();
    });

    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (streamError) {
        throw streamError;
      } else if (isEnded) {
        break;
      } else {
        await new Promise<void>((res) => {
          notifyResolver = res;
        });
      }
    }
  }

  async getSchema(input: NodeJS.ReadableStream | Buffer): Promise<unknown> {
    const stream = toNodeStream(input);
    return new Promise((resolve, reject) => {
      try {
        const decoder = (stream as any).pipe(new (avsc as any).streams.BlockDecoder());
        decoder.on("metadata", (type: any) => {
          resolve(type);
        });
        decoder.on("error", (err: Error) => {
          reject(new Error(`Neuspešno čitanje Avro šeme: ${err.message}`));
        });
        decoder.on("end", () => {
          resolve(null);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export async function parseAvroBuffer(buffer: Buffer): Promise<ParseResult> {
  const parser = new ServerAvroParser();
  const result: ParseResult = {
    records: [],
    totalRecords: 0,
    invalidRecords: 0,
    errorMessages: [],
  };

  try {
    for await (const record of parser.parse(buffer)) {
      result.records.push(record);
      result.totalRecords++;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.invalidRecords++;
    result.errorMessages.push(msg);
  }

  return result;
}
