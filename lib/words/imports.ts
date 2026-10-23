import type { RawPair, WordGroup } from "@/types/words";
import { addWordPair, createWordGroup, uniqueGroupName, validateGroupName } from "./groups";
import { cleanWord, normalizeWord } from "./normalization";
import { validateWordPair } from "./validation";
import type { WordPair } from "@/types/words";

export interface ImportedGroup {
  name: string;
  description: string;
  enabled: boolean;
  pairs: RawPair[];
}
export interface ImportIssue {
  where: string;
  message: string;
}
export interface ParsedImport {
  groups: ImportedGroup[];
  issues: ImportIssue[];
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

class Collector {
  groups = new Map<string, ImportedGroup & { _pairs: WordPair[] }>();
  issues: ImportIssue[] = [];
  ensure(name: string, description = "", enabled = true, where = "") {
    const v = validateGroupName([], name);
    if (!v.ok) { this.issues.push({ where, message: v.error }); return null; }
    const key = normalizeWord(v.value);
    let g = this.groups.get(key);
    if (!g) {
      g = { name: v.value, description: cleanWord(description), enabled, pairs: [], _pairs: [] };
      this.groups.set(key, g);
    } else if (!g.description && description) g.description = cleanWord(description);
    return g;
  }
  addPair(g: ImportedGroup & { _pairs: WordPair[] }, c: string, u: string, where: string) {
    const v = validateWordPair(g._pairs, c, u);
    if (!v.ok) { this.issues.push({ where, message: v.error }); return; }
    g._pairs.push({ id: String(g._pairs.length), ...v.value, createdAt: 0, updatedAt: 0 });
    g.pairs.push(v.value);
  }
  result(): ParsedImport {
    return { groups: [...this.groups.values()].map(({ _pairs, ...g }) => g), issues: this.issues };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
const falsy = new Set(["false", "0", "no", "disabled", "off"]);

export function parseCsvImport(text: string, opts: { defaultGroupName?: string } = {}): ParsedImport {
  const rows = parseCsv(text);
  const c = new Collector();
  if (!rows.length) return { groups: [], issues: [{ where: "File", message: "The file is empty." }] };
  const header = rows[0].map(norm);
  const idx = (name: string) => header.indexOf(name);
  const iG = idx("groupname"), iC = idx("civilianword"), iU = idx("undercoverword"), iD = idx("description"), iE = idx("enabled");
  if (iC < 0 || iU < 0 || (iG < 0 && !opts.defaultGroupName)) {
    return {
      groups: [],
      issues: [{ where: "Header", message: "Expected columns: groupName, civilianWord, undercoverWord, description (optional: enabled)." }],
    };
  }
  rows.slice(1).forEach((r, n) => {
    const where = `Row ${n + 2}`;
    const gName = (iG >= 0 ? r[iG] : "")?.trim() || opts.defaultGroupName || "";
    const cw = r[iC] ?? "", uw = r[iU] ?? "";
    const enabled = iE >= 0 && r[iE] ? !falsy.has(r[iE].trim().toLowerCase()) : true;
    if (!gName) { c.issues.push({ where, message: "Missing group name." }); return; }
    const g = c.ensure(gName, iD >= 0 ? r[iD] ?? "" : "", enabled, where);
    if (!g) return;
    if (!cw.trim() && !uw.trim()) return; // group-only row
    c.addPair(g, cw, uw, `${where} (${g.name})`);
  });
  return c.result();
}

export function parseJsonImport(text: string, opts: { defaultGroupName?: string } = {}): ParsedImport {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { return { groups: [], issues: [{ where: "File", message: "This file is not valid JSON." }] }; }
  const list = Array.isArray(data) ? data : (data as { groups?: unknown })?.groups;
  if (!Array.isArray(list)) return { groups: [], issues: [{ where: "File", message: 'Expected a JSON array of groups or an object with a "groups" array.' }] };
  const c = new Collector();
  list.forEach((raw, i) => {
    const where = `Group ${i + 1}`;
    if (!raw || typeof raw !== "object") { c.issues.push({ where, message: "Not a valid group object." }); return; }
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : opts.defaultGroupName ?? "";
    const g = c.ensure(name, typeof r.description === "string" ? r.description : "", r.enabled !== false, where);
    if (!g) return;
    if (r.pairs === undefined) return;
    if (!Array.isArray(r.pairs)) { c.issues.push({ where: `${where} (${g.name})`, message: '"pairs" must be an array.' }); return; }
    r.pairs.forEach((p, j) => {
      const pr = (p ?? {}) as Record<string, unknown>;
      if (typeof pr.civilianWord !== "string" || typeof pr.undercoverWord !== "string") {
        c.issues.push({ where: `${where} (${g.name}), pair ${j + 1}`, message: "Missing civilianWord or undercoverWord." });
        return;
      }
      c.addPair(g, pr.civilianWord, pr.undercoverWord, `${where} (${g.name}), pair ${j + 1}`);
    });
  });
  return c.result();
}

export function parseImportFile(filename: string, text: string, opts: { defaultGroupName?: string } = {}): ParsedImport {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return parseJsonImport(text, opts);
  if (lower.endsWith(".csv")) return parseCsvImport(text, opts);
  return { groups: [], issues: [{ where: "File", message: "Unsupported file type. Choose a .csv or .json file." }] };
}

export type ConflictMode = "skip" | "rename";

export interface ImportApplied {
  groups: WordGroup[];
  groupsAdded: number;
  pairsAdded: number;
  skipped: string[];
}

export function applyImport(existing: WordGroup[], parsed: ParsedImport, mode: ConflictMode): ImportApplied {
  let groups = existing;
  let groupsAdded = 0, pairsAdded = 0;
  const skipped: string[] = [];
  for (const g of parsed.groups) {
    const taken = groups.some((x) => normalizeWord(x.name) === normalizeWord(g.name));
    let name = g.name;
    if (taken) {
      if (mode === "skip") { skipped.push(g.name); continue; }
      name = uniqueGroupName(groups, g.name, "imported");
    }
    const r = createWordGroup(groups, { name, description: g.description, enabled: g.enabled, pairs: g.pairs });
    if (!r.ok) { skipped.push(`${g.name} (${r.error})`); continue; }
    groups = r.value.groups;
    groupsAdded++;
    pairsAdded += g.pairs.length;
  }
  return { groups, groupsAdded, pairsAdded, skipped };
}

/** Adds raw pairs to one group; pairs that conflict with existing words are reported, never merged silently. */
export function addPairsToGroup(groups: WordGroup[], groupId: string, pairs: RawPair[]) {
  let current = groups;
  let added = 0;
  const failures: { pair: RawPair; error: string }[] = [];
  for (const p of pairs) {
    const r = addWordPair(current, groupId, p.civilianWord, p.undercoverWord);
    if (r.ok) { current = r.value.groups; added++; } else failures.push({ pair: p, error: r.error });
  }
  return { groups: current, added, failures };
}

