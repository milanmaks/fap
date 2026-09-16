import JSZip from "jszip";
import path from "path";
import { classifyFile, SupportedFileType } from "./file-classifier";

export interface ZipEntryResult {
  entryPath: string;
  sanitizedName: string;
  fileType: SupportedFileType;
  isSupported: boolean;
  sizeBytes: number;
  data?: Buffer;
  skipReason?: string;
}

export interface ZipInspectionResult {
  valid: boolean;
  error?: string;
  entries: ZipEntryResult[];
  totalEntries: number;
  totalExpandedBytes: number;
}

const MAX_ZIP_ENTRIES = parseInt(process.env.MAX_ZIP_ENTRIES || "200", 10);
const MAX_ZIP_EXPANDED_BYTES = parseInt(process.env.MAX_ZIP_EXPANDED_BYTES || "262144000", 10); // 250MB
const MAX_COMPRESSION_RATIO = 100; // 100:1 max ratio

export async function inspectAndExtractZip(
  buffer: Buffer,
  depth = 0
): Promise<ZipInspectionResult> {
  if (depth > 1) {
    return {
      valid: false,
      error: "Ugnježdavanje ZIP arhiva preko dubine 1 nije dozvoljeno iz bezbednosnih razloga.",
      entries: [],
      totalEntries: 0,
      totalExpandedBytes: 0,
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Neuspešno otvaranje ZIP arhive: ${msg}`,
      entries: [],
      totalEntries: 0,
      totalExpandedBytes: 0,
    };
  }

  const entries: ZipEntryResult[] = [];
  let totalExpandedBytes = 0;
  const fileKeys = Object.keys(zip.files);

  if (fileKeys.length > MAX_ZIP_ENTRIES) {
    return {
      valid: false,
      error: `ZIP arhiva sadrži previše fajlova (${fileKeys.length}). Maksimalno dozvoljeno je ${MAX_ZIP_ENTRIES}.`,
      entries: [],
      totalEntries: fileKeys.length,
      totalExpandedBytes: 0,
    };
  }

  for (const rawPath of fileKeys) {
    const zipObj = zip.files[rawPath];

    // Skip directories
    if (zipObj.dir) {
      continue;
    }

    // Zip Slip defense: prevent path traversal
    const normalized = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, "");
    if (normalized.includes("..") || path.isAbsolute(normalized)) {
      entries.push({
        entryPath: rawPath,
        sanitizedName: path.basename(rawPath),
        fileType: "unknown",
        isSupported: false,
        sizeBytes: 0,
        skipReason: "Detektovan pokušaj path traversal (Zip Slip). Fajl preskočen.",
      });
      continue;
    }

    const sanitizedName = path.basename(normalized);
    const classification = classifyFile(sanitizedName);

    // If it's a nested zip and depth >= 1, reject/skip
    if (classification.fileType === "zip" && depth >= 1) {
      entries.push({
        entryPath: normalized,
        sanitizedName,
        fileType: "zip",
        isSupported: false,
        sizeBytes: 0,
        skipReason: "Ugnježdene ZIP arhive su onemogućene u MVP verziji.",
      });
      continue;
    }

    if (!classification.isSupported) {
      entries.push({
        entryPath: normalized,
        sanitizedName,
        fileType: classification.fileType,
        isSupported: false,
        sizeBytes: 0,
        skipReason: classification.reason || "Nepodržan format u arhivi.",
      });
      continue;
    }

    // Extract content buffer
    try {
      const entryBuffer = await zipObj.async("nodebuffer");
      const uncompressedSize = entryBuffer.length;
      totalExpandedBytes += uncompressedSize;

      // Zip bomb defense
      if (totalExpandedBytes > MAX_ZIP_EXPANDED_BYTES) {
        return {
          valid: false,
          error: `Ukupna dekomprimovana veličina prelazi bezbednosni limit (${MAX_ZIP_EXPANDED_BYTES / 1024 / 1024} MB).`,
          entries,
          totalEntries: entries.length,
          totalExpandedBytes,
        };
      }

      if (buffer.length > 0 && uncompressedSize / Math.max(buffer.length, 1) > MAX_COMPRESSION_RATIO) {
        return {
          valid: false,
          error: "Sumnjivo visok stepen kompresije (potencijalna Zip bomba).",
          entries,
          totalEntries: entries.length,
          totalExpandedBytes,
        };
      }

      entries.push({
        entryPath: normalized,
        sanitizedName,
        fileType: classification.fileType,
        isSupported: true,
        sizeBytes: uncompressedSize,
        data: entryBuffer,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      entries.push({
        entryPath: normalized,
        sanitizedName,
        fileType: classification.fileType,
        isSupported: false,
        sizeBytes: 0,
        skipReason: `Greška pri čitanju fajla: ${msg}`,
      });
    }
  }

  return {
    valid: true,
    entries,
    totalEntries: entries.length,
    totalExpandedBytes,
  };
}
