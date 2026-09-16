import React, { useState } from "react";
import { QueryPlan } from "@/lib/domain/types";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";

interface QueryPlanCardProps {
  plan?: QueryPlan;
  confidence?: "high" | "medium" | "low";
  mode?: string;
}

export const QueryPlanCard: React.FC<QueryPlanCardProps> = ({ plan, confidence, mode }) => {
  const [open, setOpen] = useState(false);

  if (!plan) return null;

  return (
    <div className="mt-2 text-xs border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-semibold text-[11px] text-slate-700">
            Validiran Query Plan ({plan.operation})
          </span>
          {mode && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[10px] font-mono">
              {mode}
            </span>
          )}
          {confidence && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                confidence === "high"
                  ? "bg-emerald-100 text-emerald-800"
                  : confidence === "medium"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {confidence}
            </span>
          )}
        </div>
        <div>{open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</div>
      </button>

      {open && (
        <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border-t border-slate-200">
          <pre>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
