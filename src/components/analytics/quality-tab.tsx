"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QualityScoreBreakdown, QualityRuleEvaluation } from "@/lib/domain/types";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Info,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface QualityTabProps {
  datasetId: string;
  versionId: string;
  versionNumber?: number;
}

export const QualityTab: React.FC<QualityTabProps> = ({
  datasetId,
  versionId,
  versionNumber,
}) => {
  const [quality, setQuality] = useState<QualityScoreBreakdown | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const loadQuality = useCallback(async () => {
    if (!datasetId || !versionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/quality?versionId=${versionId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Greška pri učitavanju ocene kvaliteta.");
      }
      setQuality(data.quality);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [datasetId, versionId]);

  useEffect(() => {
    loadQuality();
  }, [loadQuality]);

  const getGradeBadge = (grade: QualityScoreBreakdown["grade"]) => {
    switch (grade) {
      case "odlicno":
        return <Badge variant="success">Odličan kvalitet</Badge>;
      case "dobro":
        return <Badge variant="info">Dobar kvalitet</Badge>;
      case "upozorenje":
        return <Badge variant="warning">Upozorenje</Badge>;
      case "kriticno":
        return <Badge variant="danger">Kritično</Badge>;
    }
  };

  const getStatusBadge = (status: QualityRuleEvaluation["status"]) => {
    switch (status) {
      case "pass":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> PASS
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> UPOZORENJE
          </span>
        );
      case "fail":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> FAIL
          </span>
        );
      case "not_applicable":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <HelpCircle className="w-3 h-3" /> N/A
          </span>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Evaluacija pravila i izračunavanje skora kvaliteta...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !quality) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-rose-600 dark:text-rose-400 text-xs">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">{error || "Podaci o kvalitetu nisu dostupni."}</p>
          <Button variant="outline" size="sm" onClick={loadQuality} className="mt-3 text-xs">
            Pokušaj ponovo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scoreColor =
    quality.score >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : quality.score >= 75
      ? "text-indigo-600 dark:text-indigo-400"
      : quality.score >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-6">
      {/* Top Header Card with Overall Score */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Circular/Numeric Indicator */}
            <div className="w-24 h-24 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-2 border-indigo-100 dark:border-indigo-900/50 flex flex-col items-center justify-center shadow-inner">
              <span className={`text-3xl font-black ${scoreColor} tracking-tight`}>
                {Math.round(quality.score)}
              </span>
              <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                / 100
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                  Ocena Kvaliteta Podataka {versionNumber ? `(v${versionNumber})` : ""}
                </h2>
                {getGradeBadge(quality.grade)}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                Heuristička ocena izračunata na osnovu ponderisane evaluacije 6 dimenzija kvaliteta i
                domenskih telemetrijskih pravila.
              </p>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-1 block">
                Generisano: {new Date(quality.generatedAt).toLocaleString("sr-RS")}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadQuality}
            className="text-xs gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Osveži ocenu</span>
          </Button>
        </div>
      </div>

      {/* 6 Dimensions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quality.dimensions.map((dim, idx) => {
          const dimPct = dim.score;
          const barColor =
            dimPct >= 90
              ? "bg-emerald-500"
              : dimPct >= 75
              ? "bg-indigo-600 dark:bg-indigo-500"
              : dimPct >= 50
              ? "bg-amber-500"
              : "bg-rose-500";

          const dimLabels: Record<string, string> = {
            completeness: "Kompletnost (Completeness)",
            validity: "Validnost (Validity)",
            uniqueness: "Jedinstvenost (Uniqueness)",
            consistency: "Konzistentnost (Consistency)",
            freshness: "Svežina (Freshness)",
            schema_stability: "Stabilnost Šeme (Stability)",
          };

          return (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {dimLabels[dim.dimension] || dim.dimension}
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">{dim.score}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div style={{ width: `${Math.min(100, Math.max(0, dimPct))}%` }} className={`h-full ${barColor}`} />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                <span className="truncate pr-2">{dim.explanation}</span>
                <span className="font-mono shrink-0">Težina: {Math.round(dim.weight * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quality Rules Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Evaluacija Pravila Kvaliteta ({quality.rules.length})
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pojedinačna provera integriteta, domenskih granica, mrežnog statusa i vremenskih intervala.
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {quality.rules.map((rule, idx) => {
            const isExpanded = expandedRule === rule.ruleId;
            return (
              <div key={idx} className="p-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(rule.status)}
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {rule.ruleName || rule.ruleId}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{rule.explanation}</p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      Pogođeno: <strong className="text-zinc-800 dark:text-zinc-200">{rule.affectedRecordCount}</strong> (
                      {Math.round(rule.affectedPercent * 10) / 10}%)
                    </span>
                    {rule.examples.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedRule(isExpanded ? null : rule.ruleId)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-semibold flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? "Zatvori" : "Primeri"}</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && rule.examples.length > 0 && (
                  <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs space-y-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 block text-[11px]">
                      Primeri zapisa koji krše pravilo (do {rule.examples.length}):
                    </span>
                    <div className="space-y-1.5">
                      {rule.examples.map((ex, exIdx) => (
                        <pre
                          key={exIdx}
                          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-mono overflow-x-auto text-zinc-800 dark:text-zinc-200"
                        >
                          {JSON.stringify(ex.values, null, 2)}
                        </pre>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
