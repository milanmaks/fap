"use client";

import React, { useState, useMemo } from "react";
import { ColumnStatistics, InferredType } from "@/lib/domain/types";
import { formatNumber } from "@/lib/utils/format";
import { Badge } from "../ui/badge";
import {
  Search,
  MapPin,
  Radio,
  Clock,
  Gauge,
  Smartphone,
  Terminal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  ListTree,
  Box,
  Shuffle,
  CircleDashed,
} from "lucide-react";

interface ColumnStatsTableProps {
  stats: ColumnStatistics[];
  totalRecords: number;
}

type CategoryKey = "all" | "location" | "mobile" | "time" | "sensor" | "device" | "system" | "other";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "all", label: "Sva polja", icon: <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" /> },
  { key: "location", label: "Lokacija i GPS", icon: <MapPin className="w-3.5 h-3.5 text-emerald-500" /> },
  { key: "mobile", label: "Mreža i SIM", icon: <Radio className="w-3.5 h-3.5 text-sky-500" /> },
  { key: "time", label: "Vreme i prozori", icon: <Clock className="w-3.5 h-3.5 text-amber-500" /> },
  { key: "sensor", label: "Senzori", icon: <Gauge className="w-3.5 h-3.5 text-purple-500" /> },
  { key: "device", label: "Uređaj i sistem", icon: <Smartphone className="w-3.5 h-3.5 text-slate-400" /> },
  { key: "system", label: "FAP Metapodaci", icon: <Terminal className="w-3.5 h-3.5 text-rose-500" /> },
];

function detectCategory(path: string): CategoryKey {
  const p = path.toLowerCase();
  if (
    p.startsWith("locationsnapshot") ||
    p.includes("lat") ||
    p.includes("lng") ||
    p.includes("altitude") ||
    p.includes("accuracy") ||
    p.includes("speed") ||
    p.includes("h3index") ||
    p.includes("ismock") ||
    p.includes("gnss")
  ) {
    return "location";
  }
  if (
    p.startsWith("mobilesnapshot") ||
    p.includes("connectivitytype") ||
    p.includes("carrier") ||
    p.includes("mcc") ||
    p.includes("mnc") ||
    p.includes("simstate") ||
    p.includes("roaming") ||
    p.includes("networktype") ||
    p.includes("datastate") ||
    p.includes("cells") ||
    p.includes("ismetered") ||
    p.includes("subscriptionid")
  ) {
    return "mobile";
  }
  if (
    p.includes("timestamp") ||
    p.startsWith("time.") ||
    p.includes("observedwindow") ||
    p.includes("offsetminutes") ||
    p.includes("agemillis")
  ) {
    return "time";
  }
  if (p.startsWith("sensorsnapshot") || p.includes("lux") || p.includes("pressure")) {
    return "sensor";
  }
  if (
    p.includes("instanceid") ||
    p.includes("apppackagename") ||
    p.includes("modelversion") ||
    p.includes("sdkversion") ||
    p.includes("isscreeninteractive") ||
    p.includes("panelid") ||
    p.includes("standbybucket") ||
    p.includes("grantedpermissions")
  ) {
    return "device";
  }
  if (p.startsWith("_fap_") || p.startsWith("upload") || p === "type") {
    return "system";
  }
  return "other";
}

