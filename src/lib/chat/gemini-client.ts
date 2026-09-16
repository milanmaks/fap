import {
  AnalyticsSnapshot,
  ChartSpec,
  ChatMessage,
  DataCitation,
  DatasetVersion,
  QueryPlan,
} from "../domain/types";
import { FAP_SYSTEM_PROMPT } from "./prompts";
import { routeQuestionDeterministic } from "./question-router";

export interface GeminiClient {
  isConfigured(): boolean;

  createQueryPlan(input: {
    question: string;
    dataset: DatasetVersion;
    schema: unknown;
    analyticsSummary: AnalyticsSnapshot;
    conversation: ChatMessage[];
  }): Promise<{ route: string; plan?: QueryPlan; clarification?: string }>;

  composeAnswer(input: {
    question: string;
    route: string;
    result: unknown;
    citations: DataCitation[];
    warnings: string[];
    language: "sr" | "en";
  }): Promise<{ message: string; confidence: "high" | "medium" | "low"; chart?: ChartSpec }>;
}

export class LocalDeterministicGeminiFallback implements GeminiClient {
  isConfigured(): boolean {
    return false;
  }

  async createQueryPlan(input: {
    question: string;
    dataset: DatasetVersion;
    schema: any;
    analyticsSummary: AnalyticsSnapshot;
    conversation: ChatMessage[];
  }): Promise<{ route: string; plan?: QueryPlan; clarification?: string }> {
    const q = input.question.toLowerCase().trim();
    const routeDecision = routeQuestionDeterministic(input.question);
    const versionId = input.dataset.id;
    const fields: string[] = input.schema?.fields?.map((f: any) => f.path) || [];

    // Check for specific fields in question
    const mentionedField = fields.find((f) => q.includes(f.toLowerCase()));

    if (routeDecision.route === "metadata") {
      return {
        route: "metadata",
        plan: {
          operation: "describe",
          datasetVersionId: versionId,
        },
      };
    }

    if (routeDecision.route === "version_comparison") {
      return {
        route: "version_comparison",
        plan: {
          operation: "compare",
          datasetVersionId: versionId,
        },
      };
    }

    // Check count query
    if (q.includes("koliko") || q.includes("count") || q.includes("broj zapisa")) {
      // Check if filtering by status
      if (q.includes("status")) {
        let statusVal = "failed";
        if (q.includes("completed")) statusVal = "completed";
        if (q.includes("pending")) statusVal = "pending";

        return {
          route: "analytics_query",
          plan: {
            operation: "count",
            datasetVersionId: versionId,
            filters: [
              {
                field: "status",
                operator: "eq",
                value: statusVal,
              },
            ],
          },
        };
      }

      return {
        route: "analytics_query",
        plan: {
          operation: "count",
          datasetVersionId: versionId,
        },
      };
    }

    // Average / Sum
    if (q.includes("prosek") || q.includes("proseč") || q.includes("average")) {
      const numCol =
        mentionedField ||
        input.schema?.fields?.find((f: any) => f.type === "number")?.path ||
        "amount";

      return {
        route: "analytics_query",
        plan: {
          operation: "aggregate",
          datasetVersionId: versionId,
          select: [
            {
              field: numCol,
              aggregation: "avg",
              alias: `avg_${numCol}`,
            },
          ],
        },
      };
    }

    // Grouping by field or day
    if (q.includes("grupiši") || q.includes("po dan") || q.includes("by day") || q.includes("grad")) {
      const dateCol = input.schema?.fields?.find((f: any) => f.type === "date")?.path;
      if ((q.includes("dan") || q.includes("datum") || q.includes("day")) && dateCol) {
        return {
          route: "analytics_query",
          plan: {
            operation: "group_by",
            datasetVersionId: versionId,
            time: {
              field: dateCol,
              bucket: "day",
            },
          },
        };
      }

      const grpCol = mentionedField || "city";
      return {
        route: "analytics_query",
        plan: {
          operation: "group_by",
          datasetVersionId: versionId,
          groupBy: [grpCol],
        },
      };
    }

    // Show records / Filter
    if (routeDecision.route === "record_search") {
      const filters: any[] = [];
      if (q.includes("status")) {
        const val = q.includes("failed") ? "failed" : q.includes("completed") ? "completed" : "pending";
        filters.push({ field: "status", operator: "eq", value: val });
      }

      return {
        route: "record_search",
        plan: {
          operation: "filter",
          datasetVersionId: versionId,
          filters: filters.length > 0 ? filters : undefined,
          limit: 10,
        },
      };
    }

    return {
      route: routeDecision.route,
      plan: {
        operation: "count",
        datasetVersionId: versionId,
      },
    };
  }

