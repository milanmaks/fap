"use client";

import React, { useState } from "react";
import { SourceFile } from "@/lib/domain/types";
import { formatBytes } from "@/lib/utils/format";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  SkipForward,
  Eye,
  Archive,
} from "lucide-react";

interface FileQueueTableProps {
  files: SourceFile[];
  onViewFile?: (file: SourceFile) => void;
  selectedFileIds?: string[];
  onToggleSelectFile?: (fileId: string) => void;
}

export const FileQueueTable: React.FC<FileQueueTableProps> = ({
  files,
  onViewFile,
  selectedFileIds = [],
  onToggleSelectFile,
}) => {
  if (files.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        Nema uvezenih datoteka za ovu verziju.
      </div>
    );
  }

  const getStatusBadge = (status: SourceFile["status"]) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="w-3 h-3" /> Spreman
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="warning" className="gap-1">
            <SkipForward className="w-3 h-3" /> Preskočen
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="danger" className="gap-1">
            <XCircle className="w-3 h-3" /> Greška
          </Badge>
        );
      case "processing":
      case "queued":
        return (
          <Badge variant="info" className="gap-1">
            <AlertTriangle className="w-3 h-3" /> Obrada
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            {onToggleSelectFile && <th className="w-8 px-3 py-3 text-center"></th>}
            <th className="px-4 py-3">Naziv fajla & Lineage</th>
            <th className="px-3 py-3">Tip</th>
            <th className="px-3 py-3">Veličina</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-4 py-3">Detalji / Napomene</th>
            <th className="px-4 py-3 text-right">Akcija</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((file) => {
            const isFromZip = file.originalName.includes("→");
            const isSelected = selectedFileIds.includes(file.id);

            return (
              <tr
                key={file.id}
                className={`transition-colors ${
                  isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/70"
                }`}
              >
                {onToggleSelectFile && (
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectFile(file.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    {isFromZip ? (
                      <Archive className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate max-w-xs sm:max-w-md font-medium" title={file.originalName}>
                      {file.originalName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono uppercase text-[11px] text-slate-700">
                  {file.fileType}
                </td>
                <td className="px-3 py-3">{formatBytes(file.sizeBytes)}</td>
                <td className="px-3 py-3">{getStatusBadge(file.status)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {file.errorMessage ? (
                    <span className="text-rose-600 truncate block max-w-xs" title={file.errorMessage}>
                      {file.errorMessage}
                    </span>
                  ) : (
                    <span className="text-slate-400">Uspešno profilisan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {onViewFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewFile(file)}
                      className="text-[11px] gap-1 py-1 h-7 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      title="Pogledaj detalje i zapise ovog fajla"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Pregled</span>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