const FRIENDLY_NAMES: Record<string, { label: string; desc?: string }> = {
  "cells": { label: "Pristupne ćelije mreže", desc: "Lista baznih stanica u dometu" },
  "connectivityType": { label: "Tip veze", desc: "WIFI ili MOBILE prenos podataka" },
  "locationSnapshot.accuracy": { label: "Preciznost GPS pozicije", desc: "Radijus greške u metrima" },
  "locationSnapshot.ageMillis": { label: "Starost GPS očitavanja", desc: "Milisekunde od merenja" },
  "locationSnapshot.altitude": { label: "Nadmorska visina", desc: "Visina u metrima iznad mora" },
  "locationSnapshot.countryCode": { label: "Kod države (GPS)", desc: "Dvoslovni ISO kod države" },
  "locationSnapshot.gnssAgeMillis": { label: "Starost GNSS signala", desc: "Kašnjenje satelitskog signala" },
  "locationSnapshot.gnssAverageCn0DbHz": { label: "Jačina GNSS signala", desc: "Prosečan odnos signal-šum C/N0 (dB-Hz)" },
  "locationSnapshot.gnssSatelliteCount": { label: "Vidljivih satelita", desc: "Broj detektovanih GNSS satelita" },
  "locationSnapshot.gnssUsedInFixCount": { label: "Iskorišćenih satelita", desc: "Sateliti upotrebljeni za fiksaciju" },
  "locationSnapshot.h3Index": { label: "H3 Prostorni indeks", desc: "Heksagonalni Uber H3 prostorni identifikator" },
  "locationSnapshot.isMock": { label: "Lažirana lokacija", desc: "Simulirana/mock lokacija sa uređaja" },
  "locationSnapshot.lat": { label: "Geografska širina (Latitude)", desc: "Severna/južna koordinata" },
  "locationSnapshot.lng": { label: "Geografska dužina (Longitude)", desc: "Istočna/zapadna koordinata" },
  "locationSnapshot.provider": { label: "Izvor lokacije", desc: "GPS, Fused provajder ili Mreža" },
  "locationSnapshot.speed": { label: "Brzina kretanja", desc: "Trenutna brzina uređaja (m/s)" },
  "locationSnapshot.time.offsetMinutes": { label: "Vremenska zona", desc: "Pomak u minutima od UTC vremena" },
  "locationSnapshot.time.timestamp": { label: "Vreme GPS očitavanja", desc: "Vreme zabeleženo GPS senzorom" },
  "locationSnapshot.time.trusted": { label: "Pouzdanost sata", desc: "Status sinhronizacije vremena" },
  "mobileSnapshot.ageMillis": { label: "Starost stanja mreže", desc: "Milisekunde od očitavanja stanja" },
  "mobileSnapshot.dataConnectionSim.bandwidths": { label: "Frekventni opsezi", desc: "Širina kanala operatera" },
  "mobileSnapshot.dataConnectionSim.carrier": { label: "Mobilni operater", desc: "Naziv aktivne mreže" },
  "mobileSnapshot.dataConnectionSim.country": { label: "Država SIM kartice", desc: "ISO kod države SIM kartice" },
  "mobileSnapshot.dataConnectionSim.dataRoamingEnabled": { label: "Roming dozvoljen", desc: "Korisničko podešavanje rominga" },
  "mobileSnapshot.dataConnectionSim.dataState": { label: "Status prenosa podataka", desc: "Povezanost na mobilni internet" },
  "mobileSnapshot.dataConnectionSim.duplexMode": { label: "Dupleks režim", desc: "FDD ili TDD prenos" },
  "mobileSnapshot.dataConnectionSim.eSIM": { label: "eSIM profil", desc: "Da li je kartica virtuelni eSIM" },
  "mobileSnapshot.dataConnectionSim.isMobileDataOn": { label: "Mobilni podaci uključeni", desc: "Glavni prekidač mobilnih podataka" },
  "mobileSnapshot.dataConnectionSim.isPrimaryData": { label: "Primarni SIM za podatke", desc: "Aktivna kartica za internet saobraćaj" },
  "mobileSnapshot.dataConnectionSim.mcc": { label: "Mobilni kod države (MCC)", desc: "220 za Republiku Srbiju" },
  "mobileSnapshot.dataConnectionSim.mnc": { label: "Mobilni kod mreže (MNC)", desc: "Mrežni identifikator operatera" },
  "mobileSnapshot.dataConnectionSim.networkType": { label: "Tehnologija mreže", desc: "LTE, 5G NSA, GSM..." },
  "mobileSnapshot.dataConnectionSim.registeredCells": { label: "Registrovane ćelije", desc: "Bazne stanice na kojima je registrovan" },
  "mobileSnapshot.dataConnectionSim.roaming": { label: "Status u romingu", desc: "Da li je uređaj u roming režimu" },
  "mobileSnapshot.dataConnectionSim.serviceState": { label: "Dostupnost servisa", desc: "IN_SERVICE / NO_SERVICE" },
  "mobileSnapshot.dataConnectionSim.simState": { label: "Stanje SIM kartice", desc: "Status spremnosti kartice" },
  "mobileSnapshot.dataConnectionSim.slotIndex": { label: "SIM slot", desc: "Indeks hardverskog slota" },
  "mobileSnapshot.dataConnectionSim.subscriptionId": { label: "ID pretplate", desc: "Interni identifikator Android pretplate" },
  "mobileSnapshot.dataSubscriptionId": { label: "Aktivna data pretplata", desc: "Pretplata koja troši mobilne podatke" },
  "mobileSnapshot.isMetered": { label: "Tarifirana mreža", desc: "Mreža sa limitiranim saobraćajem" },
  "mobileSnapshot.nonTerrestrialActive": { label: "Satelitska veza aktivna", desc: "Ne-zemaljska mobilna veza" },
  "mobileSnapshot.otherSimCards": { label: "Dodatne SIM kartice", desc: "Sekundarni slotovi na telefonu" },
  "observedWindowStartTimestampMs": { label: "Početak prozora posmatranja", desc: "Početni trenutak intervala analize" },
  "observedWindowEndTimestampMs": { label: "Kraj prozora posmatranja", desc: "Krajnji trenutak intervala analize" },
  "sensorSnapshot.lux": { label: "Svetlosni senzor (Lux)", desc: "Osvetljenost okruženja" },
  "sensorSnapshot.pressureAltitudeMeters": { label: "Barometarska visina", desc: "Visina na bazi pritiska vazduha" },
  "sensorSnapshot.pressureMillibars": { label: "Atmosferski pritisak", desc: "Pritisak vazduha u mbar" },
  "appPackageName": { label: "Aplikacija", desc: "Identifikator paketa aplikacije" },
  "grantedPermissions": { label: "Dozvole aplikacije", desc: "Dodeljene sistemske dozvole" },
  "instanceId": { label: "Identifikator uređaja (UUID)", desc: "Anonimizovani jedinstveni ID uređaja" },
  "isScreenInteractive": { label: "Ekran aktivan", desc: "Status interaktivnosti ekrana" },
  "modelVersion": { label: "Verzija modela", desc: "Verzija ML modela" },
  "panelId": { label: "Istraživački panel", desc: "Identifikator panela" },
  "sdkVersion": { label: "SDK verzija", desc: "Verzija telemetrijskog SDK klijenta" },
  "standbyBucket": { label: "Režim baterije", desc: "Android Doze stanje optimizacije" },
  "time.offsetMinutes": { label: "Vremenska zona", desc: "Pomak u minutima od UTC" },
  "time.timestamp": { label: "Vreme merenja", desc: "Glavna vremenska oznaka zapisa" },
  "time.trusted": { label: "Pouzdanost sata", desc: "Sinhronizacija sa pouzdanim serverom" },
  "type": { label: "Tip telemetrije", desc: "Kategorija zapisa (npr. CELL_INFO)" },
  "uploadCountry": { label: "Zemlja uploada", desc: "ISO kod lokacije prijema" },
  "uploadTimestamp": { label: "Vreme prijema na server", desc: "Timestamp server obrade" },
  "_fap_source_file_id": { label: "ID izvornog fajla", desc: "Interni lineage identifikator" },
  "_fap_source_file_name": { label: "Izvorni fajl", desc: "Putanja datoteke u importu" },
};

