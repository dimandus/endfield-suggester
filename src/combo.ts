import { displayName, operatorTags } from "./catalog";
import {
  ARTS_INFLICT,
  CRYO_SETUP,
  PHYSICAL_APPLY,
  PHYSICAL_CONSUME,
  TAG_GROUPS,
} from "./tags";
import type { ComboTriggerId, Entity, Skill, TriggerMatch } from "./types";

export const COMBO_SKILL_INDEX = 2;

export const COMBO_TRIGGERS: { id: ComboTriggerId; label: string; hint: string }[] = [
  { id: "final-strike", label: "Последний удар", hint: "Финишер контролируемого оперативника" },
  { id: "arts-infliction", label: "Поражение искусствами", hint: "Кто-то вешает тепло / электро / природу / крио" },
  { id: "arts-reaction", label: "Реакция искусств", hint: "Две разные стихии поражения или готовая реакция" },
  { id: "electrification", label: "Электризация", hint: "Электро-поражение или тег электризации" },
  { id: "combustion", label: "Горение", hint: "Тепло-поражение или тепловзрыв / возгорание" },
  { id: "solidification", label: "Застывание", hint: "Крио-поражение или застывание" },
  { id: "corrosion", label: "Коррозия", hint: "Природное поражение или коррозия" },
  { id: "physical-status", label: "Физическое состояние", hint: "Подброс, опрокид, разгром или прорыв" },
  { id: "vulnerable-stacks", label: "Накопление уязвимости", hint: "В пачке есть кто копит стеки" },
  { id: "crush-or-breach", label: "Разгром или Прорыв", hint: "Кто-то закрывает уязвимость" },
  { id: "stagger", label: "Ошеломление", hint: "Тег ошеломления в пачке" },
  {
    id: "cryo-infliction",
    label: "Криогенное поражение",
    hint: "Кто-то вешает крио-поражение, не обязательно застывание",
  },
  {
    id: "nature-infliction",
    label: "Поражение природой",
    hint: "Кто-то вешает природное поражение, не взрыв и не коррозию",
  },
  {
    id: "electric-infliction",
    label: "Поражение электричеством",
    hint: "Кто-то вешает электро-поражение, не обязательно электризацию",
  },
  {
    id: "ally-combo",
    label: "Комбо союзника",
    hint: "Срабатывает, когда другой оперативник в пачке даёт комбо-урон",
  },
  {
    id: "ally-pressure",
    label: "Удар по отряду",
    hint: "Вражеский заряд, удар по управляемому или низкое ОЗ — решается в бою",
  },
  {
    id: "heal-spent",
    label: "Лечение исчерпано",
    hint: "После того как эффект лечения с навыка закончился",
  },
];

export const STRICT_COMBO_TAGS: Partial<Record<ComboTriggerId, readonly string[]>> = {
  combustion: ["Возгорание", "Тепловзрыв"],
  solidification: ["Застывание", "Криовзрыв"],
  corrosion: ["Коррозия", "Природный взрыв"],
  electrification: ["Электризация", "Электровзрыв"],
};

const ARTS_REACTION_TAGS = [
  "Реакция искусств",
  "Тепловзрыв",
  "Возгорание",
  "Электровзрыв",
  "Электризация",
  "Криовзрыв",
  "Застывание",
  "Природный взрыв",
  "Коррозия",
];

export const SKILL_LEGENDS = [
  "Навык 1 · Базовая атака",
  "Навык 2 · Боевой навык",
  "Навык 3 · Комбо",
  "Навык 4 · Ульта",
];

export type ComboVerdict = "fires" | "maybe" | "no" | "unknown";

export type ComboResult = {
  status: ComboVerdict;
  summary: string;
  details: string[];
};

export function comboTriggerLabel(id: string) {
  return COMBO_TRIGGERS.find((item) => item.id === id)?.label ?? id;
}

export function normalizeComboFrom(value?: string[]): ComboTriggerId[] {
  const allowed = new Set(COMBO_TRIGGERS.map((item) => item.id));
  return [...new Set(value ?? [])].filter((id): id is ComboTriggerId => allowed.has(id as ComboTriggerId));
}

export function normalizeTriggerMatch(value?: string): TriggerMatch {
  return value === "any" ? "any" : "all";
}

export function comboSkill(entity: Entity): Skill | undefined {
  return entity.info.skills?.[COMBO_SKILL_INDEX];
}

function namedWithTags(members: Entity[], list: readonly string[]) {
  return members.filter((member) => list.some((tag) => operatorTags(member).has(tag))).map(displayName);
}

function artsKinds(members: Entity[]) {
  return new Set(members.flatMap((member) => ARTS_INFLICT.filter((tag) => operatorTags(member).has(tag))));
}

