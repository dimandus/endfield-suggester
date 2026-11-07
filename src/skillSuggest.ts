import { COMBO_SKILL_INDEX, comboTriggerLabel } from "./combo";
import { canonicalTag, TAG_GROUPS } from "./tags";
import type { ComboTriggerId, Skill, SkillHit, TriggerMatch } from "./types";

export type SuggestNote = { kind: "tag" | "trigger" | "hit" | "info"; text: string };

export type SkillSuggestion = {
  tags: string[];
  triggers: ComboTriggerId[];
  match: TriggerMatch;
  damage: SkillHit[];
  notes: SuggestNote[];
};

function norm(text: string) {
  return text.toLowerCase().replace(/ё/g, "е");
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

const SLOT_TAG = ["", "Боевой навык", "Комбонавык", "Супер навык"] as const;

const HIT_RULES: { re: RegExp; element: string }[] = [
  { re: /криогенн\w*\s+урн/, element: "Крио" },
  { re: /тепловой\s+урн|тепловым\s+урн/, element: "Тепло" },
  { re: /электрическ\w*\s+урн/, element: "Электро" },
  { re: /природн\w*\s+урн/, element: "Природа" },
  { re: /физическ\w*\s+урн/, element: "Физика" },
];

const APPLY_TAG_RULES: { re: RegExp; tag: string; why: string }[] = [
  { re: /последн(ий|им)\s+удар/, tag: "Последний удар", why: "в тексте есть последний удар" },
  { re: /ошеломлен/, tag: "Ошеломление", why: "навык накладывает ошеломление" },
  { re: /добивающ/, tag: "Добивание", why: "есть добивающая атака" },
  { re: /подбрасыв|подброс\w*\s+(ее|его|цель|враг)/, tag: "Подбрасывание", why: "подбрасывает врага" },
  { re: /опрокид/, tag: "Опрокидывание", why: "опрокидывает" },
  { re: /накладыва\w*\s+разгром|накладывая разгром|применяет эффект разгрома/, tag: "Разгром", why: "сам вешает разгром" },
  { re: /накладыва\w*\s+прорыв|накладывая прорыв/, tag: "Прорыв", why: "сам вешает прорыв" },
  {
    re: /накладыва\w+[^.]*поражен\w*\s+электричеств|поражение электричеством/,
    tag: "Поражение электричеством",
    why: "вешает электро-поражение",
  },
  {
    re: /накладыва\w+[^.]*поражен\w*\s+тепл|поражение теплом/,
    tag: "Поражение теплом",
    why: "вешает тепло-поражение",
  },
  {
    re: /накладыва\w+[^.]*поражен\w*\s+природ|поражение природой/,
    tag: "Поражение природой",
    why: "вешает природное поражение",
  },
  {
    re: /криогенн\w*\s+поражен|поражение крио/,
    tag: "Криогенное поражение",
    why: "вешает крио-поражение",
  },
  {
    re: /накладыва\w+[^.]*электризац|принудительно накладывая электризац|применяет.{0,40}электризац/,
    tag: "Электризация",
    why: "вешает или принудительно включает электризацию",
  },
  { re: /накладыва\w+[^.]*возгоран|принудительно.{0,20}возгоран/, tag: "Возгорание", why: "включает возгорание" },
  { re: /накладыва\w+[^.]*застыван/, tag: "Застывание", why: "вешает застывание" },
  { re: /накладыва\w+[^.]*коррози/, tag: "Коррозия", why: "вешает коррозию" },
  { re: /тепловзрыв/, tag: "Тепловзрыв", why: "тепловзрыв" },
  { re: /электровзрыв/, tag: "Электровзрыв", why: "электровзрыв" },
  { re: /криовзрыв/, tag: "Криовзрыв", why: "криовзрыв" },
  { re: /природн\w*\s+взрыв/, tag: "Природный взрыв", why: "природный взрыв" },
  { re: /усиление тепла/, tag: "Усиление тепла", why: "бафф тепла команде" },
  { re: /усиление крио/, tag: "Усиление крио", why: "бафф крио команде" },
  { re: /усиление электричеств|усиление электро/, tag: "Усиление электро", why: "бафф электро команде" },
  { re: /усиление природы/, tag: "Усиление природы", why: "бафф природы команде" },
  { re: /усиление искусств/, tag: "Усиление искусств", why: "бафф искусств" },
  { re: /щит/, tag: "Щит", why: "даёт щит" },
  { re: /лечен|восстанавливает оз|восстановление оз/, tag: "Лечение", why: "лечит" },
  {
    re: /восстанавливает (немного |много )?он|восстановление он|возвращает \d+ он|дает .{0,24}он/,
    tag: "Очки навыков",
    why: "сам возвращает ОН, не просто тратит",
  },
  {
    re: /накладыва\w+[^.]*уязвим|1 заряд уязвимости|\+\d к уровню статуса/,
    tag: "Уязвимость",
    why: "добавляет заряды уязвимости",
  },
];

const WAIT_TRIGGER_RULES: { re: RegExp; id: ComboTriggerId; why: string }[] = [
  {
    re: /комбонавык\w* другого|другого оперативника из команды|урн комбонавык/,
    id: "ally-combo",
    why: "ждёт комбо союзника",
  },
  {
    re: /исчерпал\w* эффект лечения|лечение исчерп|кристалл исчерпал/,
    id: "heal-spent",
    why: "после того как лечение кончилось",
  },
  {
    re: /заряд навыка врага|удар по управляемому|низк\w* оз|низкое оз/,
    id: "ally-pressure",
    why: "боевое условие по отряду — в калькуляторе «может быть»",
  },
  { re: /последн(ий|им)\s+удар|финишер/, id: "final-strike", why: "ждёт ваш последний удар" },
  { re: /поражение искусствами|поражен\w* искусствами/, id: "arts-infliction", why: "ждёт любое поражение искусств" },
  { re: /реакц\w* искусств/, id: "arts-reaction", why: "ждёт реакцию искусств" },
  { re: /электризац/, id: "electrification", why: "ждёт электризацию" },
  { re: /возгоран|горение/, id: "combustion", why: "ждёт горение / возгорание" },
  { re: /застыван/, id: "solidification", why: "ждёт застывание" },
  { re: /коррози/, id: "corrosion", why: "ждёт коррозию" },
  { re: /физическ\w* состоян/, id: "physical-status", why: "ждёт физ. состояние" },
  {
    re: /разгром(ом)? или прорыв|прорывом или разгром|разгром или прорыв/,
    id: "crush-or-breach",
    why: "ждёт, что уязвимость уже закрыли",
  },
  { re: /уязвим/, id: "vulnerable-stacks", why: "ждёт заряды уязвимости на враге" },
  { re: /ошеломлен/, id: "stagger", why: "ждёт ошеломление" },
  { re: /криогенн\w* поражен|поражение крио/, id: "cryo-infliction", why: "ждёт крио-поражение" },
  { re: /поражение природой|поражен\w* природ/, id: "nature-infliction", why: "ждёт природное поражение" },
  {
    re: /поражение электричеством|поражен\w* электричеств/,
    id: "electric-infliction",
    why: "ждёт электро-поражение, не обязательно электризацию",
  },
];

const APPLY_VERBS = /накладыва|применя|принудительно|дает \d|даёт \d|восстанавливает|создает щит/;
const WAIT_CUES =
  /триггер комбо|если на (цели|враге|ней|нем)|когда на (цели|враге)|поглоща(ет|я)|при наличии|на цели уже есть|на враге есть|на врага наложе/;

function triggerBlock(text: string) {
  const n = norm(text);
  const fromLine = n.match(/триггер комбо:\s*([^\n]+)/);
  const waitChunks = n.split(/(?<=[.!\n])\s+/).filter(
    (line: string) => WAIT_CUES.test(line) || /поглоща/.test(line) || /если.{0,100}поражен/.test(line),
  );
  return [fromLine?.[1] ?? "", ...waitChunks].join(" \n ");
}

function applyBlock(text: string) {
  const n = norm(text);
  return n
    .split(/\n+/)
    .filter((line: string) => !line.startsWith("триггер комбо"))
    .join("\n");
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function dropParents(tags: string[]) {
  const set = new Set(tags);
  for (const [parent, children] of Object.entries(TAG_GROUPS)) {
    if (children.some((child) => set.has(child))) set.delete(parent);
  }
  return [...set];
}

export function suggestSkill(description: string, index: number): SkillSuggestion {
  const notes: SuggestNote[] = [];
  const waitText = triggerBlock(description);
  const applyText = applyBlock(description);
  const all = norm(description);

  const tags: string[] = [];
  const slot = SLOT_TAG[index];
  if (slot) {
    tags.push(slot);
    notes.push({ kind: "tag", text: `${slot} — слот навыка ${index + 1}, ставится всегда` });
  }

  for (const rule of APPLY_TAG_RULES) {
    if (!has(applyText, rule.re)) continue;
    if (index === 0 && rule.tag === "Очки навыков") continue;
    if (waitText && has(waitText, rule.re) && !APPLY_VERBS.test(applyText)) continue;
    tags.push(rule.tag);
    notes.push({ kind: "tag", text: `${rule.tag}: ${rule.why}` });
  }

  const triggers: ComboTriggerId[] = [];
  const waitSource = index === COMBO_SKILL_INDEX ? waitText || all : waitText;
  if (waitSource.trim()) {
    for (const rule of WAIT_TRIGGER_RULES) {
      if (!has(waitSource, rule.re)) continue;
      triggers.push(rule.id);
      notes.push({
        kind: "trigger",
        text: `${comboTriggerLabel(rule.id)}: ${rule.why}`,
      });
    }
  }

  const orTrigger = / или /.test(waitSource);
  const match: TriggerMatch = orTrigger && triggers.length > 1 ? "any" : "all";
  if (match === "any") {
    notes.push({ kind: "info", text: "В триггере есть «или» — достаточно одного условия." });
  }

  const damage: SkillHit[] = [];
  for (const rule of HIT_RULES) {
    if (!has(all, rule.re)) continue;
    if (damage.some((hit) => hit.element === rule.element)) continue;
    damage.push({ element: rule.element });
    notes.push({ kind: "hit", text: `Стихия удара «${rule.element}»: в тексте этот УРН` });
  }

  if (!description.trim()) {
    notes.push({
      kind: "info",
      text: "Сначала вставьте описание навыка из игры — разбор идёт по формулировкам вроде «накладывает» и «ТРИГГЕР КОМБО».",
    });
  } else if (!tags.length && !triggers.length) {
    notes.push({
      kind: "info",
      text: "По тексту мало якорей. Теги — только то, что навык сам делает. Галочки — то, чего он ждёт.",
    });
  }

  return {
    tags: dropParents(unique(tags.map(canonicalTag).filter(Boolean))),
    triggers: unique(triggers),
    match,
    damage,
    notes,
  };
}

export function applySkillSuggestion(skill: Skill, suggestion: SkillSuggestion, index: number): Skill {
  const tags = unique([...(skill.tags ?? []), ...suggestion.tags]);
  const next: Skill = {
    ...skill,
    tags,
    damage: skill.damage?.length ? skill.damage : suggestion.damage,
  };
  if (index === COMBO_SKILL_INDEX) {
    next.comboFrom = unique([...(skill.comboFrom ?? []), ...suggestion.triggers]);
    next.comboFromMatch = suggestion.match === "any" ? "any" : skill.comboFromMatch;
  } else if (suggestion.triggers.length) {
    next.needs = unique([...(skill.needs ?? []), ...suggestion.triggers]);
    next.needsMatch = suggestion.match === "any" ? "any" : skill.needsMatch;
  }
  return next;
}
