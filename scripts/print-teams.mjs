import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

async function loadTs(name) {
  const url = pathToFileURL(join(src, name)).href;
  return import(url);
}

const [{ padSkills }, { suggestCompletions }] = await Promise.all([
  loadTs("catalog.ts"),
  loadTs("team.ts"),
]);

const operatorsDir = join(root, "data", "operators");
const operators = readdirSync(operatorsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const info = JSON.parse(readFileSync(join(operatorsDir, entry.name, "info.json"), "utf8"));
    info.skills = padSkills(info.skills);
    return { id: entry.name, folder: entry.name, info };
  });

const weaponsDir = join(root, "data", "weapons");
const weapons = readdirSync(weaponsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const info = JSON.parse(readFileSync(join(weaponsDir, entry.name, "info.json"), "utf8"));
    return { id: entry.name, folder: entry.name, info };
  })
  .filter((item) => item.info.owned === true);

const roster = operators.filter((item) => item.info.owned === true);
const names = ["Лэватейн", "Тифея", "Чжуан Фанъи", "Ми Фу", "Премудрость", "Росси"];

for (const name of names) {
  const seed = roster.find((item) => item.info.name === name);
  if (!seed) {
    console.log(`\n=== ${name}: нет в наличии ===`);
    continue;
  }
  const suggestions = suggestCompletions(roster, { "slot-0": seed }, 2, weapons);
  console.log(`\n=== ${name} (${seed.info.class} · ${seed.info.element} · ${seed.info.rarity}★) ===`);
  for (const [index, suggestion] of suggestions.entries()) {
    const line = suggestion.members
      .map((op) => `${op.id === seed.id ? "*" : ""}${op.info.name} (${op.info.class})`)
      .join(" · ");
    const s = suggestion.score;
    console.log(
      `#${index + 1}  [${suggestion.archetype.id}]  form ${s.formation}  unlock ${s.unlock}  total ${s.total}  ${line}`,
    );
    for (const why of suggestion.why.slice(0, 6)) console.log(`    - ${why}`);
  }
}
