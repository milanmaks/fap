import { DataCitation } from "./types";

export function formatCitation(citation: DataCitation): string {
  const parts: string[] = [];

  if (citation.fileName) {
    parts.push(`Fajl: ${citation.fileName}`);
  }
  if (citation.recordStart !== undefined && citation.recordEnd !== undefined) {
    parts.push(`Zapisi: ${citation.recordStart}–${citation.recordEnd}`);
  } else if (citation.recordStart !== undefined) {
    parts.push(`Od zapisa: ${citation.recordStart}`);
  }

  if (citation.fragmentId) {
    parts.push(`Fragment: ${citation.fragmentId}`);
  }

  return parts.length > 0 ? parts.join(" · ") : `Verzija: ${citation.datasetVersionId}`;
}

export function buildVersionCitation(
  datasetId: string,
  datasetVersionId: string,
  files?: Array<{ id: string; originalName: string }>
): DataCitation[] {
  if (!files || files.length === 0) {
    return [
      {
        datasetId,
        datasetVersionId,
      },
    ];
  }

  return files.map((f) => ({
    datasetId,
    datasetVersionId,
    sourceFileId: f.id,
    fileName: f.originalName,
  }));
}
