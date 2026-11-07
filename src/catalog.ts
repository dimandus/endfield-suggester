import { canonicalTag, canonicalTagSet, SYNERGY_SKIP_TAGS } from "./tags";
import type { Entity, EntityInfo, OperatorStats, Rank, Skill, SkillHit, StatId } from "./types";

export const STATS: { id: StatId; label: string }[] = [
  { id: "strength", label: "Сила" },
  { id: "agility", label: "Ловкость" },
  { id: "intellect", label: "Интеллект" },
  { id: "will", label: "Воля" },
];

export const RANKS: Rank[] = [3, 4, 5, 6];

export const ELEMENTS = ["Физика", "Тепло", "Природа", "Электро", "Крио", "Эфир"] as const;

export const CLASSES = [
  "Страж",
  "Заклинатель",
  "Штурмовик",
  "Авангард",
  "Защитник",
  "Поддержка",
] as const;

export const WEAPON_TYPES = [
  "Меч",
  "Модуль искусств",
  "Двуручный меч",
  "Древковое оружие",
  "Пушка",
] as const;

const ELEMENT_ALIASES: Record<string, string> = {
  Физическая: "Физика",
};

const WEAPON_TYPE_ALIASES: Record<string, string> = {
  Артефакт: "Модуль искусств",
  Древковое: "Древковое оружие",
  Пистолет: "Пушка",
};

export function statLabel(id?: string) {
  return STATS.find((stat) => stat.id === id)?.label ?? id ?? "";
}

export function rankLabel(rank?: number | null) {
  return rank ? `${rank}★` : "";
}

export function emptySkills(): Skill[] {
  return Array.from({ length: 4 }, () => ({
    name: "",
    description: "",
    tags: [],
    needs: [],
    damage: [],
  }));
}

export function normalizeSkillHits(hits?: SkillHit[]): SkillHit[] {
  const seen = new Set<string>();
  const next: SkillHit[] = [];
  for (const hit of hits ?? []) {
    const mapped = hit.element ? (ELEMENT_ALIASES[hit.element] ?? hit.element) : "";
    if (!ELEMENTS.includes(mapped as (typeof ELEMENTS)[number])) continue;
    const when = hit.when?.trim() || undefined;
    const key = `${mapped}\0${when ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(when ? { element: mapped, when } : { element: mapped });
  }
  return next;
}

export function padSkills(skills?: Skill[]): Skill[] {
  const next = emptySkills();
  (skills ?? []).slice(0, 4).forEach((skill, index) => {
    next[index] = {
      name: skill.name ?? "",
      description: skill.description ?? "",
      tags: (skill.tags ?? []).map(canonicalTag),
      comboFrom: index === 2 ? [...(skill.comboFrom ?? [])] : undefined,
      comboFromMatch:
        index === 2 && skill.comboFromMatch === "any" ? "any" : undefined,
      needs: (skill.needs ?? []).length ? [...(skill.needs ?? [])] : undefined,
      needsMatch: skill.needsMatch === "any" ? "any" : undefined,
      damage: normalizeSkillHits(skill.damage),
    };
  });
  return next;
}

export function skillHitElements(skill?: Skill): string[] {
  return [...new Set((skill?.damage ?? []).map((hit) => hit.element))];
}

export function operatorHitElements(entity: { info: EntityInfo }): string[] {
  const elements = new Set<string>();
  for (const skill of entity.info.skills ?? []) {
    for (const element of skillHitElements(skill)) elements.add(element);
  }
  return [...elements];
}

export function hitsDivergeFromCanon(entity: { info: EntityInfo }): boolean {
  const canon = entity.info.element;
  const hits = operatorHitElements(entity);
  if (!hits.length) return false;
  return hits.length > 1 || hits[0] !== canon;
}

export function operatorElementLine(entity: Entity, kind: "operators" | "weapons"): string {
  if (kind !== "operators") {
    return [entity.info.type, ...(entity.info.tags ?? [])].filter(Boolean).join(" · ");
  }
  const canon = entity.info.element;
  const hits = operatorHitElements(entity);
  const head = [entity.info.class, canon, entity.info.weaponType].filter(Boolean).join(" · ");
  if (!hits.length || !hitsDivergeFromCanon(entity)) return head;
  return `${head} · удары ${hits.join(" / ")}`;
}

export function displayName(entity: { id: string; info: EntityInfo }) {
  return entity.info.nameRu || entity.info.name || entity.id;
}

export function normalizeStats(stats?: OperatorStats): { primary: StatId; secondary: StatId } {
  const ids = STATS.map((stat) => stat.id);
  let primary = ids.includes(stats?.primary as StatId) ? (stats?.primary as StatId) : "strength";
  let secondary = ids.includes(stats?.secondary as StatId)
    ? (stats?.secondary as StatId)
    : "agility";
  if (primary === secondary) {
    secondary = ids.find((id) => id !== primary) ?? "agility";
  }
  return { primary, secondary };
}

export function normalizeRank(value?: number | string | null): Rank {
  const rank = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return RANKS.includes(rank as Rank) ? (rank as Rank) : 6;
}

export function pickListed(list: readonly string[], value?: string, aliases?: Record<string, string>) {
  const mapped = value ? (aliases?.[value] ?? value) : "";
  return list.includes(mapped) ? mapped : list[0];
}

export function normalizeElement(value?: string) {
  return pickListed(ELEMENTS, value, ELEMENT_ALIASES);
}

export function normalizeClass(value?: string) {
  return pickListed(CLASSES, value);
}

export function normalizeWeaponType(value?: string) {
  return pickListed(WEAPON_TYPES, value, WEAPON_TYPE_ALIASES);
}

export function isOwned(entity: { info: EntityInfo }) {
  return entity.info.owned === true;
}

export function operatorTags(entity: { info: EntityInfo }) {
  const tags: string[] = [...(entity.info.tags ?? [])];
  for (const skill of entity.info.skills ?? []) {
    tags.push(...(skill.tags ?? []));
  }
  return canonicalTagSet(tags);
}

export function synergyTags(entity: { info: EntityInfo }) {
  return new Set([...operatorTags(entity)].filter((tag) => !SYNERGY_SKIP_TAGS.has(tag)));
}

export function leftoverFields(info: EntityInfo, used: string[]): Record<string, unknown> {
  const skip = new Set(used);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(info)) {
    if (!skip.has(key)) extra[key] = value;
  }
  return extra;
}
