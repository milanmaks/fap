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
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  BarChart3,
  Bot,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Files,
  GitCompare,
  UploadCloud,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { VersionCompareTab } from "@/components/analytics/version-compare-tab";
import { QualityTab } from "@/components/analytics/quality-tab";
import { FileDetailModal } from "@/components/files/file-detail-modal";

type MainTab = "overview" | "compare" | "quality" | "files" | "chat";

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<DatasetVersion | null>(null);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [selectedFileForModal, setSelectedFileForModal] = useState<SourceFile | null>(null);

  // Fetch all datasets
  const loadDatasets = useCallback(async (preferredDatasetId?: string) => {
    try {
      const res = await fetch("/api/datasets");
      if (res.ok) {
        const list: Dataset[] = await res.json();
        setDatasets(list);
        if (list.length > 0) {
          const target =
            preferredDatasetId && list.some((d) => d.id === preferredDatasetId)
              ? preferredDatasetId
              : list[0].id;
          setSelectedDatasetId(target);
        } else {
          setSelectedDatasetId("");
          setVersions([]);
          setSelectedVersionId("");
          setCurrentVersion(null);
          setSnapshot(null);
          setSourceFiles([]);
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

  const handleUploadSuccess = async (result: any) => {
    setShowUploadModal(false);
    await loadDatasets(result.datasetId);
    await loadVersions(result.datasetId, result.version.id);
  };

  const activeDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Application Navigation Bar */}
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Logo */}
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
                F
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">FAP</span>
                <span className="hidden sm:inline-block text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  Observability
                </span>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

            {/* Dataset Selector Dropdown */}
            <DatasetSelector
              datasets={datasets}
              currentDatasetId={selectedDatasetId}
              onSelectDataset={(id) => setSelectedDatasetId(id)}
              onCreateDataset={handleCreateDataset}
              onDeleteDataset={handleDeleteDataset}
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Ingestion Button */}
            <Button
              size="sm"
              onClick={() => setShowUploadModal(true)}
              className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Uvoz podataka</span>
            </Button>

            {/* Refresh Button */}
            <button
              onClick={() => {
                if (selectedDatasetId && selectedVersionId) {
                  loadAnalytics(selectedDatasetId, selectedVersionId);
                }
              }}
              title="Osveži podatke"
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-0.5" />

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Telemetry Status Bar & Context Header */}
      {activeDataset && currentVersion && (
        <div className="border-b border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/60 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{activeDataset.name}</span>
              <span className="text-zinc-400 dark:text-zinc-600">/</span>
              <button
                onClick={() => setShowVersionDrawer(true)}
                className="inline-flex items-center gap-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
              >
                <span>v{currentVersion.versionNumber}</span>
                <ChevronRight className="w-3 h-3 text-indigo-500" />
              </button>
              <Badge
                variant={
                  currentVersion.status === "ready"
                    ? "success"
                    : currentVersion.status === "partial"
                    ? "warning"
                    : "danger"
                }
                className="text-[10px] py-0"
              >
                {currentVersion.status}
              </Badge>
              {activeDataset.description && (
                <span className="hidden md:inline text-zinc-400 dark:text-zinc-500 truncate max-w-sm">
                  — {activeDataset.description}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
              <span>{currentVersion.totalFiles} fajlova</span>
              <span>·</span>
              <span>{currentVersion.totalRecords} zapisa</span>
              <span>·</span>
              <button
                onClick={() => setShowVersionDrawer(!showVersionDrawer)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-sans font-medium"
              >
                Istorija ({versions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Navigation Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6 overflow-x-auto no-scrollbar" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Pregled i profil ({snapshot?.columnStats.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("compare")}
              className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "compare"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <GitCompare className="w-4 h-4" />
              <span>Poređenje (Diff & Overlap)</span>
            </button>

            <button
              onClick={() => setActiveTab("quality")}
              className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "quality"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Kvalitet podataka</span>
            </button>

            <button
              onClick={() => setActiveTab("files")}
              className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "files"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Files className="w-4 h-4" />
              <span>Uvezeni fajlovi ({sourceFiles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`py-3 px-1 border-b-2 text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === "chat"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI Asistent</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            {currentVersion && (
              <KpiCards version={currentVersion} snapshot={snapshot} />
            )}

            {/* Charts */}
            {snapshot && (
              <AnalyticsCharts
                stats={snapshot.columnStats}
                files={sourceFiles}
                totalRecords={snapshot.recordCount}
              />
            )}

            {/* Column Profile Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-16 flex items-center justify-center space-x-2 text-zinc-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span>Učitavanje analitike...</span>
                  </div>
                ) : (
                  <ColumnStatsTable
                    stats={snapshot?.columnStats || []}
                    totalRecords={snapshot?.recordCount || currentVersion?.totalRecords || 0}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: DIFF & OVERLAP */}
        {activeTab === "compare" && selectedDatasetId && (
          <VersionCompareTab
            datasetId={selectedDatasetId}
            datasetName={activeDataset?.name}
            versions={versions}
            currentVersionId={selectedVersionId}
            sourceFiles={sourceFiles}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {/* TAB 3: DATA QUALITY */}
        {activeTab === "quality" && selectedDatasetId && selectedVersionId && (
          <QualityTab
            datasetId={selectedDatasetId}
            versionId={selectedVersionId}
            versionNumber={currentVersion?.versionNumber}
          />
        )}

        {/* TAB 4: IMPORTED FILES */}
        {activeTab === "files" && (
          <Card>
            <CardContent className="p-0">
              <FileQueueTable
                files={sourceFiles}
                onViewFile={(file) => setSelectedFileForModal(file)}
              />
            </CardContent>
          </Card>
        )}

        {/* TAB 5: AI CHATBOT */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            {selectedDatasetId && selectedVersionId && currentVersion ? (
              <ChatPanel
                datasetId={selectedDatasetId}
                datasetVersionId={selectedVersionId}
                datasetName={activeDataset?.name || "Dataset"}
                versionNumber={currentVersion.versionNumber}
              />
            ) : (
              <Card>
                <CardContent className="p-16 text-center text-zinc-400 text-sm">
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>Učitavanje dataset-a...</span>
                    </div>
                  ) : (
                    <div>
                      <Bot className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">Nema izabranog dataset-a</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Izaberite dataset iz gornjeg menija ili kliknite na dugme za uvoz podataka.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Version History Drawer Modal */}
      {showVersionDrawer && versions.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Istorija verzija ({versions.length})
              </h3>
              <button
                onClick={() => setShowVersionDrawer(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <VersionHistory
              versions={versions}
              selectedVersionId={selectedVersionId}
              onSelectVersion={(id) => {
                setSelectedVersionId(id);
                setShowVersionDrawer(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Ingestion Dropzone Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full p-2 relative overflow-hidden">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 z-10 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <FileDropzone
              currentDatasetId={selectedDatasetId}
              currentDatasetName={activeDataset?.name}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
        </div>
      )}

      {/* File Details & Records Explorer Modal */}
      {selectedFileForModal && selectedDatasetId && selectedVersionId && (
        <FileDetailModal
          file={selectedFileForModal}
          datasetId={selectedDatasetId}
          versionId={selectedVersionId}
          onClose={() => setSelectedFileForModal(null)}
        />
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-3 mt-12 text-[11px] text-zinc-400 dark:text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FAP Observability & Quality Platform</span>
          <span className="font-mono text-[10px]">
            TypeScript · Avro/JSON Engine · Dark Mode Ready
          </span>
          <span>Autor: Milan Maksimović</span>
        </div>
      </footer>
    </div>
  );
}
