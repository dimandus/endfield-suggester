import { displayName, operatorTags } from "./catalog";
import { comboSkill, normalizeComboFrom } from "./combo";
import { PHYSICAL_APPLY, PHYSICAL_CONSUME } from "./tags";
import type { Entity } from "./types";

export type GoldTeam = {
  id: string;
  seed: string;
  names: string[];
  archetype: "crush" | "electric" | "heat" | "nature" | "cryo" | "mixed";
  source: string;
  slotHint?: string;
  rotation: string[];
  check?: boolean;
  exclude?: string[];
};

export const GOLD_TEAMS: GoldTeam[] = [
  {
    id: "levateyn-heat",
    seed: "Лэватейн",
    names: ["Лэватейн", "Камиль", "Вулфгард", "Арделия"],
    archetype: "heat",
    check: true,
    source: "Prydwen / Game8 Laevatain Hypercarry (Camille + Wulfgard)",
    slotHint: "Слот 1 — Лэватейн: она на поле копит Плаващий огонь последним ударом.",
    rotation: [
      "Вулфгард: боевой — первое поражение теплом",
      "Вулфгард: комбо — второе поражение теплом",
      "Камиль: боевой — третье поражение теплом",
      "Лэватейн: последний удар — снимает 3 заряда Плаващего огня",
      "Арделия: комбо — коррозия (триггер комбо Лэватейн)",
      "Лэватейн: комбо — 4-й заряд Плаващего огня",
      "Камиль: комбо (связь), затем Лэватейн: усиленный боевой",
    ],
  },
  {
    id: "levateyn-heat-si",
    seed: "Лэватейн",
    names: ["Лэватейн", "Камиль", "Вулфгард", "Си"],
    archetype: "heat",
    check: true,
    exclude: ["Арделия"],
    source: "Тот же тепловой костяк, 4-й слот Си вместо Арделии",
    slotHint: "Слот 1 — Лэватейн, чтобы Си вешала тепло и резала откат её комбо.",
    rotation: [
      "Вулфгард: боевой и комбо — два поражения теплом",
      "Камиль: боевой — третье поражение теплом",
      "Лэватейн: последний удар — снимает Плаващий огонь",
      "Си: ульта на усиление тепла, если готова",
      "Лэватейн: комбо, затем усиленный боевой",
    ],
  },
  {
    id: "zhuang-flex",
    seed: "Чжуан Фанъи",
    names: ["Чжуан Фанъи", "Перлика", "Арклайт", "Антал"],
    archetype: "electric",
    check: true,
    exclude: ["Лиино"],
    source: "Game8 Electric Flex",
    slotHint: "В меню поставьте Перлику левее Чжуан Фанъи — её комбо должно вспыхнуть первым.",
    rotation: [
      "Антал: боевой — фокус и восприимчивость",
      "Чжуан Фанъи: ульта, затем боевой (лезвия)",
      "Антал: комбо",
      "Чжуан Фанъи: последний удар → комбо Перлики (электризация)",
      "Арклайт: боевой (ест электризацию, даёт ОН)",
      "Чжуан Фанъи: комбо → комбо Арклайт → снова боевой Чжуан Фанъи",
      "Повторять, пока не будет 9 рассекающих лезвий",
    ],
  },
  {
    id: "zhuang-liino",
    seed: "Чжуан Фанъи",
    names: ["Чжуан Фанъи", "Перлика", "Арклайт", "Лиино"],
    archetype: "electric",
    check: true,
    source: "Icy Veins / Mobalytics sustain flex",
    slotHint: "Перлика левее Чжуан Фанъи в слотах.",
    rotation: [
      "Чжуан Фанъи: ульта и боевой",
      "Последний удар → комбо Перлики",
      "Арклайт: боевой и комбо — петля ОН",
      "Лиино: лечение / щит, когда пачка под ударом",
      "Чжуан Фанъи: комбо и снова боевой под электризацией",
    ],
  },
  {
    id: "zhuang-dual",
    seed: "Чжуан Фанъи",
    names: ["Чжуан Фанъи", "Перлика", "Арклайт", "Авивенна"],
    archetype: "electric",
    source: "Game8 Electric Dual DPS",
    slotHint: "Перлика левее Чжуан Фанъи. ОН в первую очередь на Чжуан Фанъи, не на Авивенну.",
    rotation: [
      "Арклайт: ульта — электризация",
      "Чжуан Фанъи: БА до последнего удара → комбо Перлики и Авивенны",
      "Чжуан Фанъи: боевой под электризацией (лезвия)",
      "Авивенна копит громокопья, боевой — когда комбо уже прошло дважды",
      "Чжуан Фанъи: комбо и боевой, пока не будет 9 лезвий",
    ],
  },
  {
    id: "mi-fu-physical",
    seed: "Ми Фу",
    names: ["Ми Фу", "Чэнь Цяньюй", "Пограничник", "Лифэн"],
    archetype: "crush",
    check: true,
    source: "Game8 / Mobalytics Mono-Physical",
    slotHint: "Слот 1 — Ми Фу или Чэнь, кто сейчас копит/закрывает уязвимость на поле.",
    rotation: [
      "Лифэн: боевой — опрокид / восприимчивость",
      "Чэнь: комбо и боевой — стеки уязвимости",
      "Лифэн: комбо (связь)",
      "Ми Фу: комбо и ульта",
      "Пограничник: боевой на 4 стеках — прорыв",
      "Пограничник: ульта и комбо",
      "Ми Фу: 2-й приём боевого, затем 3-й — разгром под прорывом",
    ],
  },
  {
    id: "mi-fu-shatter",
    seed: "Ми Фу",
    names: ["Ми Фу", "Чэнь Цяньюй", "Алеш", "Эстелла"],
    archetype: "cryo",
    source: "Game8 Mi Fu Shatter",
    rotation: [
      "Эстелла: крио / восприимчивость",
      "Чэнь: комбо и боевой — уязвимость",
      "Алеш: ОН и крио-петля",
      "Ми Фу: комбо, затем 2-й и 3-й приём разгрома",
    ],
  },
  {
    id: "yvonne-solidify",
    seed: "Ивонна",
    names: ["Ивонна", "Тантан", "Гилберта", "Сайхи"],
    archetype: "cryo",
    check: true,
    source: "Game8 Yvonne Solidification",
    slotHint: "Слот 1 — Ивонна: на поле она ставит застывание и крутит ульту.",
    rotation: [
      "Сайхи и Гилберта: боевые — крио/природа и лечение",
      "Ивонна: последний удар, затем боевой — принудительное застывание",
      "Гилберта: комбо — подброс по застыванию",
      "Ивонна: комбо — снова застывание",
      "Тантан: комбо и боевой — воронки и восприимчивость",
      "Тантан: ульта, затем Ивонна: ульта и удар с воздуха",
    ],
  },
  {
    id: "gilberta-yvonne",
    seed: "Гилберта",
    names: ["Гилберта", "Ивонна", "Тантан", "Сайхи"],
    archetype: "cryo",
    check: true,
    source: "Game8 Gilberta Cryo-Nature / Yvonne",
    rotation: [
      "Гилберта: боевой — природа и стяжка",
      "Тантан: крио-поражение",
      "Ивонна: боевой — застывание, комбо и ульта",
      "Сайхи: усиление крио/природы и лечение",
    ],
  },
  {
    id: "camille-laevatain",
    seed: "Камиль",
    names: ["Камиль", "Лэватейн", "Вулфгард", "Арделия"],
    archetype: "heat",
    check: true,
    source: "Icy Veins / Game8 Camille + Laevatain",
    slotHint: "Слот 1 — Лэватейн, Камиль с поля вешает тепло и даёт связь.",
    rotation: [
      "Камиль: боевой — поражение теплом",
      "Вулфгард: боевой и комбо — ещё тепло",
      "Лэватейн: последний удар — снимает тепло",
      "Арделия: комбо — коррозия",
      "Камиль: комбо — связь, затем Лэватейн: комбо и усиленный боевой",
    ],
  },
  {
    id: "rossi-combustion-crush",
    seed: "Росси",
    names: ["Росси", "Камиль", "Ми Фу", "Гилберта"],
    archetype: "crush",
    check: true,
    source: "Game8 / Icy Veins Combustion Crush",
    rotation: [
      "Камиль: боевой — тепло для комбо Росси",
      "Гилберта: боевой и комбо — природа и уязвимость",
      "Росси: комбо и боевой — стеки уязвимости",
      "Ми Фу: комбо и разгром",
    ],
  },
  {
    id: "rossi-wulfgard-crush",
    seed: "Росси",
    names: ["Росси", "Вулфгард", "Ми Фу", "Пограничник"],
    archetype: "crush",
    source: "Game8-вариант: Вулфгард и Пограничник вместо Камиля и Гилберты",
    rotation: [
      "Вулфгард: тепло-поражение",
      "Росси: комбо по уязвимости и поражению",
      "Пограничник: ОН и прорыв",
      "Ми Фу: разгром",
    ],
  },
];

