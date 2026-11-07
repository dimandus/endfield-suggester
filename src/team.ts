import {
  displayName,
  hitsDivergeFromCanon,
  isOwned,
  operatorHitElements,
  operatorTags,
  synergyTags,
} from "./catalog";
import { rotationFor } from "./gold";
import {
  comboScore,
  comboSkill,
  comboTriggerLabel,
  evaluateCombo,
  evaluateSkillNeeds,
  hasStrictComboProvider,
  needsScore,
  normalizeComboFrom,
} from "./combo";
import {
  ARTS_INFLICT,
  CRYO_SETUP,
  HEAL_TAGS,
  PHYSICAL_APPLY,
  PHYSICAL_CONSUME,
  scoreTagPair,
  TAG_GROUPS,
} from "./tags";
import type { Entity } from "./types";

export type TeamSlotId = "slot-0" | "slot-1" | "slot-2" | "slot-3";
export type RoleSlotId = TeamSlotId;

export const TEAM_SLOTS: { id: TeamSlotId; label: string }[] = [
  { id: "slot-0", label: "Слот 1" },
  { id: "slot-1", label: "Слот 2" },
  { id: "slot-2", label: "Слот 3" },
  { id: "slot-3", label: "Слот 4" },
];
export const ROLE_SLOTS = TEAM_SLOTS;

export type TeamArchetypeId = "crush" | "electric" | "heat" | "nature" | "cryo" | "mixed";

export type TeamArchetype = {
  id: TeamArchetypeId;
  label: string;
};

export type ScoreOptions = {
  slotOne?: Entity | null;
  weapons?: Entity[];
};

export type TeamScore = {
  tagOverlap: number;
  elementOverlap: number;
  hitOverlap: number;
  pipeline: number;
  comboReady: number;
  comboTotal: number;
  needsReady: number;
  needsTotal: number;
  focusComboReady: number;
  focusComboTotal: number;
  focusNeedsReady: number;
  focusNeedsTotal: number;
  unlock: number;
  formation: number;
  weapons: number;
  archetype: TeamArchetype;
  total: number;
  raritySum: number;
};

export type LockedSlots = Partial<Record<RoleSlotId, Entity>>;

export type TeamSuggestion = {
  seed: Entity;
  locked: Entity[];
  members: Entity[];
  slots: {
    slot: (typeof ROLE_SLOTS)[number];
    operator: Entity | null;
  }[];
  missing: string[];
  sharedTags: { tag: string; kind: "exact" | "family" }[];
  why: string[];
  rotation: string[];
  slotHint?: string;
  score: TeamScore;
  archetype: TeamArchetype;
};

export function roleSlotId(_className?: string): TeamSlotId | null {
  return TEAM_SLOTS[0]?.id ?? null;
}

function hasAny(tags: Set<string>, list: readonly string[]) {
  return list.some((tag) => tags.has(tag));
}

function namedWith(members: Entity[], list: readonly string[]) {
  return members.filter((member) => hasAny(operatorTags(member), list)).map(displayName);
}

function lockedTriggerIds(member: Entity): string[] {
  const fromCombo = normalizeComboFrom(comboSkill(member)?.comboFrom);
  const fromNeeds = (member.info.skills ?? []).flatMap((skill) => normalizeComboFrom(skill.needs));
  return [...fromCombo, ...fromNeeds];
}

function focusTouches(focus: Entity[], people: Entity[]) {
  if (!focus.length) return true;
  const ids = new Set(focus.map((item) => item.id));
  return people.some((item) => ids.has(item.id));
}

export function isMainDps(entity: Entity) {
  const cls = entity.info.class;
  const rarity = entity.info.rarity ?? 0;
  if (cls === "Штурмовик") return true;
  if (cls === "Страж" && rarity >= 5) return true;
  if (cls === "Заклинатель" && rarity >= 6) return true;
  return false;
}

function isEnabler(entity: Entity) {
  return entity.info.class === "Поддержка" || entity.info.class === "Защитник";
}

function spTagCount(entity: Entity) {
  return (entity.info.skills ?? []).filter((skill) => (skill.tags ?? []).includes("Очки навыков")).length;
}

function isSpBattery(entity: Entity) {
  if (entity.info.class === "Авангард") return true;
  return spTagCount(entity) >= 2;
}

