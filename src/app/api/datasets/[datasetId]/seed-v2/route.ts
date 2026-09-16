import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { profileRecords } from "@/lib/ingestion/profiler";
import { DatasetVersion, SourceFile } from "@/lib/domain/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { datasetId } = params;
    const latestVersion = await repository.getLatestVersion(datasetId);

    if (!latestVersion) {
      return NextResponse.json(
        { error: "Dataset nema postojeće verzije iz kojih bi se kreirala v2." },
        { status: 400 }
      );
    }

    const rawRecords = await repository.getParsedRecords(latestVersion.id);
    if (!rawRecords || rawRecords.length === 0) {
      return NextResponse.json(
        { error: "Nema zapisa u trenutnoj verziji za kreiranje poređenja." },
        { status: 400 }
      );
    }

    const newVersionNumber = (latestVersion.versionNumber || 1) + 1;
    const newVersion = await repository.createVersion(datasetId, newVersionNumber);

    // Kloniramo zapise i uvodimo realistične izmene za poređenje
    const modifiedRecords = rawRecords.map((r, idx) => {
      const cloned = { ...r };
      // Svaki 10. zapis ima modifikovanu vrednost (promenjen signal / brzina / trajanje)
      if (idx % 10 === 0) {
        if ("signal" in cloned && typeof cloned.signal === "number") {
          cloned.signal = Math.round(cloned.signal * 0.95);
        }
        if ("locationSnapshot.speed" in cloned && typeof cloned["locationSnapshot.speed"] === "number") {
          cloned["locationSnapshot.speed"] = Math.round((cloned["locationSnapshot.speed"] + 2.5) * 10) / 10;
        }
      }
      return cloned;
    });

    // Uklanjamo nekoliko starih zapisa i dodajemo nove
    const sliced = modifiedRecords.slice(0, Math.max(modifiedRecords.length - 2, 1));

    // Dodajemo 3 nova zapisa sa novom kolonom "network_latency_ms" i "battery_level"
    const sampleRecord = sliced[0] || {};
    const brandNewRecords: Record<string, unknown>[] = [
      {
        ...sampleRecord,
        instanceId: (sampleRecord.instanceId as string) || "device-sample-new-1",
        time: { timestamp: Date.now() - 30000 },
        network_latency_ms: 28,
        battery_level: 84,
      },
      {
        ...sampleRecord,
        instanceId: (sampleRecord.instanceId as string) || "device-sample-new-2",
        time: { timestamp: Date.now() - 15000 },
        network_latency_ms: 32,
        battery_level: 82,
      },
    ];

    const allV2Records = [...sliced, ...brandNewRecords];

    // Profilisanje novih zapisa
    const profiled = profileRecords(allV2Records, 0);

    // Kreiramo SourceFile za v2
    const sf: SourceFile = await repository.createSourceFile({
      datasetVersionId: newVersion.id,
      originalName: `batch_v${newVersionNumber}_delta.avro`,
      fileType: "avro",
      mimeType: "application/avro",
      sizeBytes: Math.round(allV2Records.length * 150),
      checksum: `sha256_demo_v${newVersionNumber}`,
      status: "ready",
    });

    // Tag lineage
    for (const r of allV2Records) {
      (r as any)._fap_source_file_id = sf.id;
      (r as any)._fap_source_file_name = sf.originalName;
    }

    // Sačuvaj zapise i snapshot
    await repository.saveParsedRecords(newVersion.id, allV2Records);
    await repository.createSnapshot({
      datasetVersionId: newVersion.id,
      sourceFileId: sf.id,
      recordCount: allV2Records.length,
      duplicateCount: profiled.duplicateCount,
      invalidRecordCount: 0,
      columnStats: profiled.columnStats,
    });

    // Ažuriraj status verzije na ready
    const readyVer = await repository.updateVersion(newVersion.id, {
      status: "ready",
      totalFiles: 1,
      processedFiles: 1,
      totalRecords: allV2Records.length,
      schema: profiled.schema,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      version: readyVer,
      message: `Uspešno kreirana verzija v${newVersionNumber} sa ${allV2Records.length} zapisa za poređenje.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error generating seed v2:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
