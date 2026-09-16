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
  ChevronDown,
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

  // Filtriramo fajlove koji su podržani i spremni za analizu
  const validFiles = useMemo(
    () => sourceFiles.filter((f) => f.status === "ready" && f.fileType !== "zip"),
    [sourceFiles]
  );

  // Režim poređenja: "versions" (v1 vs v2) ili "files" (Fajl A vs Fajl B)
  const [diffMode, setDiffMode] = useState<"versions" | "files">(() => {
    return readyVersions.length < 2 && validFiles.length >= 2 ? "files" : "versions";
  });

  // Ako postoji samo 1 verzija a ima 2+ fajlova, automatski prebaci na poređenje fajlova
  useEffect(() => {
    if (readyVersions.length < 2 && validFiles.length >= 2) {
      setDiffMode("files");
    }
  }, [readyVersions.length, validFiles.length]);

  // Stanja za verzije
  const [targetVersionId, setTargetVersionId] = useState<string>(
    currentVersionId || (readyVersions[0]?.id ?? "")
  );
  const [baseVersionId, setBaseVersionId] = useState<string>(
    readyVersions.find((v) => v.id !== currentVersionId)?.id || (readyVersions[1]?.id ?? "")
  );

  // Stanja za fajlove
  const [fileIdA, setFileIdA] = useState<string>(validFiles[0]?.id ?? "");
  const [fileIdB, setFileIdB] = useState<string>(validFiles[1]?.id ?? "");

  // Sinhronizacija stanja fajlova kada sourceFiles stignu
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

  // Sinhronizacija verzija kada versions lista stigne ili se promeni
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

  // Stanje za inline uploader nove verzije
  const [uploadingInline, setUploadingInline] = useState(false);
  const [inlineUploadError, setInlineUploadError] = useState<string | null>(null);
  const [seedingV2, setSeedingV2] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Učitavanje diff-a (zavisno od režima)
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

    // Režim: "versions"
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

  // Zamena mesta fajlova
  const handleSwapFiles = () => {
    const tmp = fileIdA;
    setFileIdA(fileIdB);
    setFileIdB(tmp);
  };

  // Inline upload nove verzije
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

  // Instant generisanje demo verzije 2
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
            Izmenjen zapis
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
            Uklonjen zapis
          </Badge>
        );
      default:
        return <Badge variant="neutral">{cls}</Badge>;
    }
  };

  // Prikaz kada je izabran režim verzija ali nema 2 verzije
  const showVersionEmptyState = diffMode === "versions" && readyVersions.length < 2;

  return (
    <div className="space-y-6">
      {/* 1. Glavni selektor režima: Verzija vs Fajlovi */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Modul za poređenje (Diff Engine)</h3>
            <p className="text-xs text-slate-500">
              Uporedite verzije dataset-a ili direktno uporedite dva uneta Avro/JSON fajla.
            </p>
          </div>
        </div>

        {/* Dugmad za prebacivanje režima */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setDiffMode("versions")}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
              diffMode === "versions"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
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
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Poređenje 2 fajla ({validFiles.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Selektori entiteta za poređenje */}
      {diffMode === "files" ? (
        /* Selektor za fajlove */
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-sky-600" />
              Izaberite dva fajla za inspekciju razlika i preklapanja:
            </span>
            <span className="text-[11px] text-slate-400">
              Dostupno fajlova za diff: {validFiles.length}
            </span>
          </div>

          {validFiles.length < 2 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Potrebna su najmanje 2 fajla u ovom uvozu za poređenje fajl-na-fajl. Trenutno postoji{" "}
              {validFiles.length} fajl.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
              {/* Fajl A */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fajl A (Baza za poređenje):
                </label>
                <select
                  value={fileIdA}
                  onChange={(e) => setFileIdA(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono truncate"
                >
                  {validFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.originalName} ({formatBytes(f.sizeBytes)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Taster za zamenu mesta */}
              <div className="flex justify-center pt-4 sm:pt-4">
                <button
                  type="button"
                  onClick={handleSwapFiles}
                  title="Zameni mesta Fajl A i Fajl B"
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                >
                  <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                </button>
              </div>

              {/* Fajl B */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fajl B (Nova verzija / Cilj):
                </label>
                <select
                  value={fileIdB}
                  onChange={(e) => setFileIdB(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono truncate"
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
        /* Selektor za verzije */
        !showVersionEmptyState && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Prethodna verzija (Baza):</span>
                <select
                  value={baseVersionId}
                  onChange={(e) => setBaseVersionId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {readyVersions.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.id === targetVersionId}>
                      v{v.versionNumber} ({v.totalRecords} zapisa)
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Nova verzija (Poređenje):</span>
                <select
                  value={targetVersionId}
                  onChange={(e) => setTargetVersionId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 font-medium"
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
              Osveži poređenje
            </Button>
          </div>
        )
      )}

      {/* 3. Empty State za Verzije sa ugrađenim uploaderom i demo dugmetom */}
      {showVersionEmptyState && (
        <Card className="border-slate-200">
          <CardContent className="p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
              <GitCompare className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Poređenje verzija zahteva najmanje dve verzije
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Trenutno dataset ima samo 1 verziju (v1). Za poređenje verzija i detekciju evolucije
                šeme potrebno je uneti novi uvoz u ovaj dataset.
              </p>
            </div>

            {/* Ako u ovom uvozu ima 2+ fajlova, ponudi brzi prelazak na File Diff */}
            {validFiles.length >= 2 && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 flex items-center justify-between text-left">
                <div>
                  <span className="font-semibold block">Imate {validFiles.length} fajlova u ovoj verziji!</span>
                  <span className="text-[11px] text-sky-600">
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

            {/* Inline Upload Box za kreiranje v2 */}
            <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-xl p-6 transition text-center space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".avro,.json,.jsonl,.ndjson,.zip"
                className="hidden"
                onChange={handleInlineUpload}
              />
              <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto" />
              <div>
                <span className="font-semibold text-slate-800 text-xs block">
                  Otpremite novi fajl ili ZIP za kreiranje verzije 2
                </span>
                <span className="text-[11px] text-slate-500">
                  Automatski će biti dodat u dataset <strong>{datasetName || datasetId}</strong> kao nova
                  verzija.
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingInline || seedingV2}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {uploadingInline ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Obrada i profilisanje v2...
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
                  className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  title="Kreira v2 sa blagim izmenama i novom kolonom radi instant demonstracije"
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

      {/* Greška pri učitavanju diff-a */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Učitavanje */}
      {loading && (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
          <p className="text-xs">Izračunavanje preklapanja, heševa i evolucije šeme...</p>
        </div>
      )}

      {/* Prikaz Diff rezultata */}
      {!loading && diff && (
        <>
          {/* Oznaka šta se poredi */}
          <div className="bg-slate-100/80 px-4 py-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">
                {diff.comparisonType === "files" ? "Poređenje fajlova:" : "Poređenje verzija:"}
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-bold text-indigo-700">
                {diff.baseLabel}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] font-bold text-indigo-700">
                {diff.targetLabel}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Generisano: {new Date(diff.generatedAt).toLocaleTimeString("sr-RS")}
            </span>
          </div>

          {/* 4. Glavne KPI delta kartice */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Zapisi */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Broj Zapisa
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.recordCount.after.toLocaleString()}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.recordCount.absoluteDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {diff.kpis.recordCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.recordCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.recordCount.before.toLocaleString()}
              </span>
            </div>

            {/* Fajlovi */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Fajlovi
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.fileCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.fileCount.absoluteDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {diff.kpis.fileCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.fileCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.fileCount.before}
              </span>
            </div>

            {/* Kolone */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Broj Kolona
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.columnCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.columnCount.absoluteDelta >= 0 ? "text-indigo-600" : "text-amber-600"
                  }`}
                >
                  {diff.kpis.columnCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.columnCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.columnCount.before}
              </span>
            </div>

            {/* Null Stopa */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Prosečan Null
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.overallNullRate.after}%
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.overallNullRate.absoluteDelta <= 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {diff.kpis.overallNullRate.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.overallNullRate.absoluteDelta} pp
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.overallNullRate.before}%
              </span>
            </div>

            {/* Duplikati */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Duplikata
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.duplicateCount.after}
                </span>
                <span
                  className={`text-xs font-bold ${
                    diff.kpis.duplicateCount.absoluteDelta <= 0
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {diff.kpis.duplicateCount.absoluteDelta >= 0 ? "+" : ""}
                  {diff.kpis.duplicateCount.absoluteDelta}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.duplicateCount.before}
              </span>
            </div>

            {/* Jedinstveni uređaji (instanceId) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Uređaji (Devices)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-slate-900">
                  {diff.kpis.uniqueDeviceCount?.after ?? "-"}
                </span>
                {diff.kpis.uniqueDeviceCount && (
                  <span
                    className={`text-xs font-bold ${
                      diff.kpis.uniqueDeviceCount.absoluteDelta >= 0
                        ? "text-emerald-600"
                        : "text-slate-500"
                    }`}
                  >
                    {diff.kpis.uniqueDeviceCount.absoluteDelta >= 0 ? "+" : ""}
                    {diff.kpis.uniqueDeviceCount.absoluteDelta}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block">
                Baza: {diff.kpis.uniqueDeviceCount?.before ?? "-"}
              </span>
            </div>
          </div>

          {/* 5. Analiza preklapanja (Overlap Detection) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Višeslojna detekcija preklapanja (Multi-Tier Overlap)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identifikacija identičnih zapisa (SHA-256), poslovnih duplikata i preklapanja domena.
                </p>
              </div>

              {diff.overlap.exactFiles > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {diff.overlap.exactFiles} re-uvezan identičan fajl (isti heš)
                </span>
              )}
            </div>

            {/* Kartice nivoa preklapanja */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[11px] font-medium text-slate-500">
                  Nivo 2: Kanonski duplikati
                </span>
                <div className="text-lg font-bold text-slate-900">
                  {diff.overlap.exactDuplicateRecords.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">zapisa</span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Potpuno identičan sadržaj (bez metapodataka)
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[11px] font-medium text-slate-500">
                  Nivo 3: Poslovno preklapanje
                </span>
                <div className="text-lg font-bold text-indigo-700">
                  {diff.overlap.overlappingRecords.toLocaleString()}{" "}
                  <span className="text-xs font-normal text-slate-500">zapisa</span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Isti uređaj, vreme i GPS lokacija
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  Prostorno preklapanje (GPS/H3)
                </span>
                <div className="text-lg font-bold text-slate-900">
                  {diff.overlap.spatialOverlapPercent !== null
                    ? `${diff.overlap.spatialOverlapPercent}%`
                    : "N/A"}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Zajedničke H3 ćelije ili mrežne tačke
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-sky-600" />
                  Preklapanje uređaja (instanceId)
                </span>
                <div className="text-lg font-bold text-slate-900">
                  {diff.overlap.deviceOverlapPercent !== null
                    ? `${diff.overlap.deviceOverlapPercent}%`
                    : "N/A"}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Isti telefoni prisutni u oba skupa
                </span>
              </div>
            </div>

            {/* Distribucija novih naspram ponovljenih */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700">Distribucija zapisa u poređenju:</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-700 font-medium">
                    🟢 Novi: {diff.overlap.newRecords}
                  </span>
                  <span className="text-amber-700 font-medium">
                    🟡 Identični: {diff.overlap.exactDuplicateRecords}
                  </span>
                  <span className="text-sky-700 font-medium">
                    🔵 Izmenjeni: {diff.overlap.changedRecords}
                  </span>
                  <span className="text-rose-700 font-medium">
                    🔴 Samo u bazi: {diff.overlap.removedRecords}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex">
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

          {/* 6. Detekcija evolucije šeme (Schema Drift) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-600" />
                  Evolucija šeme (Schema Drift) — {diff.schemaDrift.length} promena
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dodate, uklonjene kolone, promene tipova i značajne promene stope nedostajućih vrednosti.
                </p>
              </div>

              {/* Filteri za drift */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDriftFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "all"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Sve ({diff.schemaDrift.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDriftFilter("critical")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "critical"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  }`}
                >
                  Kritično
                </button>
                <button
                  type="button"
                  onClick={() => setDriftFilter("warning")}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    driftFilter === "warning"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  }`}
                >
                  Upozorenja
                </button>
              </div>
            </div>

            {filteredDrift && filteredDrift.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Nema evidentiranih promena šeme za izabrani filter. Šeme su stabilne.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Putanja kolone</th>
                      <th className="px-3 py-2.5">Tip promene</th>
                      <th className="px-3 py-2.5">Ozbiljnost</th>
                      <th className="px-3 py-2.5">{diff.baseLabel || "Baza"}</th>
                      <th className="px-3 py-2.5">{diff.targetLabel || "Cilj"}</th>
                      <th className="px-3 py-2.5">Objašnjenje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredDrift?.map((change, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {change.columnPath}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-sans">
                            {change.changeType}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans">{getSeverityBadge(change.severity)}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {change.before !== undefined ? String(change.before) : "-"}
                        </td>
                        <td className="px-3 py-2 font-semibold text-indigo-700">
                          {change.after !== undefined ? String(change.after) : "-"}
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-600 max-w-xs truncate">
                          {change.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. Side-by-Side pregled reprezentativnih zapisa */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Uzorci zapisa i poređenje po kolonama ({diff.recordExamples.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Konkretni primeri zapisa klasifikovani po statusu podudaranja.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Lista primera */}
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
                          ? "bg-indigo-50/70 border-indigo-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 truncate max-w-[180px]">
                          {recordKey}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getClassificationBadge(ex.classification)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  );
                })}
              </div>

              {/* Detaljni Side-by-Side prikaz */}
              <div className="lg:col-span-2 bg-slate-50 rounded-lg border border-slate-200 p-4">
                {selectedExample !== null && diff.recordExamples[selectedExample] ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-800">
                          Zapis #{selectedExample + 1}
                        </span>
                        {getClassificationBadge(diff.recordExamples[selectedExample].classification)}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {diff.recordExamples[selectedExample].lineage.sourceFileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Baza */}
                      <div className="space-y-1">
                        <span className="font-semibold text-[11px] text-slate-600 block">
                          {diff.baseLabel || "Prethodna verzija"} (Baza):
                        </span>
                        <pre className="p-3 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-700 max-h-72 overflow-y-auto whitespace-pre-wrap">
                          {diff.recordExamples[selectedExample].previous
                            ? JSON.stringify(diff.recordExamples[selectedExample].previous, null, 2)
                            : "// Zapis ne postoji u prethodnoj verziji"}
                        </pre>
                      </div>

                      {/* Cilj */}
                      <div className="space-y-1">
                        <span className="font-semibold text-[11px] text-indigo-700 block">
                          {diff.targetLabel || "Nova verzija"} (Poređenje):
                        </span>
                        <pre className="p-3 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-700 max-h-72 overflow-y-auto whitespace-pre-wrap">
                          {diff.recordExamples[selectedExample].current
                            ? JSON.stringify(diff.recordExamples[selectedExample].current, null, 2)
                            : "// Zapis je uklonjen iz ove verzije"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 p-8">
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
