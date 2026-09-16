"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DatasetVersion,
  VersionDiff,
  ColumnDiff,
  RowComparisonClassification,
  SourceFile,
} from "@/lib/domain/types";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatBytes } from "@/lib/utils/format";
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
  RefreshCw,
  FileCode,
  FolderGit2,
  ArrowLeftRight,
  UploadCloud,
  Sparkles,
} from "lucide-react";

interface VersionCompareTabProps {
  datasetId: string;
  datasetName?: string;
  versions: DatasetVersion[];
  currentVersionId: string;
  sourceFiles?: SourceFile[];
  onUploadSuccess?: (result: any) => void;
}

export const VersionCompareTab: React.FC<VersionCompareTabProps> = ({
  datasetId,
  datasetName,
  versions,
  currentVersionId,
  sourceFiles = [],
  onUploadSuccess,
}) => {
  const readyVersions = useMemo(
    () => versions.filter((v) => v.status === "ready" || v.status === "partial"),
    [versions]
  );

  const validFiles = useMemo(
    () => sourceFiles.filter((f) => f.status === "ready" && f.fileType !== "zip"),
    [sourceFiles]
  );

  // Režim poređenja: "versions" ili "files"
  const [diffMode, setDiffMode] = useState<"versions" | "files">(() => {
    return readyVersions.length < 2 && validFiles.length >= 2 ? "files" : "versions";
  });

  useEffect(() => {
    if (readyVersions.length < 2 && validFiles.length >= 2) {
      setDiffMode("files");
    }
  }, [readyVersions.length, validFiles.length]);

  const [targetVersionId, setTargetVersionId] = useState<string>(
    currentVersionId || (readyVersions[0]?.id ?? "")
  );
  const [baseVersionId, setBaseVersionId] = useState<string>(
    readyVersions.find((v) => v.id !== currentVersionId)?.id || (readyVersions[1]?.id ?? "")
  );

  const [fileIdA, setFileIdA] = useState<string>(validFiles[0]?.id ?? "");
  const [fileIdB, setFileIdB] = useState<string>(validFiles[1]?.id ?? "");

  useEffect(() => {
    if (validFiles.length >= 2) {
      if (!fileIdA || !validFiles.some((f) => f.id === fileIdA)) {
        setFileIdA(validFiles[0].id);
      }
      if (!fileIdB || !validFiles.some((f) => f.id === fileIdB) || fileIdB === fileIdA) {
        const other = validFiles.find((f) => f.id !== fileIdA) || validFiles[1];
        if (other) setFileIdB(other.id);
      }
    }
  }, [validFiles, fileIdA, fileIdB]);

  useEffect(() => {
    if (readyVersions.length >= 2) {
      if (!targetVersionId || !readyVersions.some((v) => v.id === targetVersionId)) {
        setTargetVersionId(readyVersions[0].id);
      }
      if (
        !baseVersionId ||
        !readyVersions.some((v) => v.id === baseVersionId) ||
        baseVersionId === targetVersionId
      ) {
        const other = readyVersions.find((v) => v.id !== (targetVersionId || readyVersions[0]?.id));
        if (other) setBaseVersionId(other.id);
      }
    }
  }, [readyVersions, targetVersionId, baseVersionId]);

  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [available, setAvailable] = useState<boolean>(true);
  const [notAvailableMsg, setNotAvailableMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [driftFilter, setDriftFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [selectedExample, setSelectedExample] = useState<number | null>(null);

  const [uploadingInline, setUploadingInline] = useState(false);
  const [inlineUploadError, setInlineUploadError] = useState<string | null>(null);
  const [seedingV2, setSeedingV2] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadDiff = useCallback(async () => {
    setError(null);

    if (diffMode === "files") {
      if (!fileIdA || !fileIdB || fileIdA === fileIdB) {
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/datasets/${datasetId}/diff?mode=files&fileIdA=${fileIdA}&fileIdB=${fileIdB}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Greška pri učitavanju poređenja fajlova.");

        if (data.available === false) {
          setAvailable(false);
          setNotAvailableMsg(data.message || "Poređenje fajlova nije dostupno.");
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
      return;
    }

    if (readyVersions.length < 2) {
      setAvailable(false);
      setNotAvailableMsg(
        "Za poređenje verzija potreban je uvoz najmanje dve verzije dataset-a. Trenutno postoji samo jedna verzija."
      );
      setDiff(null);
      return;
    }

    if (!baseVersionId || !targetVersionId || baseVersionId === targetVersionId) {
      return;
    }

    setLoading(true);
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
  }, [datasetId, diffMode, fileIdA, fileIdB, baseVersionId, targetVersionId, readyVersions.length]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const handleSwapFiles = () => {
    const tmp = fileIdA;
    setFileIdA(fileIdB);
    setFileIdB(tmp);
  };

  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingInline(true);
    setInlineUploadError(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      formData.append("datasetId", datasetId);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Greška pri uploadu nove verzije.");

      if (onUploadSuccess) {
        await onUploadSuccess(data);
      }
      setDiffMode("versions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setInlineUploadError(msg);
    } finally {
      setUploadingInline(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSeedV2 = async () => {
    setSeedingV2(true);
    setInlineUploadError(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/seed-v2`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Greška pri kreiranju test verzije 2.");

      if (onUploadSuccess) {
        await onUploadSuccess({ datasetId, version: data.version });
      }
      setDiffMode("versions");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setInlineUploadError(msg);
    } finally {
      setSeedingV2(false);
    }
  };

  const filteredDrift = diff?.schemaDrift.filter((d) => {
    if (driftFilter === "all") return true;
    return d.severity === driftFilter;
  });

  const getSeverityBadge = (sev: ColumnDiff["severity"]) => {
    switch (sev) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            Kritično
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            Upozorenje
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            Info
          </span>
        );
    }
  };

  const getClassificationBadge = (cls: RowComparisonClassification) => {
    switch (cls) {
      case "exact_duplicate":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Identičan duplikat
          </span>
        );
      case "changed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Izmenjen zapis
          </span>
        );
      case "new":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Novi zapis
          </span>
        );
      case "removed_from_current_version":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Uklonjen zapis
          </span>
        );
      default:
        return <Badge variant="neutral">{cls}</Badge>;
    }
  };

  const showVersionEmptyState = diffMode === "versions" && readyVersions.length < 2;

  return (
    <div className="space-y-4">
      {/* 1. Selektor režima: Verzija vs Fajlovi */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              Modul za poređenje i detekciju preklapanja
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Poređenje verzija dataset-a ili direktno poređenje dva Avro / JSON fajla.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs">
          <button
            type="button"
            onClick={() => setDiffMode("versions")}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
              diffMode === "versions"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Poređenje verzija ({readyVersions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDiffMode("files")}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
              diffMode === "files"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Poređenje 2 fajla ({validFiles.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Selektori entiteta */}
      {diffMode === "files" ? (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-sky-500" />
              Izaberite dva fajla za inspekciju razlika i preklapanja:
            </span>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
              Fajlova u uvozu: {validFiles.length}
            </span>
          </div>

          {validFiles.length < 2 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              Potrebna su najmanje 2 fajla u ovom uvozu za poređenje fajl-na-fajl. Trenutno postoji{" "}
              {validFiles.length} fajl.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Fajl A (Baza za poređenje):
                </label>
                <select
                  value={fileIdA}
                  onChange={(e) => setFileIdA(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 font-mono truncate"
                >
                  {validFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.originalName} ({formatBytes(f.sizeBytes)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={handleSwapFiles}
                  title="Zameni mesta Fajl A i Fajl B"
                  className="p-2 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition"
                >
                  <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Fajl B (Cilj):
                </label>
                <select
                  value={fileIdB}
                  onChange={(e) => setFileIdB(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 font-mono truncate"
                >
                  {validFiles.map((f) => (
                    <option key={f.id} value={f.id} disabled={f.id === fileIdA}>
                      {f.originalName} ({formatBytes(f.sizeBytes)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ) : (
        !showVersionEmptyState && (
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Baza:</span>
                <select
                  value={baseVersionId}
                  onChange={(e) => setBaseVersionId(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {readyVersions.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.id === targetVersionId}>
                      v{v.versionNumber} ({v.totalRecords} zapisa)
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 hidden sm:block" />

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Poređenje:</span>
                <select
                  value={targetVersionId}
                  onChange={(e) => setTargetVersionId(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {readyVersions.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.id === baseVersionId}>
                      v{v.versionNumber} ({v.totalRecords} zapisa)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDiff}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Osveži
            </Button>
          </div>
        )
      )}

      {/* 3. Empty State za Verzije */}
      {showVersionEmptyState && (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <GitCompare className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Poređenje verzija zahteva najmanje dve verzije
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Trenutno dataset ima samo 1 verziju (v1). Za poređenje verzija i detekciju evolucije
                šeme potrebno je uneti novi uvoz u ovaj dataset.
              </p>
            </div>

            {validFiles.length >= 2 && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-lg text-xs text-sky-800 dark:text-sky-300 flex items-center justify-between text-left">
                <div>
                  <span className="font-semibold block">Dostupno {validFiles.length} fajlova u ovoj verziji</span>
                  <span className="text-[11px] text-sky-600 dark:text-sky-400">
                    Možete odmah porediti bilo koja dva Avro fajla jedan protiv drugog.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setDiffMode("files")}
                  className="bg-sky-600 hover:bg-sky-700 text-white shrink-0 ml-3 text-xs"
                >
                  Uporedi 2 fajla
                </Button>
              </div>
            )}

            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl p-6 transition text-center space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".avro,.json,.jsonl,.ndjson,.zip"
                className="hidden"
                onChange={handleInlineUpload}
              />
              <UploadCloud className="w-7 h-7 text-indigo-600 dark:text-indigo-400 mx-auto" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs block">
                  Otpremite novi fajl ili ZIP za kreiranje verzije 2
                </span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Automatski će biti dodat u dataset <strong>{datasetName || datasetId}</strong>.
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingInline || seedingV2}
                  className="text-xs"
                >
                  {uploadingInline ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Profilisanje v2...
                    </>
                  ) : (
                    "Izaberi fajl za v2"
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedV2}
                  disabled={uploadingInline || seedingV2}
                  className="text-xs border-indigo-200 dark:border-zinc-700 text-indigo-700 dark:text-indigo-300"
                >
                  {seedingV2 ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Generisanje...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Kreiraj test v2
                    </>
                  )}
                </Button>
              </div>

              {inlineUploadError && (
                <div className="text-xs text-rose-600 font-medium pt-1">
                  Greška: {inlineUploadError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-16 text-center text-slate-400 dark:text-zinc-500 space-y-2">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs">Izračunavanje preklapanja, heševa i evolucije šeme...</p>
        </div>
      )}

      {!loading && diff && (
        <>
          {/* Oznaka šta se poredi */}
          <div className="bg-slate-100/80 dark:bg-zinc-800/60 px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs flex items-center justify-between text-slate-700 dark:text-zinc-300">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 dark:text-zinc-400">
                {diff.comparisonType === "files" ? "Poređenje fajlova:" : "Poređenje verzija:"}
              </span>
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {diff.baseLabel}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {diff.targetLabel}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
              Generisano: {new Date(diff.generatedAt).toLocaleTimeString("sr-RS")}
            </span>
          </div>

          {/* KPI Delta kartice */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Broj Zapisa
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.recordCount.after.toLocaleString()}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.recordCount.absoluteDelta >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {diff.kpis.recordCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.recordCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.recordCount.before.toLocaleString()}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Fajlovi
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.fileCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.fileCount.absoluteDelta >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {diff.kpis.fileCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.fileCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.fileCount.before}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Broj Kolona
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.columnCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.columnCount.absoluteDelta >= 0 ? "text-indigo-500" : "text-amber-500"
                  }`}
                >
                  {diff.kpis.columnCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.columnCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.columnCount.before}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Prosečan Null
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.overallNullRate.after}%
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.overallNullRate.absoluteDelta <= 0
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {diff.kpis.overallNullRate.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.overallNullRate.absoluteDelta} pp
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.overallNullRate.before}%
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Duplikata
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.duplicateCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.duplicateCount.absoluteDelta <= 0
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {diff.kpis.duplicateCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.duplicateCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.duplicateCount.before}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Uređaji (Devices)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.kpis.uniqueDeviceCount?.after ?? "-"}
                </span>
                {diff.kpis.uniqueDeviceCount && (
                  <span
                    className={`text-xs font-bold ${
                      diff.kpis.uniqueDeviceCount.absoluteDelta >= 0
                        ? "text-emerald-500"
                        : "text-slate-400"
                    }`}
                  >
                    {diff.kpis.uniqueDeviceCount.absoluteDelta >= 0 ? "+" : ""}
                    {diff.kpis.uniqueDeviceCount.absoluteDelta}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-mono">
                Baza: {diff.kpis.uniqueDeviceCount?.before ?? "-"}
              </span>
            </div>
          </div>

          {/* 5. Overlap Detection */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Višeslojna detekcija preklapanja podataka
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Identifikacija identičnih zapisa (SHA-256), poslovnih duplikata i domenskog preklapanja.
                </p>
              </div>

              {diff.overlap.exactFiles > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-lg border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {diff.overlap.exactFiles} re-uvezan identičan fajl
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-700/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  Nivo 2: Kanonski duplikati
                </span>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.overlap.exactDuplicateRecords.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                  Potpuno identičan sadržaj (bez promenljivih metapodataka)
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-700/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  Nivo 3: Poslovno preklapanje
                </span>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {diff.overlap.overlappingRecords.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                  Isti uređaj, vreme i GPS koordinate
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-700/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  Prostorno preklapanje
                </span>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.overlap.spatialOverlapPercent !== null
                    ? `${diff.overlap.spatialOverlapPercent}%`
                    : "N/A"}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                  Zajedničke H3 ćelije ili mrežne tačke
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-slate-200 dark:border-zinc-700/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-sky-500" />
                  Preklapanje uređaja
                </span>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {diff.overlap.deviceOverlapPercent !== null
                    ? `${diff.overlap.deviceOverlapPercent}%`
                    : "N/A"}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                  Uređaji prisutni u oba skupa podataka
                </span>
              </div>
            </div>

            {/* Distribucija bez emodžija */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700 dark:text-zinc-300">Klasifikacija zapisa:</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                    Novi: {diff.overlap.newRecords}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                    Identični: {diff.overlap.exactDuplicateRecords}
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-sky-500 mr-1.5" />
                    Izmenjeni: {diff.overlap.changedRecords}
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center">
                    <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
                    Samo u bazi: {diff.overlap.removedRecords}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden flex">
                {diff.kpis.recordCount.after > 0 && (
                  <>
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(diff.overlap.newRecords / diff.kpis.recordCount.after) * 100}%`,
                      }}
                      title={`Novi zapisi: ${diff.overlap.newRecords}`}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${(diff.overlap.exactDuplicateRecords / diff.kpis.recordCount.after) * 100}%`,
                      }}
                      title={`Identični duplikati: ${diff.overlap.exactDuplicateRecords}`}
                    />
                    <div
                      className="bg-sky-500 h-full"
                      style={{
                        width: `${(diff.overlap.changedRecords / diff.kpis.recordCount.after) * 100}%`,
                      }}
                      title={`Izmenjeni zapisi: ${diff.overlap.changedRecords}`}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 6. Schema Drift */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-500" />
                  Evolucija šeme (Schema Drift) — {diff.schemaDrift.length} promena
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Dodate i obrisane kolone, promene tipova i odstupanja stopa popunjenosti.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDriftFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "all"
                      ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Sve ({diff.schemaDrift.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDriftFilter("critical")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "critical"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
                  }`}
                >
                  Kritično
                </button>
                <button
                  type="button"
                  onClick={() => setDriftFilter("warning")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "warning"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
                  }`}
                >
                  Upozorenja
                </button>
              </div>
            </div>

            {filteredDrift && filteredDrift.length === 0 ? (
              <div className="p-6 text-center text-slate-400 dark:text-zinc-500 text-xs">
                Nema evidentiranih promena šeme za izabrani filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
                  <thead className="bg-slate-50/60 dark:bg-zinc-800/30 text-slate-700 dark:text-zinc-300 font-semibold border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5">Putanja kolone</th>
                      <th className="px-3 py-2.5">Tip promene</th>
                      <th className="px-3 py-2.5">Ozbiljnost</th>
                      <th className="px-3 py-2.5">{diff.baseLabel || "Baza"}</th>
                      <th className="px-3 py-2.5">{diff.targetLabel || "Cilj"}</th>
                      <th className="px-3 py-2.5">Objašnjenje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono">
                    {filteredDrift?.map((change, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 transition">
                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-zinc-200">
                          {change.columnPath}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-sans">
                            {change.changeType}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans">{getSeverityBadge(change.severity)}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">
                          {change.before !== undefined ? String(change.before) : "-"}
                        </td>
                        <td className="px-3 py-2 font-semibold text-indigo-600 dark:text-indigo-400">
                          {change.after !== undefined ? String(change.after) : "-"}
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600 dark:text-zinc-400 max-w-xs truncate">
                          {change.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. Side-by-Side pregled */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                Uzorci zapisa i side-by-side pregled ({diff.recordExamples.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Konkretni primeri zapisa klasifikovani po statusu podudaranja.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {diff.recordExamples.map((ex, idx) => {
                  const isSelected = selectedExample === idx;
                  const recordKey =
                    (ex.current?.instanceId as string) ||
                    (ex.previous?.instanceId as string) ||
                    `Zapis #${idx + 1}`;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedExample(idx)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800"
                          : "bg-slate-50/60 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[180px] font-mono">
                          {recordKey}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getClassificationBadge(ex.classification)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-2 bg-slate-50 dark:bg-zinc-800/40 rounded-lg border border-slate-200 dark:border-zinc-800 p-4">
                {selectedExample !== null && diff.recordExamples[selectedExample] ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200">
                          Zapis #{selectedExample + 1}
                        </span>
                        {getClassificationBadge(diff.recordExamples[selectedExample].classification)}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                        {diff.recordExamples[selectedExample].lineage.sourceFileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="font-semibold text-[11px] text-slate-600 dark:text-zinc-400 block">
                          {diff.baseLabel || "Baza"}:
                        </span>
                        <pre className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-mono text-slate-700 dark:text-zinc-300 max-h-72 overflow-y-auto whitespace-pre-wrap">
                          {diff.recordExamples[selectedExample].previous
                            ? JSON.stringify(diff.recordExamples[selectedExample].previous, null, 2)
                            : "// Zapis ne postoji u prethodnoj verziji"}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <span className="font-semibold text-[11px] text-indigo-600 dark:text-indigo-400 block">
                          {diff.targetLabel || "Cilj"}:
                        </span>
                        <pre className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-mono text-slate-700 dark:text-zinc-300 max-h-72 overflow-y-auto whitespace-pre-wrap">
                          {diff.recordExamples[selectedExample].current
                            ? JSON.stringify(diff.recordExamples[selectedExample].current, null, 2)
                            : "// Zapis je uklonjen iz ove verzije"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-zinc-500 p-8">
                    Izaberite primer sa leve strane za pregled razlika.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