function isPureStacker(entity: Entity) {
  const tags = operatorTags(entity);
  const combo = normalizeComboFrom(comboSkill(entity)?.comboFrom);
  if (combo.includes("arts-infliction") || combo.includes("arts-reaction")) return false;
  return hasAny(tags, PHYSICAL_APPLY) && !hasAny(tags, ARTS_INFLICT) && !hasAny(tags, PHYSICAL_CONSUME);
}

function focusWantsCrush(focus: Entity[]) {
  if (!focus.length) return true;
  return focus.some((member) => {
    const ids = lockedTriggerIds(member);
    return (
      ids.includes("vulnerable-stacks") ||
      ids.includes("crush-or-breach") ||
      ids.includes("physical-status")
    );
  });
}

function consumeFamily(id: string) {
  if (id === "electrification") return "electro";
  if (id === "combustion") return "heat";
  if (id === "solidification") return "cryo";
  if (id === "corrosion") return "nature";
  return null;
}

function consumeNeedsOf(entity: Entity) {
  const ids = (entity.info.skills ?? []).flatMap((skill) => normalizeComboFrom(skill.needs));
  return new Set(
    ids.map(consumeFamily).filter((item): item is NonNullable<ReturnType<typeof consumeFamily>> => Boolean(item)),
  );
}

export function detectArchetype(members: Entity[], focus: Entity[] = []): TeamArchetype {
  const appliers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_APPLY));
  const consumers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_CONSUME));
  const split = appliers.some((applier) => consumers.some((consumer) => consumer.id !== applier.id));
  const electric = members.filter((member) => operatorTags(member).has("Поражение электричеством")).length;
  const heat = members.filter((member) => operatorTags(member).has("Поражение теплом")).length;
  const nature = members.filter((member) => operatorTags(member).has("Поражение природой")).length;
  const cryo = members.filter((member) => operatorTags(member).has("Криогенное поражение")).length;
  const crush = (split ? 2 : 0) + (members.some(isSpBattery) ? 1 : 0);
  const scores: { id: TeamArchetypeId; label: string; n: number }[] = [
    { id: "crush", label: "Физическое ядро (уязвимость → разгром/прорыв)", n: crush },
    { id: "electric", label: "Электро-керри (поражение электричеством → электризация)", n: electric },
    { id: "heat", label: "Тепловое ядро (горение / тепло-поражение)", n: heat },
    { id: "nature", label: "Природное ядро", n: nature },
    { id: "cryo", label: "Крио-ядро", n: cryo },
  ];
  const wants = new Set(focus.flatMap(lockedTriggerIds));
  if (wants.has("vulnerable-stacks") || wants.has("crush-or-breach")) scores[0].n += 1;
  if (wants.has("electric-infliction") || wants.has("electrification")) scores[1].n += 1;
  if (wants.has("combustion")) scores[2].n += 1;
  if (wants.has("corrosion") || wants.has("nature-infliction")) scores[3].n += 1;
  if (wants.has("solidification") || wants.has("cryo-infliction")) scores[4].n += 1;
  scores.sort((a, b) => b.n - a.n);
  const best = scores[0];
  const second = scores[1];
  if (!best || best.n < 2 || (second && second.n === best.n && best.n < 3)) {
    return { id: "mixed", label: "Смешанный состав" };
  }
  return { id: best.id, label: best.label };
}

function weaponScore(members: Entity[], weapons: Entity[] = []) {
  if (!weapons.length) return 0;
  const owned = weapons.filter(isOwned);
  const types = new Set(owned.map((item) => item.info.type || item.info.weaponType).filter(Boolean));
  const ids = new Set(owned.map((item) => item.id));
  let score = 0;
  for (const member of members) {
    if (member.info.weaponType && types.has(member.info.weaponType)) score += 2;
    const recommended = member.info.recommendedWeaponIds ?? [];
    if (recommended.some((id) => ids.has(id))) score += 4;
  }
  return score;
}

function wantedInflictTags(member: Entity, slotOne?: Entity | null) {
  const tags = operatorTags(member);
  const fromTags = ARTS_INFLICT.filter((tag) => tags.has(tag));
  if (member.id === "si") {
    return slotOne?.info.element === "Тепло" ? ["Поражение теплом"] : ["Криогенное поражение"];
  }
  if (isEnabler(member) && fromTags.length) return fromTags;
  const fromHits = [...new Set(operatorHitElements(member))]
    .map((element) =>
      ({
        Тепло: "Поражение теплом",
        Электро: "Поражение электричеством",
        Природа: "Поражение природой",
        Крио: "Криогенное поражение",
      })[element],
    )
    .filter((tag): tag is string => Boolean(tag));
  return fromHits.length ? fromHits : fromTags;
}

