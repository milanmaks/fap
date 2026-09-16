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
    <div className="mt-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-800/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-semibold text-[11px] text-zinc-700 dark:text-zinc-300">
            Validiran Query Plan ({plan.operation})
          </span>
          {mode && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-[10px] font-mono">
              {mode}
            </span>
          )}
          {confidence && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                confidence === "high"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                  : confidence === "medium"
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                  : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
              }`}
            >
              {confidence}
            </span>
          )}
        </div>
        <div>{open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</div>
      </button>

      {open && (
        <div className="p-3 bg-zinc-900 text-zinc-100 font-mono text-[11px] overflow-x-auto border-t border-zinc-200 dark:border-zinc-800">
          <pre>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
