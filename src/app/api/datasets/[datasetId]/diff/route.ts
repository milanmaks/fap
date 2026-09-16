import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { compareVersions, compareFiles } from "@/lib/analytics/diff-engine";
import { RecordWithLineage } from "@/lib/domain/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { datasetId } = params;
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get("mode");
    const fileIdA = searchParams.get("fileIdA");
    const fileIdB = searchParams.get("fileIdB");

    // 1. REŽIM POREĐENJA DVA FAJLA (FILE-TO-FILE DIFF)
    if (mode === "files" || (fileIdA && fileIdB)) {
      if (!fileIdA || !fileIdB || fileIdA === fileIdB) {
        return NextResponse.json(
          {
            available: false,
            message: "Izaberite dva različita fajla za poređenje.",
          },
          { status: 200 }
        );
      }

      const [fileA, fileB] = await Promise.all([
        repository.getSourceFile(fileIdA),
        repository.getSourceFile(fileIdB),
      ]);

      if (!fileA || !fileB) {
        return NextResponse.json(
          { error: "Jedan od izabranih fajlova nije pronađen u sistemu." },
          { status: 404 }
        );
      }

      // Učitavanje zapisa za fajlove
      const [recordsAAll, recordsBAll] = await Promise.all([
        repository.getParsedRecords(fileA.datasetVersionId),
        repository.getParsedRecords(fileB.datasetVersionId),
      ]);

      // Filtriranje zapisa po ID-ju fajla (lineage)
      let recordsA = (recordsAAll as RecordWithLineage[]).filter(
        (r) => r._fap_source_file_id === fileA.id
      );
      let recordsB = (recordsBAll as RecordWithLineage[]).filter(
        (r) => r._fap_source_file_id === fileB.id
      );

      // Fallback: Ako u verziji postoji samo 1 fajl ili tag nije postavljen
      if (recordsA.length === 0 && recordsAAll.length > 0) {
        recordsA = recordsAAll as RecordWithLineage[];
      }
      if (recordsB.length === 0 && recordsBAll.length > 0) {
        recordsB = recordsBAll as RecordWithLineage[];
      }

      const diff = compareFiles({
        datasetId,
        fileA,
        fileB,
        recordsA,
        recordsB,
        options: {
          maxExamples: 20,
        },
      });

      return NextResponse.json({
        available: true,
        diff,
      });
    }

    // 2. REŽIM POREĐENJA VERZIJA (VERSION-TO-VERSION DIFF)
    let baseVersionId = searchParams.get("baseVersionId");
    let targetVersionId = searchParams.get("targetVersionId");

    const versions = await repository.listVersions(datasetId);
    const readyVersions = versions.filter((v) => v.status === "ready" || v.status === "partial");

    if (readyVersions.length < 2 && (!baseVersionId || !targetVersionId)) {
      return NextResponse.json(
        {
          available: false,
          message:
            "Za poređenje verzija potreban je uvoz najmanje dve verzije dataset-a. Trenutno postoji samo jedna verzija.",
        },
        { status: 200 }
      );
    }

    if (!targetVersionId) {
      targetVersionId = readyVersions[0]?.id;
    }
    if (!baseVersionId) {
      const targetIdx = readyVersions.findIndex((v) => v.id === targetVersionId);
      baseVersionId = readyVersions[targetIdx + 1]?.id || readyVersions[1]?.id;
    }

    if (!baseVersionId || !targetVersionId || baseVersionId === targetVersionId) {
      return NextResponse.json(
        {
          available: false,
          message: "Izaberite dve različite verzije za poređenje.",
        },
        { status: 200 }
      );
    }

    const [baseVersion, targetVersion] = await Promise.all([
      repository.getVersion(baseVersionId),
      repository.getVersion(targetVersionId),
    ]);

    if (!baseVersion || !targetVersion) {
      return NextResponse.json(
        { error: "Jedna od izabranih verzija nije pronađena." },
        { status: 404 }
      );
    }

    const [
      baseFiles,
      targetFiles,
      baseSnapshot,
      targetSnapshot,
      baseRawRecords,
      targetRawRecords,
    ] = await Promise.all([
      repository.listSourceFiles(baseVersion.id),
      repository.listSourceFiles(targetVersion.id),
      repository.getLatestSnapshot(baseVersion.id),
      repository.getLatestSnapshot(targetVersion.id),
      repository.getParsedRecords(baseVersion.id),
      repository.getParsedRecords(targetVersion.id),
    ]);

    if (!baseSnapshot || !targetSnapshot) {
      return NextResponse.json(
        { error: "Analitički snapshot nije dostupan za izabrane verzije." },
        { status: 404 }
      );
    }

    const baseRecords: RecordWithLineage[] = baseRawRecords as RecordWithLineage[];
    const targetRecords: RecordWithLineage[] = targetRawRecords as RecordWithLineage[];

    const diff = compareVersions({
      datasetId,
      baseVersion,
      targetVersion,
      baseFiles,
      targetFiles,
      baseRecords,
      targetRecords,
      baseSnapshot,
      targetSnapshot,
      options: {
        maxExamples: 20,
      },
    });

    return NextResponse.json({
      available: true,
      diff,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error in diff API:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