  async composeAnswer(input: {
    question: string;
    route: string;
    result: any;
    citations: DataCitation[];
    warnings: string[];
    language: "sr" | "en";
  }): Promise<{ message: string; confidence: "high" | "medium" | "low"; chart?: ChartSpec }> {
    const res = input.result;

    if (input.route === "metadata") {
      const cols = res?.columnStats?.map((c: any) => `• \`${c.path}\` (${c.inferredType})`).join("\n") || "Nema kolona";
      return {
        message: `[Lokalni Režim] Šema dataset-a sadrži sledeće kolone:\n\n${cols}\n\nUkupan broj uvezenih fajlova: ${res?.totalFiles ?? 1}, ukupno zapisa: ${res?.recordCount ?? 0}.`,
        confidence: "high",
      };
    }

    if (input.route === "data_quality") {
      const highestNull = res?.columnStats
        ?.slice()
        ?.sort((a: any, b: any) => b.nullCount - a.nullCount)?.[0];

      return {
        message: `[Lokalni Režim] Analiza kvaliteta podataka:\n- Ukupno nevalidnih zapisa: ${res?.invalidRecordCount ?? 0}\n- Detektovano duplikata: ${res?.duplicateCount ?? 0}\n- Kolona sa najviše null vrednosti: \`${highestNull?.path || "nijedna"}\` (${highestNull?.nullCount || 0} null zapisa).`,
        confidence: "high",
      };
    }

    if (input.route === "version_comparison") {
      return {
        message: `[Lokalni Režim] Poređenje verzija:\n- ${res.leftVersion}: ${res.records?.left} zapisa\n- ${res.rightVersion}: ${res.records?.right} zapisa (razlika: ${res.records?.difference > 0 ? "+" : ""}${res.records?.difference})\n- Dodate kolone: ${res.addedColumns?.join(", ") || "nema"}\n- Uklonjene kolone: ${res.removedColumns?.join(", ") || "nema"}`,
        confidence: "high",
      };
    }

    if (res?.summary) {
      let extra = "";
      if (res.data && typeof res.data === "object" && "count" in res.data) {
        extra = `\n\nRezultat brojanja: **${res.data.count}** zapisa.`;
      } else if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
        const aggs = Object.entries(res.data)
          .map(([k, v]) => `• **${k}**: ${v}`)
          .join("\n");
        extra = `\n\nIzračunate vrednosti:\n${aggs}`;
      }

      return {
        message: `[Lokalni Režim] ${res.summary}${extra}`,
        confidence: "high",
        chart: res.chart,
      };
    }

    return {
      message: `[Lokalni Režim] Odgovor za upit '${input.question}'. Izvršeni rezultati su potkrepljeni verifikovanim snapshot-om podataka.`,
      confidence: "medium",
      chart: res?.chart,
    };
  }
}

export class GoogleGenAiGeminiClient implements GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async createQueryPlan(input: {
    question: string;
    dataset: DatasetVersion;
    schema: unknown;
    analyticsSummary: AnalyticsSnapshot;
    conversation: ChatMessage[];
  }): Promise<{ route: string; plan?: QueryPlan; clarification?: string }> {
    const prompt = `
${FAP_SYSTEM_PROMPT}

Korisničko pitanje: "${input.question}"
Verzija dataset-a: "${input.dataset.id}" (v${input.dataset.versionNumber})
Dostupna šema kolona:
${JSON.stringify(input.schema, null, 2)}

Statistika kolona:
${JSON.stringify(input.analyticsSummary.columnStats.slice(0, 15), null, 2)}

Tvoj zadatak je da odrediš rutu i kreiraš validan JSON QueryPlan koji odgovara na pitanje.
Operacije mogu biti: "count", "aggregate", "group_by", "filter", "describe", "compare".
Format odgovora MORA biti ISKLJUČIVO validan JSON objekat oblika:
{
  "route": "metadata" | "analytics_query" | "record_search" | "version_comparison" | "data_quality" | "summary" | "clarification",
  "plan": {
    "operation": "count" | "aggregate" | "group_by" | "filter" | "describe" | "compare",
    "datasetVersionId": "${input.dataset.id}",
    "select": [{"field": "kolona", "aggregation": "count" | "sum" | "avg" | "min" | "max" | "distinct_count", "alias": "alias"}],
    "filters": [{"field": "kolona", "operator": "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "is_null" | "not_null", "value": "vrednost"}],
    "groupBy": ["kolona"],
    "limit": 50,
    "time": {"field": "datum_kolona", "bucket": "day"}
  },
  "clarification": "Pitanje za korisnika ako je upit dvosmislen"
}
`;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!resp.ok) {
        console.warn("Gemini API error status:", resp.status, await resp.text());
        // Fallback to local deterministic router
        return new LocalDeterministicGeminiFallback().createQueryPlan(input);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return new LocalDeterministicGeminiFallback().createQueryPlan(input);
      }

      const parsed = JSON.parse(text);
      if (parsed.plan) {
        parsed.plan.datasetVersionId = input.dataset.id;
      }
      return parsed;
    } catch (err) {
      console.warn("Gemini call exception, fallback to local:", err);
      return new LocalDeterministicGeminiFallback().createQueryPlan(input);
    }
  }

  async composeAnswer(input: {
    question: string;
    route: string;
    result: unknown;
    citations: DataCitation[];
    warnings: string[];
    language: "sr" | "en";
  }): Promise<{ message: string; confidence: "high" | "medium" | "low"; chart?: ChartSpec }> {
    const prompt = `
${FAP_SYSTEM_PROMPT}

Korisničko pitanje: "${input.question}"
Ruta: ${input.route}
Verifikovani rezultati server-side analize:
${JSON.stringify(input.result, null, 2)}

Upozorenja: ${JSON.stringify(input.warnings)}

Generiši sažet, tačan i profesionalan odgovor na srpskom jeziku (latinica).
NEMOJ izmišljati nijednu cifru. Svaki numerički podatak mora poticati iz gorenavedenih rezultata.
Ako je dostupan grafikon, potvrdi ga.

Vrati ISKLJUČIVO JSON u formatu:
{
  "message": "tekst odgovora",
  "confidence": "high" | "medium" | "low"
}
`;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!resp.ok) {
        return new LocalDeterministicGeminiFallback().composeAnswer(input);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return new LocalDeterministicGeminiFallback().composeAnswer(input);

      const parsed = JSON.parse(text);
      return {
        message: parsed.message,
        confidence: parsed.confidence || "high",
        chart: (input.result as any)?.chart,
      };
    } catch {
      return new LocalDeterministicGeminiFallback().composeAnswer(input);
    }
  }
}

export function getGeminiClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";

  if (apiKey) {
    return new GoogleGenAiGeminiClient(apiKey, model);
  }

  return new LocalDeterministicGeminiFallback();
}
