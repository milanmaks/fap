import {
  AnalyticsSnapshot,
  DatasetVersion,
  QualityDimension,
  QualityDimensionScore,
  QualityRule,
  QualityRuleEvaluation,
  QualityRuleStatus,
  QualityScoreBreakdown,
  RecordWithLineage,
} from "../domain/types";
import { computeCanonicalRecordHash, getNestedValue } from "./hash-utils";

export interface QualityWeights {
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  freshness: number;
  schema_stability: number;
}

export const DEFAULT_QUALITY_WEIGHTS: QualityWeights = {
  completeness: 0.25,
  validity: 0.25,
  uniqueness: 0.15,
  consistency: 0.15,
  freshness: 0.10,
  schema_stability: 0.10,
};

// Sensors or fields known to be optionally absent on many mobile hardware configurations
const KNOWN_OPTIONAL_HARDWARE_FIELDS = new Set<string>([
  "sensorSnapshot.pressureAltitudeMeters",
  "sensorSnapshot.pressureMillibars",
  "mobileSnapshot.ageMillis",
  "mobileSnapshot.dataConnectionSim.eSIM",
]);

export interface EvaluateQualityInput {
  version: DatasetVersion;
  records: RecordWithLineage[];
  snapshot: AnalyticsSnapshot;
  previousVersion?: DatasetVersion | null;
  previousSnapshot?: AnalyticsSnapshot | null;
  weights?: QualityWeights;
  scope?: "dataset_version" | "source_file" | "column";
}