export function scoreFormation(members: Entity[], focus: Entity[] = []) {
  const carry = members.filter(isMainDps);
  const sp = members.filter(isSpBattery);
  const support = members.filter((member) => member.info.class === "Поддержка");
  const sustain = members.filter((member) => member.info.class === "Защитник");
  const focusNeedsCarry = focus.length > 0 && !focus.some(isMainDps);
  let score = 0;
  const notes: string[] = [];
  if (!carry.length) {
    score -= 48;
    notes.push("Нет главного ДД — нужен штурмовик, 5★+ страж или 6★ заклинатель.");
  } else {
    score += 16;
    notes.push(`Главный ДД: ${carry.map(displayName).join(", ")}.`);
    if (focusNeedsCarry && carry.some((member) => member.info.class === "Штурмовик")) {
      score += 12;
      notes.push("Выбрана поддержка — в добор поставлен штурмовик как керри.");
    }
  }
  if (sp.length) {
    score += 5;
    if (sp.some((member) => spTagCount(member) >= 1)) score += 3;
    notes.push(`SP: ${sp.map(displayName).join(", ")}.`);
    if (sp.length >= 2) {
      score -= 8;
      notes.push("Два SP-генератора сразу — лишний слот.");
    }
  }
  const appliers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_APPLY));
  const consumers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_CONSUME));
  const physicalCore =
    sp.length > 0 &&
    appliers.some((applier) => consumers.some((consumer) => consumer.id !== applier.id));
  if (support.length) {
    score += 5;
    notes.push(`Поддержка: ${support.map(displayName).join(", ")}.`);
  } else if (physicalCore && focusWantsCrush(focus)) {
    score += 5;
    notes.push("Физическое ядро (накопитель + разгром/прорыв + SP) вместо отдельной поддержки.");
    if (
      sp.some(
        (member) =>
          member.info.element === "Физика" || hasAny(operatorTags(member), [...PHYSICAL_APPLY, ...PHYSICAL_CONSUME]),
      )
    ) {
      score += 8;
      notes.push("SP закрывает физическое ядро (прорыв/уязвимость), а не чужую стихию.");
    }
  } else if (sustain.length) {
    notes.push(`Защитник: ${sustain.map(displayName).join(", ")}.`);
  }
  if (support.length >= 2 && !carry.length) score -= 16;
  if (support.length >= 3) score -= 10;
  return { score, notes, carry, sp, support, sustain };
}

