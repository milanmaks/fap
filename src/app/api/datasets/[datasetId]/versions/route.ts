import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";

export async function GET(
  _req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const versions = await repository.listVersions(params.datasetId);
    return NextResponse.json(versions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