export function evaluateDatasetQuality(input: EvaluateQualityInput): QualityScoreBreakdown {
  const {
    version,
    records,
    snapshot,
    previousVersion,
    previousSnapshot,
    weights = DEFAULT_QUALITY_WEIGHTS,
    scope = "dataset_version",
  } = input;

  const totalRecords = records.length;
  const warnings: string[] = [];
  const rules: QualityRuleEvaluation[] = [];

  // -------------------------------------------------------------
  // 1. COMPLETENESS (0 - 100)
  // -------------------------------------------------------------
  let completenessScore = 100;
  if (snapshot.columnStats.length > 0 && totalRecords > 0) {
    let totalEligibleCells = 0;
    let filledEligibleCells = 0;

    for (const col of snapshot.columnStats) {
      // Don't double-penalize known unavailable optional hardware sensors
      if (KNOWN_OPTIONAL_HARDWARE_FIELDS.has(col.path) && col.nullCount === totalRecords) {
        continue;
      }
      totalEligibleCells += totalRecords;
      filledEligibleCells += col.presentCount;
    }

    if (totalEligibleCells > 0) {
      completenessScore = Math.min(
        100,
        Math.max(0, (filledEligibleCells / totalEligibleCells) * 100)
      );
    }
  }

  // -------------------------------------------------------------
  // 2. VALIDITY (0 - 100) & DOMAIN RULES
  // -------------------------------------------------------------
  let invalidCount = snapshot.invalidRecordCount || 0;

  // Rule 2.1: Required timestamp
  let missingTimestampCount = 0;
  const missingTimestampExamples: QualityRuleEvaluation["examples"] = [];

  // Rule 2.2: Coordinate range (-90..90, -180..180)
  let invalidCoordsCount = 0;
  const invalidCoordsExamples: QualityRuleEvaluation["examples"] = [];

  // Rule 2.3: Non-negative accuracy and speed
  let invalidSpeedOrAccuracyCount = 0;
  const invalidSpeedOrAccuracyExamples: QualityRuleEvaluation["examples"] = [];

  // Rule 2.4: Safe 64-bit h3Index
  let invalidH3Count = 0;
  const invalidH3Examples: QualityRuleEvaluation["examples"] = [];

  for (let i = 0; i < totalRecords; i++) {
    const r = records[i];

    // Timestamp check
    const ts =
      getNestedValue(r, "time.timestamp") ??
      getNestedValue(r, "time") ??
      getNestedValue(r, "observedWindowStartTimestampMs");
    if (ts === undefined || ts === null) {
      missingTimestampCount++;
      if (missingTimestampExamples.length < 5) {
        missingTimestampExamples.push({
          recordIndex: i,
          sourceFileId: r._fap_source_file_id,
          values: { time: ts },
        });
      }
    }

    // Coordinates check
    const lat = getNestedValue(r, "locationSnapshot.lat");
    const lng = getNestedValue(r, "locationSnapshot.lng");
    if (lat !== undefined && lat !== null) {
      const nLat = Number(lat);
      if (isNaN(nLat) || nLat < -90 || nLat > 90) {
        invalidCoordsCount++;
        if (invalidCoordsExamples.length < 5) {
          invalidCoordsExamples.push({
            recordIndex: i,
            sourceFileId: r._fap_source_file_id,
            values: { lat, lng },
          });
        }
      }
    }
    if (lng !== undefined && lng !== null) {
      const nLng = Number(lng);
      if (isNaN(nLng) || nLng < -180 || nLng > 180) {
        invalidCoordsCount++;
        if (invalidCoordsExamples.length < 5) {
          invalidCoordsExamples.push({
            recordIndex: i,
            sourceFileId: r._fap_source_file_id,
            values: { lat, lng },
          });
        }
      }
    }

    // Speed and Accuracy
    const speed = getNestedValue(r, "locationSnapshot.speed");
    const acc = getNestedValue(r, "locationSnapshot.accuracy");
    if (speed !== undefined && speed !== null && Number(speed) < 0) {
      invalidSpeedOrAccuracyCount++;
      if (invalidSpeedOrAccuracyExamples.length < 5) {
        invalidSpeedOrAccuracyExamples.push({
          recordIndex: i,
          sourceFileId: r._fap_source_file_id,
          values: { speed, accuracy: acc },
        });
      }
    }
    if (acc !== undefined && acc !== null && Number(acc) < 0) {
      invalidSpeedOrAccuracyCount++;
      if (invalidSpeedOrAccuracyExamples.length < 5) {
        invalidSpeedOrAccuracyExamples.push({
          recordIndex: i,
          sourceFileId: r._fap_source_file_id,
          values: { speed, accuracy: acc },
        });
      }
    }

    // h3Index type check
    const h3 = getNestedValue(r, "locationSnapshot.h3Index");
    if (h3 !== undefined && h3 !== null) {
      if (typeof h3 === "number" && h3 > Number.MAX_SAFE_INTEGER) {
        invalidH3Count++;
        if (invalidH3Examples.length < 5) {
          invalidH3Examples.push({
            recordIndex: i,
            sourceFileId: r._fap_source_file_id,
            values: { h3Index: h3 },
          });
        }
      }
    }
  }

  // Register Validity Rules
  rules.push({
    ruleId: "timestamp-required",
    ruleName: "Obavezno polje vremenske oznake (time.timestamp)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : missingTimestampCount === 0
        ? "pass"
        : "fail",
    affectedRecordCount: missingTimestampCount,
    affectedPercent:
      totalRecords > 0 ? (missingTimestampCount / totalRecords) * 100 : 0,
    explanation:
      missingTimestampCount === 0
        ? "Svi zapisi sadrže definisanu vremensku oznaku."
        : `${missingTimestampCount} zapisa nema validnu vremensku oznaku.`,
    examples: missingTimestampExamples,
  });

  rules.push({
    ruleId: "geo-coordinates-valid-range",
    ruleName: "Geografske koordinate u dozvoljenom opsegu (-90..90, -180..180)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : invalidCoordsCount === 0
        ? "pass"
        : "fail",
    affectedRecordCount: invalidCoordsCount,
    affectedPercent:
      totalRecords > 0 ? (invalidCoordsCount / totalRecords) * 100 : 0,
    explanation:
      invalidCoordsCount === 0
        ? "Sve GPS koordinate su unutar dozvoljenog opsega."
        : `${invalidCoordsCount} koordinata je van validnog opsega.`,
    examples: invalidCoordsExamples,
  });

  rules.push({
    ruleId: "accuracy-speed-non-negative",
    ruleName: "Preciznost i brzina moraju biti nenegativne (>= 0)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : invalidSpeedOrAccuracyCount === 0
        ? "pass"
        : "fail",
    affectedRecordCount: invalidSpeedOrAccuracyCount,
    affectedPercent:
      totalRecords > 0 ? (invalidSpeedOrAccuracyCount / totalRecords) * 100 : 0,
    explanation:
      invalidSpeedOrAccuracyCount === 0
        ? "Brzina i preciznost su u validnom domenu (>= 0)."
        : `${invalidSpeedOrAccuracyCount} zapisa ima negativne vrednosti brzine ili preciznosti.`,
    examples: invalidSpeedOrAccuracyExamples,
  });

  rules.push({
    ruleId: "h3-index-64bit-safe",
    ruleName: "h3Index formatiran bez gubitka 64-bitne preciznosti",
    status:
      totalRecords === 0
        ? "not_applicable"
        : invalidH3Count === 0
        ? "pass"
        : "warning",
    affectedRecordCount: invalidH3Count,
    affectedPercent: totalRecords > 0 ? (invalidH3Count / totalRecords) * 100 : 0,
    explanation:
      invalidH3Count === 0
        ? "Svi h3Index identifikatori su bezbedno sačuvani kao string bez gubitka preciznosti."
        : `${invalidH3Count} vrednosti h3Index prelazi MAX_SAFE_INTEGER bez string konverzije.`,
    examples: invalidH3Examples,
  });

  const totalValidityViolations =
    invalidCount +
    missingTimestampCount +
    invalidCoordsCount +
    invalidSpeedOrAccuracyCount +
    invalidH3Count;
  const validityScore =
    totalRecords > 0
      ? Math.max(0, 100 - (totalValidityViolations / totalRecords) * 100)
      : 100;

  // -------------------------------------------------------------
  // 3. UNIQUENESS (0 - 100)
  // -------------------------------------------------------------
  let duplicateCount = snapshot.duplicateCount || 0;
  if (duplicateCount === 0 && totalRecords > 0) {
    const seenHashes = new Set<string>();
    for (const r of records) {
      const h = computeCanonicalRecordHash(r);
      if (seenHashes.has(h)) duplicateCount++;
      else seenHashes.add(h);
    }
  }

  const uniquenessScore =
    totalRecords > 0
      ? Math.max(0, 100 - (duplicateCount / totalRecords) * 100)
      : 100;

  rules.push({
    ruleId: "uniqueness-exact-duplicates",
    ruleName: "Odsustvo identičnih duplikata zapisa",
    status:
      totalRecords === 0
        ? "not_applicable"
        : duplicateCount === 0
        ? "pass"
        : "warning",
    affectedRecordCount: duplicateCount,
    affectedPercent:
      totalRecords > 0 ? (duplicateCount / totalRecords) * 100 : 0,
    explanation:
      duplicateCount === 0
        ? "Nema detektovanih identičnih duplikata u verziji."
        : `Pronađeno ${duplicateCount} identičnih zapisa (${Math.round((duplicateCount / totalRecords) * 100)}%).`,
    examples: [],
  });

  // -------------------------------------------------------------
  // 4. CONSISTENCY (0 - 100)
  // -------------------------------------------------------------
  let windowOrderViolations = 0;
  let uploadBeforeEventViolations = 0;
  let networkStateViolations = 0;
  let mockLocationCount = 0;
  let nonRsCountryCount = 0;

  const windowExamples: QualityRuleEvaluation["examples"] = [];
  const networkExamples: QualityRuleEvaluation["examples"] = [];

  for (let i = 0; i < totalRecords; i++) {
    const r = records[i];

    // observedWindowEndTimestampMs >= observedWindowStartTimestampMs
    const wStart = getNestedValue(r, "observedWindowStartTimestampMs");
    const wEnd = getNestedValue(r, "observedWindowEndTimestampMs");
    if (wStart !== undefined && wEnd !== undefined) {
      if (Number(wEnd) < Number(wStart)) {
        windowOrderViolations++;
        if (windowExamples.length < 5) {
          windowExamples.push({
            recordIndex: i,
            sourceFileId: r._fap_source_file_id,
            values: { start: wStart, end: wEnd },
          });
        }
      }
    }

    // uploadTimestamp >= time.timestamp
    const upTs = getNestedValue(r, "uploadTimestamp");
    const evTs = getNestedValue(r, "time.timestamp") ?? getNestedValue(r, "time");
    if (upTs !== undefined && evTs !== undefined) {
      if (Number(upTs) < Number(evTs)) {
        uploadBeforeEventViolations++;
      }
    }

    // CONNECTED requires IN_SERVICE
    const dataState = getNestedValue(r, "mobileSnapshot.dataConnectionSim.dataState");
    const serviceState = getNestedValue(r, "mobileSnapshot.dataConnectionSim.serviceState");
    if (dataState === "CONNECTED" && serviceState !== undefined) {
      if (serviceState !== "IN_SERVICE" && serviceState !== "STATE_IN_SERVICE") {
        networkStateViolations++;
        if (networkExamples.length < 5) {
          networkExamples.push({
            recordIndex: i,
            sourceFileId: r._fap_source_file_id,
            values: { dataState, serviceState },
          });
        }
      }
    }

    // isMock location
    const isMock = getNestedValue(r, "locationSnapshot.isMock");
    if (isMock === true) {
      mockLocationCount++;
    }

    // countryCode
    const country =
      getNestedValue(r, "locationSnapshot.countryCode") ??
      getNestedValue(r, "uploadCountry");
    if (country && String(country).toUpperCase() !== "RS") {
      nonRsCountryCount++;
    }
  }

  rules.push({
    ruleId: "window-end-after-start",
    ruleName: "Kraj prozora posmatranja posle početka (end >= start)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : windowOrderViolations === 0
        ? "pass"
        : "fail",
    affectedRecordCount: windowOrderViolations,
    affectedPercent:
      totalRecords > 0 ? (windowOrderViolations / totalRecords) * 100 : 0,
    explanation:
      windowOrderViolations === 0
        ? "Vremenski intervali posmatranja su hronološki konzistentni."
        : `${windowOrderViolations} zapisa ima vreme kraja prozora pre početka.`,
    examples: windowExamples,
  });

  rules.push({
    ruleId: "network-state-consistency",
    ruleName: "Konzistentnost mrežnog stanja (CONNECTED => IN_SERVICE)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : networkStateViolations === 0
        ? "pass"
        : "warning",
    affectedRecordCount: networkStateViolations,
    affectedPercent:
      totalRecords > 0 ? (networkStateViolations / totalRecords) * 100 : 0,
    explanation:
      networkStateViolations === 0
        ? "Mrežno stanje je potpuno konzistentno."
        : `${networkStateViolations} zapisa ima CONNECTED status van aktivnog servisa.`,
    examples: networkExamples,
  });

  rules.push({
    ruleId: "location-not-mocked",
    ruleName: "Autentičnost lokacije (isMock === false)",
    status:
      totalRecords === 0
        ? "not_applicable"
        : mockLocationCount === 0
        ? "pass"
        : "warning",
    affectedRecordCount: mockLocationCount,
    affectedPercent:
      totalRecords > 0 ? (mockLocationCount / totalRecords) * 100 : 0,
    explanation:
      mockLocationCount === 0
        ? "Lokacije su stvarne (isMock = false u 100% zapisa)."
        : `${mockLocationCount} zapisa koristi lažiranu (mock) lokaciju.`,
    examples: [],
  });

  rules.push({
    ruleId: "telemetry-country-rs",
    ruleName: "Geografska teritorija (countryCode === 'RS')",
    status:
      totalRecords === 0
        ? "not_applicable"
        : nonRsCountryCount === 0
        ? "pass"
        : "warning",
    affectedRecordCount: nonRsCountryCount,
    affectedPercent:
      totalRecords > 0 ? (nonRsCountryCount / totalRecords) * 100 : 0,
    explanation:
      nonRsCountryCount === 0
        ? "Svi zapisi pripadaju teritoriji Srbije (RS)."
        : `${nonRsCountryCount} zapisa pripada stranoj teritoriji.`,
    examples: [],
  });

  const totalConsistencyViolations =
    windowOrderViolations +
    uploadBeforeEventViolations +
    networkStateViolations +
    mockLocationCount;
  const consistencyScore =
    totalRecords > 0
      ? Math.max(0, 100 - (totalConsistencyViolations / totalRecords) * 100)
      : 100;

  // -------------------------------------------------------------
  // 5. FRESHNESS (0 - 100)
  // -------------------------------------------------------------
  let freshnessScore = 80;
  const delays: number[] = [];
  for (const r of records) {
    const up = getNestedValue(r, "uploadTimestamp");
    const ev = getNestedValue(r, "time.timestamp") ?? getNestedValue(r, "time");
    if (typeof up === "number" && typeof ev === "number") {
      delays.push(up - ev);
    }
  }

  if (delays.length > 0) {
    delays.sort((a, b) => a - b);
    const medianDelaySec = (delays[Math.floor(delays.length / 2)] || 0) / 1000;
    if (medianDelaySec < 60) freshnessScore = 100;
    else if (medianDelaySec < 3600) freshnessScore = 90;
    else if (medianDelaySec < 86400) freshnessScore = 80;
    else freshnessScore = 65;
  }

  // -------------------------------------------------------------
  // 6. SCHEMA STABILITY (0 - 100)
  // -------------------------------------------------------------
  let schemaStabilityScore = 100;
  if (previousSnapshot && previousSnapshot.columnStats.length > 0) {
    const prevCols = new Map(previousSnapshot.columnStats.map((c) => [c.path, c]));
    let removedCount = 0;
    let typeChangedCount = 0;

    for (const [path, prevCol] of prevCols.entries()) {
      const currCol = snapshot.columnStats.find((c) => c.path === path);
      if (!currCol) {
        removedCount++;
      } else if (currCol.inferredType !== prevCol.inferredType) {
        typeChangedCount++;
      }
    }

    const penalty = removedCount * 15 + typeChangedCount * 20;
    schemaStabilityScore = Math.max(0, 100 - penalty);

    if (removedCount > 0 || typeChangedCount > 0) {
      warnings.push(
        `Šema ima nestabilnost: ${removedCount} kolona je uklonjeno, a ${typeChangedCount} promenilo tip.`
      );
    }
  }

  // -------------------------------------------------------------
  // WEIGHTED TOTAL SCORE
  // -------------------------------------------------------------
  const finalScore =
    completenessScore * weights.completeness +
    validityScore * weights.validity +
    uniquenessScore * weights.uniqueness +
    consistencyScore * weights.consistency +
    freshnessScore * weights.freshness +
    schemaStabilityScore * weights.schema_stability;

  const roundedScore = Math.round(finalScore * 10) / 10;

  let grade: QualityScoreBreakdown["grade"] = "dobro";
  if (roundedScore >= 90) grade = "odlicno";
  else if (roundedScore >= 75) grade = "dobro";
  else if (roundedScore >= 50) grade = "upozorenje";
  else grade = "kriticno";

  const dimensions: QualityDimensionScore[] = [
    {
      dimension: "completeness",
      score: Math.round(completenessScore * 10) / 10,
      weight: weights.completeness,
      explanation: "Popunjenost ključnih atributa i odsustvo neočekivanih praznih polja.",
    },
    {
      dimension: "validity",
      score: Math.round(validityScore * 10) / 10,
      weight: weights.validity,
      explanation: "Usklađenost tipova, validnost koordinata, brzina i vremenskih oznaka.",
    },
    {
      dimension: "uniqueness",
      score: Math.round(uniquenessScore * 10) / 10,
      weight: weights.uniqueness,
      explanation: "Odsustvo dupliciranih zapisa sa identičnim kanonskim sadržajem.",
    },
    {
      dimension: "consistency",
      score: Math.round(consistencyScore * 10) / 10,
      weight: weights.consistency,
      explanation: "Međusobna konzistentnost intervala prozora, mrežnih stanja i autentičnosti lokacije.",
    },
    {
      dimension: "freshness",
      score: Math.round(freshnessScore * 10) / 10,
      weight: weights.freshness,
      explanation: "Ažurnost podataka i kašnjenje između vremena događaja i obrade.",
    },
    {
      dimension: "schema_stability",
      score: Math.round(schemaStabilityScore * 10) / 10,
      weight: weights.schema_stability,
      explanation: previousSnapshot
        ? "Stabilnost šeme u odnosu na prethodnu verziju."
        : "Inicijalna verzija — nema penala za stabilnost šeme.",
    },
  ];

  return {
    scope,
    score: roundedScore,
    grade,
    dimensions,
    rules,
    generatedAt: new Date().toISOString(),
    warnings,
  };
}
