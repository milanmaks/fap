export type QuestionRoute =
  | "metadata"
  | "analytics_query"
  | "record_search"
  | "version_comparison"
  | "data_quality"
  | "summary"
  | "clarification";

export interface RouteDecision {
  route: QuestionRoute;
  confidence: "high" | "medium" | "low";
  matchedPattern?: string;
}

export function routeQuestionDeterministic(question: string): RouteDecision {
  const q = question.toLowerCase().trim();

  // Version comparison
  if (
    q.includes("uporedi") ||
    q.includes("poređenje") ||
    q.includes("compare") ||
    q.includes("razlika između verzij") ||
    q.includes("versus") ||
    /\bv\d+\b.*\bv\d+\b/i.test(q)
  ) {
    return { route: "version_comparison", confidence: "high", matchedPattern: "version_comparison" };
  }

  // Data quality
  if (
    q.includes("null") ||
    q.includes("duplikat") ||
    q.includes("duplicate") ||
    q.includes("kvalitet") ||
    q.includes("grešk") ||
    q.includes("nedostaj") ||
    q.includes("anomali")
  ) {
    return { route: "data_quality", confidence: "high", matchedPattern: "data_quality" };
  }

  // Metadata / Schema / Files
  if (
    q.includes("kolon") ||
    q.includes("column") ||
    q.includes("šem") ||
    q.includes("schema") ||
    q.includes("fajl") ||
    q.includes("file") ||
    q.includes("polj") ||
    q.includes("tipov") ||
    q.includes("struktura")
  ) {
    return { route: "metadata", confidence: "high", matchedPattern: "metadata" };
  }

  // Aggregation / Count / Analytics
  if (
    q.includes("koliko") ||
    q.includes("count") ||
    q.includes("prosek") ||
    q.includes("proseč") ||
    q.includes("average") ||
    q.includes("ukupno") ||
    q.includes("total") ||
    q.includes("suma") ||
    q.includes("sum") ||
    q.includes("najveć") ||
    q.includes("najmanj") ||
    q.includes("max") ||
    q.includes("min") ||
    q.includes("grupiši") ||
    q.includes("po dan") ||
    q.includes("by day") ||
    q.includes("broj")
  ) {
    return { route: "analytics_query", confidence: "high", matchedPattern: "analytics_query" };
  }

  // Record search / Filter
  if (
    q.includes("prikaži") ||
    q.includes("show") ||
    q.includes("nađi") ||
    q.includes("find") ||
    q.includes("gde je") ||
    q.includes("where") ||
    q.includes("pretraži") ||
    q.includes("search")
  ) {
    return { route: "record_search", confidence: "medium", matchedPattern: "record_search" };
  }

  // Summary / Overview
  if (
    q.includes("sažetak") ||
    q.includes("rezime") ||
    q.includes("opis") ||
    q.includes("šta sadrži") ||
    q.includes("summary") ||
    q.includes("overview")
  ) {
    return { route: "summary", confidence: "medium", matchedPattern: "summary" };
  }

  // Fallback
  return { route: "analytics_query", confidence: "low" };
}