export function namesKey(names: string[]) {
  return [...names].sort((a, b) => a.localeCompare(b, "ru")).join("|");
}

export function findGoldTeam(members: Entity[]): GoldTeam | undefined {
  const key = namesKey(members.map(displayName));
  return GOLD_TEAMS.find((team) => namesKey(team.names) === key);
}

function has(tags: Set<string>, list: readonly string[]) {
  return list.some((tag) => tags.has(tag));
}

export function fallbackRotation(members: Entity[]): string[] {
  const steps: string[] = [];
  const inflict = members.filter((member) =>
    [...operatorTags(member)].some((tag) => tag.startsWith("Поражение") || tag === "Криогенное поражение"),
  );
  const stackers = members.filter((member) => has(operatorTags(member), PHYSICAL_APPLY));
  const consumers = members.filter((member) => has(operatorTags(member), PHYSICAL_CONSUME));
  const carry = members.find((member) => member.info.class === "Штурмовик") ?? members[0];
  if (carry) steps.push(`${displayName(carry)} на поле: БА до последнего удара.`);
  for (const member of inflict) {
    if (member.id === carry?.id) continue;
    steps.push(`${displayName(member)}: боевой / комбо — повесить поражение.`);
  }
  for (const member of stackers) {
    if (member.id === carry?.id) continue;
    steps.push(`${displayName(member)}: копить уязвимость (подброс / опрокид).`);
  }
  for (const member of members) {
    const from = normalizeComboFrom(comboSkill(member)?.comboFrom);
    if (from.includes("final-strike")) {
      steps.push(`Последний удар → комбо ${displayName(member)}.`);
    }
  }
  for (const member of consumers) {
    steps.push(`${displayName(member)}: закрыть уязвимость разгромом / прорывом.`);
  }
  if (carry) steps.push(`${displayName(carry)}: комбо, затем боевой / ульта.`);
  return [...new Set(steps)];
}

export function rotationFor(members: Entity[]): { steps: string[]; hint?: string; source?: string } {
  const gold = findGoldTeam(members);
  if (gold) return { steps: gold.rotation, hint: gold.slotHint, source: gold.source };
  return { steps: fallbackRotation(members) };
}
