import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { RecordWithLineage } from "@/lib/domain/types";

const MAX_EXPORT_RECORDS = 5000;

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = typeof val === "object" ? JSON.stringify(val) : String(val);

  // Spreadsheet formula injection prevention: prefix dangerous starting characters with apostrophe
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function flattenForCsv(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("_fap_")) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(result, flattenForCsv(val as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { datasetId: string } }
) {
  try {
    const { datasetId } = params;
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId");
    const fileId = searchParams.get("fileId");
    const format = (searchParams.get("format") || "json").toLowerCase();

    const version = versionId
      ? await repository.getVersion(versionId)
      : await repository.getLatestVersion(datasetId);

    if (!version) {
      return NextResponse.json({ error: "Verzija nije pronađena." }, { status: 404 });
    }

    const rawRecords = await repository.getParsedRecords(version.id);
    let records: RecordWithLineage[] = rawRecords as RecordWithLineage[];

    if (fileId) {
      records = records.filter((r) => r._fap_source_file_id === fileId);
    }

    if (records.length > MAX_EXPORT_RECORDS) {
      records = records.slice(0, MAX_EXPORT_RECORDS);
    }

    // Sanitize and clean technical fields
    const cleanedRecords = records.map((r) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (k.startsWith("_fap_")) continue;
        if (k === "locationSnapshot" && v && typeof v === "object") {
          const loc = { ...(v as Record<string, unknown>) };
          if (loc.h3Index !== undefined && loc.h3Index !== null) {
            loc.h3Index = String(loc.h3Index);
          }
          clean[k] = loc;
        } else if (typeof v === "bigint") {
          clean[k] = v.toString();
        } else {
          clean[k] = v;
        }
      }
      return clean;
    });

    const filename = `export_${datasetId}_v${version.versionNumber}_${fileId ? "file" : "all"}.${format}`;

    if (format === "csv") {
      const flattened = cleanedRecords.map((r) => flattenForCsv(r));
      const headers = Array.from(new Set(flattened.flatMap((r) => Object.keys(r))));

      const csvLines: string[] = [];
      csvLines.push(headers.map(escapeCsvCell).join(","));

      for (const row of flattened) {
        csvLines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
      }

      const csvContent = "\uFEFF" + csvLines.join("\r\n"); // UTF-8 BOM for Excel compatibility

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default JSON export
    return new NextResponse(JSON.stringify(cleanedRecords, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Export error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
