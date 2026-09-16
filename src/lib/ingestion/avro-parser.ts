import avsc from "avsc";
import snappyjs from "snappyjs";
import { Readable } from "stream";
import { ParseResult } from "./json-parser";

// Safely decode 64-bit integers with zero precision loss for values exceeding JS safe integer range
function readAvroLong(tap: any): number | string {
  let res = 0n;
  let shift = 0n;
  const buf = tap.buf;
  const len = buf.length;
  while (true) {
    if (tap.pos >= len) {
      tap.pos = len + 1;
      return 0;
    }
    const val = buf[tap.pos++];
    const b = BigInt(val);
    res |= (b & 0x7fn) << shift;
    if (!(val & 0x80)) break;
    shift += 7n;
  }
  const n = (res >> 1n) ^ -(res & 1n);
  // If within safe integer range, return number; otherwise return full decimal string without scientific notation
  if (n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(n);
  }
  return n.toString();
}

if ((avsc as any).types?.LongType?.prototype) {
  (avsc as any).types.LongType.prototype._read = function (tap: any) {
    return readAvroLong(tap);
  };
}

export function sanitizeAvroSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) {
    return schema.map(sanitizeAvroSchema);
  }
  const copy: Record<string, any> = { ...schema };
  if (copy.fields && Array.isArray(copy.fields)) {
    copy.fields = copy.fields.map((field: any) => {
      const f = { ...field };
      // Avro 1.x specification requires default value to match the first branch of a union.
      // Many real-world schemas define ['null', 'array'] with default: [] or ['null', 'string'] with default: ''
      if (Array.isArray(f.type) && f.default !== undefined) {
        const firstType = f.type[0];
        if (firstType === "null" && f.default !== null) {
          f.default = null;
        }
      }
      if (f.type && typeof f.type === "object") {
        f.type = sanitizeAvroSchema(f.type);
      }
      return f;
    });
  }
  return copy;
}

const defaultCodecs = ((avsc as any).streams?.BlockDecoder?.getDefaultCodecs?.() || {}) as Record<string, any>;

const AVRO_CODECS = {
  ...defaultCodecs,
  snappy: (buf: Buffer, cb: (err: Error | null, res?: Buffer) => void) => {
    try {
      let uncompressed: Uint8Array | Buffer;
      try {
        // Avro snappy blocks can include a 4-byte CRC-32 checksum at the end
        uncompressed = snappyjs.uncompress(buf.subarray(0, buf.length - 4));
      } catch {
        uncompressed = snappyjs.uncompress(buf);
      }
      cb(null, Buffer.from(uncompressed));
    } catch (err: unknown) {
      cb(err instanceof Error ? err : new Error(String(err)));
    }
  },
};

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
      decoder = (stream as any).pipe(
        new (avsc as any).streams.BlockDecoder({
          codecs: AVRO_CODECS,
          parseHook: sanitizeAvroSchema,
        })
      );
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
        const decoder = (stream as any).pipe(
          new (avsc as any).streams.BlockDecoder({
            codecs: AVRO_CODECS,
            parseHook: sanitizeAvroSchema,
          })
        );
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
