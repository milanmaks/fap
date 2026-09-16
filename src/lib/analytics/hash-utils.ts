import crypto from "crypto";

export interface BusinessKeyDefinition {
  name: string;
  extractKey: (record: Record<string, unknown>) => string | null;
}

const DEFAULT_IGNORED_CANONICAL_FIELDS = new Set<string>([
  "uploadTimestamp",
]);

/**
 * Normalizes values recursively, sorting keys and stripping FAP technical ingestion metadata.
 */
export function normalizeCanonicalValue(
  val: unknown,
  customIgnoredFields?: Set<string>
): unknown {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === "bigint") {
    return val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map((item) => normalizeCanonicalValue(item, customIgnoredFields));
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      // Exclude FAP technical fields and ingestion metadata
      if (key.startsWith("_fap_")) continue;
      if (DEFAULT_IGNORED_CANONICAL_FIELDS.has(key)) continue;
      if (customIgnoredFields && customIgnoredFields.has(key)) continue;

      const subVal = obj[key];
      // Special treatment for h3Index: ensure string representation
      if (key === "h3Index" && subVal !== null && subVal !== undefined) {
        result[key] = String(subVal);
      } else {
        result[key] = normalizeCanonicalValue(subVal, customIgnoredFields);
      }
    }
    return result;
  }
  return val;
}

/**
 * Computes SHA-256 canonical hash of a record, invariant to key ordering and
 * excluding FAP technical metadata (_fap_* and uploadTimestamp).
 */
export function computeCanonicalRecordHash(
  record: Record<string, unknown>,
  customIgnoredFields?: Set<string>
): string {
  const normalized = normalizeCanonicalValue(record, customIgnoredFields);
  const jsonStr = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

/**
 * Round floating coordinate deterministically to 5 decimal places (~1.1 meter precision).
 */
export function roundCoordinate(val: unknown, decimals = 5): string | null {
  if (typeof val === "number" && !isNaN(val)) {
    return Number(val).toFixed(decimals);
  }
  if (typeof val === "string") {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      return num.toFixed(decimals);
    }
  }
  return null;
}

/**
 * Safely extracts nested value by dot path (e.g. 'time.timestamp' or 'locationSnapshot.lat').
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let curr: any = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
}

/**
 * Default Telemetry Business Key extractor.
 * Combines instanceId + type + time.timestamp + rounded lat/lng + h3Index (as string).
 */
export const TelemetryBusinessKeyDefinition: BusinessKeyDefinition = {
  name: "telemetry_event",
  extractKey: (record: Record<string, unknown>): string | null => {
    const instanceId = getNestedValue(record, "instanceId");
    const type = getNestedValue(record, "type");
    const timestamp =
      getNestedValue(record, "time.timestamp") ??
      getNestedValue(record, "time") ??
      getNestedValue(record, "observedWindowStartTimestampMs");

    // If core identity is missing, return null (record is not business-key comparable)
    if (!instanceId || !type || timestamp === undefined || timestamp === null) {
      return null;
    }

    const lat = roundCoordinate(getNestedValue(record, "locationSnapshot.lat"));
    const lng = roundCoordinate(getNestedValue(record, "locationSnapshot.lng"));
    const rawH3 = getNestedValue(record, "locationSnapshot.h3Index");
    const h3 = rawH3 !== undefined && rawH3 !== null ? String(rawH3) : "";

    const parts = [
      String(instanceId).trim(),
      String(type).trim(),
      String(timestamp).trim(),
      lat ?? "",
      lng ?? "",
      h3,
    ];

    return parts.join("|");
  },
};

/**
 * Computes SHA-256 hash of the record's business key.
 * Returns null if the record does not satisfy the business key definition.
 */
export function computeBusinessKeyHash(
  record: Record<string, unknown>,
  definition: BusinessKeyDefinition = TelemetryBusinessKeyDefinition
): string | null {
  const keyString = definition.extractKey(record);
  if (!keyString) return null;
  return crypto.createHash("sha256").update(keyString).digest("hex");
}

/**
 * Formats a human-readable display string for the business key.
 */
export function formatBusinessKey(
  record: Record<string, unknown>,
  definition: BusinessKeyDefinition = TelemetryBusinessKeyDefinition
): string {
  const key = definition.extractKey(record);
  if (!key) return "N/A (nedostaje ID)";
  return key;
}

/**
 * Computes SHA-256 checksum of an uploaded raw file buffer.
 */
export function computeFileChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
