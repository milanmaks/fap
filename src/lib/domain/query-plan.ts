import { z } from "zod";
import { QueryPlan, DatasetSchema } from "./types";

export const QueryPlanFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "in",
    "is_null",
    "not_null",
  ]),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]).optional(),
});

export const QueryPlanSelectSchema = z.object({
  field: z.string().min(1),
  aggregation: z.enum(["count", "sum", "avg", "min", "max", "distinct_count"]).optional(),
  alias: z.string().optional(),
});

export const QueryPlanSchema = z.object({
  operation: z.enum(["count", "aggregate", "group_by", "filter", "describe", "compare"]),
  datasetVersionId: z.string().min(1),
  select: z.array(QueryPlanSelectSchema).optional(),
  filters: z.array(QueryPlanFilterSchema).optional(),
  groupBy: z.array(z.string().min(1)).max(3, "Maksimalno 3 group-by polja").optional(),
  orderBy: z.array(
    z.object({
      field: z.string().min(1),
      direction: z.enum(["asc", "desc"]),
    })
  ).optional(),
  limit: z.number().int().positive().optional(),
  time: z
    .object({
      field: z.string().min(1),
      start: z.string().optional(),
      end: z.string().optional(),
      bucket: z.enum(["hour", "day", "week", "month"]).optional(),
    })
    .optional(),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedPlan?: QueryPlan;
}

export function validateQueryPlan(
  rawPlan: unknown,
  expectedVersionId: string,
  schema: DatasetSchema | null
): ValidationResult {
  const parsed = QueryPlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  const plan = parsed.data;
  const errors: string[] = [];

  if (plan.datasetVersionId !== expectedVersionId) {
    errors.push(
      `Neovlašćena ili neispravna verzija dataset-a. Traženo: '${plan.datasetVersionId}', očekivano: '${expectedVersionId}'.`
    );
  }

  // Schema field validation
  if (schema && schema.fields) {
    const knownFields = new Set(schema.fields.map((f) => f.path));
    // Also allow wildcard '*' for count
    knownFields.add("*");

    const checkField = (field: string, context: string) => {
      if (field === "*" && (context.includes("select") || plan.operation === "count")) {
        return;
      }
      if (!knownFields.has(field)) {
        errors.push(
          `Polje '${field}' u ${context} ne postoji u šemi verzije. Poznata polja: ${Array.from(knownFields).filter(f => f !== "*").slice(0, 10).join(", ")}`
        );
      }
    };

    if (plan.select) {
      for (const sel of plan.select) {
        checkField(sel.field, "select listi");
      }
    }

    if (plan.filters) {
      for (const fil of plan.filters) {
        checkField(fil.field, "filterima");
      }
    }

    if (plan.groupBy) {
      for (const g of plan.groupBy) {
        checkField(g, "group-by listi");
      }
    }

    if (plan.orderBy) {
      for (const o of plan.orderBy) {
        checkField(o.field, "order-by listi");
      }
    }

    if (plan.time) {
      checkField(plan.time.field, "vremenskom filteru");
    }
  }

  // Record returning operations require limit clamped to 100
  if (plan.operation === "filter" || plan.operation === "group_by") {
    if (!plan.limit || plan.limit > 100) {
      plan.limit = Math.min(plan.limit || 50, 100);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], sanitizedPlan: plan };
}
