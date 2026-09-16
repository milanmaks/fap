"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SourceFile, QualityScoreBreakdown } from "@/lib/domain/types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { formatBytes } from "@/lib/utils/format";
import {
  X,
  FileCode,
  Archive,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Table as TableIcon,
  Code,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface FileDetailModalProps {
  file: SourceFile;
  datasetId: string;
  versionId: string;
  onClose: () => void;
}

export const FileDetailModal: React.FC<FileDetailModalProps> = ({
  file,
  datasetId,
  versionId,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<"table" | "json">("table");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [quality, setQuality] = useState<QualityScoreBreakdown | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);

  // Load Records
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const q = encodeURIComponent(search);
      const res = await fetch(
        `/api/datasets/${datasetId}/records?versionId=${versionId}&fileId=${file.id}&search=${q}&page=${page}&pageSize=${pageSize}`
      );
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotalRecords(data.totalRecords || 0);
        setTotalPages(data.totalPages || 1);
        setColumns(data.columns || []);
      }
    } catch (err) {
      console.error("Error loading file records:", err);
    } finally {
      setLoadingRecords(false);
    }
  }, [datasetId, versionId, file.id, search, page, pageSize]);

  // Load File Quality
  useEffect(() => {
    async function loadFileQuality() {
      try {
        const res = await fetch(
          `/api/datasets/${datasetId}/quality?versionId=${versionId}&fileId=${file.id}`
        );
        if (res.ok) {
          const data = await res.json();
          setQuality(data.quality);
        }
      } catch (err) {
        console.error("Error loading file quality:", err);
      }
    }
    loadFileQuality();
  }, [datasetId, versionId, file.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDownload = (format: "json" | "csv") => {
    window.open(
      `/api/datasets/${datasetId}/records/export?versionId=${versionId}&fileId=${file.id}&format=${format}`,
      "_blank"
    );
  };

  const isFromZip = file.originalName.includes("→");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50">
          <div className="space-y-1 truncate">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-md">
                <FileCode className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 truncate" title={file.originalName}>
                {file.originalName}
              </h2>
            </div>

            {/* Lineage indicator */}
            {isFromZip && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium pl-8">
                <Archive className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Izvučeno iz arhive: {file.originalName.split("→")[0].trim()}</span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Metadata Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-4 border-b border-slate-100 bg-white text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Format</span>
            <span className="font-mono font-bold text-slate-800 uppercase">{file.fileType}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Veličina</span>
            <span className="font-semibold text-slate-800">{formatBytes(file.sizeBytes)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Zapisa</span>
            <span className="font-bold text-slate-900">{totalRecords}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Status</span>
            <span className="text-emerald-700 font-semibold">{file.status}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Kvalitet</span>
            <span className="font-bold text-indigo-700">
              {quality ? `${Math.round(quality.score)} / 100` : "..."}
            </span>
          </div>
          <div className="truncate">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Checksum</span>
            <span className="font-mono text-[10px] text-slate-500 truncate block" title={file.checksum}>
              {file.checksum ? `${file.checksum.slice(0, 10)}...` : "—"}
            </span>
          </div>
        </div>

        {/* Search, Filter & View Controls */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Pretraži zapise po bilo kom polju..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveView("table")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 font-medium ${
                  activeView === "table" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("json")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 font-medium ${
                  activeView === "json" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("json")}
              className="text-xs gap-1 py-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("csv")}
              className="text-xs gap-1 py-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </Button>
          </div>
        </div>

        {/* Content Explorer Area */}
        <div className="flex-1 overflow-auto p-4">
          {loadingRecords ? (
            <div className="p-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Učitavanje zapisa...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              Nema zapisa koji odgovaraju pretrazi.
            </div>
          ) : activeView === "table" ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-[11px] text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center">#</th>
                    {columns.slice(0, 8).map((col) => (
                      <th key={col} className="px-3 py-2 font-mono truncate max-w-xs">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {records.map((r, rIdx) => (
                    <tr
                      key={rIdx}
                      onClick={() => setSelectedRecord(r)}
                      className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-1.5 text-center text-slate-400 text-[10px]">
                        {(page - 1) * pageSize + rIdx + 1}
                      </td>
                      {columns.slice(0, 8).map((col) => {
                        const val = r[col];
                        let display = "—";
                        if (val !== null && val !== undefined) {
                          display = typeof val === "object" ? JSON.stringify(val) : String(val);
                        }
                        return (
                          <td key={col} className="px-3 py-1.5 truncate max-w-xs text-slate-800" title={display}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {records.map((r, rIdx) => (
                <div key={rIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 border-b border-slate-200 pb-1 font-semibold">
                    <span>ZAPIS #{(page - 1) * pageSize + rIdx + 1}</span>
                  </div>
                  <pre className="text-[11px] overflow-x-auto text-slate-800">
                    {JSON.stringify(r, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>
            Prikazano {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)} od {totalRecords} zapisa
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="font-mono font-semibold px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
