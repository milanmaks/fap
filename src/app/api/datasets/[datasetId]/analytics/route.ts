import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";

export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId");

    let version = versionId
      ? await repository.getVersion(versionId)
      : await repository.getLatestVersion(params.datasetId);

    if (!version) {
      return NextResponse.json(
        { error: "Nema dostupnih verzija za ovaj dataset." },
        { status: 404 }
      );
    }

    const snapshot = await repository.getLatestSnapshot(version.id);
    const sourceFiles = await repository.listSourceFiles(version.id);

    return NextResponse.json({
      version,
      snapshot,
      sourceFiles,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
