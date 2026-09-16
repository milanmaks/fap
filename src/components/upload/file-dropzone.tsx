"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Uvoz podataka (Ingestion)</h2>
          <p className="text-sm text-slate-500">
            Otpremite podatke za profilisanje, verzionisanje i AI analitiku.
          </p>
        </div>

        {currentDatasetId && (
          <div className="flex items-center space-x-2 text-xs bg-slate-100 p-1.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setCreateNew(false)}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                !createNew ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Nova verzija ({currentDatasetName || "Trenutni"})
            </button>
            <button
              type="button"
              onClick={() => setCreateNew(true)}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                createNew ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Novi dataset
            </button>
          </div>
        )}
      </div>

      {createNew && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Naziv novog dataset-a (opciono):
          </label>
          <input
            type="text"
            placeholder="npr. Transakcije Korisnika 2026"
            value={newDatasetName}
            onChange={(e) => setNewDatasetName(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            ? "border-indigo-500 bg-indigo-50/50"
            : "border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
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
          <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 text-sm">
              Kliknite za odabir fajlova
            </span>{" "}
            <span className="text-slate-500 text-sm">ili prevucite fajlove ovde</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded">
              .avro
            </span>
            <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded">
              .json
            </span>
            <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded">
              .jsonl / .ndjson
            </span>
            <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded">
              .zip
            </span>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Izabrano datoteka ({selectedFiles.length}):</span>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              className="text-rose-600 hover:underline"
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
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{file.name}</span>
                    <span className="text-slate-400">({formatBytes(file.size)})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase font-mono text-[10px] ${
                        cls.isSupported
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
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
                      className="text-slate-400 hover:text-rose-600 font-bold px-1"
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
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
