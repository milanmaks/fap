"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dataset, DatasetVersion, AnalyticsSnapshot } from "@/lib/domain/types";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DatasetSelector } from "@/components/datasets/dataset-selector";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  BarChart3,
  Bot,
  Database,
  ArrowLeft,
  Columns,
  Files,
  Loader2,
} from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

function ChatContent() {
  const searchParams = useSearchParams();
  const paramDatasetId = searchParams.get("datasetId");
  const paramVersionId = searchParams.get("versionId");

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(paramDatasetId || "");
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(paramVersionId || "");
  const [currentVersion, setCurrentVersion] = useState<DatasetVersion | null>(null);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all datasets
  const loadDatasets = useCallback(async (preferredId?: string) => {
    try {
      const res = await fetch("/api/datasets");
      if (res.ok) {
        const list: Dataset[] = await res.json();
        setDatasets(list);
        if (list.length > 0) {
          const target = preferredId && list.some((d) => d.id === preferredId)
            ? preferredId
            : list[0].id;
          setSelectedDatasetId((prev) => prev || target);
        }
      }
    } catch (err) {
      console.error("Error loading datasets:", err);
    }
  }, []);

  // Fetch dataset versions
  const loadVersions = useCallback(async (datasetId: string, preferredVersionId?: string) => {
    try {
      const res = await fetch(`/api/datasets/${datasetId}/versions`);
      if (res.ok) {
        const vers: DatasetVersion[] = await res.json();
        setVersions(vers);
        if (vers.length > 0) {
          const targetVer =
            preferredVersionId && vers.some((v) => v.id === preferredVersionId)
              ? preferredVersionId
              : vers[0].id;
          setSelectedVersionId(targetVer);
        } else {
          setSelectedVersionId("");
          setCurrentVersion(null);
          setSnapshot(null);
        }
      }
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  }, []);

  // Fetch version analytics for context summary
  const loadAnalytics = useCallback(async (datasetId: string, versionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/analytics?versionId=${versionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentVersion(data.version);
        setSnapshot(data.snapshot);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatasets(paramDatasetId || undefined);
  }, [loadDatasets, paramDatasetId]);

  useEffect(() => {
    if (selectedDatasetId) {
      loadVersions(selectedDatasetId, paramVersionId || undefined);
    }
  }, [selectedDatasetId, loadVersions, paramVersionId]);

  useEffect(() => {
    if (selectedDatasetId && selectedVersionId) {
      loadAnalytics(selectedDatasetId, selectedVersionId);
    }
  }, [selectedDatasetId, selectedVersionId, loadAnalytics]);

  const handleCreateDataset = async (name: string, description?: string) => {
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        const newDs: Dataset = await res.json();
        await loadDatasets(newDs.id);
        setSelectedDatasetId(newDs.id);
      }
    } catch (err) {
      console.error("Error creating dataset:", err);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    try {
      const res = await fetch(`/api/datasets/${datasetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadDatasets();
      }
    } catch (err) {
      console.error("Error deleting dataset:", err);
    }
  };

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-xs">
                F
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg tracking-tight">FAP</span>
                <span className="hidden sm:inline-block text-[11px] text-slate-500 ml-2 font-mono">
                  File Analytics Platform
                </span>
              </div>
            </Link>

            <div className="h-5 w-[1px] bg-slate-200 hidden md:block" />

            {/* Dataset Selector */}
            <DatasetSelector
              datasets={datasets}
              currentDatasetId={selectedDatasetId}
              onSelectDataset={(id) => setSelectedDatasetId(id)}
              onCreateDataset={handleCreateDataset}
              onDeleteDataset={handleDeleteDataset}
            />
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center space-x-2">
            <Link
              href={selectedDatasetId ? `/?datasetId=${selectedDatasetId}` : "/"}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span>Analitika</span>
            </Link>
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 transition flex items-center gap-1.5"
            >
              <Bot className="w-4 h-4 text-indigo-600" />
              <span>AI Četbot</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Chat Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-4">
        {/* Top Context Info Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 gap-3 shadow-2xs">
          <div className="flex items-center space-x-3">
            <Link
              href={selectedDatasetId ? `/?datasetId=${selectedDatasetId}` : "/"}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
              title="Nazad na analitiku"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900">
                  {activeDataset?.name || "Izaberite dataset"}
                </h1>
                {currentVersion && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-mono">
                    v{currentVersion.versionNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Prirodno-jezičko postavljanje upita i analiza podataka uz Gemini Flash.
              </p>
            </div>
          </div>

          {/* Version Selector & Summary Pills */}
          {versions.length > 0 && currentVersion && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 text-[11px]">Verzija:</span>
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber} ({formatNumber(v.totalRecords)} zapisa)
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-600">
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                  <Database className="w-3 h-3 text-emerald-600" />
                  {formatNumber(currentVersion.totalRecords)} zapisa
                </span>
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                  <Columns className="w-3 h-3 text-indigo-600" />
                  {currentVersion.schema?.fields?.length || snapshot?.columnStats?.length || 0} kolona
                </span>
                <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                  <Files className="w-3 h-3 text-blue-600" />
                  {currentVersion.totalFiles} fajlova
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Component */}
        <div className="flex-1">
          {selectedDatasetId && selectedVersionId && currentVersion ? (
            <ChatPanel
              datasetId={selectedDatasetId}
              datasetVersionId={selectedVersionId}
              datasetName={activeDataset?.name || "Dataset"}
              versionNumber={currentVersion.versionNumber}
            />
          ) : (
            <Card>
              <CardContent className="p-16 text-center text-slate-400 text-sm">
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span>Učitavanje dataset-a...</span>
                  </div>
                ) : (
                  <div>
                    <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">Nema izabranog dataset-a</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Izaberite dataset iz gornjeg menija ili se vratite na{" "}
                      <Link href="/" className="text-indigo-600 underline font-medium">
                        Analitiku
                      </Link>{" "}
                      kako biste otpremili nove podatke.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex items-center space-x-2 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <span>Učitavanje AI četbota...</span>
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