function checkTrigger(
  id: ComboTriggerId,
  members: Entity[],
): { ok: "yes" | "maybe" | "no"; detail: string } {
  switch (id) {
    case "final-strike":
      return {
        ok: "maybe",
        detail: "финишер делает контролируемый оперативник — в бою это вы",
      };
    case "arts-infliction": {
      const names = namedWithTags(members, ARTS_INFLICT);
      return names.length
        ? { ok: "yes", detail: `вешают ${names.join(", ")}` }
        : { ok: "no", detail: "никто не вешает поражение искусствами" };
    }
    case "arts-reaction": {
      const kinds = artsKinds(members);
      const named = namedWithTags(members, ARTS_REACTION_TAGS);
      if (kinds.size >= 2) {
        return { ok: "yes", detail: `разные поражения: ${[...kinds].join(", ")}` };
      }
      if (named.length) {
        return { ok: "yes", detail: `реакцию дают ${named.join(", ")}` };
      }
      return { ok: "no", detail: "нет двух стихий поражения и нет готовой реакции" };
    }
    case "electrification": {
      const names = namedWithTags(members, ["Электризация", "Поражение электричеством", "Электровзрыв"]);
      return names.length
        ? { ok: "yes", detail: `электро дают ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке нет электризации и электро-поражения" };
    }
    case "combustion": {
      const names = namedWithTags(members, ["Возгорание", "Тепловзрыв", "Поражение теплом"]);
      return names.length
        ? { ok: "yes", detail: `тепло дают ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке нет горения и тепло-поражения" };
    }
    case "solidification": {
      const names = namedWithTags(members, [...CRYO_SETUP, "Застывание", "Криовзрыв"]);
      return names.length
        ? { ok: "yes", detail: `крио/застывание: ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке нет застывания и крио-поражения" };
    }
    case "corrosion": {
      const names = namedWithTags(members, ["Коррозия", "Поражение природой", "Природный взрыв"]);
      return names.length
        ? { ok: "yes", detail: `природу дают ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке нет коррозии и природного поражения" };
    }
    case "physical-status": {
      const names = namedWithTags(members, TAG_GROUPS["Физическое состояние"] ?? []);
      return names.length
        ? { ok: "yes", detail: `физический статус: ${names.join(", ")}` }
        : { ok: "no", detail: "никто не вешает физическое состояние" };
    }
    case "vulnerable-stacks": {
      const names = namedWithTags(members, PHYSICAL_APPLY);
      return names.length
        ? { ok: "yes", detail: `стеки копят ${names.join(", ")}` }
        : { ok: "no", detail: "нет накопителя уязвимости (подброс / опрокид)" };
    }
    case "crush-or-breach": {
      const names = namedWithTags(members, PHYSICAL_CONSUME);
      return names.length
        ? { ok: "yes", detail: `закрывают ${names.join(", ")}` }
        : { ok: "no", detail: "нет Разгрома и Прорыва" };
    }
    case "stagger": {
      const names = namedWithTags(members, ["Ошеломление"]);
      return names.length
        ? { ok: "yes", detail: `ошеломление: ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке нет ошеломления" };
    }
    case "cryo-infliction": {
      const names = namedWithTags(members, ["Криогенное поражение"]);
      return names.length
        ? { ok: "yes", detail: `крио-поражение: ${names.join(", ")}` }
        : { ok: "no", detail: "никто не вешает криогенное поражение" };
    }
    case "nature-infliction": {
      const names = namedWithTags(members, ["Поражение природой"]);
      return names.length
        ? { ok: "yes", detail: `природу вешают ${names.join(", ")}` }
        : { ok: "no", detail: "никто не вешает поражение природой" };
    }
    case "ally-combo": {
      const names = members
        .filter((member) => {
          const ids = normalizeComboFrom(comboSkill(member)?.comboFrom);
          return ids.some((id) => id !== "ally-combo");
        })
        .map(displayName);
      return names.length
        ? { ok: "yes", detail: `комбо союзников: ${names.join(", ")}` }
        : { ok: "no", detail: "в пачке больше никто не закрывает своё комбо" };
    }
    case "ally-pressure":
      return {
        ok: "maybe",
        detail: "в бою: заряд навыка врага, удар по управляемому или низкое ОЗ",
      };
    case "heal-spent":
      return {
        ok: "maybe",
        detail: "после того как лечение с боевого навыка исчерпалось",
      };
    case "electric-infliction": {
      const names = namedWithTags(members, ["Поражение электричеством"]);
      const copiers = members
        .filter(
          (member) =>
            member.info.element === "Электро" && operatorTags(member).has("Поражение искусствами"),
        )
        .map(displayName);
      const all = [...new Set([...names, ...copiers])];
      return all.length
        ? { ok: "yes", detail: `электро-поражение: ${all.join(", ")}` }
        : { ok: "no", detail: "никто не вешает поражение электричеством" };
    }
    default:
      return { ok: "no", detail: "неизвестное условие" };
  }
}

function evaluateTriggerList(
  ids: ComboTriggerId[],
  team: Entity[],
  labels: { empty: string; emptyHint: string; fires: string; maybe: string; no: string },
  match: TriggerMatch = "all",
): ComboResult {
  if (!ids.length) {
    return { status: "unknown", summary: labels.empty, details: [labels.emptyHint] };
  }

  const checks = ids.map((id) => {
    const result = checkTrigger(id, team);
    return { id, label: comboTriggerLabel(id), ...result };
  });

  const hasYes = checks.some((item) => item.ok === "yes");
  const hasNo = checks.some((item) => item.ok === "no");
  const hasMaybe = checks.some((item) => item.ok === "maybe");
  const status: ComboVerdict =
    match === "any"
      ? hasYes
        ? "fires"
        : hasMaybe
          ? "maybe"
          : "no"
      : hasNo
        ? "no"
        : hasMaybe
          ? "maybe"
          : "fires";
  const summary =
    status === "fires" ? labels.fires : status === "maybe" ? labels.maybe : labels.no;

  return {
    status,
    summary,
    details: checks.map((item) => {
      const mark = item.ok === "no" ? "нет" : item.ok === "maybe" ? "вами" : "да";
      return `${item.label} (${mark}): ${item.detail}`;
    }),
  };
}

export function evaluateCombo(operator: Entity, team: Entity[]): ComboResult {
  const skill = comboSkill(operator);
  const ids = normalizeComboFrom(skill?.comboFrom);
  const match = normalizeTriggerMatch(skill?.comboFromMatch);
  const labels = {
    empty: "Комбо: условие не указано",
    emptyHint: "В редакторе у навыка 3 задайте «Срабатывает от».",
    fires: "Комбо: сработает",
    maybe: "Комбо: если бьёте финишером",
    no: "Комбо: не сработает",
  };
  const fromTeam = evaluateTriggerList(ids, team, labels, match);
  if (fromTeam.status === "fires" || fromTeam.status === "unknown") return fromTeam;
  const fromSelf = evaluateTriggerList(ids, [operator], labels, match);
  if (fromSelf.status === "fires") {
    return {
      status: "fires",
      summary: labels.fires,
      details: ["сам закрывает условие комбо", ...fromSelf.details],
    };
  }
  return fromTeam;
}

export function evaluateSkillNeeds(
  skill: Skill | undefined,
  team: Entity[],
  self?: Entity,
): ComboResult {
  const labels = {
    empty: "Ждёт: не задано",
    emptyHint: "",
    fires: "Ждёт: есть в пачке",
    maybe: "Ждёт: если бьёте финишером",
    no: "Ждёт: нет в пачке",
  };
  const fromTeam = evaluateTriggerList(
    normalizeComboFrom(skill?.needs),
    team,
    labels,
    normalizeTriggerMatch(skill?.needsMatch),
  );
  if (fromTeam.status === "fires" || fromTeam.status === "unknown" || !self) return fromTeam;
  const fromSelf = evaluateTriggerList(
    normalizeComboFrom(skill?.needs),
    [self],
    labels,
    normalizeTriggerMatch(skill?.needsMatch),
  );
  if (fromSelf.status === "fires") {
    return {
      status: "maybe",
      summary: "Ждёт: сам наберёт в ротации",
      details: fromSelf.details,
    };
  }
  return fromTeam;
}

function scoreResults(results: ComboResult[]) {
  let ready = 0;
  let total = 0;
  let points = 0;
  for (const result of results) {
    if (result.status === "unknown") continue;
    total += 1;
    if (result.status === "fires") {
      ready += 1;
      points += 4;
    } else if (result.status === "maybe") {
      ready += 1;
      points += 2;
    }
  }
  return { ready, total, points };
}

function providersFor(member: Entity, members: Entity[], fromOthers: boolean) {
  return fromOthers ? members.filter((item) => item.id !== member.id) : members;
}

export function hasStrictComboProvider(id: ComboTriggerId, members: Entity[]) {
  const tags = STRICT_COMBO_TAGS[id];
  if (!tags?.length) return false;
  return namedWithTags(members, tags).length > 0;
}

export function comboScore(
  members: Entity[],
  options?: { targets?: Entity[]; fromOthers?: boolean },
) {
  const targets = options?.targets ?? members;
  const fromOthers = options?.fromOthers ?? false;
  return scoreResults(
    targets.map((member) => evaluateCombo(member, providersFor(member, members, fromOthers))),
  );
}

export function needsScore(
  members: Entity[],
  options?: { targets?: Entity[]; fromOthers?: boolean },
) {
  const targets = options?.targets ?? members;
  const fromOthers = options?.fromOthers ?? false;
  const results: ComboResult[] = [];
  for (const member of targets) {
    const providers = providersFor(member, members, fromOthers);
    for (const skill of member.info.skills ?? []) {
      if (!normalizeComboFrom(skill.needs).length) continue;
      results.push(evaluateSkillNeeds(skill, providers, fromOthers ? member : undefined));
    }
  }
  return scoreResults(results);
}
