"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ColumnStatistics, SourceFile } from "@/lib/domain/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface AnalyticsChartsProps {
  stats: ColumnStatistics[];
  files: SourceFile[];
  totalRecords: number;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  stats,
  files,
  totalRecords,
}) => {
  // Chart 1: Null rates by column (top 8)
  const nullRateData = stats
    .map((s) => ({
      column: s.path.length > 14 ? s.path.slice(0, 12) + "…" : s.path,
      fullPath: s.path,
      nullPercentage: totalRecords > 0 ? Math.round((s.nullCount / totalRecords) * 1000) / 10 : 0,
      nullCount: s.nullCount,
    }))
    .sort((a, b) => b.nullPercentage - a.nullPercentage)
    .slice(0, 8);

  // Chart 2: File size distribution
  const fileData = files.map((f) => ({
    name: f.originalName.length > 14 ? f.originalName.slice(0, 12) + "…" : f.originalName,
    fullName: f.originalName,
    sizeKb: Math.round(f.sizeBytes / 1024),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stopa Null vrednosti po kolonama (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {nullRateData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
              Nema podataka o kolonama
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nullRateData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="column"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    formatter={(val: any, _name: any, item: any) => [
                      `${val}% (${item.payload.nullCount} zapisa)`,
                      "Null stopa",
                    ]}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullPath || ""}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="nullPercentage" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                    {nullRateData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.nullPercentage > 20 ? "#ef4444" : entry.nullPercentage > 5 ? "#f59e0b" : "#10b981"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Veličina uvezenih fajlova (KB)</CardTitle>
        </CardHeader>
        <CardContent>
          {fileData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
              Nema uvezenih fajlova
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fileData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit=" KB" />
                  <Tooltip
                    formatter={(val: any) => [`${val} KB`, "Veličina"]}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || ""}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="sizeKb" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
