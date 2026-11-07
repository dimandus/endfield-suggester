export type TabId = "operators" | "weapons" | "teams" | "editor";
export type Kind = "operators" | "weapons";
export type StatId = "strength" | "agility" | "intellect" | "will";
export type Rank = 3 | 4 | 5 | 6;

export type ComboTriggerId =
  | "final-strike"
  | "arts-infliction"
  | "arts-reaction"
  | "electrification"
  | "combustion"
  | "solidification"
  | "corrosion"
  | "physical-status"
  | "vulnerable-stacks"
  | "crush-or-breach"
  | "stagger"
  | "cryo-infliction"
  | "nature-infliction"
  | "electric-infliction"
  | "ally-combo"
  | "ally-pressure"
  | "heal-spent";

export type TriggerMatch = "all" | "any";

export type SkillHit = {
  element: string;
  when?: string;
};

export type Skill = {
  name: string;
  description?: string;
  tags?: string[];
  comboFrom?: ComboTriggerId[];
  comboFromMatch?: TriggerMatch;
  needs?: ComboTriggerId[];
  needsMatch?: TriggerMatch;
  damage?: SkillHit[];
};

export type OperatorStats = {
  primary?: StatId | string;
  secondary?: StatId | string;
};

export type EntityInfo = {
  id?: string;
  name?: string;
  nameRu?: string;
  rarity?: number;
  class?: string;
  type?: string;
  weaponType?: string;
  element?: string;
  tags?: string[];
  stats?: OperatorStats;
  skills?: Skill[];
  owned?: boolean;
  recommendedWeaponIds?: string[];
  suitableOperatorIds?: string[];
  notes?: string;
  [key: string]: unknown;
};

export type Entity = {
  id: string;
  folder: string;
  info: EntityInfo;
  portraitPath?: string | null;
  iconPath?: string | null;
  error?: string | null;
};

export type Library = {
  dataDir: string;
  tags: string[];
  operators: Entity[];
  weapons: Entity[];
};

export type EditorTarget =
  | { kind: Kind; mode: "create" }
  | { kind: Kind; mode: "edit"; id: string };
