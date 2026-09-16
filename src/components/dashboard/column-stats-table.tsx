"use client";

import React, { useState, useMemo } from "react";
import { ColumnStatistics, InferredType } from "@/lib/domain/types";
import { formatNumber } from "@/lib/utils/format";
import { Badge } from "../ui/badge";
import {
  Search,
  MapPin,
  Wifi,
  Clock,
  Activity,
  Smartphone,
  Cpu,
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
} from "lucide-react";

interface ColumnStatsTableProps {
  stats: ColumnStatistics[];
  totalRecords: number;
}

// Mapiranje kategorija polja
type CategoryKey = "all" | "location" | "mobile" | "time" | "sensor" | "device" | "system" | "other";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "all", label: "Sva polja", icon: <SlidersHorizontal className="w-3.5 h-3.5" />, color: "indigo" },
  { key: "location", label: "📍 Lokacija i GPS", icon: <MapPin className="w-3.5 h-3.5 text-emerald-600" />, color: "emerald" },
  { key: "mobile", label: "📶 Mobilna mreža i SIM", icon: <Wifi className="w-3.5 h-3.5 text-sky-600" />, color: "sky" },
  { key: "time", label: "⏱️ Vreme i prozori", icon: <Clock className="w-3.5 h-3.5 text-amber-600" />, color: "amber" },
  { key: "sensor", label: "💡 Senzori i okruženje", icon: <Activity className="w-3.5 h-3.5 text-purple-600" />, color: "purple" },
  { key: "device", label: "📱 Uređaj i sistem", icon: <Smartphone className="w-3.5 h-3.5 text-slate-600" />, color: "slate" },
  { key: "system", label: "⚙️ FAP Metapodaci", icon: <Cpu className="w-3.5 h-3.5 text-rose-600" />, color: "rose" },
];

// Određivanje kategorije na osnovu dot-path-a
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

