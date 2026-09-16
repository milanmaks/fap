import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { defaultStorageAdapter } from "@/lib/storage/local-storage-adapter";
import { ImportService, UploadedFileInput } from "@/lib/ingestion/import-service";

const MAX_UPLOAD_FILE_BYTES = parseInt(process.env.MAX_UPLOAD_FILE_BYTES || "52428800", 10); // 50MB
const MAX_UPLOAD_FILES = parseInt(process.env.MAX_UPLOAD_FILES || "20", 10);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const datasetId = formData.get("datasetId") as string | null;
    const datasetName = formData.get("datasetName") as string | null;
    const description = formData.get("description") as string | null;

    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Nije prosleđen nijedan fajl za upload." },
        { status: 400 }
      );
    }

    if (files.length > MAX_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Prekoračen maksimalan broj fajlova po uploadu (${MAX_UPLOAD_FILES}).` },
        { status: 400 }
      );
    }

    const fileInputs: UploadedFileInput[] = [];

    for (const f of files) {
      if (f.size > MAX_UPLOAD_FILE_BYTES) {
        return NextResponse.json(
          {
            error: `Fajl '${f.name}' prelazi maksimalnu dozvoljenu veličinu od ${MAX_UPLOAD_FILE_BYTES / 1024 / 1024} MB.`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await f.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      fileInputs.push({
        name: f.name,
        buffer,
        mimeType: f.type || undefined,
      });
    }

    const importService = new ImportService(repository, defaultStorageAdapter);
    const result = await importService.processUploads(fileInputs, {
      datasetId: datasetId || undefined,
      datasetName: datasetName || undefined,
      description: description || undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
