"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dataset, DatasetVersion, AnalyticsSnapshot, SourceFile } from "@/lib/domain/types";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { FileQueueTable } from "@/components/upload/file-queue-table";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ColumnStatsTable } from "@/components/dashboard/column-stats-table";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { VersionHistory } from "@/components/dashboard/version-history";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DatasetSelector } from "@/components/datasets/dataset-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Sparkles, Layers, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<DatasetVersion | null>(null);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "columns" | "files">("overview");

  // Fetch all datasets
  const loadDatasets = useCallback(async (preferredDatasetId?: string) => {
    try {
      const res = await fetch("/api/datasets");
      if (res.ok) {
        const list: Dataset[] = await res.json();
        setDatasets(list);
        if (list.length > 0) {
          const target = preferredDatasetId && list.some(d => d.id === preferredDatasetId)
            ? preferredDatasetId
            : list[0].id;
          setSelectedDatasetId(target);
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
          const targetVer = preferredVersionId && vers.some(v => v.id === preferredVersionId)
            ? preferredVersionId
            : vers[0].id;
          setSelectedVersionId(targetVer);
        } else {
          setSelectedVersionId("");
          setCurrentVersion(null);
          setSnapshot(null);
          setSourceFiles([]);
        }
      }
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  }, []);

  // Fetch version analytics
  const loadAnalytics = useCallback(async (datasetId: string, versionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/analytics?versionId=${versionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentVersion(data.version);
        setSnapshot(data.snapshot);
        setSourceFiles(data.sourceFiles || []);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  // When selected dataset changes
  useEffect(() => {
    if (selectedDatasetId) {
      loadVersions(selectedDatasetId);
    }
  }, [selectedDatasetId, loadVersions]);

  // When selected version changes
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
      }
    } catch (err) {
      console.error("Error creating dataset:", err);
    }
  };

  const handleUploadSuccess = async (result: any) => {
    // Reload datasets and select the new version
    await loadDatasets(result.datasetId);
    await loadVersions(result.datasetId, result.version.id);
  };

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-xs">
                F
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg tracking-tight">FAP</span>
                <span className="hidden sm:inline-block text-[11px] text-slate-500 ml-2 font-mono">
                  File Analytics Platform
                </span>
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden md:block" />

            {/* Dataset Selector Dropdown & New Dataset button */}
            <DatasetSelector
              datasets={datasets}
              currentDatasetId={selectedDatasetId}
              onSelectDataset={(id) => setSelectedDatasetId(id)}
              onCreateDataset={handleCreateDataset}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="info" className="hidden sm:inline-flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3 h-3" /> Gemini Flash AI
            </Badge>
            <Badge variant="neutral" className="hidden md:inline-flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Read-Only Validated
            </Badge>
            <button
              onClick={() => {
                if (selectedDatasetId && selectedVersionId) {
                  loadAnalytics(selectedDatasetId, selectedVersionId);
                }
              }}
              title="Osveži podatke"
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Upload Dropzone */}
        <FileDropzone
          currentDatasetId={selectedDatasetId}
          currentDatasetName={activeDataset?.name}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Dataset Meta Banner */}
        {activeDataset && currentVersion && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3.5 gap-2 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900">{activeDataset.name}</h1>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-mono">
                    v{currentVersion.versionNumber}
                  </span>
                </div>
                {activeDataset.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{activeDataset.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span>Status:</span>
              <Badge
                variant={
                  currentVersion.status === "ready"
                    ? "success"
                    : currentVersion.status === "partial"
                    ? "warning"
                    : "danger"
                }
              >
                {currentVersion.status}
              </Badge>
            </div>
          </div>
        )}

        {/* KPIs */}
        {currentVersion && (
          <KpiCards version={currentVersion} snapshot={snapshot} />
        )}

        {/* 2-Column Responsive Layout: Left = Analytics & Schema, Right = AI Chatbot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Analytics, Schema, Charts, Files (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Version History List */}
            {versions.length > 0 && (
              <VersionHistory
                versions={versions}
                selectedVersionId={selectedVersionId}
                onSelectVersion={(id) => setSelectedVersionId(id)}
              />
            )}

            {/* Visual Analytics Charts */}
            {snapshot && (
              <AnalyticsCharts
                stats={snapshot.columnStats}
                files={sourceFiles}
                totalRecords={snapshot.recordCount}
              />
            )}

            {/* Tabs for Column Profile & File Sources */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                      activeTab === "overview"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Profil Kolona ({snapshot?.columnStats.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("files")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                      activeTab === "files"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Uvezeni Fajlovi ({sourceFiles.length})
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 flex items-center justify-center space-x-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Učitavanje analitike...</span>
                  </div>
                ) : activeTab === "overview" ? (
                  <ColumnStatsTable
                    stats={snapshot?.columnStats || []}
                    totalRecords={snapshot?.recordCount || currentVersion?.totalRecords || 0}
                  />
                ) : (
                  <FileQueueTable files={sourceFiles} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: AI Chatbot (5 cols on lg) */}
          <div className="lg:col-span-5 sticky top-20">
            {selectedDatasetId && selectedVersionId && currentVersion ? (
              <ChatPanel
                datasetId={selectedDatasetId}
                datasetVersionId={selectedVersionId}
                datasetName={activeDataset?.name || "Dataset"}
                versionNumber={currentVersion.versionNumber}
              />
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-slate-400 text-sm">
                  Izaberite ili otpremite dataset kako biste započeli razgovor sa AI asistentom.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FAP — File Analytics Platform & AI Chatbot</span>
          <span className="font-mono text-[11px] text-slate-400">
            Next.js App Router · TypeScript Strict · Tailwind CSS · Gemini Flash
          </span>
          <span>Autor: Milan Maksimović</span>
        </div>
      </footer>
    </div>
  );
}
