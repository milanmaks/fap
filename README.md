# FAP — File Analytics Platform & Data Observability

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-36%20tests%20passing-success)](https://vitest.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-orange)](https://deepmind.google/technologies/gemini/)

**FAP (File Analytics Platform)** je produkciono orijentisana platforma za uvoz, profilisanje, **verzionisanje, poređenje verzija (diff), detekciju preklapanja podataka (overlap), ocenu kvaliteta (Data Quality Engine)** i prirodno-jezičku analizu skupova podataka (.avro, .json, .jsonl, .zip) uz pomoć veštačke inteligencije (Gemini Flash).

> ⚠️ **Nulta tolerancija na AI halucinacije:** Svaki kvantitativni odgovor koji četbot pruži potiče isključivo iz validiranog, read-only strukturiranog query plan-a ili profilisanog snapshot-a podataka sa citiranjem porekla (lineage). Četbot nikada ne izmišlja numeričke odgovore.

---

## 🚀 Ključne mogućnosti (Features)

### 1. Višeformatni uvoz datoteka (Multi-File Ingestion)
- **JSON & JSONL / NDJSON**: Strimujuća obrada liniju-po-liniju, bez zagušenja memorije.
- **Avro (.avro)**: Prilagođeni binarni parser sa podrškom za:
  - **64-bit safe long decode**: Vrednosti poput `h3Index` (npr. `617522780852453375`) koje premašuju JavaScript `Number.MAX_SAFE_INTEGER` dekodiraju se direktno u decimalne stringove bez gubitka preciznosti.
  - **Sanitizacija Avro unija**: Automatsko ispravljanje nekompatibilnih podrazumevanih vrednosti (`default: []` na `type: ["null", ...]`) pre kompilacije šeme.
  - **Snappy i Deflate dekompresija**.
- **ZIP arhive**: Automatska dekompresija, praćenje roditeljske arhive (`_fap_parent_archive`), zaštita od **Zip Slip** i **Zip Bombi**.

### 2. Poređenje verzija (Version Comparison & Diff Engine)
- **Automatski diff verzija**: Poređenje aktivne verzije sa bilo kojom prethodnom verzijom (`v1` vs `v2`).
- **KPI delta metrike**: Apsolutne i procentualne promene za zapise, fajlove, kolone, null stopu, duplikate i jedinstvene uređaje (`instanceId`).
- **Detekcija evolucije šeme (Schema Drift)**:
  - Klasifikacija promena: `added`, `removed`, `type_changed`, `null_rate_changed`, `range_changed`, `average_changed`, `cardinality_changed`.
  - Nivo ozbiljnosti: `critical`, `warning`, `info`.
- **Side-by-Side prikaz razlika**: Prikaz konkretnih primera novih, izmenjenih i identičnih zapisa između verzija.

### 3. Višeslojna detekcija preklapanja (Multi-Tier Overlap Detection)
- **Nivo 1 - Heš fajla**: SHA-256 heš binarnog sadržaja datoteke za prepoznavanje re-uvezanih identičnih fajlova.
- **Nivo 2 - Kanonski heš zapisa**: SHA-256 heš normalizovanog zapisa (isključujući interne `_fap_*` metapodatke i `uploadTimestamp`) sa sortiranim ključevima i bezbednim formatiranjem 64-bitnih brojeva.
- **Nivo 3 - Poslovni ključ (Business Key)**:
  - Telemetrijski kompozitni ključ: `instanceId + type + time.timestamp + round(latitude, 5) + round(longitude, 5) + h3Index`.
  - Zaokruživanje koordinata na 5 decimalnih mesta (~1.1 metar preciznost) eliminiše numeričke jitter šumove senzora.
- **Preklapanje vremenskih, prostornih i hardverskih opsega**: Identifikacija preklapanja vremenskih intervala (start–end), GPS bounding box-eva i istih mobilnih uređaja (`instanceId`).

### 4. Data Quality Engine (Ocena kvaliteta podataka 0–100)
Evaluacija skupa podataka kroz 6 ponderisanih dimenzija kvaliteta:

| Dimenzija | Ponder | Opis |
| :--- | :---: | :--- |
| **Kompletnost (Completeness)** | 25% | Prosek popunjenosti ključnih polja; toleriše nepostojeće senzore na hardveru (`pressure*`, `eSIM`, `ageMillis`). |
| **Validnost (Validity)** | 25% | Validacija opsega GPS koordinata (-90..90 lat, -180..180 lon), detekcija mock lokacija i 64-bit bezbednost `h3Index`-a. |
| **Jedinstvenost (Uniqueness)** | 20% | Procenat kanonski jedinstvenih zapisa i poslovnih duplikata. |
| **Konzistentnost (Consistency)** | 15% | Logička pravila: `window_end >= window_start`, mrežna konzistentnost (WIFI ne zahteva mobilnu ćeliju). |
| **Svežina (Freshness)** | 10% | Detekcija zapisa iz budućnosti ili neuobičajeno starih telemetrijskih podataka. |
| **Stabilnost šeme (Schema Stability)** | 5% | Kazneni poeni za neočekivana brisanja kolona ili promene tipova u odnosu na prethodnu verziju. |

Svako pravilo ima definisan status (`PASS`, `WARN`, `FAIL`), stopu greške i reprezentativne primere prekršaja sa navigacijom.

### 5. File Detail Modal & Record Explorer
- Prikaz metapodataka fajla: veličina, broj zapisa, SHA-256 heš, ZIP poreklo.
- **Paginirani pregled zapisa**: Tabelarni i sirovi JSON prikaz (1–100 zapisa po stranici).
- **Pretraga uživo**: Filtriranje zapisa po bilo kom polju u realnom vremenu.
- **Bezbedan izvoz (CSV & JSON)**: Zaštita od Spreadsheet Formula Injection napada (automatsko eskejpovanje ćelija koje počinju sa `=`, `+`, `-`, `@`).

### 6. AI Četbot sa Gemini Flash integracijom
- Povezan sa `compareVersions` i `evaluateDatasetQuality` modulima.
- Odgovara na pitanja o poređenju verzija, driftu šeme, preklapanju zapisa i oceni kvaliteta.
- Citiranje porekla podataka (lineage reference) u svakom odgovoru.
- Automatski deterministički demo mod ukoliko `GEMINI_API_KEY` nije definisan.

---

## 🛠️ Tehnološki stek (Stack)

- **Frontend & Backend:** Next.js 14 (App Router), React 18, TypeScript (Strict mode)
- **Stilovi:** Tailwind CSS, Lucide Icons
- **Validacija:** Zod
- **Grafikoni:** Recharts
- **Parsiranje fajlova:** `avsc` (Avro sa prilagođenim 64-bit dekoderom), `jszip` (ZIP arhive)
- **Baza podataka / ORM:** Prisma ORM (PostgreSQL), sa ugrađenim `MemoryRepository` za instant demo rad
- **Testiranje:** Vitest (36 testova u 8 test paketa)
- **Linter:** ESLint (Next.js core-web-vitals)

---

## ⚡ Brzo pokretanje (Quickstart)

### 1. Kloniranje i instalacija

```bash
git clone https://github.com/milanmaks/fap.git
cd fap
npm install
```

### 2. Podešavanje promenljivih okruženja

Kopirajte `.env.example` u `.env.local`:

```bash
cp .env.example .env.local
```

Primer `.env.local`:
```ini
# Opciono za Gemini AI (ako je prazno, radi deterministički lokalni demo mod)
GEMINI_API_KEY=vaš_gemini_api_ključ
GEMINI_MODEL=gemini-1.5-flash

# Opciono za PostgreSQL (ako je prazno, koristi in-memory skladište)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fap
USE_PRISMA=false

# Bezbednosni limiti
MAX_UPLOAD_FILE_BYTES=52428800
MAX_UPLOAD_FILES=20
MAX_ZIP_ENTRIES=200
MAX_ZIP_EXPANDED_BYTES=262144000
MAX_RECORDS_PER_FRAGMENT=5000
MAX_PROFILE_RECORDS=100000
```

### 3. Pokretanje razvojnog servera

```bash
npm run dev
```

Aplikacija je dostupna na: **`http://localhost:3000`**

---

## 🧪 Testovi i provera kvaliteta (Quality Assurance)

Projekat poseduje 100% prolaznost na svim testovima i linteru:

```bash
# Pokretanje svih Vitest testova (36 testova)
npm run test

# Pokretanje ESLint-a
npm run lint

# Produkcijski build
npm run build
```

### Pokrivenost testova (8 test paketa, 36 testova):
- `tests/hash-utils.test.ts`: Kanonski heš zapisa, redosled ključeva, brisanje metapodataka, determinističko zaokruživanje GPS koordinata, očuvanje 64-bitnog `h3Index`-a.
- `tests/diff-engine.test.ts`: Poređenje verzija, KPI delte, detekcija dodatka/brisanja kolona, promene tipova, preklapanje zapisa.
- `tests/quality-engine.test.ts`: Evaluacija 6 dimenzija kvaliteta, pravila telemetrije (GPS granice, mock lokacije, h3 bezbednost), ponderisano bodovanje.
- `tests/avro-parser.test.ts`: Dekodiranje 64-bitnih celih brojeva van JS sigurnog opsega u stringove, sanitizacija nekompatibilnih default vrednosti unija.
- `tests/file-classifier.test.ts`: Klasifikacija `.json`, `.jsonl`, `.avro`, `.zip`, MIME detekcija i odbijanje nevalidnih fajlova.
- `tests/json-parser.test.ts`: Parsiranje JSON nizova i objekata, strimovanje JSONL, otpornost na greške.
- `tests/profiler.test.ts`: Rekurzivno otkrivanje ugnježdenih polja, statistika, kardinalnost, detekcija duplikata.
- `tests/query-validator.test.ts`: Read-only verifikacija upita, zabrana mutacija i SQL injection obrazaca.

---

## 🔒 Bezbednosne mere (Security Controls)

- **Zaštita od Spreadsheet Formula Injection (CSV/Excel):** Polja koja počinju sa karakterima `=`, `+`, `-`, `@` automatski dobijaju apostrof prefiks (`'`) pri izvozu u CSV.
- **Zaštita od Zip Bombi:** Ograničenje na maksimalan broj unutrašnjih fajlova (200), maksimalnu dekomprimovanu veličinu (250MB) i odnos kompresije (100:1).
- **Zaštita od Zip Slip (Path Traversal):** Normalizacija i provera relativnih putanja unutar arhiva.
- **Validacija upita (Read-Only Safety):** Aplikacija odbija sirovi SQL i proizvoljan kod; dozvoljeni su samo validirani, bezbedni JSON query planovi.
- **Zaštita tajnih ključeva:** `GEMINI_API_KEY` se koristi isključivo na serveru i nikada se ne šalje u browser.

---

## 📁 Struktura projekta

```text
src/
├── app/
│   ├── page.tsx                     # Glavni dashboard (Pregled, Diff, Kvalitet, Fajlovi)
│   ├── layout.tsx                   # Glavni layout aplikacije
│   ├── globals.css                  # Tailwind stilovi
│   ├── datasets/[datasetId]/page.tsx # Ruter ka odabranom dataset-u
│   └── api/
│       ├── uploads/route.ts         # Multipart file upload obrada
│       ├── datasets/route.ts        # GET/POST rute za dataset-ove
│       ├── datasets/[id]/diff/      # Endpoint za diff verzija
│       ├── datasets/[id]/quality/   # Endpoint za Data Quality ocenu
│       ├── datasets/[id]/records/   # Paginirani explorer zapisa
│       ├── datasets/[id]/records/export/ # Bezbedan CSV/JSON izvoz
│       ├── datasets/[id]/analytics/ # Snapshot analitika
│       └── datasets/[id]/chat/      # Server-side Gemini chat sa lineage podrškom
├── components/
│   ├── analytics/
│   │   ├── version-compare-tab.tsx  # Ekran za poređenje verzija i schema drift
│   │   └── quality-tab.tsx          # Ekran sa dimenzijama kvaliteta i pravilima
│   ├── files/
│   │   └── file-detail-modal.tsx    # Modal za inspekciju pojedinačnog fajla i zapisa
│   ├── upload/                      # Dropzone i tabela fajlova
│   ├── dashboard/                   # KPI kartice, profilisane kolone, Recharts
│   ├── chat/                        # AI četbot prozor i citati
│   └── datasets/                    # Selektor i modal za novi dataset
├── lib/
│   ├── domain/types.ts              # Prošireni domen (Diff, Quality, Lineage, Overlap)
│   ├── analytics/
│   │   ├── hash-utils.ts            # SHA-256, kanonski heš, 64-bit h3Index, poslovni ključ
│   │   ├── diff-engine.ts           # Logika za poređenje verzija i schema drift
│   │   └── quality-engine.ts        # 6 dimenzija kvaliteta podataka i telemetrijska pravila
│   ├── ingestion/                   # Avro (64-bit safe), JSON, ZIP parsiranje i profajler
│   ├── storage/                     # Lokalno bezbedno skladište fajlova
│   ├── persistence/                 # In-Memory i Prisma PostgreSQL repozitorijumi
│   └── chat/                        # Gemini klijent, srpski promptovi, validacija plana
└── tests/                           # 8 paketa unit testova (Vitest)
```

---

## ⚠️ Poznata MVP Ograničenja i Sledeći koraci (Roadmap)

1. **In-process analiza**: Obrada zapisa se vrši unutar Node.js procesa. Za skupove podataka od više miliona zapisa, preporučuje se integracija sa embedded DuckDB ili ClickHouse bazom.
2. **Paginacija profajlera**: Profilisanje kolona trenutno uzorkuje do 100.000 zapisa radi očuvanja memorije servera.
3. **Autentifikacija**: Trenutno radi u režimu za lokalni rad bez autentifikacije; sledeći korak je integracija NextAuth.js / Clerk sa ulogama (Viewer, Data Engineer, Admin).
4. **Asinhroni radni red**: Zahtevi za masovni upload se trenutno obrađuju u toku HTTP zahteva; u produkciji je predviđen prelazak na BullMQ radne tokove sa WebSocket notifikacijama.

---

## 👤 Autor

- **Milan Maksimović** ([@milanmaks](https://github.com/milanmaks))
