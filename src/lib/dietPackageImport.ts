import * as XLSX from "xlsx";
import { parseCsvText } from "./csvParse";
import type {
  DietPackageOccurrence,
  DietPackagePreview,
  StudentDiet,
} from "../types";

type RawMod = {
  facultyCode: string;
  program: string;
  route: string;
  dietCode: string;
  batch: string;
  studentCount: number;
  kumpulan: string;
  seqn: string;
  minv: number | null;
  maxv: number | null;
  dietModuleCode: string;
  offeredModuleCode: string | null;
  occurrences: DietPackageOccurrence[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFill(raw: string): { enrolled: number; capacity: number } {
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return { enrolled: 0, capacity: 0 };
  return { enrolled: Number(m[1]), capacity: Number(m[2]) };
}

function isOccurCode(s: string): boolean {
  if (!s || s.includes("/")) return false;
  return /^[0-9]+[A-Za-z]?$/.test(s) || /^[0-9]+M$/i.test(s);
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_/.-]+/g, "");
}

const FLAT_ALIASES: Record<string, string> = {
  faculty: "faculty",
  facultycode: "faculty",
  fakulti: "faculty",
  crsfacc: "faculty",
  program: "program",
  pdtprgc: "program",
  route: "route",
  pdtrouc: "route",
  diet: "diet",
  dietcode: "diet",
  pdtcode: "diet",
  codediet: "diet",
  batch: "batch",
  pdtbatc: "batch",
  students: "students",
  bilpelajar: "students",
  studentcount: "students",
  kumpulan: "kumpulan",
  group: "kumpulan",
  packagegroup: "kumpulan",
  pdmsesc: "kumpulan",
  rumahkursus: "kumpulan",
  seqn: "seqn",
  pdmseqn: "seqn",
  sequence: "seqn",
  minv: "minv",
  pdmminv: "minv",
  min: "minv",
  maxv: "maxv",
  pdmmaxv: "maxv",
  max: "maxv",
  dietmodule: "dietModule",
  fmemodp: "dietModule",
  module: "module",
  modulecode: "module",
  modul: "module",
  moduldiet: "dietModule",
  modcode: "module",
  occurrence: "occurrence",
  occur: "occurrence",
  occ: "occurrence",
  mavoccur: "occurrence",
  enrolled: "enrolled",
  filled: "enrolled",
  capacity: "capacity",
  cap: "capacity",
  mavtrgt: "capacity",
  target: "capacity",
};

