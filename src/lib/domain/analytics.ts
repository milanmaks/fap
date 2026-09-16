import {
  AnalyticsSnapshot,
  ChartSpec,
  ColumnStatistics,
  DataCitation,
  DatasetSchema,
  DatasetVersion,
  QueryPlan,
} from "./types";
import { toIsoBucket } from "../utils/dates";

export interface QueryExecutionResult {
  summary: string;
  data: unknown;
  recordCount: number;
  citations: DataCitation[];
  chart?: ChartSpec;
  warnings: string[];
}

function getNestedValue(obj: any, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined || typeof curr !== "object") return undefined;
    curr = curr[p];
  }
  return curr;
}

export function executeQueryPlanOnRecords(
  records: Record<string, unknown>[],
  plan: QueryPlan,
  version: DatasetVersion,
  filesMap: Map<string, string> // fileId -> fileName
): QueryExecutionResult {
  const warnings: string[] = [];
  let filtered = records;

  // 1. Apply filters
  if (plan.filters && plan.filters.length > 0) {
    filtered = filtered.filter((row) => {
      for (const f of plan.filters!) {
        const val = getNestedValue(row, f.field);

        switch (f.operator) {
          case "eq":
            if (val != f.value) return false;
            break;
          case "neq":
            if (val == f.value) return false;
            break;
          case "gt":
            if (typeof val !== "number" || typeof f.value !== "number" || val <= f.value)
              return false;
            break;
          case "gte":
            if (typeof val !== "number" || typeof f.value !== "number" || val < f.value)
              return false;
            break;
          case "lt":
            if (typeof val !== "number" || typeof f.value !== "number" || val >= f.value)
              return false;
            break;
          case "lte":
            if (typeof val !== "number" || typeof f.value !== "number" || val > f.value)
              return false;
            break;
          case "contains":
            if (
              typeof val !== "string" ||
              typeof f.value !== "string" ||
              !val.toLowerCase().includes(f.value.toLowerCase())
            ) {
              return false;
            }
            break;
          case "in":
            if (!Array.isArray(f.value) || !f.value.includes(val as any)) return false;
            break;
          case "is_null":
            if (val !== null && val !== undefined) return false;
            break;
          case "not_null":
            if (val === null || val === undefined) return false;
            break;
        }
      }
      return true;
    });
  }

  // Citations
  const citations: DataCitation[] = [
    {
      datasetId: version.datasetId,
      datasetVersionId: version.id,
      recordStart: 0,
      recordEnd: Math.max(records.length - 1, 0),
    },
  ];

  // 2. Process Operations
  if (plan.operation === "count") {
    return {
      summary: `Ukupno pronađeno ${filtered.length} zapisa koji zadovoljavaju kriterijume.`,
      data: { count: filtered.length },
      recordCount: filtered.length,
      citations,
      warnings,
    };
  }

  if (plan.operation === "group_by") {
    const groupField = plan.groupBy?.[0] || plan.time?.field;
    if (!groupField) {
      return {
        summary: "Nije specificirano polje za grupisanje.",
        data: [],
        recordCount: 0,
        citations,
        warnings: ["Nedostaje groupBy polje."],
      };
    }

    const groups = new Map<string, { count: number; sum: number; values: number[] }>();

    for (const r of filtered) {
      let rawVal = getNestedValue(r, groupField);
      let key = "nepoznato";

      if (plan.time && plan.time.bucket) {
        if (typeof rawVal === "string") {
          key = toIsoBucket(rawVal, plan.time.bucket);
        }
      } else if (rawVal !== null && rawVal !== undefined) {
        key = String(rawVal);
      }

      let g = groups.get(key);
      if (!g) {
        g = { count: 0, sum: 0, values: [] };
        groups.set(key, g);
      }
      g.count++;

      // Check numeric aggregate if select has sum/avg
      if (plan.select && plan.select.length > 0) {
        const aggField = plan.select[0].field;
        const numVal = getNestedValue(r, aggField);
        if (typeof numVal === "number" && !isNaN(numVal)) {
          g.sum += numVal;
          g.values.push(numVal);
        }
      }
    }

    const chartData = Array.from(groups.entries())
      .map(([k, v]) => ({
        group: k,
        count: v.count,
        average: v.values.length > 0 ? v.sum / v.values.length : undefined,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, plan.limit || 50);

    const chart: ChartSpec = {
      type: "bar",
      title: `Grupisano po: ${groupField}`,
      xKey: "group",
      yKey: "count",
      data: chartData,
    };

    return {
      summary: `Pronađeno ${chartData.length} grupa po polju '${groupField}'.`,
      data: chartData,
      recordCount: filtered.length,
      citations,
      chart,
      warnings,
    };
  }

  if (plan.operation === "aggregate") {
    const results: Record<string, any> = {};
    if (plan.select && plan.select.length > 0) {
      for (const sel of plan.select) {
        const agg = sel.aggregation || "count";
        const alias = sel.alias || `${agg}_${sel.field.replace(/\./g, "_")}`;

        if (agg === "count") {
          results[alias] = filtered.length;
        } else {
          const numbers = filtered
            .map((r) => getNestedValue(r, sel.field))
            .filter((v): v is number => typeof v === "number" && !isNaN(v));

          if (numbers.length === 0) {
            results[alias] = null;
            warnings.push(`Nema numeričkih vrednosti za agregaciju '${agg}' na polju '${sel.field}'.`);
          } else {
            const sum = numbers.reduce((a, b) => a + b, 0);
            if (agg === "sum") results[alias] = sum;
            else if (agg === "avg") results[alias] = sum / numbers.length;
            else if (agg === "min") results[alias] = Math.min(...numbers);
            else if (agg === "max") results[alias] = Math.max(...numbers);
            else if (agg === "distinct_count") results[alias] = new Set(numbers).size;
          }
        }
      }
    }

    return {
      summary: `Izračunate agregacije za ${filtered.length} zapisa.`,
      data: results,
      recordCount: filtered.length,
      citations,
      warnings,
    };
  }

  // operation === 'filter'
  const limit = Math.min(plan.limit || 20, 100);
  const rows = filtered.slice(0, limit);

  return {
    summary: `Prikazano ${rows.length} zapisa (od ukupno ${filtered.length} filtriranih).`,
    data: rows,
    recordCount: filtered.length,
    citations,
    warnings: filtered.length > limit ? [`Prikaz je ograničen na prvih ${limit} zapisa.`] : [],
  };
}

export function compareSnapshots(
  left: AnalyticsSnapshot,
  right: AnalyticsSnapshot,
  leftVerNum: number,
  rightVerNum: number
): Record<string, unknown> {
  const recordDiff = right.recordCount - left.recordCount;
  const invalidDiff = right.invalidRecordCount - left.invalidRecordCount;

  const leftCols = new Map(left.columnStats.map((c) => [c.path, c]));
  const rightCols = new Map(right.columnStats.map((c) => [c.path, c]));

  const addedColumns: string[] = [];
  const removedColumns: string[] = [];
  const typeChangedColumns: Array<{ path: string; from: string; to: string }> = [];

  for (const [col, rStat] of rightCols.entries()) {
    if (!leftCols.has(col)) {
      addedColumns.push(col);
    } else {
      const lStat = leftCols.get(col)!;
      if (lStat.inferredType !== rStat.inferredType) {
        typeChangedColumns.push({
          path: col,
          from: lStat.inferredType,
          to: rStat.inferredType,
        });
      }
    }
  }

  for (const col of leftCols.keys()) {
    if (!rightCols.has(col)) {
      removedColumns.push(col);
    }
  }

  return {
    leftVersion: `v${leftVerNum}`,
    rightVersion: `v${rightVerNum}`,
    records: {
      left: left.recordCount,
      right: right.recordCount,
      difference: recordDiff,
    },
    invalidRecords: {
      left: left.invalidRecordCount,
      right: right.invalidRecordCount,
      difference: invalidDiff,
    },
    addedColumns,
    removedColumns,
    typeChangedColumns,
  };
}
