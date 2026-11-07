import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "data", "operators");

const WORD = [
  [/физическ/i, "Физика"],
  [/теплово/i, "Тепло"],
  [/природн/i, "Природа"],
  [/электрическ/i, "Электро"],
  [/криогенн/i, "Крио"],
  [/эфир/i, "Эфир"],
];

const OVERRIDES = {
  "rossi:1": [
    { element: "Физика" },
    { element: "Тепло", when: "на цели есть уязвимость" },
  ],
  "serebristyy-potok:1": [
    { element: "Физика" },
    { element: "Электро", when: "Натиск молнии после комбо" },
  ],
  "svetosnezhka:1": [{ element: "Крио", when: "ответный удар при блоке" }],
  "ketcher:1": [{ element: "Физика", when: "ответный удар при блоке" }],
  "murrchena:1": [{ element: "Природа", when: "ОСТАВЬ МОИХ ДРУЗЕЙ В ПОКОЕ!" }],
  "murrchena:2": [{ element: "Физика", when: "бомба или поделка" }],
};

function parseHits(text) {
  const found = [];
  const re = /([А-Яа-яЁё]+)\s+УРН/g;
  let match;
  while ((match = re.exec(text))) {
    const word = match[1];
    const mapped = WORD.find(([pattern]) => pattern.test(word));
    if (mapped && !found.includes(mapped[1])) found.push(mapped[1]);
  }
  return found.map((element) => ({ element }));
}

for (const folder of await readdir(root)) {
  const path = join(root, folder, "info.json");
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    continue;
  }
  const info = JSON.parse(raw);
  if (!Array.isArray(info.skills)) continue;
  info.skills = info.skills.map((skill, index) => {
    const key = `${folder}:${index}`;
    const damage = OVERRIDES[key] ?? parseHits(skill.description ?? "");
    return { ...skill, damage };
  });
  await writeFile(path, `${JSON.stringify(info, null, 2)}\n`, "utf8");
}
