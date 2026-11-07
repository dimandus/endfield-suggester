export const SLOT_TAGS = ["Боевой навык", "Комбонавык", "Супер навык"] as const;

export const UNIVERSAL_BA_TAGS = ["Последний удар", "Ошеломление", "Добивание"] as const;

export const SYNERGY_SKIP_TAGS = new Set<string>([...SLOT_TAGS, ...UNIVERSAL_BA_TAGS, "Очки навыков"]);

export const TAG_GROUPS: Record<string, string[]> = {
  "Физическое состояние": ["Подбрасывание", "Опрокидывание", "Разгром", "Прорыв"],
  "Поражение искусствами": [
    "Поражение теплом",
    "Поражение электричеством",
    "Поражение природой",
    "Криогенное поражение",
  ],
};

export const PHYSICAL_APPLY = ["Подбрасывание", "Опрокидывание"];
export const PHYSICAL_CONSUME = ["Разгром", "Прорыв"];
export const ARTS_INFLICT = [
  "Поражение теплом",
  "Поражение электричеством",
  "Поражение природой",
  "Криогенное поражение",
];
export const CRYO_SETUP = ["Криогенное поражение", "Застывание", "Крио"];

export const AMP_TAGS = [
  "Усиление крио",
  "Усиление тепла",
  "Усиление электро",
  "Усиление природы",
  "Усиление искусств",
] as const;

export const HEAL_TAGS = ["Лечение", "Щит"] as const;

export const TAG_ALIASES: Record<string, string> = {
  Подбросить: "Подбрасывание",
  Опрокинуть: "Опрокидывание",
  "Поражение крио": "Криогенное поражение",
};

const PARENT_BY_CHILD = new Map(
  Object.entries(TAG_GROUPS).flatMap(([parent, children]) =>
    children.map((child) => [child, parent] as const),
  ),
);

export function canonicalTag(tag: string): string {
  return TAG_ALIASES[tag] ?? tag;
}

export const EXACT_TAG_WEIGHT = 2;
export const FAMILY_TAG_WEIGHT = 1;

export function canonicalTagSet(tags: Iterable<string>): Set<string> {
  const result = new Set<string>();
  for (const raw of tags) {
    const tag = canonicalTag(raw);
    if (tag) result.add(tag);
  }
  return result;
}

export function expandTags(tags: Iterable<string>): Set<string> {
  const result = canonicalTagSet(tags);
  for (const tag of [...result]) {
    const parent = PARENT_BY_CHILD.get(tag);
    if (parent) result.add(parent);
  }
  return result;
}

function inGroup(tags: Set<string>, parent: string, children: string[]): boolean {
  return tags.has(parent) || children.some((child) => tags.has(child));
}

export function scoreTagPair(a: Set<string>, b: Set<string>): number {
  let exact = 0;
  for (const tag of a) {
    if (!b.has(tag)) continue;
    const children = TAG_GROUPS[tag];
    if (children) {
      const aHasChild = children.some((child) => a.has(child));
      const bHasChild = children.some((child) => b.has(child));
      if (aHasChild || bHasChild) continue;
    }
    exact += 1;
  }

  let family = 0;
  for (const [parent, children] of Object.entries(TAG_GROUPS)) {
    if (!inGroup(a, parent, children) || !inGroup(b, parent, children)) continue;
    const sameChild = children.some((child) => a.has(child) && b.has(child));
    const sameBareParent =
      a.has(parent) &&
      b.has(parent) &&
      !children.some((child) => a.has(child) || b.has(child));
    if (sameChild || sameBareParent) continue;
    family += 1;
  }

  return exact * EXACT_TAG_WEIGHT + family * FAMILY_TAG_WEIGHT;
}

export function impliedGroupTags(tags: Iterable<string>): string[] {
  const stored = new Set([...tags].map(canonicalTag).filter(Boolean));
  const implied: string[] = [];
  for (const tag of stored) {
    const parent = PARENT_BY_CHILD.get(tag);
    if (parent && !stored.has(parent) && !implied.includes(parent)) implied.push(parent);
  }
  return implied;
}
