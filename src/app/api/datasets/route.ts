import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { repository } from "@/lib/persistence";

const CreateDatasetSchema = z.object({
  name: z.string().min(1, "Naziv dataset-a je obavezan"),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const datasets = await repository.listDatasets();
    return NextResponse.json(datasets);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateDatasetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const created = await repository.createDataset(
      parsed.data.name,
      parsed.data.description
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
