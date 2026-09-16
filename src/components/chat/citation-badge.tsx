import React from "react";
import { DataCitation } from "@/lib/domain/types";
import { formatCitation } from "@/lib/domain/citations";
import { Tag } from "lucide-react";

interface CitationBadgeProps {
  citations: DataCitation[];
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100">
      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mb-1">
        <Tag className="w-3 h-3 text-indigo-500" />
        Izvori podataka (Lineage Citations):
      </div>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-mono"
          >
            {formatCitation(c)}
          </span>
        ))}
      </div>
    </div>
  );
};