function getFieldDisplay(path: string): { title: string; subtitle: string; desc?: string } {
  if (FRIENDLY_NAMES[path]) {
    return {
      title: FRIENDLY_NAMES[path].label,
      subtitle: path,
      desc: FRIENDLY_NAMES[path].desc,
    };
  }

  const parts = path.split(".");
  const leaf = parts[parts.length - 1];
  const title = leaf
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return {
    title,
    subtitle: path,
  };
}

function formatSmartValue(val: unknown, path: string): string {
  if (val === null || val === undefined) return "-";

  const num = typeof val === "number" ? val : parseFloat(String(val));
  const isNumeric = !isNaN(num);

  const isTimestamp =
    isNumeric &&
    (path.toLowerCase().includes("timestamp") || path.toLowerCase().includes("time.timestamp")) &&
    num > 1262304000000 &&
    num < 2208988800000;

  if (isTimestamp) {
    try {
      const d = new Date(num);
      return d.toLocaleString("sr-RS", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return String(val);
    }
  }

  if (isNumeric && (path.endsWith(".lat") || path.endsWith(".lng"))) {
    return `${num.toFixed(5)}°`;
  }

  if (isNumeric && path.endsWith(".speed")) {
    const kmh = (num * 3.6).toFixed(1);
    return `${num.toFixed(1)} m/s (${kmh} km/h)`;
  }

  if (isNumeric && path.endsWith(".accuracy")) {
    return `±${num.toFixed(1)} m`;
  }

  if (isNumeric && path.endsWith(".altitude")) {
    return `${num.toFixed(1)} m`;
  }

  if (isNumeric && path.endsWith(".lux")) {
    return `${Math.round(num)} lux`;
  }

  const str = String(val);
  if (typeof val === "string" && str.length > 24) {
    return `${str.slice(0, 10)}…${str.slice(-6)}`;
  }

  if (isNumeric && !Number.isInteger(num)) {
    return num.toLocaleString("sr-RS", { maximumFractionDigits: 2 });
  }

  return formatNumber(num);
}

export const ColumnStatsTable: React.FC<ColumnStatsTableProps> = ({ stats, totalRecords }) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [nullFilter, setNullFilter] = useState<"all" | "complete" | "partial" | "empty">("all");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const filteredStats = useMemo(() => {
    return stats.filter((col) => {
      const category = detectCategory(col.path);
      const friendly = getFieldDisplay(col.path);
      const nullRatio = totalRecords > 0 ? col.nullCount / totalRecords : 0;

      if (selectedCategory !== "all" && category !== selectedCategory) {
        return false;
      }

      if (nullFilter === "complete" && nullRatio > 0.001) return false;
      if (nullFilter === "partial" && (nullRatio <= 0.001 || nullRatio >= 0.999)) return false;
      if (nullFilter === "empty" && nullRatio < 0.999) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesPath = col.path.toLowerCase().includes(q);
        const matchesTitle = friendly.title.toLowerCase().includes(q);
        const matchesDesc = friendly.desc?.toLowerCase().includes(q) || false;
        const matchesType = col.inferredType.toLowerCase().includes(q);
        return matchesPath || matchesTitle || matchesDesc || matchesType;
      }

      return true;
    });
  }, [stats, selectedCategory, nullFilter, search, totalRecords]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      all: stats.length,
      location: 0,
      mobile: 0,
      time: 0,
      sensor: 0,
      device: 0,
      system: 0,
      other: 0,
    };
    stats.forEach((s) => {
      const cat = detectCategory(s.path);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [stats]);

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedField(path);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const getTypeBadge = (type: InferredType) => {
    switch (type) {
      case "string":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            <Type className="w-3 h-3 text-slate-400" />
            string
          </span>
        );
      case "number":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
            <Hash className="w-3 h-3 text-sky-500" />
            number
          </span>
        );
      case "boolean":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <ToggleLeft className="w-3 h-3 text-amber-500" />
            boolean
          </span>
        );
      case "date":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <Calendar className="w-3 h-3 text-emerald-500" />
            date
          </span>
        );
      case "array":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            <ListTree className="w-3 h-3 text-indigo-500" />
            array
          </span>
        );
      case "object":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <Box className="w-3 h-3 text-zinc-400" />
            object
          </span>
        );
      case "mixed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <Shuffle className="w-3 h-3 text-rose-500" />
            mixed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
            <CircleDashed className="w-3 h-3 text-slate-400" />
            null
          </span>
        );
    }
  };

  const groupsToDisplay = useMemo(() => {
    if (viewMode === "table") {
      return [{ key: "all" as CategoryKey, title: "Sve kolone", icon: <TableIcon className="w-3.5 h-3.5 text-zinc-400" />, items: filteredStats }];
    }

    const groups: { key: CategoryKey; title: string; icon: React.ReactNode; items: ColumnStatistics[] }[] = [];
    const catMap = new Map<CategoryKey, ColumnStatistics[]>();

    filteredStats.forEach((col) => {
      const cat = detectCategory(col.path);
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(col);
    });

    CATEGORIES.filter((c) => c.key !== "all").forEach((cat) => {
      const items = catMap.get(cat.key);
      if (items && items.length > 0) {
        groups.push({
          key: cat.key,
          title: cat.label,
          icon: cat.icon,
          items,
        });
      }
    });

    return groups;
  }, [viewMode, filteredStats]);

  if (stats.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
        Nema dostupnih statistika kolona za ovu verziju.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kontrolni panel: Pretraga, filteri i prikaz */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
        {/* Pretraga */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Pretraži kolone po nazivu, putanji ili tipu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter po popunjenosti */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setNullFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "all"
                ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            Sve ({stats.length})
          </button>
          <button
            onClick={() => setNullFilter("complete")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "complete"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60"
            }`}
          >
            100% Popunjeno
          </button>
          <button
            onClick={() => setNullFilter("empty")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "empty"
                ? "bg-slate-700 dark:bg-zinc-600 text-white"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
            title="Polja sa 100% nedostajućim podacima (npr. nepostojeći senzori)"
          >
            Nije prisutno (0%)
          </button>
        </div>

        {/* Režim prikaza */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === "grouped"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kategorije</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              viewMode === "table"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabela</span>
          </button>
        </div>
      </div>

      {/* Kategorije (Filter pills) */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5">
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.key] || 0;
          if (cat.key !== "all" && count === 0) return null;
          const isActive = selectedCategory === cat.key;

          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? "bg-indigo-700/60 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rezultati tabele */}
      {filteredStats.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-10 text-center border border-slate-200 dark:border-zinc-800">
          <HelpCircle className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
            Nema polja koja odgovaraju unetom kriterijumu.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
              setNullFilter("all");
            }}
            className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Resetuj sve filtere
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupsToDisplay.map((group) => (
            <div
              key={group.key}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden"
            >
              {viewMode === "grouped" && (
                <div className="bg-slate-50/80 dark:bg-zinc-800/50 px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>{group.icon}</span>
                    <h3 className="font-semibold text-slate-800 dark:text-zinc-200 text-xs tracking-wide">
                      {group.title}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {group.items.length} {group.items.length === 1 ? "polje" : "polja"}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
                  <thead className="bg-slate-50/60 dark:bg-zinc-800/30 text-slate-700 dark:text-zinc-300 font-semibold border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 min-w-[240px]">Polje / Metapodatak</th>
                      <th className="px-3 py-3 w-[110px]">Tip</th>
                      <th className="px-4 py-3 w-[160px]">Popunjenost</th>
                      <th className="px-3 py-3 w-[120px]">Jedinstvenih</th>
                      <th className="px-4 py-3 min-w-[180px]">Raspon i prosek</th>
                      <th className="px-4 py-3 min-w-[220px]">Najčešći primeri</th>
                      <th className="px-2 py-3 w-[36px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {group.items.map((col) => {
                      const nullRatio = totalRecords > 0 ? col.nullCount / totalRecords : 0;
                      const isComplete = nullRatio < 0.001;
                      const isEmpty = nullRatio > 0.999;
                      const friendly = getFieldDisplay(col.path);
                      const isExpanded = expandedField === col.path;
                      const isTimestamp =
                        (col.path.toLowerCase().includes("timestamp") ||
                          col.path.toLowerCase().includes("time.timestamp")) &&
                        typeof col.average === "number" &&
                        col.average > 1262304000000;

                      return (
                        <React.Fragment key={col.path}>
                          <tr
                            onClick={() => setExpandedField(isExpanded ? null : col.path)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                                : "hover:bg-slate-50/70 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                                  {friendly.title}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[240px]">
                                    {col.path}
                                  </span>
                                  <button
                                    onClick={(e) => handleCopyPath(col.path, e)}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-0.5 transition"
                                    title="Kopiraj putanju"
                                  >
                                    {copiedField === col.path ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                {friendly.desc && (
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                    {friendly.desc}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-3 align-middle">{getTypeBadge(col.inferredType)}</td>

                            <td className="px-4 py-3 align-middle">
                              {isComplete ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  100%
                                </span>
                              ) : isEmpty ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                  0% (prazno)
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                                      {((1 - nullRatio) * 100).toFixed(1)}%
                                    </span>
                                    <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                                      {(nullRatio * 100).toFixed(1)}% null
                                    </span>
                                  </div>
                                  <div className="w-24 bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        nullRatio > 0.4 ? "bg-amber-500" : "bg-sky-500"
                                      }`}
                                      style={{ width: `${Math.max((1 - nullRatio) * 100, 4)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 align-middle">
                              <span className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">
                                ~{formatNumber(col.distinctEstimate)}
                              </span>
                              {col.distinctEstimate === 1 && (
                                <span className="block text-[10px] text-slate-400 dark:text-zinc-500">
                                  fiksna vrednost
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 align-middle text-slate-700 dark:text-zinc-300 font-mono">
                              {isEmpty ? (
                                <span className="text-slate-400 dark:text-zinc-600">-</span>
                              ) : isTimestamp ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-[11px] text-indigo-600 dark:text-indigo-400">
                                    {formatSmartValue(col.average, col.path)}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                                    {formatSmartValue(col.min, col.path)} … {formatSmartValue(col.max, col.path)}
                                  </div>
                                </div>
                              ) : col.inferredType === "number" && col.average !== undefined ? (
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-slate-400 dark:text-zinc-500 text-[10px] font-sans">
                                      Avg:
                                    </span>{" "}
                                    <span className="font-semibold text-slate-900 dark:text-zinc-100">
                                      {formatSmartValue(col.average, col.path)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                                    [{formatSmartValue(col.min, col.path)} … {formatSmartValue(col.max, col.path)}]
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600 text-[11px] font-sans">
                                  -
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 align-middle">
                              {col.topValues && col.topValues.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-md">
                                  {col.topValues.slice(0, 3).map((tv, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-[11px] text-slate-800 dark:text-zinc-200 transition font-mono"
                                      title={`${tv.value} (${tv.count} pojava)`}
                                    >
                                      <span className="truncate max-w-[130px] font-medium">
                                        {formatSmartValue(tv.value, col.path)}
                                      </span>
                                      <span className="ml-1 text-slate-400 dark:text-zinc-500 text-[10px] font-sans">
                                        ({tv.count})
                                      </span>
                                    </span>
                                  ))}
                                  {col.topValues.length > 3 && (
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 self-center">
                                      +{col.topValues.length - 3} više
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-zinc-600">-</span>
                              )}
                            </td>

                            <td className="px-2 py-3 align-middle text-right text-slate-400 dark:text-zinc-500">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-indigo-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </td>
                          </tr>

                          {/* Detaljni expanded panel */}
                          {isExpanded && (
                            <tr className="bg-indigo-50/20 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
                              <td colSpan={7} className="p-4">
                                <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900/40 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                                    <div>
                                      <h4 className="font-semibold text-slate-900 dark:text-zinc-100 text-xs">
                                        Distribucija uzoraka: {friendly.title}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                                        {col.path}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => handleCopyPath(col.path, e)}
                                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Kopiraj dot-path</span>
                                    </button>
                                  </div>

                                  {col.topValues && col.topValues.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {col.topValues.map((tv, idx) => {
                                        const pct =
                                          totalRecords > 0
                                            ? ((tv.count / totalRecords) * 100).toFixed(1)
                                            : "0";
                                        return (
                                          <div
                                            key={idx}
                                            className="bg-slate-50 dark:bg-zinc-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-700/80 flex flex-col justify-between"
                                          >
                                            <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-800 dark:text-zinc-200 truncate">
                                              <span className="truncate" title={String(tv.value)}>
                                                {formatSmartValue(tv.value, col.path)}
                                              </span>
                                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 ml-1 font-sans">
                                                {pct}%
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 font-sans">
                                              <span>{tv.count} zapisa</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400 dark:text-zinc-500">
                                      Nema evidentiranih uzoraka vrednosti.
                                    </div>
                                  )}

                                  {isEmpty && (
                                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md p-2.5 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold">Nema podataka (0%):</span> Ovaj senzor
                                        nije podržan ili aktiviran na hardveru mobilnog uređaja (npr. barometar ili eSIM profil).
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
