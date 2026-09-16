# FAP — File Analytics Platform & AI Chatbot

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Tests-success)](https://vitest.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-orange)](https://deepmind.google/technologies/gemini/)

**FAP (File Analytics Platform)** je produkciono orijentisana MVP veb aplikacija za uvoz, profilisanje, verzionisanje i prirodno-jezičku analizu skupova podataka (.avro, .json, .jsonl, .zip) uz pomoć veštačke inteligencije (Gemini Flash).

> ⚠️ **Nulta tolerancija na AI halucinacije:** Svaki kvantitativni odgovor koji četbot pruži potiče isključivo iz validiranog, read-only strukturiranog query plan-a ili profilisanog snapshot-a podataka. Četbot nikada ne izmišlja numeričke odgovore.

---

## 🚀 Ključne mogućnosti (Features)

1. **Višeformatni uvoz datoteka (Multi-File Ingestion):**
   - `.json`: Standardni JSON objekti i nizovi objekata.
   - `.jsonl` / `.ndjson`: Strimujuća obrada liniju-po-liniju, bez zagušenja memorije.
   - `.avro`: Serverski Avro adapter (`avsc.streams.BlockDecoder`) sa detekcijom šeme i bezbednom obradom grešaka.
   - `.zip`: Automatska dekompresija i inspekcija podržanih unutrašnjih fajlova sa zaštitom od **Zip Slip** (path traversal) i **Zip Bombi**.

2. **Automatsko profilisanje i šema (Data Profiling & Schema Inference):**
   - Rekurzivno otkrivanje ugnježdenih kolona (npr. `customer.address.city`).
   - Inferencija tipova: `string`, `number`, `boolean`, `date` (ISO format), `object`, `array`, `mixed`.
   - Statistika po kolonama: stopa `null` vrednosti, procena kardinalnosti (`distinct`), min, max, prosek za numeričke kolone i česte vrednosti (`topValues`).
   - Detekcija duplikata na osnovu kanonskog SHA-256 heša zapisa.

3. **Verzionisanje dataset-ova (Dataset Versioning):**
   - Svaki ponovni uvoz u postojeći dataset kreira novu, inkrementalnu verziju (`v1`, `v2`...) umesto prepisivanja starih rezultata.
   - Puna istorijska nepromenljivost (immutable snapshots).
   - Poređenje verzija: poređenje broja zapisa, grešaka, dodatih/obrisanih kolona i promena tipova.

4. **Četbot sa Gemini Flash integracijom:**
   - Server-side integracija sa Gemini Flash modelom (API ključ nikada nije izložen browser-u).
   - Rutiranje pitanja: metapodaci, agregacije, filteri, vremensko grupisanje, kvalitet podataka i poređenje verzija.
   - **Read-Only Query Plan Validator**: Generisani planovi se pre izvršavanja proveravaju u odnosu na šemu i strogo zabranjuju bilo kakve mutacije ili SQL obrasce.
   - **Data Lineage & Citations**: Svaki odgovor sadrži reference izvora (fajl, opseg zapisa, ID fragmenta).
   - **Lokalni fallback**: Ako `GEMINI_API_KEY` nije definisan, aplikacija automatski prelazi u deterministički lokalni demo mod, omogućavajući nesmetano testiranje bez spoljnih servisa.

---

## 🛠️ Tehnološki stek (Stack)

- **Frontend & Backend:** Next.js 14 (App Router), React 18, TypeScript (Strict mode)
- **Stilovi:** Tailwind CSS, Lucide Icons
- **Validacija:** Zod
- **Grafikoni:** Recharts
- **Parsiranje fajlova:** `avsc` (Avro), `jszip` (ZIP arhive)
- **Baza podataka / ORM:** Prisma ORM (PostgreSQL), sa ugrađenim `MemoryRepository` za instant demo mod
- **Testiranje:** Vitest (21 test)
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

Primer konfiguracije u `.env.local`:
```ini
# Opciono za Gemini AI (ako je prazno, radi lokalni demo mod)
GEMINI_API_KEY=vaš_gemini_api_ključ
GEMINI_MODEL=gemini-1.5-flash

# Opciono za PostgreSQL (ako je prazno, koristi in-memory demo skladište)
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

## 🐘 Perzistentni režim (PostgreSQL + Docker Compose)

Ukoliko želite perzistenciju podataka u pravoj PostgreSQL bazi:

1. **Pokrenite PostgreSQL kontejner:**
   ```bash
   docker compose up -d postgres
   ```

2. **Generišite i primenite Prisma migracije:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

3. **U `.env.local` postavite:**
   ```ini
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fap"
   USE_PRISMA="true"
   ```

4. **Pokrenite aplikaciju:**
   ```bash
   npm run dev
   ```

---

## 🧪 Testovi i provera kvaliteta (Quality Assurance)

Projekat poseduje 100% prolaznost na unit testovima i linteru:

```bash
# Pokretanje Vitest testova (21 test)
npm run test

# Pokretanje lintera
npm run lint

# Produkcijski build
npm run build
```

### Pregled pokrivenosti testova:
- `tests/file-classifier.test.ts`: Klasifikacija `.json`, `.jsonl`, `.avro`, `.zip`, detekcija MIME tipova i odbijanje nepoznatih formata.
- `tests/json-parser.test.ts`: Parsiranje JSON nizova, pojedinačnih objekata, obrada grešaka bez rušenja procesa, strimovanje JSONL liniju-po-liniju.
- `tests/profiler.test.ts`: Otkrivanje ugnježdenih kolona, inferencija tipova, računanje proseka/min/max, detekcija duplikata kanonskim hešom i fragmentacija.
- `tests/avro-parser.test.ts`: Enkodiranje i dekodiranje pravog OCF Avro fajla na serveru, sigurno odbijanje malformiranih binarnih fajlova.
- `tests/query-validator.test.ts`: Dozvola read-only operacija, provera postojanja polja u šemi, odbijanje SQL injection ključnih reči (`DROP`, `DELETE`, `UPDATE`), clamping limita na 100.

---

## 🔒 Bezbednosne mere (Security Controls)

- **Zaštita od Zip Bombi:** Ograničenje na maksimalan broj unutrašnjih fajlova (200), maksimalnu dekomprimovanu veličinu (250MB) i odnos kompresije (100:1).
- **Zaštita od Zip Slip (Path Traversal):** Normalizacija i provera relativnih putanja u arhivama.
- **Bezbedno izvršavanje upita:** Aplikacija **ne prima** sirovi SQL sa klijenta niti od AI modela. Upiti su isključivo u strukturiranom JSON obliku i strogo su provereni pre izvršavanja.
- **Tajna konfiguracija:** `GEMINI_API_KEY` se čita isključivo u server-side kodu i nikada se ne šalje klijentskom browseru.

---

## 📋 Struktura koda

```text
src/
├── app/
│   ├── page.tsx                     # Glavni analitički dashboard i četbot
│   ├── layout.tsx                   # Glavni layout
│   ├── globals.css                  # Tailwind direktive
│   ├── datasets/[datasetId]/page.tsx # Ruter ka selektovanom dataset-u
│   └── api/
│       ├── uploads/route.ts         # Multipart file upload handler
│       ├── datasets/route.ts        # GET/POST rute za dataset-ove
│       ├── datasets/[id]/route.ts   # Detalji dataset-a
│       ├── datasets/[id]/versions/  # Istorija verzija
│       ├── datasets/[id]/analytics/ # Snapshot analitika i lista fajlova
│       └── datasets/[id]/chat/      # Server-side Gemini chat endpoint
├── components/
│   ├── upload/                      # Dropzone i tabela uvezenih fajlova
│   ├── dashboard/                   # KPI kartice, profilisane kolone, Recharts grafikoni, verzije
│   ├── chat/                        # AI četbot, query plan kartica, lineage chip-ovi
│   ├── datasets/                    # Selektor dataset-a i modal za kreiranje
│   └── ui/                          # Button, Card, Badge
├── lib/
│   ├── domain/                      # Types, QueryPlan, Citations, Analytics engine
│   ├── ingestion/                   # Classifier, JSON/JSONL, Avro, ZIP, Profiler, ImportService
│   ├── storage/                     # LocalStorageAdapter sa zaštitom od path traversal-a
│   ├── persistence/                 # Repository interfejs, MemoryRepository, PrismaRepository
│   ├── chat/                        # GeminiClient, Serbian Prompts, Router, Validator, ChatService
│   └── utils/                       # IDs, Dates, Formatters
└── tests/                           # Vitest test suite
```

---

## ⚠️ Poznata MVP Ograničenja i Sledeći koraci (Roadmap)

### Trenutna MVP ograničenja:
1. **In-process Query Engine:** Trenutna analiza se vrši u memoriji unutar Node.js procesa. Za datoteke veće od nekoliko stotina megabajta preporučuje se skaliranje na DuckDB ili DataFusion.
2. **Autentifikacija korisnika:** U MVP-ju nema autentifikacije i višekorisničkih timova (trenutno je predviđeno za single-tenant / local development).
3. **Pojedinačni čvor za uvoz:** Obrada fajlova se odvija u sklopu istog Node.js procesa (ImportProcessor interfejs je spreman za povezivanje sa BullMQ / Celery distribuiranom radnom redom).

### Preporučeni sledeći koraci za produkciju:
- Povezivanje [DuckDB](https://duckdb.org/) agregacionog adaptera preko definisanog `QueryPlan` interfejsa.
- Integracija [NextAuth.js](https://next-auth.js.org/) / Clerk za višekorisnički pristup i timove.
- S3 / Google Cloud Storage adapter za skladištenje sirovih fajlova.
- Pozadinska asinhrona radna red (BullMQ / Redis) za masivne uvoze.

---

## 👤 Autor

- **Milan Maksimović** ([@milanmaks](https://github.com/milanmaks))
