import { DatasetSchema, QueryPlan } from "../domain/types";
import { validateQueryPlan, ValidationResult } from "../domain/query-plan";

export class ReadonlyQueryValidator {
  private static FORBIDDEN_KEYWORDS = [
    "drop",
    "delete",
    "insert",
    "update",
    "alter",
    "truncate",
    "exec",
    "execute",
    "create",
    "grant",
    "revoke",
    "merge",
    "upsert",
    "--",
    ";",
  ];

  static validate(
    rawPlan: unknown,
    expectedVersionId: string,
    schema: DatasetSchema | null
  ): ValidationResult {
    // 1. Structural and field validation
    const result = validateQueryPlan(rawPlan, expectedVersionId, schema);
    if (!result.valid || !result.sanitizedPlan) {
      return result;
    }

    const plan = result.sanitizedPlan;
    const errors: string[] = [];

    // 2. Scan string values and fields for SQL injection or mutation keywords
    const scanString = (val: string, location: string) => {
      const lower = val.toLowerCase();
      for (const kw of ReadonlyQueryValidator.FORBIDDEN_KEYWORDS) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
          errors.push(
            `Nedozvoljena reč ili komanda '${kw}' pronađena u ${location}. Dozvoljeni su samo bezbedni read-only upiti.`
          );
        }
      }
    };

    if (plan.select) {
      for (const s of plan.select) {
        scanString(s.field, "select koloni");
      }
    }

    if (plan.filters) {
      for (const f of plan.filters) {
        scanString(f.field, "filter koloni");
        if (typeof f.value === "string") {
          scanString(f.value, "filter vrednosti");
        }
      }
    }

    if (plan.groupBy) {
      for (const g of plan.groupBy) {
        scanString(g, "group-by koloni");
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, errors: [], sanitizedPlan: plan };
  }
}