function mapFlatHeaders(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = FLAT_ALIASES[normHeader(h)];
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

function looksLikeFlatTemplate(headers: string[]): boolean {
  const map = mapFlatHeaders(headers);
  return (
    map.has("faculty") &&
    map.has("diet") &&
    (map.has("module") || map.has("dietModule"))
  );
}

function splitOccurrences(raw: string): string[] {
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildPreviewFromRawMods(
  fileName: string,
  rawMods: RawMod[],
): DietPackagePreview {
  const dietMap = new Map<string, StudentDiet>();

  for (const m of rawMods) {
    if (!m.dietCode) continue;
    let dietRec = dietMap.get(m.dietCode);
    if (!dietRec) {
      dietRec = {
        facultyCode: m.facultyCode,
        program: m.program,
        route: m.route,
        dietCode: m.dietCode,
        batch: m.batch,
        studentCount: m.studentCount,
        groups: [],
      };
      dietMap.set(m.dietCode, dietRec);
    } else if (m.studentCount > 0) {
      dietRec.studentCount = m.studentCount;
    }

    const groupKey = `${m.kumpulan}|${m.seqn}|${m.minv}|${m.maxv}`;
    let group = dietRec.groups.find(
      (g) => `${g.kumpulan}|${g.seqn}|${g.minv}|${g.maxv}` === groupKey,
    );
    if (!group) {
      group = {
        kumpulan: m.kumpulan,
        seqn: m.seqn,
        minv: m.minv,
        maxv: m.maxv,
        modules: [],
      };
      dietRec.groups.push(group);
    }

    const moduleCode = m.offeredModuleCode || m.dietModuleCode;
    let mod = group.modules.find(
      (x) =>
        (x.offeredModuleCode || x.dietModuleCode).toUpperCase() ===
        moduleCode.toUpperCase(),
    );
    if (!mod) {
      mod = {
        dietModuleCode: m.dietModuleCode || moduleCode,
        offeredModuleCode: m.offeredModuleCode,
        occurrences: [],
      };
      group.modules.push(mod);
    } else if (m.offeredModuleCode) {
      mod.offeredModuleCode = m.offeredModuleCode;
    }

    for (const occ of m.occurrences) {
      const existing = mod.occurrences.find(
        (o) => o.code.toUpperCase() === occ.code.toUpperCase(),
      );
      if (existing) {
        existing.capacity = Math.max(existing.capacity, occ.capacity);
        existing.enrolled = Math.max(existing.enrolled, occ.enrolled);
      } else {
        mod.occurrences.push({ ...occ });
      }
    }
  }

  const diets = Array.from(dietMap.values());
  let moduleReqCount = 0;
  let offeredCount = 0;
  for (const d of diets) {
    for (const g of d.groups) {
      for (const mod of g.modules) {
        moduleReqCount += 1;
        if (mod.offeredModuleCode && mod.occurrences.length > 0) {
          offeredCount += 1;
        }
      }
    }
  }

  return {
    fileName,
    diets,
    dietCount: diets.length,
    moduleReqCount,
    offeredCount,
    studentTotal: diets.reduce((sum, d) => sum + (d.studentCount || 0), 0),
  };
}

function emptyPreview(fileName: string): DietPackagePreview {
  return {
    fileName,
    diets: [],
    dietCount: 0,
    moduleReqCount: 0,
    offeredCount: 0,
    studentTotal: 0,
  };
}

/** Flat template: one row per module (occurrence may be comma-separated). */
function parseFlatRows(
  headers: string[],
  dataRows: string[][],
  fileName: string,
): DietPackagePreview {
  const col = mapFlatHeaders(headers);
  if (
    !col.has("faculty") ||
    !col.has("diet") ||
    (!col.has("module") && !col.has("dietModule"))
  ) {
    return emptyPreview(fileName);
  }

  const get = (row: string[], key: string) => {
    const i = col.get(key);
    return i == null ? "" : cellStr(row[i]);
  };

  const rawMods: RawMod[] = [];
  for (const row of dataRows) {
    if (row.every((c) => !cellStr(c))) continue;
    const dietCode = get(row, "diet");
    const dietModule = get(row, "dietModule");
    const offeredModule = get(row, "module");
    const moduleCode = offeredModule || dietModule;
    if (!dietCode || !moduleCode) continue;

    const occRaw = get(row, "occurrence");
    const occCodes = occRaw ? splitOccurrences(occRaw) : [];
    const enrolled = cellNum(get(row, "enrolled")) ?? 0;
    const capacity = cellNum(get(row, "capacity")) ?? 0;
    const occurrences: DietPackageOccurrence[] =
      occCodes.length > 0
        ? occCodes.map((code) => ({ code, enrolled, capacity }))
        : [];

    rawMods.push({
      facultyCode: get(row, "faculty"),
      program: get(row, "program"),
      route: get(row, "route"),
      dietCode,
      batch: get(row, "batch"),
      studentCount: cellNum(get(row, "students")) ?? 0,
      kumpulan: get(row, "kumpulan"),
      seqn: get(row, "seqn"),
      minv: cellNum(get(row, "minv")),
      maxv: cellNum(get(row, "maxv")),
      dietModuleCode: dietModule || moduleCode,
      offeredModuleCode: offeredModule || null,
      occurrences,
    });
  }

  return buildPreviewFromRawMods(fileName, rawMods);
}

/**
 * Parse MOR44-style "Senarai Pakej Wajib" Excel (merged hierarchy + Occur columns).
 */
function parseMor44Rows(
  rows: (string | number | null)[][],
  fileName: string,
): DietPackagePreview {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const joined = (rows[i] ?? []).map(cellStr).join(" ").toLowerCase();
    if (joined.includes("fakulti") && joined.includes("diet")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 8;

  const dataStart = headerIdx + 2;
  const rawMods: RawMod[] = [];
  let fac = "";
  let prog = "";
  let route = "";
  let diet = "";
  let batch = "";
  let bil = 0;
  let kump = "";
  let seqn = "";
  let minv: number | null = null;
  let maxv: number | null = null;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const c = (colIdx: number) => row[colIdx] ?? null;

    const facV = cellStr(c(1));
    const progV = cellStr(c(2));
    const routeV = cellStr(c(4));
    const dietV = cellStr(c(6));
    const batchV = cellStr(c(9));
    const bilV = cellNum(c(10));
    const kumpV = cellStr(c(13));
    const seqnV = cellStr(c(14));
    const minV = cellNum(c(17));
    const maxV = cellNum(c(18));
    const dietMod = cellStr(c(19));
    const penMod = cellStr(c(20));

    if (facV) fac = facV;
    if (progV) prog = progV;
    if (routeV) route = routeV;
    if (dietV) diet = dietV;
    if (batchV) batch = batchV;
    if (bilV != null) bil = bilV;
    if (kumpV) kump = kumpV;
    if (seqnV) seqn = seqnV;
    if (minV != null) minv = minV;
    if (maxV != null) maxv = maxV;

    if (!dietMod && !penMod) continue;

    const codes: { col: number; code: string }[] = [];
    for (let colIdx = 21; colIdx < row.length; colIdx++) {
      const s = cellStr(c(colIdx));
      if (!s) continue;
      if (isOccurCode(s)) codes.push({ col: colIdx, code: s });
    }

    const occurrences: DietPackageOccurrence[] = [];
    const next = rows[i + 1] ?? [];
    const nextDiet = cellStr(next[19]);
    const nextPen = cellStr(next[20]);
    const nextIsFill = !nextDiet && !nextPen;

    for (const { col: colIdx, code } of codes) {
      let enrolled = 0;
      let capacity = 0;
      if (nextIsFill) {
        const fill = cellStr(next[colIdx]);
        if (fill.includes("/")) {
          const parsed = parseFill(fill);
          enrolled = parsed.enrolled;
          capacity = parsed.capacity;
        }
      }
      occurrences.push({ code, enrolled, capacity });
    }

    rawMods.push({
      facultyCode: fac,
      program: prog,
      route,
      dietCode: diet,
      batch,
      studentCount: bil,
      kumpulan: kump,
      seqn,
      minv,
      maxv,
      dietModuleCode: dietMod || penMod,
      offeredModuleCode: penMod || null,
      occurrences,
    });
  }

  return buildPreviewFromRawMods(fileName, rawMods);
}

function rowsFromCsvText(text: string): string[][] {
  return parseCsvText(text);
}

function rowsFromWorkbook(buffer: ArrayBuffer): (string | number | null)[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
}

/**
 * Parse diet package file:
 * - Flat template CSV/Excel (Download Template)
 * - MOR44-style pakej wajib Excel export
 */
export function parseDietPackageFile(
  buffer: ArrayBuffer,
  fileName: string,
): DietPackagePreview {
  const lower = fileName.toLowerCase();
  const isCsv = lower.endsWith(".csv") || lower.endsWith(".txt");

  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const table = rowsFromCsvText(text);
    if (table.length === 0) return emptyPreview(fileName);
    const [headers, ...data] = table;
    if (looksLikeFlatTemplate(headers)) {
      return parseFlatRows(headers, data, fileName);
    }
    return emptyPreview(fileName);
  }

  const rows = rowsFromWorkbook(buffer);
  if (rows.length === 0) return emptyPreview(fileName);

  // Try flat template on first non-empty row as headers
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = (rows[i] ?? []).map(cellStr);
    if (!headers.some(Boolean)) continue;
    if (looksLikeFlatTemplate(headers)) {
      const data = rows.slice(i + 1).map((r) => (r ?? []).map(cellStr));
      return parseFlatRows(headers, data, fileName);
    }
    const joined = headers.join(" ").toLowerCase();
    if (joined.includes("fakulti") && joined.includes("diet")) {
      return parseMor44Rows(rows, fileName);
    }
  }

  return parseMor44Rows(rows, fileName);
}