export function scoreTeam(members: Entity[], focus: Entity[] = [], options: ScoreOptions = {}): TeamScore {
  const tags = members.map(operatorTags);
  const scoredTags = members.map(synergyTags);
  const elements = members.map((member) => member.info.element ?? "");
  const hits = members.map((member) => new Set(operatorHitElements(member)));
  const focusIds = new Set(focus.map((item) => item.id));
  const isFocus = members.map((member) => focusIds.has(member.id));
  let tagOverlap = 0;
  let elementOverlap = 0;
  let hitOverlap = 0;

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const weight = !focus.length ? 1 : isFocus[i] || isFocus[j] ? 3 : 0;
      const enablerFocus = focus.length > 0 && focus.every(isEnabler);
      const elementWeight = enablerFocus ? Math.min(weight, 1) : weight;
      tagOverlap += scoreTagPair(scoredTags[i], scoredTags[j]) * weight;
      if (elements[i] && elements[i] === elements[j]) elementOverlap += elementWeight;
      for (const element of hits[i]) {
        if (hits[j].has(element)) hitOverlap += weight;
      }
    }
  }

  const appliers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_APPLY));
  const consumers = members.filter((member) => hasAny(operatorTags(member), PHYSICAL_CONSUME));
  const splitPipeline = appliers.some((applier) =>
    consumers.some((consumer) => consumer.id !== applier.id),
  );
  const lockedWants = new Set(focus.flatMap(lockedTriggerIds));

  let pipeline = 0;
  if (splitPipeline && focusTouches(focus, [...appliers, ...consumers])) pipeline += 6;
  if (
    focus.length &&
    (lockedWants.has("vulnerable-stacks") || lockedWants.has("crush-or-breach"))
  ) {
    if (appliers.some((member) => !focusIds.has(member.id))) pipeline += 8;
    if (consumers.some((member) => !focusIds.has(member.id))) pipeline += 8;
  }
  const artsKinds = new Set(
    tags.flatMap((set) => ARTS_INFLICT.filter((tag) => set.has(tag))),
  );
  if (artsKinds.size >= 2 && (!focus.length || lockedWants.has("arts-reaction"))) pipeline += 4;
  const cryoPeople = members.filter(
    (member) => hasAny(operatorTags(member), CRYO_SETUP) || operatorTags(member).has("Криогенное поражение"),
  );
  const physicalPeople = members.filter((member) =>
    hasAny(operatorTags(member), TAG_GROUPS["Физическое состояние"] ?? []),
  );
  if (cryoPeople.length && physicalPeople.length && focusTouches(focus, [...cryoPeople, ...physicalPeople])) {
    pipeline += 5;
  }

  const fromOthers = { fromOthers: true as const };
  const others = members.filter((member) => !focusIds.has(member.id));
  const combo = comboScore(members, fromOthers);
  const needs = needsScore(members, fromOthers);
  const focusCombo = comboScore(members, { ...fromOthers, targets: focus });
  const focusNeeds = needsScore(members, { ...fromOthers, targets: focus });
  const fillerCombo = comboScore(members, { ...fromOthers, targets: others });
  const fillerNeeds = needsScore(members, { ...fromOthers, targets: others });
  let strict = 0;
  let battery = 0;
  const crushCore = splitPipeline && members.some(isPureStacker);
  for (const member of focus) {
    const providers = members.filter((item) => item.id !== member.id);
    for (const id of normalizeComboFrom(comboSkill(member)?.comboFrom)) {
      if (hasStrictComboProvider(id, providers)) strict += 4;
    }
    const hits = new Set(operatorHitElements(member));
    const wantedArts = wantedInflictTags(member, options.slotOne);
    const lockedConsume = consumeNeedsOf(member);
    for (const other of providers) {
      const tags = operatorTags(other);
      const matchingArts = wantedArts.filter((tag) => tags.has(tag));
      const otherArts = ARTS_INFLICT.filter((tag) => tags.has(tag));
      const artsWeight = crushCore && !lockedWants.has("arts-infliction") ? 1 : 3;
      if (lockedWants.has("arts-infliction")) {
        if (matchingArts.length) battery += 6;
        else if (otherArts.length) battery += 2;
      } else {
        battery += matchingArts.length * artsWeight;
      }
      if (
        (lockedWants.has("vulnerable-stacks") || hits.has("Физика")) &&
        hasAny(tags, PHYSICAL_APPLY)
      ) {
        battery += isPureStacker(other) ? 10 : 4;
      }
      if (normalizeComboFrom(comboSkill(other)?.comboFrom).includes("ally-combo")) {
        battery += 8;
      }
      if (crushCore && isSpBattery(other) && hasAny(tags, [...PHYSICAL_APPLY, ...PHYSICAL_CONSUME])) {
        battery += 6;
      }
      if (normalizeComboFrom(comboSkill(other)?.comboFrom).includes("final-strike")) {
        battery += 6;
      }
      if (
        hasAny(tags, ["Коррозия", "Поражение природой"]) &&
        (lockedWants.has("combustion") || lockedWants.has("corrosion"))
      ) {
        battery += 10;
      }
      const ampFor = {
        "Поражение теплом": "Усиление тепла",
        "Поражение электричеством": "Усиление электро",
        "Поражение природой": "Усиление природы",
        "Криогенное поражение": "Усиление крио",
      } as const;
      for (const inflict of wantedArts) {
        const amp = ampFor[inflict as keyof typeof ampFor];
        if (amp && tags.has(amp)) battery += 3;
      }
      if (tags.has("Усиление искусств")) battery += crushCore ? 1 : 2;
      if (hasAny(tags, HEAL_TAGS)) battery += crushCore ? 0 : 2;
      const otherConsume = consumeNeedsOf(other);
      for (const family of lockedConsume) {
        if (otherConsume.has(family)) battery -= 12;
      }
    }
  }
  const slotOne = options.slotOne ?? members[0];
  if (members.some((member) => member.id === "si") && slotOne && isMainDps(slotOne) && slotOne.id !== "si") {
    battery += 6;
  }
  if (!(focus.length && focus.every(isEnabler))) {
    for (const other of others) {
      if (
        (lockedWants.has("electrification") || lockedWants.has("electric-infliction")) &&
        !lockedWants.has("vulnerable-stacks") &&
        hasAny(operatorTags(other), PHYSICAL_APPLY)
      ) {
        battery -= 14;
      }
      if (crushCore && consumeNeedsOf(other).has("electro")) battery -= 12;
      if (!isMainDps(other)) continue;
      if (isPureStacker(other)) continue;
      if (hasAny(operatorTags(other), PHYSICAL_CONSUME)) {
        if (
          crushCore &&
          (other.info.rarity ?? 0) >= 6 &&
          !normalizeComboFrom(comboSkill(other)?.comboFrom).includes("ally-combo")
        ) {
          battery -= 10;
        }
        continue;
      }
      const helpsArts = wantedInflictTags(focus[0] ?? other, options.slotOne).some((tag) =>
        operatorTags(other).has(tag),
      );
      if (crushCore && focusWantsCrush(focus)) {
        battery -= 12;
        continue;
      }
      if (helpsArts) continue;
      battery -= 8;
    }
  }
  const unlock = focusCombo.points * 3 + focusNeeds.points * 3 + strict * 3 + battery;
  const formation = scoreFormation(members, focus).score;
  const weapons = weaponScore(members, options.weapons);
  const archetype = detectArchetype(members, focus);
  const archetypeBonus = archetype.id === "mixed" ? 0 : 14;
  const raritySum = members.reduce((sum, member) => sum + (member.info.rarity ?? 0), 0);
  return {
    tagOverlap,
    elementOverlap,
    hitOverlap,
    pipeline,
    comboReady: combo.ready,
    comboTotal: combo.total,
    needsReady: needs.ready,
    needsTotal: needs.total,
    focusComboReady: focusCombo.ready,
    focusComboTotal: focusCombo.total,
    focusNeedsReady: focusNeeds.ready,
    focusNeedsTotal: focusNeeds.total,
    unlock,
    formation,
    weapons,
    archetype,
    total:
      formation +
      unlock +
      tagOverlap +
      elementOverlap +
      hitOverlap +
      pipeline +
      weapons +
      archetypeBonus +
      fillerCombo.points +
      fillerNeeds.points,
    raritySum,
  };
}

