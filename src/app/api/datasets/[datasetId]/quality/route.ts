import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { evaluateDatasetQuality } from "@/lib/analytics/quality-engine";
import { RecordWithLineage } from "@/lib/domain/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { datasetId } = params;
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId");
    const fileId = searchParams.get("fileId");

    const version = versionId
      ? await repository.getVersion(versionId)
      : await repository.getLatestVersion(datasetId);

    if (!version) {
      return NextResponse.json(
        { error: "Nema dostupnih verzija za ovaj dataset." },
        { status: 404 }
      );
    }

    const [snapshot, allRawRecords, versions] = await Promise.all([
      repository.getLatestSnapshot(version.id),
      repository.getParsedRecords(version.id),
      repository.listVersions(datasetId),
    ]);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Analitički profil nije pronađen za ovu verziju." },
        { status: 404 }
      );
    }

    // Previous version for schema stability check
    const sorted = versions
      .filter((v) => v.status === "ready" || v.status === "partial")
      .sort((a, b) => b.versionNumber - a.versionNumber);
    const currIdx = sorted.findIndex((v) => v.id === version.id);
    const prevVer = currIdx >= 0 ? sorted[currIdx + 1] || null : null;
    const prevSnap = prevVer ? await repository.getLatestSnapshot(prevVer.id) : null;

    let records: RecordWithLineage[] = allRawRecords as RecordWithLineage[];
    let scope: "dataset_version" | "source_file" = "dataset_version";

    if (fileId) {
      records = records.filter((r) => r._fap_source_file_id === fileId);
      scope = "source_file";
    }

    const quality = evaluateDatasetQuality({
      version,
      records,
      snapshot,
      previousVersion: prevVer,
      previousSnapshot: prevSnap,
      scope,
    });

    return NextResponse.json({
      quality,
      datasetId,
      versionId: version.id,
      fileId: fileId || undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error in quality API:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
