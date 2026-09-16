"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DatasetVersion, VersionDiff, ColumnDiff, RowComparisonClassification } from "@/lib/domain/types";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ArrowRight,
  GitCompare,
  Layers,
  Clock,
  Smartphone,
  MapPin,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface VersionCompareTabProps {
  datasetId: string;
  versions: DatasetVersion[];
  currentVersionId: string;
}

export const VersionCompareTab: React.FC<VersionCompareTabProps> = ({
  datasetId,
  versions,
  currentVersionId,
}) => {
  const readyVersions = versions.filter((v) => v.status === "ready" || v.status === "partial");

  const [targetVersionId, setTargetVersionId] = useState<string>(
    currentVersionId || (readyVersions[0]?.id ?? "")
  );
  const [baseVersionId, setBaseVersionId] = useState<string>(
    readyVersions.find((v) => v.id !== currentVersionId)?.id || (readyVersions[1]?.id ?? "")
  );

  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [available, setAvailable] = useState<boolean>(true);
  const [notAvailableMsg, setNotAvailableMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [driftFilter, setDriftFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [selectedExample, setSelectedExample] = useState<number | null>(null);

  const loadDiff = useCallback(async () => {
    if (!baseVersionId || !targetVersionId || baseVersionId === targetVersionId) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/diff?baseVersionId=${baseVersionId}&targetVersionId=${targetVersionId}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Greška pri učitavanju poređenja verzija.");
      }

      if (data.available === false) {
        setAvailable(false);
        setNotAvailableMsg(data.message || "Poređenje nije dostupno.");
        setDiff(null);
      } else {
        setAvailable(true);
        setDiff(data.diff);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [datasetId, baseVersionId, targetVersionId]);

  useEffect(() => {
    if (readyVersions.length < 2) {
      setAvailable(false);
      setNotAvailableMsg(
        "Za poređenje verzija potreban je uvoz najmanje dve verzije dataset-a. Trenutno postoji samo jedna verzija."
      );
    } else {
      loadDiff();
    }
  }, [loadDiff, readyVersions.length]);

  if (readyVersions.length < 2 || !available) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-12 text-center">
          <GitCompare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Poređenje verzija nije dostupno</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {notAvailableMsg ||
              "Za poređenje i otkrivanje preklapanja potreban je uvoz najmanje dve verzije dataset-a."}
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg border border-indigo-100">
            <Info className="w-3.5 h-3.5" />
            Otpremite novi fajl ili ZIP arhivu u ovaj dataset kako bi se kreirala v2 za poređenje.
          </div>
        </CardContent>
      </Card>
    );
  }

  const baseVer = readyVersions.find((v) => v.id === baseVersionId);
  const targetVer = readyVersions.find((v) => v.id === targetVersionId);

  const filteredDrift = diff?.schemaDrift.filter((d) => {
    if (driftFilter === "all") return true;
    return d.severity === driftFilter;
  });

  const getSeverityBadge = (sev: ColumnDiff["severity"]) => {
    switch (sev) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
            Kritično
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            Upozorenje
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Info
          </span>
        );
    }
  };

  const getClassificationBadge = (cls: RowComparisonClassification) => {
    switch (cls) {
      case "exact_duplicate":
        return (
          <Badge variant="warning" className="gap-1">
            Identičan duplikat
          </Badge>
        );
      case "changed":
        return (
          <Badge variant="info" className="gap-1">
            Izmenjen događaj
          </Badge>
        );
      case "new":
        return (
          <Badge variant="success" className="gap-1">
            Novi zapis
          </Badge>
        );
      case "removed_from_current_version":
        return (
          <Badge variant="danger" className="gap-1">
            Uklonjen iz ove verzije
          </Badge>
        );
      default:
        return <Badge variant="neutral">{cls}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Version Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Uporedi verziju:
          </span>
          <div className="flex items-center gap-2">
            <select
              value={targetVersionId}
              onChange={(e) => setTargetVersionId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {readyVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} ({new Date(v.createdAt).toLocaleDateString("sr-RS")})
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400 font-medium">naspram (bazna):</span>
            <select
              value={baseVersionId}
              onChange={(e) => setBaseVersionId(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {readyVersions
                .filter((v) => v.id !== targetVersionId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} ({new Date(v.createdAt).toLocaleDateString("sr-RS")})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDiff}
            disabled={loading}
            className="gap-1 text-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Osveži diff</span>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Analiza razlika i preklapanja u toku...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && diff && (
        <>
          {/* KPI Delta Table */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "Zapisa",
                delta: diff.kpis.recordCount,
                unit: "",
              },
              {
                label: "Fajlova",
                delta: diff.kpis.fileCount,
                unit: "",
              },
              {
                label: "Kolona",
                delta: diff.kpis.columnCount,
                unit: "",
              },
              {
                label: "Null Stopa",
                delta: diff.kpis.overallNullRate,
                unit: "%",
                reverseColor: true,
              },
              {
                label: "Duplikata",
                delta: diff.kpis.duplicateCount,
                unit: "",
                reverseColor: true,
              },
              {
                label: "Uređaja (instanceId)",
                delta: diff.kpis.uniqueDeviceCount || { before: 0, after: 0, absoluteDelta: 0, percentDelta: 0 },
                unit: "",
              },
            ].map((kpi, idx) => {
              const abs = kpi.delta.absoluteDelta;
              const isPositive = abs > 0;
              const isZero = abs === 0;
              const isGood = kpi.reverseColor ? !isPositive : isPositive;

              const badgeColor = isZero
                ? "text-slate-500 bg-slate-100"
                : isGood
                ? "text-emerald-700 bg-emerald-50"
                : "text-rose-700 bg-rose-50";

              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1.5"
                >
                  <span className="text-[11px] font-semibold text-slate-500 block truncate">
                    {kpi.label}
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-slate-900">
                      {kpi.delta.after}
                      {kpi.unit}
                    </span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
                      {abs > 0 ? `+${abs}` : abs}
                      {kpi.delta.percentDelta !== null && kpi.delta.percentDelta !== 0
                        ? ` (${kpi.delta.percentDelta > 0 ? "+" : ""}${kpi.delta.percentDelta}%)`
                        : ""}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Prethodno: {kpi.delta.before}
                    {kpi.unit}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Overlap Summary Dashboard */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Preklapanje zapisa i resursa (Overlap Dashboard)
                </h3>
                <p className="text-xs text-slate-500">
                  Višeslojna analiza preklapanja: isti fajl, kanonski hash, poslovni ključ (business key) i prostorno-vremensko pokrivanje.
                </p>
              </div>
            </div>

            {/* Overlap Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Target zapisa</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{diff.kpis.recordCount.after}</p>
                <span className="text-[10px] text-slate-400">100% u v{targetVer?.versionNumber}</span>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                <span className="text-[10px] font-semibold text-emerald-800 uppercase">Novi zapisi</span>
                <p className="text-base font-bold text-emerald-700 mt-0.5">{diff.overlap.newRecords}</p>
                <span className="text-[10px] text-emerald-600">
                  {diff.kpis.recordCount.after > 0
                    ? `${Math.round((diff.overlap.newRecords / diff.kpis.recordCount.after) * 100)}% celog uvoza`
                    : "0%"}
                </span>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80">
                <span className="text-[10px] font-semibold text-amber-800 uppercase">Identični duplikati</span>
                <p className="text-base font-bold text-amber-700 mt-0.5">
                  {diff.overlap.exactDuplicateRecords}
                </p>
                <span className="text-[10px] text-amber-600">Kanonski identični</span>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200/80">
                <span className="text-[10px] font-semibold text-indigo-800 uppercase">Izmenjeni zapisi</span>
                <p className="text-base font-bold text-indigo-700 mt-0.5">{diff.overlap.changedRecords}</p>
                <span className="text-[10px] text-indigo-600">Isti poslovni ID</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" /> Vreme preklapanje
                </span>
                <p className="text-base font-bold text-slate-800 mt-0.5">
                  {diff.overlap.temporalOverlapPercent !== null
                    ? `${diff.overlap.temporalOverlapPercent}%`
                    : "Nije dostupno"}
                </p>
                <span className="text-[10px] text-slate-400">Timestamp interval</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-slate-400" /> Uređaji presek
                </span>
                <p className="text-base font-bold text-slate-800 mt-0.5">
                  {diff.overlap.deviceOverlapPercent !== null
                    ? `${diff.overlap.deviceOverlapPercent}%`
                    : "Nije dostupno"}
                </p>
                <span className="text-[10px] text-slate-400">instanceId skup</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-600 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Prostorni presek
                </span>
                <p className="text-base font-bold text-slate-800 mt-0.5">
                  {diff.overlap.spatialOverlapPercent !== null
                    ? `${diff.overlap.spatialOverlapPercent}%`
                    : "Nije dostupno"}
                </p>
                <span className="text-[10px] text-slate-400">H3 & GPS poklapanje</span>
              </div>
            </div>

            {/* Stacked Visual Bar */}
            {diff.kpis.recordCount.after > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Distribucija strukture zapisa u novoj verziji:</span>
                  <span>Ukupno {diff.kpis.recordCount.after} zapisa</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${(diff.overlap.newRecords / diff.kpis.recordCount.after) * 100}%`,
                    }}
                    className="bg-emerald-500 h-full"
                    title={`Novi zapisi: ${diff.overlap.newRecords}`}
                  />
                  <div
                    style={{
                      width: `${(diff.overlap.exactDuplicateRecords / diff.kpis.recordCount.after) * 100}%`,
                    }}
                    className="bg-amber-400 h-full"
                    title={`Identični duplikati: ${diff.overlap.exactDuplicateRecords}`}
                  />
                  <div
                    style={{
                      width: `${(diff.overlap.changedRecords / diff.kpis.recordCount.after) * 100}%`,
                    }}
                    className="bg-indigo-500 h-full"
                    title={`Izmenjeni zapisi: ${diff.overlap.changedRecords}`}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-600 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Novi zapisi ({diff.overlap.newRecords})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Identični duplikati ({diff.overlap.exactDuplicateRecords})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    Izmenjeni zapisi ({diff.overlap.changedRecords})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Schema Drift Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Promene u šemi podataka (Schema Drift: {diff.schemaDrift.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Praćenje dodatih, uklonjenih ili promenjenih kolona, null stopa i tipova podataka.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {(["all", "critical", "warning", "info"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDriftFilter(filter)}
                    className={`px-2.5 py-1 rounded-md transition font-medium capitalize ${
                      driftFilter === filter
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {filter === "all" ? "Sve promene" : filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredDrift && filteredDrift.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Putanja kolone</th>
                      <th className="px-3 py-2.5">Tip promene</th>
                      <th className="px-3 py-2.5">Ozbiljnost</th>
                      <th className="px-3 py-2.5">Prethodna vrednost</th>
                      <th className="px-3 py-2.5">Nova vrednost</th>
                      <th className="px-4 py-2.5">Objašnjenje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDrift.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-900">
                          {item.columnPath}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 uppercase text-[10px]">
                          {item.changeType.replace("_", " ")}
                        </td>
                        <td className="px-3 py-2.5">{getSeverityBadge(item.severity)}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">
                          {item.before !== undefined ? String(item.before) : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-900 font-medium">
                          {item.after !== undefined ? String(item.after) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{item.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Nema detektovanih promena šeme za izabrani filter.
              </div>
            )}
          </div>

          {/* Representative Record Overlap Examples */}
          {diff.recordExamples.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Reprezentativni primeri preklapanja i izmena zapisa ({diff.recordExamples.length})
              </h3>
              <div className="space-y-2">
                {diff.recordExamples.map((ex, idx) => {
                  const isExpanded = selectedExample === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedExample(isExpanded ? null : idx)}
                        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/70 transition"
                      >
                        <div className="flex items-center gap-2">
                          {getClassificationBadge(ex.classification)}
                          <span className="text-xs font-mono text-slate-700">
                            {ex.lineage?.sourceFileName ? ex.lineage.sourceFileName : `Zapis #${idx + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {ex.businessKeyHash && (
                            <span className="font-mono text-[10px] hidden sm:inline">
                              BK: {ex.businessKeyHash.slice(0, 12)}...
                            </span>
                          )}
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 border-t border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-semibold text-slate-600 block mb-1 text-[11px]">
                              Prethodna verzija (v{baseVer?.versionNumber}):
                            </span>
                            {ex.previous ? (
                              <pre className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono overflow-x-auto max-h-56">
                                {JSON.stringify(ex.previous, null, 2)}
                              </pre>
                            ) : (
                              <p className="text-slate-400 italic">Zapis nije postojao u prethodnoj verziji.</p>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600 block mb-1 text-[11px]">
                              Nova verzija (v{targetVer?.versionNumber}):
                            </span>
                            {ex.current ? (
                              <pre className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono overflow-x-auto max-h-56">
                                {JSON.stringify(ex.current, null, 2)}
                              </pre>
                            ) : (
                              <p className="text-slate-400 italic">Zapis uklonjen u ovoj verziji.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
