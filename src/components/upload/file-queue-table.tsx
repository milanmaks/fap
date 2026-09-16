"use client";

import React from "react";
import { SourceFile } from "@/lib/domain/types";
import { formatBytes } from "@/lib/utils/format";
import { Badge } from "../ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, FileCode, SkipForward } from "lucide-react";

interface FileQueueTableProps {
  files: SourceFile[];
}

export const FileQueueTable: React.FC<FileQueueTableProps> = ({ files }) => {
  if (files.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
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
            <th className="px-4 py-3">Naziv fajla / Putanja</th>
            <th className="px-3 py-3">Tip</th>
            <th className="px-3 py-3">Veličina</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-4 py-3">Detalji / Napomene</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {files.map((file) => (
            <tr key={file.id} className="hover:bg-slate-50/70 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate max-w-xs sm:max-w-md">{file.originalName}</span>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
