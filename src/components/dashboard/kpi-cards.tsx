import React from "react";
import { Files, Database, Columns, AlertOctagon, Percent } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import { AnalyticsSnapshot, DatasetVersion } from "@/lib/domain/types";

interface KpiCardsProps {
  version: DatasetVersion;
  snapshot: AnalyticsSnapshot | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ version, snapshot }) => {
  const totalRecords = snapshot?.recordCount ?? version.totalRecords;
  const columnCount = version.schema?.fields?.length ?? snapshot?.columnStats?.length ?? 0;

  // Calculate overall null percentage across all column statistics
  let overallNullPercent = 0;
  if (snapshot && snapshot.columnStats.length > 0 && totalRecords > 0) {
    const totalNulls = snapshot.columnStats.reduce((sum, col) => sum + col.nullCount, 0);
    const totalPossible = totalRecords * snapshot.columnStats.length;
    overallNullPercent = totalPossible > 0 ? totalNulls / totalPossible : 0;
  }

  const kpis = [
    {
      label: "Ukupno fajlova",
      value: formatNumber(version.totalFiles),
      subtitle: `${version.processedFiles} obrađeno`,
      icon: Files,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      label: "Ukupno zapisa",
      value: formatNumber(totalRecords),
      subtitle: snapshot?.duplicateCount ? `${snapshot.duplicateCount} duplikata` : "Čisti zapisi",
      icon: Database,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      label: "Broj kolona",
      value: formatNumber(columnCount),
      subtitle: "Inicijalna šema",
      icon: Columns,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
      label: "Procenat Null vrednosti",
      value: formatPercent(overallNullPercent),
      subtitle: "Po svim kolonama",
      icon: Percent,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      label: "Greške obrade",
      value: formatNumber(version.errorCount),
      subtitle: version.errorCount > 0 ? "Zahteva proveru" : "Bez grešaka",
      icon: AlertOctagon,
      color: version.errorCount > 0 ? "text-rose-600 bg-rose-50 border-rose-100" : "text-slate-600 bg-slate-50 border-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{kpi.subtitle}</p>
            </div>
            <div className={`p-3 rounded-xl border ${kpi.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
