"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Sparkles, AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { CitationBadge } from "./citation-badge";
import { QueryPlanCard } from "./query-plan-card";
import { ChatMessage, ChartSpec, QueryPlan } from "@/lib/domain/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ChatPanelProps {
  datasetId: string;
  datasetVersionId: string;
  datasetName: string;
  versionNumber: number;
}

interface MessageItem extends ChatMessage {
  confidence?: "high" | "medium" | "low";
  mode?: string;
  chart?: ChartSpec;
  warnings?: string[];
  isDemoFallback?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Koje kolone postoje u ovom dataset-u?",
  "Koliko ukupno ima zapisa?",
  "Prikaži zapise gde je status failed",
  "Koliki je prosečan amount?",
  "Grupiši zapise po statusu",
  "Koja kolona ima najviše null vrednosti?",
  "Uporedi verziju 1 i verziju 2",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  datasetId,
  datasetVersionId,
  datasetName,
  versionNumber,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for the active version
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/datasets/${datasetId}/chat?versionId=${datasetVersionId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setMessages(data);
        }
      } catch {
        // ignore
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [datasetId, datasetVersionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput("");
    setError(null);

    const userMsg: MessageItem = {
      id: `temp_user_${Date.now()}`,
      datasetVersionId,
      role: "user",
      content: query,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`/api/datasets/${datasetId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetVersionId,
          message: query,
          conversation: messages.slice(-6),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Greška pri komunikaciji sa asistentom.");
      }

      const assistantMsg: MessageItem = {
        id: `temp_asst_${Date.now()}`,
        datasetVersionId,
        role: "assistant",
        content: data.message,
        confidence: data.confidence,
        mode: data.mode,
        queryPlan: data.queryPlan,
        citations: data.citations || [],
        chart: data.chart,
        warnings: data.warnings,
        isDemoFallback: data.isDemoFallback,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              FAP Data Assistant
              <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                Gemini Flash
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Kontekst: <span className="font-medium text-slate-700">{datasetName} (v{versionNumber})</span>
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 px-4">
            <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">
              Postavite pitanje o podacima
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              AI asistent ne izmišlja cifre: svaki numerički podatak prolazi kroz validiran read-only query plan pre prikaza odgovora.
            </p>

            <div className="flex flex-wrap gap-1.5 justify-center max-w-lg mx-auto">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id || idx}
              className={`flex items-start space-x-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-xl rounded-xl p-3.5 text-xs ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-xs"
                    : "bg-slate-50 border border-slate-200 text-slate-900 rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                {/* Local demo fallback alert banner */}
                {!isUser && m.isDemoFallback && (
                  <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Lokalni režim analitike (bezbedno determinističko računanje).</span>
                  </div>
                )}

                {/* Inline Chart if present */}
                {!isUser && m.chart && m.chart.data && m.chart.data.length > 0 && (
                  <div className="mt-3 bg-white p-2.5 border border-slate-200 rounded-lg">
                    <div className="text-[11px] font-semibold text-slate-800 mb-2 flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                      {m.chart.title}
                    </div>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={m.chart.data} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey={m.chart.xKey}
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                          />
                          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              fontSize: "11px",
                            }}
                          />
                          <Bar dataKey={m.chart.yKey} fill="#6366f1" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Query Plan */}
                {!isUser && m.queryPlan && (
                  <QueryPlanCard
                    plan={m.queryPlan}
                    confidence={m.confidence}
                    mode={m.mode}
                  />
                )}

                {/* Data Lineage Citations */}
                {!isUser && m.citations && m.citations.length > 0 && (
                  <CitationBadge citations={m.citations} />
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 pl-9">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Server validira upit i priprema analitiku...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Postavite pitanje o dataset-u (npr. 'Koliko ima zapisa po statusu?')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="md"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
