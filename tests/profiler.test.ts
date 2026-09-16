import { describe, it, expect } from "vitest";
import { profileRecords } from "../src/lib/ingestion/profiler";

describe("Data Profiler", () => {
  it("profiles column statistics and nested dot-paths", () => {
    const records = [
      {
        user: { name: "Marko", city: "Beograd" },
        age: 30,
        registered: "2026-01-10T12:00:00Z",
      },
      {
        user: { name: "Jelena", city: "Novi Sad" },
        age: 26,
        registered: "2026-02-15T09:30:00Z",
      },
      {
        user: { name: "Nikola", city: null },
        age: 40,
        registered: "2026-03-01T14:00:00Z",
      },
    ];

    const profile = profileRecords(records, 0, 5000);

    expect(profile.recordCount).toBe(3);
    expect(profile.invalidRecordCount).toBe(0);

    const cityStat = profile.columnStats.find((c) => c.path === "user.city");
    expect(cityStat).toBeDefined();
    expect(cityStat?.nullCount).toBe(1);
    expect(cityStat?.presentCount).toBe(2);

    const ageStat = profile.columnStats.find((c) => c.path === "age");
    expect(ageStat).toBeDefined();
    expect(ageStat?.inferredType).toBe("number");
    expect(ageStat?.min).toBe(26);
    expect(ageStat?.max).toBe(40);
    expect(ageStat?.average).toBeCloseTo(32);

    const regStat = profile.columnStats.find((c) => c.path === "registered");
    expect(regStat).toBeDefined();
    expect(regStat?.inferredType).toBe("date");
  });

  it("detects exact duplicate records via canonical hash", () => {
    const records = [
      { a: 1, b: "hello" },
      { a: 2, b: "world" },
      { b: "hello", a: 1 }, // duplicate with different key order
    ];

    const profile = profileRecords(records);
    expect(profile.duplicateCount).toBe(1);
  });

  it("generates correct fragment ranges", () => {
    const records = Array.from({ length: 12 }, (_, i) => ({ id: i }));
    const profile = profileRecords(records, 0, 5);

    expect(profile.fragments.length).toBe(3);
    expect(profile.fragments[0].recordStart).toBe(0);
    expect(profile.fragments[0].recordEnd).toBe(4);
    expect(profile.fragments[0].recordCount).toBe(5);

    expect(profile.fragments[2].recordStart).toBe(10);
    expect(profile.fragments[2].recordEnd).toBe(11);
    expect(profile.fragments[2].recordCount).toBe(2);
  });
});