export function describeSynergy(members: Entity[], focus: Entity[] = [], options: ScoreOptions = {}): string[] {
  const why: string[] = [];
  const archetype = detectArchetype(members, focus);
  why.push(`Архетип: ${archetype.label}.`);
  if (options.slotOne) {
    const heatDps = members.find((item) => item.info.element === "Тепло" && isMainDps(item) && item.id !== "si");
    if (options.slotOne.id === "si") {
      why.push("Слот 1: Си — вешает крио. Чтобы вешала тепло, переставьте теплового ДД в слот 1.");
    } else if (members.some((item) => item.id === "si") && options.slotOne.info.element === "Тепло") {
      why.push(`Слот 1: ${displayName(options.slotOne)} — Си вешает тепло и срезает откат его комбо.`);
    } else {
      why.push(`Слот 1: ${displayName(options.slotOne)}.`);
    }
    if (heatDps && options.slotOne.id === "si") {
      why.push(`Кандидат в слот 1: ${displayName(heatDps)}.`);
    }
  }
  why.push(...scoreFormation(members, focus).notes);
  if (focus.length) {
    const unlocked: string[] = [];
    const missing: string[] = [];
    for (const member of focus) {
      const others = members.filter((item) => item.id !== member.id);
      const combo = evaluateCombo(member, others);
      if (combo.status !== "unknown") {
        if (combo.status === "no") missing.push(`${displayName(member)} (${combo.summary.replace("Комбо: ", "")})`);
        else unlocked.push(`${displayName(member)} (${combo.summary.replace("Комбо: ", "")})`);
      }
      for (const skill of member.info.skills ?? []) {
        const ids = normalizeComboFrom(skill.needs);
        if (!ids.length) continue;
        const result = evaluateSkillNeeds(skill, others, member);
        const label = `${displayName(member)} «${skill.name}»`;
        if (result.status === "no") missing.push(`${label} — нет в пачке`);
        else unlocked.push(`${label} — есть в пачке`);
      }
    }
    if (unlocked.length) why.push(`Раскрывает выбранных: ${unlocked.join("; ")}.`);
    if (missing.length) why.push(`Выбранным не хватает: ${missing.join("; ")}.`);
    const direct: string[] = [];
    for (const member of focus) {
      const others = members.filter((item) => item.id !== member.id);
      for (const id of normalizeComboFrom(comboSkill(member)?.comboFrom)) {
        if (!hasStrictComboProvider(id, others)) continue;
        const names = others
          .filter((item) => hasStrictComboProvider(id, [item]))
          .map(displayName);
        if (names.length) {
          direct.push(`${displayName(member)} ← ${comboTriggerLabel(id)} от ${names.join(", ")}`);
        }
      }
    }
    if (direct.length) why.push(`Прямой триггер, не зонтик: ${direct.join("; ")}.`);
  }
  const stackers = namedWith(members, PHYSICAL_APPLY);
  const consumers = namedWith(members, PHYSICAL_CONSUME);
  if (stackers.length && consumers.length) {
    why.push(
      `${stackers.join(", ")} копит уязвимость, ${consumers.join(", ")} её закрывает Разгромом или Прорывом.`,
    );
  } else if (consumers.length && !stackers.length) {
    why.push(
      `${consumers.join(", ")} умеет закрывать уязвимость, но в отряде нет того, кто её стабильно копит.`,
    );
  }

  const inflict = namedWith(members, ARTS_INFLICT);
  const artsKinds = new Set(
    members.flatMap((member) => [...operatorTags(member)].filter((tag) => ARTS_INFLICT.includes(tag))),
  );
  if (artsKinds.size >= 2) {
    why.push(
      `Разные поражения искусств (${[...artsKinds].join(", ")}) — можно собирать реакции. Участвуют: ${inflict.join(", ")}.`,
    );
  }

  const cryo = namedWith(members, CRYO_SETUP);
  const physical = namedWith(members, TAG_GROUPS["Физическое состояние"] ?? []);
  if (cryo.length && physical.length) {
    why.push(
      `${cryo.join(", ")} готовит крио/застывание, ${physical.join(", ")} бьёт физическим статусом — связка под Осколок.`,
    );
  }

  const byCanon = new Map<string, string[]>();
  const byHit = new Map<string, string[]>();
  for (const member of members) {
    const name = displayName(member);
    const canon = member.info.element;
    if (canon) byCanon.set(canon, [...(byCanon.get(canon) ?? []), name]);
    for (const hit of operatorHitElements(member)) {
      byHit.set(hit, [...(byHit.get(hit) ?? []), name]);
    }
    if (hitsDivergeFromCanon(member)) {
      why.push(
        `${name}: канон «${canon}», удары ${operatorHitElements(member).join(" / ")}.`,
      );
    }
  }
  for (const [element, names] of byCanon) {
    if (names.length >= 2) why.push(`Канон «${element}»: ${names.join(", ")}.`);
  }
  for (const [element, names] of byHit) {
    if (names.length >= 2) why.push(`Удары «${element}»: ${names.join(", ")}.`);
  }

  const focusIds = new Set(focus.map((item) => item.id));
  const rest = members.filter((member) => !focusIds.has(member.id));
  const comboHits = rest
    .map((member) => ({
      member,
      combo: evaluateCombo(
        member,
        members.filter((item) => item.id !== member.id),
      ),
    }))
    .filter((item) => item.combo.status === "fires" || item.combo.status === "maybe");
  if (comboHits.length) {
    why.push(
      `Комбо добора: ${comboHits.map((item) => `${displayName(item.member)} (${item.combo.summary.replace("Комбо: ", "")})`).join("; ")}.`,
    );
  }
  const comboMiss = rest
    .map((member) => ({
      member,
      combo: evaluateCombo(
        member,
        members.filter((item) => item.id !== member.id),
      ),
    }))
    .filter((item) => item.combo.status === "no");
  if (comboMiss.length) {
    why.push(`Комбо добора не закроется: ${comboMiss.map((item) => displayName(item.member)).join(", ")}.`);
  }

  const needHits: string[] = [];
  const needMiss: string[] = [];
  for (const member of rest) {
    const others = members.filter((item) => item.id !== member.id);
    for (const skill of member.info.skills ?? []) {
      const ids = normalizeComboFrom(skill.needs);
      if (!ids.length) continue;
        const result = evaluateSkillNeeds(skill, others, member);
      const label = `${displayName(member)} «${skill.name}» (${ids.map(comboTriggerLabel).join(", ")})`;
      if (result.status === "no") needMiss.push(label);
      else needHits.push(label);
    }
  }
  if (needHits.length) why.push(`Ветки добора получают: ${needHits.join("; ")}.`);
  if (needMiss.length) why.push(`Ветки добора ждут, но в пачке нет: ${needMiss.join("; ")}.`);

  return why;
}

