import React from "react";
import { DatasetVersion } from "@/lib/domain/types";
import { formatNumber } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/dates";
import { Badge } from "../ui/badge";
import { History, Check, ArrowRight } from "lucide-react";

interface VersionHistoryProps {
  versions: DatasetVersion[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  selectedVersionId,
  onSelectVersion,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Istorija verzija dataset-a ({versions.length})
        </h3>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Izaberite verziju za analizu i chat</span>
      </div>

      <div className="space-y-2">
        {versions.map((ver) => {
          const isSelected = ver.id === selectedVersionId;

          return (
            <div
              key={ver.id}
              onClick={() => onSelectVersion(ver.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                isSelected
                  ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-400/40"
                  : "bg-zinc-50/60 dark:bg-zinc-800/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/80 border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    isSelected
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  v{ver.versionNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Verzija {ver.versionNumber}
                    </span>
                    <Badge
                      variant={
                        ver.status === "ready"
                          ? "success"
                          : ver.status === "partial"
                          ? "warning"
                          : "danger"
                      }
                      className="text-[10px] py-0"
                    >
                      {ver.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {formatNumber(ver.totalRecords)} zapisa · {ver.totalFiles} fajlova · {formatDate(ver.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isSelected ? (
                  <span className="inline-flex items-center text-xs text-indigo-600 dark:text-indigo-400 font-medium gap-1">
                    <Check className="w-4 h-4" /> Aktivna
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 gap-1">
                    Izaberi <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
