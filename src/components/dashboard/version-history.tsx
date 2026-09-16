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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          Istorija verzija dataset-a ({versions.length})
        </h3>
        <span className="text-[11px] text-slate-400">Izaberite verziju za analizu i chat</span>
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
                  ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/50"
                  : "bg-slate-50/60 hover:bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  v{ver.versionNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">
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
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatNumber(ver.totalRecords)} zapisa · {ver.totalFiles} fajlova · {formatDate(ver.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isSelected ? (
                  <span className="inline-flex items-center text-xs text-indigo-600 font-medium gap-1">
                    <Check className="w-4 h-4" /> Aktivna
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs text-slate-400 hover:text-slate-600 gap-1">
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