export function sharedTags(members: Entity[]): { tag: string; kind: "exact" | "family" }[] {
  const tagSets = members.map(synergyTags);
  const exactCounts = new Map<string, number>();
  for (const tags of tagSets) {
    for (const tag of tags) {
      if (TAG_GROUPS[tag] && [...tags].some((item) => TAG_GROUPS[tag].includes(item))) continue;
      exactCounts.set(tag, (exactCounts.get(tag) ?? 0) + 1);
    }
  }
  const exact = [...exactCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([tag]) => ({ tag, kind: "exact" as const }));

  const family = Object.entries(TAG_GROUPS).flatMap(([parent, children]) => {
    const inFamily = tagSets.filter(
      (tags) => tags.has(parent) || children.some((child) => tags.has(child)),
    ).length;
    if (inFamily < 2) return [];
    const sharedChild = children.some(
      (child) => tagSets.filter((tags) => tags.has(child)).length >= 2,
    );
    if (sharedChild) return [];
    return [{ tag: parent, kind: "family" as const }];
  });

  return [...exact, ...family];
}

function rarityKey(members: Entity[]): number[] {
  return members.map((member) => member.info.rarity ?? 0).sort((a, b) => b - a);
}

function compareSuggestions(a: { members: Entity[]; score: TeamScore }, b: { members: Entity[]; score: TeamScore }) {
  if (a.members.length !== b.members.length) return b.members.length - a.members.length;
  if (a.score.formation !== b.score.formation) return b.score.formation - a.score.formation;
  if (a.score.total !== b.score.total) return b.score.total - a.score.total;
  if (a.score.unlock !== b.score.unlock) return b.score.unlock - a.score.unlock;
  if (a.score.raritySum !== b.score.raritySum) return b.score.raritySum - a.score.raritySum;
  const aRanks = rarityKey(a.members);
  const bRanks = rarityKey(b.members);
  const len = Math.max(aRanks.length, bRanks.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (bRanks[i] ?? 0) - (aRanks[i] ?? 0);
    if (diff) return diff;
  }
  return displayName(a.members[0]).localeCompare(displayName(b.members[0]), "ru");
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const acc: T[] = [];
  function rec(start: number) {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    const need = k - acc.length;
    for (let i = start; i <= items.length - need; i += 1) {
      acc.push(items[i]);
      rec(i + 1);
      acc.pop();
    }
  }
  rec(0);
  return out;
}