export type OfferedTarget = {
  moduleCode: string;
  occurrence: string;
  capacity: number;
};

export function mergeOfferedTargets(...lists: OfferedTarget[][]): OfferedTarget[] {
  const map = new Map<string, OfferedTarget>();
  for (const list of lists) {
    for (const t of list) {
      const moduleCode = t.moduleCode.trim();
      const occurrence = (t.occurrence || "1").trim();
      if (!moduleCode) continue;
      const key = `${moduleCode}::${occurrence}`.toUpperCase();
      const prev = map.get(key);
      map.set(key, {
        moduleCode,
        occurrence,
        capacity: Math.max(prev?.capacity ?? 0, t.capacity || 0),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.moduleCode}/${a.occurrence}`.localeCompare(
      `${b.moduleCode}/${b.occurrence}`,
      undefined,
      { numeric: true },
    ),
  );
}

/** Flatten unique module+occurrence targets for scheduling. */
export function flattenOfferedTargets(
  preview: DietPackagePreview,
  facultyCode?: string,
): OfferedTarget[] {
  const map = new Map<string, OfferedTarget>();
  const fac = (facultyCode ?? "").trim().toUpperCase();

  for (const diet of preview.diets) {
    if (fac && diet.facultyCode.toUpperCase() !== fac) continue;
    for (const group of diet.groups) {
      for (const mod of group.modules) {
        const moduleCode = (mod.offeredModuleCode || "").trim();
        if (!moduleCode) continue;
        for (const occ of mod.occurrences) {
          const key = `${moduleCode}::${occ.code}`.toUpperCase();
          const prev = map.get(key);
          const capacity = Math.max(prev?.capacity ?? 0, occ.capacity || 0);
          map.set(key, {
            moduleCode,
            occurrence: occ.code,
            capacity,
          });
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.moduleCode}/${a.occurrence}`.localeCompare(
      `${b.moduleCode}/${b.occurrence}`,
      undefined,
      { numeric: true },
    ),
  );
}
