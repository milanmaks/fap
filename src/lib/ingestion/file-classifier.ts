export type SupportedFileType = "json" | "jsonl" | "avro" | "zip" | "unknown";

export interface ClassificationResult {
  fileType: SupportedFileType;
  isSupported: boolean;
  mimeType?: string;
  extension: string;
  reason?: string;
}

export function classifyFile(filename: string, mimeType?: string): ClassificationResult {
  const lowerName = filename.toLowerCase().trim();
  const lastDot = lowerName.lastIndexOf(".");
  const extension = lastDot !== -1 ? lowerName.substring(lastDot) : "";

  if (extension === ".json") {
    return {
      fileType: "json",
      isSupported: true,
      mimeType: mimeType || "application/json",
      extension,
    };
  }

  if (extension === ".jsonl" || extension === ".ndjson") {
    return {
      fileType: "jsonl",
      isSupported: true,
      mimeType: mimeType || "application/x-ndjson",
      extension,
    };
  }

  if (extension === ".avro") {
    return {
      fileType: "avro",
      isSupported: true,
      mimeType: mimeType || "application/avro",
      extension,
    };
  }

  if (extension === ".zip") {
    return {
      fileType: "zip",
      isSupported: true,
      mimeType: mimeType || "application/zip",
      extension,
    };
  }

  // Fallback by MIME type if extension is absent or ambiguous
  if (mimeType) {
    const lowerMime = mimeType.toLowerCase();
    if (lowerMime.includes("jsonl") || lowerMime.includes("ndjson")) {
      return { fileType: "jsonl", isSupported: true, mimeType, extension };
    }
    if (lowerMime.includes("json")) {
      return { fileType: "json", isSupported: true, mimeType, extension };
    }
    if (lowerMime.includes("avro")) {
      return { fileType: "avro", isSupported: true, mimeType, extension };
    }
    if (lowerMime.includes("zip")) {
      return { fileType: "zip", isSupported: true, mimeType, extension };
    }
  }

  return {
    fileType: "unknown",
    isSupported: false,
    mimeType,
    extension,
    reason: `Nepodržani format datoteke '${extension || filename}'. Podržani formati: .avro, .json, .jsonl, .ndjson, .zip`,
  };
}
