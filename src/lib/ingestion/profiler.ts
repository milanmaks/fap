import crypto from "crypto";
import {
  ColumnStatistics,
  DatasetSchema,
  FileFragment,
  InferredType,
  SchemaField,
} from "../domain/types";
import { isValidDate } from "../utils/dates";
import { generateId } from "../utils/ids";

export interface ProfiledDataset {
  recordCount: number;
  duplicateCount: number;
  invalidRecordCount: number;
  schema: DatasetSchema;
  columnStats: ColumnStatistics[];
  fragments: Omit<FileFragment, "sourceFileId">[];
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      result.push(...flattenObject(value as Record<string, unknown>, fullPath));
    } else {
      result.push({ path: fullPath, value });
    }
  }

  return result;
}

function inferValueType(val: unknown): InferredType {
  if (val === null || val === undefined) return "null";
  if (Array.isArray(val)) return "array";
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (val instanceof Date) return "date";
  if (typeof val === "string") {
    // Check if string matches ISO date/time format
    if (
      val.length >= 10 &&
      /^\d{4}-\d{2}-\d{2}/.test(val) &&
      isValidDate(val)
    ) {
      return "date";
    }
    return "string";
  }
  if (typeof val === "object") return "object";
  return "string";
}

function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJson((obj as any)[k]))
      .join(",") +
    "}"
  );
}

const DEFAULT_FRAGMENT_SIZE = parseInt(process.env.MAX_RECORDS_PER_FRAGMENT || "5000", 10);
const MAX_PROFILE_RECORDS = parseInt(process.env.MAX_PROFILE_RECORDS || "100000", 10);

export function profileRecords(
  records: Record<string, unknown>[],
  invalidCount = 0,
  fragmentSize = DEFAULT_FRAGMENT_SIZE
): ProfiledDataset {
  const total = records.length;
  const sample = total > MAX_PROFILE_RECORDS ? records.slice(0, MAX_PROFILE_RECORDS) : records;

  // Track duplicates using canonical hash
  const seenHashes = new Set<string>();
  let duplicateCount = 0;

  for (const r of sample) {
    const hash = crypto.createHash("sha256").update(canonicalJson(r)).digest("hex");
    if (seenHashes.has(hash)) {
      duplicateCount++;
    } else {
      seenHashes.add(hash);
    }
  }

  // Column aggregations
  type Acc = {
    types: Set<InferredType>;
    presentCount: number;
    nullCount: number;
    values: unknown[];
    numericSum: number;
    numericCount: number;
    numericMin: number;
    numericMax: number;
    frequencyMap: Map<string, number>;
  };

  const colMap = new Map<string, Acc>();

  for (const record of sample) {
    const flattened = flattenObject(record);
    const seenColsInRecord = new Set<string>();

    for (const { path: colPath, value } of flattened) {
      seenColsInRecord.add(colPath);
      let acc = colMap.get(colPath);
      if (!acc) {
        acc = {
          types: new Set<InferredType>(),
          presentCount: 0,
          nullCount: 0,
          values: [],
          numericSum: 0,
          numericCount: 0,
          numericMin: Infinity,
          numericMax: -Infinity,
          frequencyMap: new Map(),
        };
        colMap.set(colPath, acc);
      }

      if (value === null || value === undefined) {
        acc.nullCount++;
      } else {
        acc.presentCount++;
        const type = inferValueType(value);
        acc.types.add(type);

        if (acc.values.length < 5) {
          acc.values.push(value);
        }

        if (typeof value === "number" && !isNaN(value)) {
          acc.numericSum += value;
          acc.numericCount++;
          if (value < acc.numericMin) acc.numericMin = value;
          if (value > acc.numericMax) acc.numericMax = value;
        }

        if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
          const strVal = String(value);
          acc.frequencyMap.set(strVal, (acc.frequencyMap.get(strVal) || 0) + 1);
        }
      }
    }

    // For any columns seen in prior records but not this one, count as null
    for (const [colPath, acc] of colMap.entries()) {
      if (!seenColsInRecord.has(colPath)) {
        acc.nullCount++;
      }
    }
  }

  const columnStats: ColumnStatistics[] = [];
  const schemaFields: SchemaField[] = [];

  for (const [colPath, acc] of colMap.entries()) {
    let finalType: InferredType = "null";
    const nonNullTypes = Array.from(acc.types).filter((t) => t !== "null");
    if (nonNullTypes.length === 1) {
      finalType = nonNullTypes[0];
    } else if (nonNullTypes.length > 1) {
      finalType = "mixed";
    }

    const distinctCount = acc.frequencyMap.size;

    // Calculate top 10 values
    const topValues = Array.from(acc.frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    const stat: ColumnStatistics = {
      path: colPath,
      inferredType: finalType,
      presentCount: acc.presentCount,
      nullCount: acc.nullCount,
      distinctEstimate: distinctCount,
      min: acc.numericCount > 0 ? acc.numericMin : undefined,
      max: acc.numericCount > 0 ? acc.numericMax : undefined,
      average: acc.numericCount > 0 ? acc.numericSum / acc.numericCount : undefined,
      topValues: topValues.length > 0 ? topValues : undefined,
    };

    columnStats.push(stat);

    schemaFields.push({
      path: colPath,
      type: finalType,
      nullable: acc.nullCount > 0,
      sampleValues: acc.values,
    });
  }

  // Fragment boundaries
  const fragments: Omit<FileFragment, "sourceFileId">[] = [];
  const effectiveFragSize = Math.max(fragmentSize, 1);
  const totalFrags = Math.ceil(total / effectiveFragSize) || 1;

  for (let i = 0; i < totalFrags; i++) {
    const recordStart = i * effectiveFragSize;
    const recordEnd = Math.min(recordStart + effectiveFragSize - 1, Math.max(total - 1, 0));
    const count = total === 0 ? 0 : recordEnd - recordStart + 1;

    fragments.push({
      id: generateId("frag"),
      index: i,
      recordStart,
      recordEnd,
      recordCount: count,
      status: "ready",
      createdAt: new Date().toISOString(),
    });
  }

  return {
    recordCount: total,
    duplicateCount,
    invalidRecordCount: invalidCount,
    schema: {
      fields: schemaFields,
      inferredAt: new Date().toISOString(),
      recordSampleCount: sample.length,
    },
    columnStats,
    fragments,
  };
}
