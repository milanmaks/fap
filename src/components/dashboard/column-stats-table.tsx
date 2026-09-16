import React from "react";
import { ColumnStatistics, InferredType } from "@/lib/domain/types";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import { Badge } from "../ui/badge";

interface ColumnStatsTableProps {
  stats: ColumnStatistics[];
  totalRecords: number;
}

export const ColumnStatsTable: React.FC<ColumnStatsTableProps> = ({ stats, totalRecords }) => {
  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Nema dostupnih statistika kolona za ovu verziju.
      </div>
    );
  }

  const getTypeBadge = (type: InferredType) => {
    switch (type) {
      case "string":
        return <Badge variant="neutral">string</Badge>;
      case "number":
        return <Badge variant="info">number</Badge>;
      case "boolean":
        return <Badge variant="warning">boolean</Badge>;
      case "date":
        return <Badge variant="success">date</Badge>;
      case "object":
      case "array":
        return <Badge variant="default">{type}</Badge>;
      case "mixed":
        return <Badge variant="danger">mixed</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            <th className="px-4 py-3">Putanja kolone (Dot-path)</th>
            <th className="px-3 py-3">Tip</th>
            <th className="px-4 py-3">Null Stopa</th>
            <th className="px-3 py-3">Jedinstvenih (Procena)</th>
            <th className="px-3 py-3">Min / Max / Prosek</th>
            <th className="px-4 py-3">Česte vrednosti (Top Values)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stats.map((col) => {
            const nullRatio = totalRecords > 0 ? col.nullCount / totalRecords : 0;
            const nullPercent = formatPercent(nullRatio);

            return (
              <tr key={col.path} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-slate-900">
                  {col.path}
                </td>
                <td className="px-3 py-3">{getTypeBadge(col.inferredType)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          nullRatio > 0.3
                            ? "bg-rose-500"
                            : nullRatio > 0.05
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(nullRatio * 100, 100)}%` }}
                      />
                    </div>
                    <span className="font-medium text-slate-700">{nullPercent}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-slate-800">
                  ~{formatNumber(col.distinctEstimate)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {col.inferredType === "number" && col.average !== undefined ? (
                    <div className="space-y-0.5">
                      <div>
                        <span className="text-slate-400 text-[10px]">Avg:</span>{" "}
                        <span className="font-semibold">{formatNumber(Math.round(col.average * 100) / 100)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        [{formatNumber(col.min as number)} … {formatNumber(col.max as number)}]
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {col.topValues && col.topValues.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-sm">
                      {col.topValues.slice(0, 4).map((tv, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700"
                        >
                          <span className="truncate max-w-[120px] font-medium">{tv.value}</span>
                          <span className="ml-1 text-slate-400 text-[10px]">({tv.count})</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
