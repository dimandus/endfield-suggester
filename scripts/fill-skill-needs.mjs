import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const NEEDS = {
  alesh: { 1: ["solidification"] },
  ardeliya: { 1: ["corrosion"] },
  arklayt: { 1: ["electrification"], 3: ["electrification"] },
  "chzhuan-fani": { 1: ["electrification"] },
  fluorite: { 3: ["arts-infliction"] },
  "mi-fu": { 1: ["vulnerable-stacks"] },
  pogranichnik: { 1: ["vulnerable-stacks"], 3: ["physical-status"] },
  rossi: { 1: ["vulnerable-stacks"] },
  saihi: { 1: ["final-strike"] },
  tifeya: { 1: ["arts-infliction"] },
  vulfguard: { 1: ["arts-reaction"] },
};

const root = join(process.cwd(), "data", "operators");
for (const folder of await readdir(root)) {
  const path = join(root, folder, "info.json");
  let info;
  try {
    info = JSON.parse(await readFile(path, "utf8"));
  } catch {
    continue;
  }
  const map = NEEDS[folder] ?? {};
  info.skills = (info.skills ?? []).map((skill, index) => {
    const next = { ...skill };
    delete next.needs;
    if (map[index]?.length) next.needs = map[index];
    return next;
  });
  await writeFile(path, `${JSON.stringify(info, null, 2)}\n`, "utf8");
}