function assignSlots(lockedBySlot: LockedSlots, extras: Entity[]): TeamSuggestion["slots"] {
  const placed: LockedSlots = { ...lockedBySlot };
  const taken = new Set(
    TEAM_SLOTS.map((slot) => placed[slot.id]?.id).filter((id): id is string => Boolean(id)),
  );
  const pool = extras.filter((item) => !taken.has(item.id));
  const everyone = [
    ...TEAM_SLOTS.map((slot) => placed[slot.id]).filter((item): item is Entity => Boolean(item)),
    ...pool,
  ];
  if (!placed["slot-0"]) {
    const hasSi = everyone.some((item) => item.id === "si");
    const heatDps = everyone.find((item) => item.info.element === "Тепло" && isMainDps(item));
    const anyDps = everyone.find(isMainDps);
    const pick = hasSi && heatDps && heatDps.id !== "si" ? heatDps : anyDps;
    if (pick && !taken.has(pick.id)) {
      placed["slot-0"] = pick;
      taken.add(pick.id);
    }
  }
  const leftover = everyone
    .filter((item) => !taken.has(item.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "ru"));
  let index = 0;
  for (const slot of TEAM_SLOTS) {
    if (placed[slot.id]) continue;
    placed[slot.id] = leftover[index++];
  }
  return TEAM_SLOTS.map((slot) => ({ slot, operator: placed[slot.id] ?? null }));
}

