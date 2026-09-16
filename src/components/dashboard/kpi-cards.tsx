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
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Ukupno zapisa",
      value: formatNumber(totalRecords),
      subtitle: snapshot?.duplicateCount ? `${snapshot.duplicateCount} duplikata` : "Čisti zapisi",
      icon: Database,
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Broj kolona",
      value: formatNumber(columnCount),
      subtitle: "Inicijalna šema",
      icon: Columns,
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      label: "Procenat Null vrednosti",
      value: formatPercent(overallNullPercent),
      subtitle: "Po svim kolonama",
      icon: Percent,
      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Greške obrade",
      value: formatNumber(version.errorCount),
      subtitle: version.errorCount > 0 ? "Zahteva proveru" : "Bez grešaka",
      icon: AlertOctagon,
      color: version.errorCount > 0 ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5">{kpi.value}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{kpi.subtitle}</p>
            </div>
            <div className={`p-2.5 rounded-xl border ${kpi.color}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
