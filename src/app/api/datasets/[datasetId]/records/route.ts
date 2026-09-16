import { NextRequest, NextResponse } from "next/server";
import { repository } from "@/lib/persistence";
import { RecordWithLineage } from "@/lib/domain/types";

function matchesSearch(record: Record<string, unknown>, searchLower: string): boolean {
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("_fap_")) continue;
    if (value === null || value === undefined) continue;

    if (typeof value === "object") {
      if (matchesSearch(value as Record<string, unknown>, searchLower)) {
        return true;
      }
    } else {
      const valStr = String(value).toLowerCase();
      if (valStr.includes(searchLower)) {
        return true;
      }
    }
  }
  return false;
}

function sanitizeRecordOutput(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === "locationSnapshot" && v && typeof v === "object") {
      const loc = { ...(v as Record<string, unknown>) };
      if (loc.h3Index !== undefined && loc.h3Index !== null) {
        loc.h3Index = String(loc.h3Index);
      }
      sanitized[k] = loc;
    } else if (typeof v === "bigint") {
      sanitized[k] = v.toString();
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
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
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawPageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const pageSize = Math.min(100, Math.max(1, isNaN(rawPageSize) ? 50 : rawPageSize));

    const version = versionId
      ? await repository.getVersion(versionId)
      : await repository.getLatestVersion(datasetId);

    if (!version) {
      return NextResponse.json(
        { error: "Nema dostupnih verzija za ovaj dataset." },
        { status: 404 }
      );
    }

    const rawRecords = await repository.getParsedRecords(version.id);
    let filtered: RecordWithLineage[] = rawRecords as RecordWithLineage[];

    if (fileId) {
      filtered = filtered.filter((r) => r._fap_source_file_id === fileId);
    }

    if (search) {
      filtered = filtered.filter((r) => matchesSearch(r, search));
    }

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered
      .slice(startIndex, startIndex + pageSize)
      .map((r, idx) => ({
        ...sanitizeRecordOutput(r),
        _fap_record_index: startIndex + idx,
      }));

    // Extract columns present in sample
    const colSet = new Set<string>();
    filtered.slice(0, 100).forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (!k.startsWith("_fap_")) colSet.add(k);
      });
    });

    return NextResponse.json({
      records: paginated,
      totalRecords,
      page,
      pageSize,
      totalPages,
      columns: Array.from(colSet),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error in records API:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