function packSuggestion(
  locked: Entity[],
  slots: TeamSuggestion["slots"],
  weapons: Entity[] = [],
): TeamSuggestion {
  const members = slots.map((item) => item.operator).filter((item): item is Entity => item !== null);
  const seed = locked[0] ?? members[0];
  const slotOne = slots[0]?.operator ?? null;
  const options = { slotOne, weapons };
  const score = scoreTeam(members, locked, options);
  const rotation = rotationFor(members);
  return {
    seed,
    locked,
    members,
    slots,
    missing: slots.filter((item) => !item.operator).map((item) => item.slot.label),
    sharedTags: sharedTags(members),
    why: describeSynergy(members, locked, options),
    rotation: rotation.steps,
    slotHint: rotation.hint,
    score,
    archetype: score.archetype,
  };
}

export function suggestCompletions(
  operators: Entity[],
  lockedBySlot: LockedSlots,
  limit = 4,
  weapons: Entity[] = [],
  excludedIds: string[] = [],
): TeamSuggestion[] {
  const locked = TEAM_SLOTS.map((slot) => lockedBySlot[slot.id]).filter(
    (item): item is Entity => Boolean(item),
  );
  if (!locked.length) return [];

  const lockedIds = new Set(locked.map((item) => item.id));
  const banned = new Set(excludedIds);
  const emptySlots = TEAM_SLOTS.filter((slot) => !lockedBySlot[slot.id]);
  const pool = operators.filter((operator) => !lockedIds.has(operator.id) && !banned.has(operator.id));
  const pickSets = combinations(pool, emptySlots.length);

  const unique = new Map<string, TeamSuggestion>();
  for (const extras of pickSets) {
    const slots = assignSlots(lockedBySlot, extras);
    const suggestion = packSuggestion(locked, slots, weapons);
    const key = teamKey(suggestion.members);
    const current = unique.get(key);
    if (!current || compareSuggestions(suggestion, current) < 0) unique.set(key, suggestion);
  }

  if (!unique.size) {
    const slots = assignSlots(lockedBySlot, []);
    return [packSuggestion(locked, slots, weapons)];
  }

  const sorted = [...unique.values()].sort(compareSuggestions);
  const picked: TeamSuggestion[] = [];
  const seenArch = new Set<string>();
  for (const suggestion of sorted) {
    if (picked.length >= limit) break;
    if (seenArch.has(suggestion.archetype.id)) continue;
    picked.push(suggestion);
    seenArch.add(suggestion.archetype.id);
  }
  for (const suggestion of sorted) {
    if (picked.length >= limit) break;
    if (!picked.includes(suggestion)) picked.push(suggestion);
  }
  return picked;
}

export function completeTeam(operators: Entity[], lockedBySlot: LockedSlots): TeamSuggestion | null {
  return suggestCompletions(operators, lockedBySlot, 1)[0] ?? null;
}

export function suggestTeam(operators: Entity[], seedId: string): TeamSuggestion | null {
  const seed = operators.find((operator) => operator.id === seedId);
  if (!seed) return null;
  return completeTeam(operators, { "slot-0": seed });
}

function teamKey(members: Entity[]) {
  return members
    .map((member) => member.id)
    .sort()
    .join("|");
}

export function ownedRoster(operators: Entity[]) {
  return operators.filter(isOwned);
}

export function suggestRosterTeams(
  operators: Entity[],
  seedId?: string | null,
  limit = 5,
): TeamSuggestion[] {
  const roster = ownedRoster(operators);
  const featured = seedId ? suggestTeam(roster, seedId) : null;
  const unique = new Map<string, TeamSuggestion>();
  if (featured) unique.set(teamKey(featured.members), featured);

  for (const seed of roster) {
    if (seedId && seed.id === seedId) continue;
    const suggestion = suggestTeam(roster, seed.id);
    if (!suggestion) continue;
    const key = teamKey(suggestion.members);
    const current = unique.get(key);
    if (!current || compareSuggestions(suggestion, current) < 0) unique.set(key, suggestion);
  }

  return [...unique.values()].sort(compareSuggestions).slice(0, limit);
}