// Prijateljski nazivi za poznate telemetrijske kolone
const FRIENDLY_NAMES: Record<string, { label: string; desc?: string }> = {
  "cells": { label: "Pristupne ćelije mreže", desc: "Lista baznih stanica u dometu" },
  "connectivityType": { label: "Tip internet veze", desc: "WIFI ili MOBILE" },
  "locationSnapshot.accuracy": { label: "Preciznost GPS lokacije", desc: "Radijus greške u metrima" },
  "locationSnapshot.ageMillis": { label: "Starost GPS očitavanja", desc: "Milisekunde od merenja" },
  "locationSnapshot.altitude": { label: "Nadmorska visina", desc: "Visina u metrima" },
  "locationSnapshot.countryCode": { label: "Kod države (GPS)", desc: "Dvoslovni ISO kod" },
  "locationSnapshot.gnssAgeMillis": { label: "Starost GNSS signala", desc: "Kašnjenje satelitskog signala" },
  "locationSnapshot.gnssAverageCn0DbHz": { label: "Jačina satelitskog signala", desc: "Prosečan C/N0 odnos signal-šum u dB-Hz" },
  "locationSnapshot.gnssSatelliteCount": { label: "Vidljivih satelita", desc: "Broj detektovanih satelita na nebu" },
  "locationSnapshot.gnssUsedInFixCount": { label: "Iskorišćenih satelita", desc: "Broj satelita upotrebljenih za određivanje koordinata" },
  "locationSnapshot.h3Index": { label: "H3 Prostorni indeks", desc: "Geografska heksagonalna ćelija (Uber H3)" },
  "locationSnapshot.isMock": { label: "Lažirana lokacija (Mock)", desc: "Da li je lokacija simulirana na telefonu" },
  "locationSnapshot.lat": { label: "Geografska širina (Latitude)", desc: "Severna/južna koordinata" },
  "locationSnapshot.lng": { label: "Geografska dužina (Longitude)", desc: "Istočna/zapadna koordinata" },
  "locationSnapshot.provider": { label: "Izvor lokacije", desc: "GPS, Fused provajder ili Mreža" },
  "locationSnapshot.speed": { label: "Brzina kretanja", desc: "Trenutna brzina uređaja (m/s)" },
  "locationSnapshot.time.offsetMinutes": { label: "Vremenska zona (minuti)", desc: "Pomak u odnosu na UTC (npr. 120 = UTC+2)" },
  "locationSnapshot.time.timestamp": { label: "Vreme GPS očitavanja", desc: "Tačno vreme lokacije" },
  "locationSnapshot.time.trusted": { label: "Pouzdanost vremena", desc: "Sinhronizovano sa pouzdanim satom" },
  "mobileSnapshot.ageMillis": { label: "Starost stanja mreže", desc: "Kašnjenje očitavanja mreže" },
  "mobileSnapshot.dataConnectionSim.bandwidths": { label: "Frekventni opsezi", desc: "Širina kanala bazne stanice" },
  "mobileSnapshot.dataConnectionSim.carrier": { label: "Mobilni operater", desc: "Naziv mreže (npr. Yettel, A1, mts)" },
  "mobileSnapshot.dataConnectionSim.country": { label: "Država operatera", desc: "ISO kod države SIM kartice" },
  "mobileSnapshot.dataConnectionSim.dataRoamingEnabled": { label: "Roming dozvoljen", desc: "Korisničko podešavanje rominga" },
  "mobileSnapshot.dataConnectionSim.dataState": { label: "Status prenosa podataka", desc: "Povezanost sa mobilnim internetom" },
  "mobileSnapshot.dataConnectionSim.duplexMode": { label: "Dupleks režim", desc: "FDD ili TDD prenos" },
  "mobileSnapshot.dataConnectionSim.eSIM": { label: "eSIM profil", desc: "Da li je kartica virtuelni eSIM" },
  "mobileSnapshot.dataConnectionSim.isMobileDataOn": { label: "Mobilni podaci uključeni", desc: "Glavni prekidač za mobilni internet" },
  "mobileSnapshot.dataConnectionSim.isPrimaryData": { label: "Primarna SIM za podatke", desc: "Aktivna kartica za internet saobraćaj" },
  "mobileSnapshot.dataConnectionSim.mcc": { label: "Mobilni kod države (MCC)", desc: "220 za Srbiju" },
  "mobileSnapshot.dataConnectionSim.mnc": { label: "Mobilni kod mreže (MNC)", desc: "01 Yettel, 03 Telekom, 05 A1" },
  "mobileSnapshot.dataConnectionSim.networkType": { label: "Tehnologija mreže", desc: "LTE, 5G NSA, GSM..." },
  "mobileSnapshot.dataConnectionSim.registeredCells": { label: "Registrovane ćelije", desc: "Aktivna bazna stanica" },
  "mobileSnapshot.dataConnectionSim.roaming": { label: "Status u romingu", desc: "Da li je uređaj trenutno u romingu" },
  "mobileSnapshot.dataConnectionSim.serviceState": { label: "Dostupnost usluge", desc: "IN_SERVICE / NO_SERVICE" },
  "mobileSnapshot.dataConnectionSim.simState": { label: "Status SIM kartice", desc: "Spremna za rad (IN_SERVICE)" },
  "mobileSnapshot.dataConnectionSim.slotIndex": { label: "SIM slot", desc: "Slot 0 ili Slot 1" },
  "mobileSnapshot.dataConnectionSim.subscriptionId": { label: "ID pretplate", desc: "Interni Android identifikator pretplate" },
  "mobileSnapshot.dataSubscriptionId": { label: "Aktivna data pretplata", desc: "ID pretplate koja troši mobilne podatke" },
  "mobileSnapshot.isMetered": { label: "Tarifira se saobraćaj", desc: "Mreža sa ograničenim megabajtima" },
  "mobileSnapshot.nonTerrestrialActive": { label: "Satelitska veza aktivna", desc: "Ne-zemaljska mobilna komunikacija" },
  "mobileSnapshot.otherSimCards": { label: "Dodatne SIM kartice", desc: "Sekundarni slotovi" },
  "observedWindowStartTimestampMs": { label: "Početak posmatranog prozora", desc: "Vremenski interval merenja" },
  "observedWindowEndTimestampMs": { label: "Kraj posmatranog prozora", desc: "Vremenski interval merenja" },
  "sensorSnapshot.lux": { label: "Svetlosni senzor (Lux)", desc: "Osvetljenost okoline u luksima" },
  "sensorSnapshot.pressureAltitudeMeters": { label: "Barometarska visina", desc: "Visina na osnovu pritiska vazduha" },
  "sensorSnapshot.pressureMillibars": { label: "Atmosferski pritisak", desc: "Pritisak vazduha u milibarima" },
  "appPackageName": { label: "Aplikacija", desc: "Identifikator aplikacije na uređaju" },
  "grantedPermissions": { label: "Dodeljene dozvole", desc: "Android dozvole (lokacija, telefon...)" },
  "instanceId": { label: "Identifikator uređaja (UUID)", desc: "Jedinstveni anonimizovani ID telefona" },
  "isScreenInteractive": { label: "Ekran uređaja uključen", desc: "Da li je korisnik gledao u telefon" },
  "modelVersion": { label: "Verzija modela", desc: "Verzija ML modela za obradu" },
  "panelId": { label: "Panel / Korisnička grupa", desc: "Istraživački panel" },
  "sdkVersion": { label: "Verzija SDK-a", desc: "Verzija klijentskog koda" },
  "standbyBucket": { label: "Režim štednje baterije", desc: "Android Doze stanje (ACTIVE, RARE...)" },
  "time.offsetMinutes": { label: "Vremenska zona", desc: "Pomak u minutima od UTC" },
  "time.timestamp": { label: "Vremenska oznaka merenja", desc: "Vreme kada je kreiran zapis" },
  "time.trusted": { label: "Pouzdanost sistemskog sata", desc: "Nivo poverenja u sat uređaja" },
  "type": { label: "Tip telemetrijskog zapisa", desc: "Vrsta merenja (CELL_INFO, SPEED_TEST...)" },
  "uploadCountry": { label: "Zemlja uploada", desc: "ISO kod zemlje slanja" },
  "uploadTimestamp": { label: "Vreme prijema na server", desc: "Vreme obrade fajla" },
  "_fap_source_file_id": { label: "ID izvornog fajla", desc: "Interni identifikator fajla" },
  "_fap_source_file_name": { label: "Naziv izvornog fajla", desc: "Putanja unutar ZIP arhive ili naziv fajla" },
};

