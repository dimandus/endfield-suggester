import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

async function loadTs(name) {
  const url = pathToFileURL(join(src, name)).href;
  return import(url);
}

const [{ padSkills, displayName }, { suggestCompletions }, { GOLD_TEAMS, namesKey }] = await Promise.all([
  loadTs("catalog.ts"),
  loadTs("team.ts"),
  loadTs("gold.ts"),
]);

const operatorsDir = join(root, "data", "operators");
const operators = readdirSync(operatorsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const info = JSON.parse(readFileSync(join(operatorsDir, entry.name, "info.json"), "utf8"));
    info.skills = padSkills(info.skills);
    return { id: entry.name, folder: entry.name, info };
  });

const roster = operators.filter((item) => item.info.owned === true);
const byName = new Map(roster.map((item) => [item.info.name, item]));

let failed = 0;
for (const gold of GOLD_TEAMS) {
  if (!gold.check) continue;
  const missing = gold.names.filter((name) => !byName.has(name));
  if (missing.length) {
    console.log(`SKIP ${gold.id}: нет в наличии ${missing.join(", ")}`);
    continue;
  }
  const seed = byName.get(gold.seed);
  const excluded = (gold.exclude ?? [])
    .map((name) => byName.get(name)?.id)
    .filter(Boolean);
  const suggestions = suggestCompletions(roster, { "slot-0": seed }, 5, [], excluded);
  const hit = suggestions.find((item) => namesKey(item.members.map(displayName)) === namesKey(gold.names));
  if (hit) {
    const rank = suggestions.indexOf(hit) + 1;
    console.log(`OK   ${gold.id}  #${rank}  [${hit.archetype.id}]  ${gold.names.join(" · ")}`);
  } else {
    failed += 1;
    console.log(`FAIL ${gold.id}  ждали ${gold.names.join(" · ")}`);
    for (const [index, suggestion] of suggestions.entries()) {
      console.log(
        `     #${index + 1} [${suggestion.archetype.id}] ${suggestion.members.map(displayName).join(" · ")}`,
      );
    }
  }
}

if (failed) {
  console.error(`\n${failed} эталон(а) не в топ-5`);
  process.exit(1);
}
console.log("\nВсе доступные эталоны есть в топ-5.");
