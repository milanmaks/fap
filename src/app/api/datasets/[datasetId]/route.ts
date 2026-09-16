import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";

export async function GET(
  _req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const dataset = await repository.getDataset(params.datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: `Dataset '${params.datasetId}' nije pronađen.` },
        { status: 404 }
      );
    }

    const latestVersion = await repository.getLatestVersion(params.datasetId);
    const versions = await repository.listVersions(params.datasetId);

    return NextResponse.json({
      dataset,
      latestVersion,
      versions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const dataset = await repository.getDataset(params.datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: `Dataset '${params.datasetId}' nije pronađen.` },
        { status: 404 }
      );
    }

    await repository.deleteDataset(params.datasetId);
    await repository.logAuditEvent({
      eventType: "DATASET_DELETED",
      entityType: "Dataset",
      entityId: params.datasetId,
      payload: { name: dataset.name },
    });

    return NextResponse.json({ success: true, deletedId: params.datasetId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