// Prijateljski prikaz imena
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
  // Pretvaranje camelCase u razmaknuti tekst
  const title = leaf
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return {
    title,
    subtitle: path,
  };
}

// Pametno formatiranje vrednosti
function formatSmartValue(val: unknown, path: string): string {
  if (val === null || val === undefined) return "-";

  const num = typeof val === "number" ? val : parseFloat(String(val));
  const isNumeric = !isNaN(num);

  // Da li je timestamp u milisekundama (između 2010. i 2040. godine)
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

  // Da li je GPS koordinata
  if (isNumeric && (path.endsWith(".lat") || path.endsWith(".lng"))) {
    return `${num.toFixed(5)}°`;
  }

  // Da li je brzina
  if (isNumeric && path.endsWith(".speed")) {
    const kmh = (num * 3.6).toFixed(1);
    return `${num.toFixed(1)} m/s (~${kmh} km/h)`;
  }

  // Da li je tačnost
  if (isNumeric && path.endsWith(".accuracy")) {
    return `±${num.toFixed(1)} m`;
  }

  // Da li je nadmorska visina
  if (isNumeric && path.endsWith(".altitude")) {
    return `${num.toFixed(1)} m`;
  }

  // Da li je osvetljenje
  if (isNumeric && path.endsWith(".lux")) {
    return `${Math.round(num)} lux`;
  }

  // Skraćivanje dugačkih ID-jeva (npr. UUID ili H3)
  const str = String(val);
  if (typeof val === "string" && str.length > 24) {
    return `${str.slice(0, 10)}…${str.slice(-6)}`;
  }

  // Zaokruživanje decimala
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

  // Filtrirane i grupisane kolone
  const filteredStats = useMemo(() => {
    return stats.filter((col) => {
      const category = detectCategory(col.path);
      const friendly = getFieldDisplay(col.path);
      const nullRatio = totalRecords > 0 ? col.nullCount / totalRecords : 0;

      // Filter po kategoriji
      if (selectedCategory !== "all" && category !== selectedCategory) {
        return false;
      }

      // Filter po popunjenosti
      if (nullFilter === "complete" && nullRatio > 0.001) return false;
      if (nullFilter === "partial" && (nullRatio <= 0.001 || nullRatio >= 0.999)) return false;
      if (nullFilter === "empty" && nullRatio < 0.999) return false;

      // Filter po pretrazi
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

  // Statistika po kategorijama za brojače
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

  // Kopiranje putanje
  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedField(path);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const getTypeBadge = (type: InferredType) => {
    switch (type) {
      case "string":
        return <Badge variant="neutral">🔤 Tekst</Badge>;
      case "number":
        return <Badge variant="info">🔢 Broj</Badge>;
      case "boolean":
        return <Badge variant="warning">🔘 Da/Ne</Badge>;
      case "date":
        return <Badge variant="success">⏱️ Datum</Badge>;
      case "array":
        return <Badge variant="default">📑 Lista</Badge>;
      case "object":
        return <Badge variant="default">📦 Objekat</Badge>;
      case "mixed":
        return <Badge variant="danger">⚠️ Mešano</Badge>;
      default:
        return <Badge variant="neutral">⚪ Prazno</Badge>;
    }
  };

  // Grupe za prikaz
  const groupsToDisplay = useMemo(() => {
    if (viewMode === "table") {
      return [{ key: "all" as CategoryKey, title: "Sve kolone", items: filteredStats }];
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
      <div className="p-12 text-center text-slate-400 text-sm">
        Nema dostupnih statistika kolona za ovu verziju.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 bg-slate-50/50 rounded-xl border border-slate-200/80">
      {/* 1. Gornji kontrolni panel: Pretraga i filteri */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        {/* Pretraga */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži polja (npr. lat, operater, speed, baterija, greška)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter po statusu popunjenosti */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[11px] font-medium hidden lg:inline">Status:</span>
          <button
            onClick={() => setNullFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "all"
                ? "bg-slate-800 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sve ({stats.length})
          </button>
          <button
            onClick={() => setNullFilter("complete")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "complete"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            100% Popunjeno
          </button>
          <button
            onClick={() => setNullFilter("empty")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              nullFilter === "empty"
                ? "bg-slate-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            title="Polja koja hardver uređaja ne beleži (npr. eSIM, pritisak)"
          >
            Nije podržano (100% prazno)
          </button>
        </div>

        {/* Režim prikaza */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
              viewMode === "grouped" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Grupisani prikaz po modulima"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Po temama</span>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
              viewMode === "table" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
            title="Ravna tabela"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabela</span>
          </button>
        </div>
      </div>

      {/* 2. Kategorije (Pills) */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1 overflow-x-auto">
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
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-indigo-700/60 text-white" : "bg-slate-100 text-slate-500 font-semibold"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Prikaz rezultata */}
      {filteredStats.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Nema pronađenih polja za zadati kriterijum.</p>
          <p className="text-xs text-slate-400 mt-1">Pokušajte sa drugačijim terminom pretrage ili poništite filtere.</p>
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
              setNullFilter("all");
            }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
          >
            Resetuj sve filtere
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupsToDisplay.map((group) => (
            <div key={group.key} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Naslov grupe (ako je grouped mod) */}
              {viewMode === "grouped" && (
                <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{group.icon}</span>
                    <h3 className="font-semibold text-slate-800 text-sm">{group.title}</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {group.items.length} {group.items.length === 1 ? "polje" : "polja"}
                  </span>
                </div>
              )}

              {/* Tabela za ovu grupu */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 min-w-[220px]">Naziv podatka / Polje</th>
                      <th className="px-3 py-3 w-[110px]">Tip</th>
                      <th className="px-4 py-3 w-[160px]">Popunjenost</th>
                      <th className="px-3 py-3 w-[120px]">Različitih vrednosti</th>
                      <th className="px-4 py-3 min-w-[170px]">Raspon i prosek</th>
                      <th className="px-4 py-3 min-w-[220px]">Najčešći primeri (Top Values)</th>
                      <th className="px-2 py-3 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                              isExpanded ? "bg-indigo-50/40" : "hover:bg-slate-50/80"
                            }`}
                          >
                            {/* Kolona 1: Prijateljski naziv + dot-path breadcrumb */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                  {friendly.title}
                                  {isEmpty && (
                                    <span className="text-[10px] text-slate-400 font-normal italic">
                                      (nije na senzoru)
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-[260px]">
                                    {col.path}
                                  </span>
                                  <button
                                    onClick={(e) => handleCopyPath(col.path, e)}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 transition"
                                    title="Kopiraj putanju polja"
                                  >
                                    {copiedField === col.path ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                {friendly.desc && (
                                  <span className="text-[10px] text-slate-400 mt-0.5">{friendly.desc}</span>
                                )}
                              </div>
                            </td>

                            {/* Kolona 2: Tip podatka */}
                            <td className="px-3 py-3 align-middle">{getTypeBadge(col.inferredType)}</td>

                            {/* Kolona 3: Popunjenost (Null status) */}
                            <td className="px-4 py-3 align-middle">
                              {isComplete ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  100% popunjeno
                                </span>
                              ) : isEmpty ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  ⚪ Prazno (0%)
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-slate-700">
                                      {((1 - nullRatio) * 100).toFixed(1)}%
                                    </span>
                                    <span className="text-slate-400 text-[10px]">
                                      {(nullRatio * 100).toFixed(1)}% null
                                    </span>
                                  </div>
                                  <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
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

                            {/* Kolona 4: Jedinstvenih vrednosti */}
                            <td className="px-3 py-3 align-middle">
                              <span className="font-semibold text-slate-800">
                                ~{formatNumber(col.distinctEstimate)}
                              </span>
                              {col.distinctEstimate === 1 && (
                                <span className="block text-[10px] text-slate-400">fiksna vrednost</span>
                              )}
                            </td>

                            {/* Kolona 5: Raspon i prosek */}
                            <td className="px-4 py-3 align-middle text-slate-700">
                              {isEmpty ? (
                                <span className="text-slate-400">-</span>
                              ) : isTimestamp ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-[11px] text-indigo-700">
                                    {formatSmartValue(col.average, col.path)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {formatSmartValue(col.min, col.path)} … {formatSmartValue(col.max, col.path)}
                                  </div>
                                </div>
                              ) : col.inferredType === "number" && col.average !== undefined ? (
                                <div className="space-y-0.5">
                                  <div>
                                    <span className="text-slate-400 text-[10px]">Avg:</span>{" "}
                                    <span className="font-semibold text-slate-900">
                                      {formatSmartValue(col.average, col.path)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    [{formatSmartValue(col.min, col.path)} … {formatSmartValue(col.max, col.path)}]
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Nije numeričko</span>
                              )}
                            </td>

                            {/* Kolona 6: Najčešći primeri */}
                            <td className="px-4 py-3 align-middle">
                              {col.topValues && col.topValues.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-md">
                                  {col.topValues.slice(0, 3).map((tv, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] text-slate-800 transition"
                                      title={`${tv.value} (${tv.count} pojava)`}
                                    >
                                      <span className="truncate max-w-[130px] font-medium">
                                        {formatSmartValue(tv.value, col.path)}
                                      </span>
                                      <span className="ml-1 text-slate-400 text-[10px] font-semibold">
                                        ({tv.count})
                                      </span>
                                    </span>
                                  ))}
                                  {col.topValues.length > 3 && (
                                    <span className="text-[10px] text-slate-400 self-center">
                                      +{col.topValues.length - 3} više
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Kolona 7: Expand ikona */}
                            <td className="px-2 py-3 align-middle text-right text-slate-400">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </td>
                          </tr>

                          {/* Detaljni expanded panel */}
                          {isExpanded && (
                            <tr className="bg-indigo-50/30 border-b border-indigo-100">
                              <td colSpan={7} className="p-4">
                                <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <div>
                                      <h4 className="font-semibold text-slate-900 text-xs">
                                        Detaljna distribucija vrednosti za {friendly.title}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{col.path}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => handleCopyPath(col.path, e)}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Kopiraj dot-path</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Prikaz svih top vrednosti sa procentima */}
                                  {col.topValues && col.topValues.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <span className="text-[11px] font-medium text-slate-500">
                                        Najčešće vrednosti i udeo:
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                        {col.topValues.map((tv, idx) => {
                                          const pct =
                                            totalRecords > 0 ? ((tv.count / totalRecords) * 100).toFixed(1) : "0";
                                          return (
                                            <div
                                              key={idx}
                                              className="bg-slate-50 p-2 rounded-md border border-slate-200 flex flex-col justify-between"
                                            >
                                              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-800 truncate">
                                                <span className="truncate" title={String(tv.value)}>
                                                  {formatSmartValue(tv.value, col.path)}
                                                </span>
                                                <span className="text-[10px] text-indigo-600 ml-1 font-sans">
                                                  {pct}%
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                                                <span>{tv.count} zapisa</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400">Nema evidentiranih uzoraka vrednosti.</div>
                                  )}

                                  {/* Dodatna pomoć i opis za telemetriju */}
                                  {isEmpty && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-start gap-2 text-xs text-amber-800">
                                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold">Polje je 100% prazno:</span> Ovo je potpuno
                                        normalno za telemetrijske senzore koje uređaj hardverski ne poseduje (npr.
                                        barometar, eSIM ili neaktivni slot SIM kartice).
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
