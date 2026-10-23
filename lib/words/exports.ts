import type { WordGroup } from "@/types/words";

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const CSV_HEADER = "groupName,civilianWord,undercoverWord,description,enabled";

export function exportCsv(groups: readonly WordGroup[]): string {
  const lines = [CSV_HEADER];
  for (const g of groups) {
    if (!g.pairs.length) lines.push([g.name, "", "", g.description, String(g.enabled)].map(esc).join(","));
    for (const p of g.pairs) lines.push([g.name, p.civilianWord, p.undercoverWord, g.description, String(g.enabled)].map(esc).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function exportJson(groups: readonly WordGroup[]): string {
  return JSON.stringify(
    {
      app: "shadow-words",
      version: 1,
      exportedAt: new Date().toISOString(),
      groups: groups.map((g) => ({
        name: g.name,
        description: g.description,
        enabled: g.enabled,
        createdAt: new Date(g.createdAt).toISOString(),
        updatedAt: new Date(g.updatedAt).toISOString(),
        pairs: g.pairs.map((p) => ({ civilianWord: p.civilianWord, undercoverWord: p.undercoverWord })),
      })),
    },
    null,
    2,
  );
}

export const SAMPLE_CSV =
  `${CSV_HEADER}\r\n` +
  "Breakfast,Pancake,Waffle,Morning foods,true\r\n" +
  "Breakfast,Coffee,Tea,,true\r\n" +
  "Breakfast,Omelette,Scrambled eggs,,true\r\n" +
  "Vehicles,Car,Truck,Things with wheels,true\r\n" +
  "Vehicles,Bicycle,Scooter,,true\r\n";

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
