export type InferredType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array"
  | "null"
  | "mixed";

export interface SchemaField {
  path: string;
  type: InferredType;
  nullable: boolean;
  sampleValues: unknown[];
  description?: string;
}

export interface DatasetSchema {
  fields: SchemaField[];
  inferredAt: string;
  recordSampleCount: number;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  status: "queued" | "processing" | "ready" | "failed" | "partial";
  schema: DatasetSchema | null;
  schemaHash?: string;
  totalFiles: number;
  processedFiles: number;
  totalRecords: number;
  errorCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface SourceFile {
  id: string;
  datasetVersionId: string;
  originalName: string;
  fileType: "avro" | "json" | "jsonl" | "zip" | "unknown";
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  status: "queued" | "processing" | "ready" | "failed" | "skipped";
  storageKey?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface FileFragment {
  id: string;
  sourceFileId: string;
  index: number;
  recordStart: number;
  recordEnd: number;
  recordCount: number;
  byteStart?: number;
  byteEnd?: number;
  status: "queued" | "processing" | "ready" | "failed";
  createdAt: string;
}

export interface TopValue {
  value: string;
  count: number;
}

export interface ColumnStatistics {
  path: string;
  inferredType: InferredType;
  presentCount: number;
  nullCount: number;
  distinctEstimate: number;
  min?: string | number;
  max?: string | number;
  average?: number;
  topValues?: TopValue[];
}

export interface PeriodFilter {
  start?: string;
  end?: string;
  granularity?: "all" | "hour" | "day" | "week" | "month";
}

export interface AnalyticsSnapshot {
  id: string;
  datasetVersionId: string;
  sourceFileId?: string;
  periodStart?: string;
  periodEnd?: string;
  granularity?: "all" | "hour" | "day" | "week" | "month";
  recordCount: number;
  duplicateCount?: number;
  invalidRecordCount: number;
  columnStats: ColumnStatistics[];
  createdAt: string;
}

export interface DataCitation {
  datasetId: string;
  datasetVersionId: string;
  sourceFileId?: string;
  fileName?: string;
  fragmentId?: string;
  recordStart?: number;
  recordEnd?: number;
  queryId?: string;
}

export interface QueryPlanSelect {
  field: string;
  aggregation?: "count" | "sum" | "avg" | "min" | "max" | "distinct_count";
  alias?: string;
}

export interface QueryPlanFilter {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "in"
    | "is_null"
    | "not_null";
  value?: string | number | boolean | Array<string | number | boolean>;
}

export interface QueryPlanOrderBy {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryPlanTime {
  field: string;
  start?: string;
  end?: string;
  bucket?: "hour" | "day" | "week" | "month";
}

export interface QueryPlan {
  operation: "count" | "aggregate" | "group_by" | "filter" | "describe" | "compare";
  datasetVersionId: string;
  select?: QueryPlanSelect[];
  filters?: QueryPlanFilter[];
  groupBy?: string[];
  orderBy?: QueryPlanOrderBy[];
  limit?: number;
  time?: QueryPlanTime;
}

export interface ChartSpec {
  type: "bar" | "line" | "pie";
  title: string;
  xKey: string;
  yKey: string;
  data: Array<Record<string, unknown>>;
}

export interface ChatMessage {
  id: string;
  datasetVersionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  queryPlan?: QueryPlan;
  citations: DataCitation[];
  createdAt: string;
}

// -------------------------------------------------------------
// Version Comparison, Overlap & Data Observability Domain Types
// -------------------------------------------------------------

export type ChangeSeverity = "info" | "warning" | "critical";

export type OverlapClassification =
  | "exact_file"
  | "canonical_row"
  | "business_key"
  | "temporal"
  | "spatial"
  | "device";

export type RowComparisonClassification =
  | "new"
  | "exact_duplicate"
  | "overlapping"
  | "changed"
  | "removed_from_current_version";

export type QualityDimension =
  | "completeness"
  | "validity"
  | "uniqueness"
  | "consistency"
  | "freshness"
  | "schema_stability";

export type QualityRuleStatus =
  | "pass"
  | "warning"
  | "fail"
  | "not_applicable";

export type ColumnDiff = {
  columnPath: string;
  changeType:
    | "added"
    | "removed"
    | "type_changed"
    | "null_rate_changed"
    | "range_changed"
    | "average_changed"
    | "cardinality_changed"
    | "distribution_changed";
  severity: ChangeSeverity;
  before?: unknown;
  after?: unknown;
  absoluteDelta?: number;
  percentDelta?: number;
  explanation: string;
};

export type KpiDelta = {
  before: number;
  after: number;
  absoluteDelta: number;
  percentDelta: number | null;
};

export type RecordLineage = {
  datasetVersionId: string;
  sourceFileId?: string;
  sourceFileName?: string;
  recordIndex?: number;
  fragmentId?: string;
};

export type RecordWithLineage = Record<string, unknown> & {
  _fap_source_file_id?: string;
  _fap_source_file_name?: string;
  _fap_record_index?: number;
};

export type VersionDiff = {
  datasetId: string;
  baseVersionId: string;
  targetVersionId: string;
  comparisonType?: "versions" | "files";
  baseLabel?: string;
  targetLabel?: string;
  fileAId?: string;
  fileBId?: string;
  generatedAt: string;
  kpis: {
    recordCount: KpiDelta;
    fileCount: KpiDelta;
    columnCount: KpiDelta;
    overallNullRate: KpiDelta;
    duplicateCount: KpiDelta;
    uniqueDeviceCount?: KpiDelta;
    timeRange?: {
      base?: { start: string; end: string };
      target?: { start: string; end: string };
    };
  };
  schemaDrift: ColumnDiff[];
  overlap: {
    exactFiles: number;
    exactDuplicateRecords: number;
    overlappingRecords: number;
    changedRecords: number;
    newRecords: number;
    removedRecords: number;
    temporalOverlapPercent: number | null;
    spatialOverlapPercent: number | null;
    deviceOverlapPercent: number | null;
  };
  recordExamples: Array<{
    classification: RowComparisonClassification;
    businessKeyHash?: string;
    canonicalHash?: string;
    previous?: Record<string, unknown>;
    current?: Record<string, unknown>;
    lineage: RecordLineage;
  }>;
};

export type QualityRule = {
  id: string;
  name: string;
  description: string;
  dimension: QualityDimension;
  severity: "warning" | "critical";
  enabled: boolean;
  appliesTo?: string[];
};

export type QualityRuleEvaluation = {
  ruleId: string;
  ruleName?: string;
  status: QualityRuleStatus;
  affectedRecordCount: number;
  affectedPercent: number;
  explanation: string;
  examples: Array<{
    recordIndex?: number;
    sourceFileId?: string;
    values: Record<string, unknown>;
  }>;
};

export type QualityDimensionScore = {
  dimension: QualityDimension;
  score: number;
  weight: number;
  explanation: string;
};

export type QualityScoreBreakdown = {
  scope: "dataset_version" | "source_file" | "column";
  score: number;
  grade: "odlicno" | "dobro" | "upozorenje" | "kriticno";
  dimensions: QualityDimensionScore[];
  rules: QualityRuleEvaluation[];
  generatedAt: string;
  warnings: string[];
};
