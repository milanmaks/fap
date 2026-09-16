"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Database, FolderPlus } from "lucide-react";
import { Button } from "../ui/button";
import { formatBytes } from "@/lib/utils/format";
import { SupportedFileType, classifyFile } from "@/lib/ingestion/file-classifier";

interface FileDropzoneProps {
  currentDatasetId?: string;
  currentDatasetName?: string;
  onUploadSuccess: (result: any) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  currentDatasetId,
  currentDatasetName,
  onUploadSuccess,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(!currentDatasetId);
  const [newDatasetName, setNewDatasetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentDatasetId) {
      setCreateNew(false);
    }
  }, [currentDatasetId]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const valid: File[] = [];
    for (let i = 0; i < files.length; i++) {
      valid.push(files[i]);
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      if (!createNew && currentDatasetId) {
        formData.append("datasetId", currentDatasetId);
      } else if (newDatasetName.trim()) {
        formData.append("datasetName", newDatasetName.trim());
      } else if (currentDatasetId) {
        // Fallback: if user didn't enter a custom name for new dataset, upload into current dataset
        formData.append("datasetId", currentDatasetId);
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Greška pri uploadu datoteka.");
      }

      setSelectedFiles([]);
      setNewDatasetName("");
      onUploadSuccess(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Uvoz podataka (Ingestion)</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Otpremite podatke za profilisanje, verzionisanje i AI analitiku.
          </p>
        </div>

        {currentDatasetId && (
          <div className="flex items-center space-x-2 text-xs bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setCreateNew(false)}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                !createNew ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Nova verzija ({currentDatasetName || "Trenutni"})
            </button>
            <button
              type="button"
              onClick={() => setCreateNew(true)}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                createNew ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Novi dataset
            </button>
          </div>
        )}
      </div>

      {!createNew && currentDatasetId && (
        <div className="mb-4 flex items-center gap-2 p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs text-indigo-900 dark:text-indigo-200">
          <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            Podaci će biti uvezeni u dataset <strong>{currentDatasetName || currentDatasetId}</strong> kao nova verzija.
          </span>
        </div>
      )}

      {createNew && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Naziv novog dataset-a (opciono):
          </label>
          <input
            type="text"
            placeholder="npr. Transakcije Korisnika 2026"
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            className="w-full text-xs sm:text-sm px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {/* Dropzone Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
            : "border-zinc-300 dark:border-zinc-750 hover:border-indigo-400 dark:hover:border-indigo-500 bg-zinc-50/50 dark:bg-zinc-850/40 hover:bg-zinc-50 dark:hover:bg-zinc-850/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".avro,.json,.jsonl,.ndjson,.zip"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950/60 rounded-full text-indigo-600 dark:text-indigo-400">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Kliknite za odabir fajlova
            </span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400 text-sm">ili prevucite fajlove ovde</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded">
              .avro
            </span>
            <span className="text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded">
              .json
            </span>
            <span className="text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded">
              .jsonl / .ndjson
            </span>
            <span className="text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded">
              .zip
            </span>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <span>Izabrano datoteka ({selectedFiles.length}):</span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Ukloni sve
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((file, idx) => {
              const cls = classifyFile(file.name, file.type);
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{file.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">({formatBytes(file.size)})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase font-mono text-[10px] ${
                        cls.isSupported
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {cls.fileType}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-end">
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Profilisanje i obrada...
                </>
              ) : (
                `Započni uvoz (${selectedFiles.length})`
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
