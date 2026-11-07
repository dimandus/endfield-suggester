import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CLASSES,
  displayName,
  ELEMENTS,
  leftoverFields,
  isOwned,
  normalizeClass,
  normalizeElement,
  normalizeRank,
  normalizeStats,
  normalizeWeaponType,
  padSkills,
  RANKS,
  STATS,
  WEAPON_TYPES,
} from "./catalog";
import ComboFromPicker from "./ComboFromPicker";
import { COMBO_SKILL_INDEX, SKILL_LEGENDS } from "./combo";
import { applySkillSuggestion, suggestSkill } from "./skillSuggest";
import TagPicker from "./TagPicker";
import { canonicalTag } from "./tags";
import type { EditorTarget, Kind, Library, Rank, Skill, SkillHit, StatId } from "./types";

function SkillSuggestBox({
  index,
  description,
  onApply,
}: {
  index: number;
  description: string;
  onApply: () => void;
}) {
  const suggestion = suggestSkill(description, index);
  const triggerLabel = index === COMBO_SKILL_INDEX ? "галочки комбо" : "галочки «ждёт»";
  if (!description.trim()) {
    return <p className="muted">Вставьте описание — можно разобрать теги и {triggerLabel} по тексту.</p>;
  }
  return (
    <div className="skill-suggest">
      <button type="button" className="ghost" onClick={onApply}>
        Разобрать описание
      </button>
      {suggestion.notes.length ? (
        <ul>
          {suggestion.notes.map((note) => (
            <li key={note.text}>{note.text}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Props = {
  library: Library;
  target: EditorTarget;
  onTargetChange: (target: EditorTarget) => void;
  onSaved: () => Promise<void> | void;
};

export default function Editor({ library, target, onTargetChange, onSaved }: Props) {
  const [kind, setKind] = useState<Kind>(target.kind);
  const [selectedId, setSelectedId] = useState<string | null>(
    target.mode === "edit" ? target.id : null,
  );
  const [name, setName] = useState("");
  const [owned, setOwned] = useState(false);
  const [rarity, setRarity] = useState<Rank>(6);
  const [operatorClass, setOperatorClass] = useState<string>(CLASSES[0]);
  const [element, setElement] = useState<string>(ELEMENTS[0]);
  const [weaponType, setWeaponType] = useState<string>(WEAPON_TYPES[0]);
  const [primary, setPrimary] = useState<StatId>("strength");
  const [secondary, setSecondary] = useState<StatId>("agility");
  const [skills, setSkills] = useState<Skill[]>(padSkills());
  const [tags, setTags] = useState<string[]>([]);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = kind === "operators" ? library.operators : library.weapons;
  const selected = list.find((entity) => entity.id === selectedId) ?? null;

  useEffect(() => {
    if (target.mode === "create") {
      startCreate(target.kind);
    }
  }, [target.kind, target.mode]);

  useEffect(() => {
    if (target.mode === "edit") {
      loadEntity(target.kind, target.id);
    }
  }, [target, library]);

  function startCreate(nextKind: Kind) {
    setKind(nextKind);
    setSelectedId(null);
    setName("");
    setOwned(false);
    setRarity(6);
    setOperatorClass(CLASSES[0]);
    setElement(ELEMENTS[0]);
    setWeaponType(WEAPON_TYPES[0]);
    setPrimary("strength");
    setSecondary("agility");
    setSkills(padSkills());
    setTags([]);
    setExtra({});
    setMessage(null);
    setError(null);
  }

  function loadEntity(nextKind: Kind, id: string) {
    const source = nextKind === "operators" ? library.operators : library.weapons;
    const entity = source.find((item) => item.id === id);
    if (!entity) {
      startCreate(nextKind);
      return;
    }
    setKind(nextKind);
    setSelectedId(entity.id);
    setName(entity.info.nameRu || entity.info.name || "");
    setOwned(isOwned(entity));
    setRarity(normalizeRank(entity.info.rarity));
    setOperatorClass(normalizeClass(entity.info.class));
    setElement(normalizeElement(entity.info.element));
    setWeaponType(
      normalizeWeaponType(nextKind === "operators" ? entity.info.weaponType : entity.info.type),
    );
    const stats = normalizeStats(entity.info.stats);
    setPrimary(stats.primary);
    setSecondary(stats.secondary);
    setSkills(padSkills(entity.info.skills));
    setTags((entity.info.tags ?? []).map(canonicalTag));
    setExtra(
      leftoverFields(entity.info, [
        "id",
        "name",
        "nameRu",
        "owned",
        "rarity",
        "class",
        "element",
        "weaponType",
        "type",
        "stats",
        "skills",
        "tags",
      ]),
    );
    setError(null);
  }

  function updateSkill(index: number, patch: Partial<Skill>) {
    setSkills((current) =>
      current.map((skill, skillIndex) =>
        skillIndex === index ? { ...skill, ...patch } : skill,
      ),
    );
  }

  function updateHit(skillIndex: number, hitIndex: number, patch: Partial<SkillHit>) {
    const hits = [...(skills[skillIndex]?.damage ?? [])];
    hits[hitIndex] = { ...hits[hitIndex], ...patch };
    updateSkill(skillIndex, { damage: hits });
  }

  function fillSkillFromText(index: number) {
    const skill = skills[index];
    if (!skill) return;
    const suggestion = suggestSkill(skill.description ?? "", index);
    const next = applySkillSuggestion(skill, suggestion, index);
    updateSkill(index, next);
  }

  async function save() {
    if (!name.trim()) {
      setError("Укажите имя.");
      return;
    }
    if (kind === "operators" && primary === secondary) {
      setError("Основной и побочный показатели должны быть разными.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const info =
        kind === "operators"
          ? {
              ...extra,
              name: name.trim(),
              owned,
              rarity,
              class: operatorClass,
              element,
              weaponType,
              stats: { primary, secondary },
              skills: padSkills(skills),
            }
          : {
              ...extra,
              name: name.trim(),
              rarity,
              type: weaponType,
              tags: tags.map(canonicalTag),
            };

      const savedId = await invoke<string>("save_entity", {
        kind,
        id: selectedId,
        info,
      });
      await onSaved();
      onTargetChange({ kind, mode: "edit", id: savedId });
      setMessage("Сохранено в папку data.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    const title = selected ? displayName(selected) : selectedId;
    if (!window.confirm(`Удалить «${title}» вместе с папкой?`)) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("delete_entity", { kind, id: selectedId });
      await onSaved();
      startCreate(kind);
      onTargetChange({ kind, mode: "create" });
      setMessage("Папка удалена.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="editor">
      <aside className="editor-list">
        <div className="editor-switch">
          <button
            type="button"
            className={kind === "operators" ? "active" : ""}
            onClick={() => {
              if (kind !== "operators") {
                onTargetChange({ kind: "operators", mode: "create" });
              }
            }}
          >
            Персонажи
          </button>
          <button
            type="button"
            className={kind === "weapons" ? "active" : ""}
            onClick={() => {
              if (kind !== "weapons") {
                onTargetChange({ kind: "weapons", mode: "create" });
              }
            }}
          >
            Оружие
          </button>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => onTargetChange({ kind, mode: "create" })}
        >
          + Создать
        </button>
        <ul>
          {list.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                className={entity.id === selectedId ? "active" : "ghost"}
                onClick={() => onTargetChange({ kind, mode: "edit", id: entity.id })}
              >
                {displayName(entity)}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="form-head">
          <div>
            <p className="eyebrow">{selectedId ? selectedId : "новая папка"}</p>
            <h2>{selectedId ? "Редактирование" : "Новая запись"}</h2>
          </div>
          <div className="actions">
            {selectedId ? (
              <button type="button" className="ghost danger" onClick={() => void remove()} disabled={busy}>
                Удалить
              </button>
            ) : null}
            <button type="submit" disabled={busy}>
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        </div>

        <label>
          Имя
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        {kind === "operators" ? (
          <label className="check-label">
            <input
              type="checkbox"
              checked={owned}
              onChange={(event) => setOwned(event.target.checked)}
            />
            В наличии — участвует в подборе команд
          </label>
        ) : null}

        {kind === "operators" ? (
          <>
            <div className="stat-row">
              <label>
                Ранг
                <select
                  value={rarity}
                  onChange={(event) => setRarity(Number(event.target.value) as Rank)}
                >
                  {RANKS.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}★
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Класс
                <select
                  value={operatorClass}
                  onChange={(event) => setOperatorClass(event.target.value)}
                >
                  {CLASSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="stat-row">
              <label>
                Стихия
                <select value={element} onChange={(event) => setElement(event.target.value)}>
                  {ELEMENTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Тип оружия
                <select value={weaponType} onChange={(event) => setWeaponType(event.target.value)}>
                  {WEAPON_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="stat-row">
              <label>
                Основной показатель
                <select
                  value={primary}
                  onChange={(event) => {
                    const next = event.target.value as StatId;
                    setPrimary(next);
                    if (next === secondary) {
                      const fallback = STATS.find((stat) => stat.id !== next)?.id ?? "agility";
                      setSecondary(fallback);
                    }
                  }}
                >
                  {STATS.map((stat) => (
                    <option key={stat.id} value={stat.id}>
                      {stat.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Побочный показатель
                <select
                  value={secondary}
                  onChange={(event) => setSecondary(event.target.value as StatId)}
                >
                  {STATS.filter((stat) => stat.id !== primary).map((stat) => (
                    <option key={stat.id} value={stat.id}>
                      {stat.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              Остальные два показателя считаются обычными:{" "}
              {STATS.filter((stat) => stat.id !== primary && stat.id !== secondary)
                .map((stat) => stat.label)
                .join(", ")}
              .
            </p>

            <div className="field-row">
              <h3>Навыки</h3>
              <button
                type="button"
                className="ghost"
                onClick={() => void invoke("open_tags_file")}
              >
                Открыть tags.txt
              </button>
            </div>
            <details className="cheat">
              <summary>Шпаргалка: теги и галочки</summary>
              <div className="cheat-body">
                <p>
                  Правило: <strong>теги — что навык сам делает, галочки — чего он ждёт.</strong>{" "}
                  Вставь текст из игры и нажми «Разобрать описание», потом проверь глазами.
                </p>
                <ul>
                  <li>
                    <strong>Теги эффекта</strong> — только если навык накладывает, применяет или
                    восстанавливает: подброс, разгром, поражение теплом, лечение, ОН. Не ставь
                    родительское «Поражение искусствами», если уже есть «Поражение теплом».
                  </li>
                  <li>
                    <strong>Галочки у комбо (навык 3)</strong> — строка «ТРИГГЕР КОМБО». Это событие
                    в пачке, не эффект самого навыка. Если в триггере «или» — включи «достаточно
                    любого».
                  </li>
                  <li>
                    <strong>Галочки «ждёт в пачке» (боевой и ульта)</strong> — усиленная ветка: «если
                    на цели уже есть…», «поглощает электризацию…». Обычный урон без условия сюда не
                    идёт.
                  </li>
                  <li>
                    <strong>Базовая атака</strong> почти всегда: последний удар, ошеломление,
                    добивание — и стихия удара, не канон персонажа.
                  </li>
                </ul>
              </div>
            </details>
            <div className="skill-grid">
              {skills.map((skill, index) => (
                <fieldset key={index}>
                  <legend>{SKILL_LEGENDS[index] ?? `Навык ${index + 1}`}</legend>
                  <input
                    placeholder="Название"
                    value={skill.name}
                    onChange={(event) => updateSkill(index, { name: event.target.value })}
                  />
                  <textarea
                    placeholder="Описание"
                    rows={6}
                    value={skill.description ?? ""}
                    onChange={(event) => updateSkill(index, { description: event.target.value })}
                  />
                  <SkillSuggestBox
                    index={index}
                    description={skill.description ?? ""}
                    onApply={() => fillSkillFromText(index)}
                  />
                  <span className="field-label">Стихия удара</span>
                  <div className="hit-rows">
                    {(skill.damage ?? []).map((hit, hitIndex) => (
                      <div className="hit-row" key={`${index}-${hitIndex}`}>
                        <select
                          value={hit.element}
                          onChange={(event) =>
                            updateHit(index, hitIndex, { element: event.target.value })
                          }
                        >
                          {ELEMENTS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="всегда, или условие"
                          value={hit.when ?? ""}
                          onChange={(event) =>
                            updateHit(index, hitIndex, { when: event.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            updateSkill(index, {
                              damage: (skill.damage ?? []).filter((_, i) => i !== hitIndex),
                            })
                          }
                        >
                          −
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="ghost"
                      onClick={() =>
                        updateSkill(index, {
                          damage: [
                            ...(skill.damage ?? []),
                            { element: element || ELEMENTS[0] },
                          ],
                        })
                      }
                    >
                      + Стихия удара
                    </button>
                  </div>
                  {index === COMBO_SKILL_INDEX ? (
                    <ComboFromPicker
                      value={skill.comboFrom ?? []}
                      match={skill.comboFromMatch ?? "all"}
                      onChange={(next) => updateSkill(index, { comboFrom: next })}
                      onMatchChange={(comboFromMatch) =>
                        updateSkill(index, {
                          comboFromMatch: comboFromMatch === "any" ? "any" : undefined,
                        })
                      }
                    />
                  ) : (
                    <ComboFromPicker
                      label={
                        skill.needsMatch === "any"
                          ? "Ждёт в пачке (достаточно одного)"
                          : "Ждёт в пачке (все выбранные сразу)"
                      }
                      note="Теги ниже — что навык сам вешает. Здесь — какой статус нужен, чтобы сработала усиленная ветка."
                      value={skill.needs ?? []}
                      match={skill.needsMatch ?? "all"}
                      onChange={(next) => updateSkill(index, { needs: next })}
                      onMatchChange={(needsMatch) =>
                        updateSkill(index, {
                          needsMatch: needsMatch === "any" ? "any" : undefined,
                        })
                      }
                    />
                  )}
                  <span className="field-label">Теги эффекта</span>
                  <TagPicker
                    catalog={library.tags ?? []}
                    value={skill.tags ?? []}
                    onChange={(next) => updateSkill(index, { tags: next })}
                  />
                </fieldset>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="stat-row">
              <label>
                Ранг
                <select
                  value={rarity}
                  onChange={(event) => setRarity(Number(event.target.value) as Rank)}
                >
                  {RANKS.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}★
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Тип
                <select value={weaponType} onChange={(event) => setWeaponType(event.target.value)}>
                  {WEAPON_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <div className="field-row">
                <span className="field-label">Теги</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void invoke("open_tags_file")}
                >
                  Открыть tags.txt
                </button>
              </div>
              <TagPicker catalog={library.tags ?? []} value={tags} onChange={setTags} />
            </div>
          </>
        )}

        {error ? <p className="error banner">{error}</p> : null}
        {message ? <p className="ok banner">{message}</p> : null}
      </form>
    </section>
  );
}
