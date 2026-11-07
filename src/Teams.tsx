import { useMemo, useRef, useState } from "react";
import { displayName, isOwned, operatorElementLine, rankLabel } from "./catalog";
import { evaluateCombo } from "./combo";
import Portrait from "./Portrait";
import {
  TEAM_SLOTS,
  suggestCompletions,
  type RoleSlotId,
  type TeamSuggestion,
} from "./team";
import type { Entity } from "./types";

type Props = {
  operators: Entity[];
  weapons?: Entity[];
};

type SlotDef = (typeof TEAM_SLOTS)[number];

function scoreLine(score: TeamSuggestion["score"]) {
  return (
    <>
      {score.archetype.label}
      {` · очки ${score.total} · состав ${score.formation}`}
      {score.focusComboTotal
        ? ` · раскрыто комбо ${score.focusComboReady}/${score.focusComboTotal}`
        : ""}
      {score.focusNeedsTotal
        ? ` · раскрыто ветки ${score.focusNeedsReady}/${score.focusNeedsTotal}`
        : ""}
      {` · удары ${score.hitOverlap} · теги ${score.tagOverlap}`}
    </>
  );
}

function SlotCard({
  slot,
  operator,
  members,
  locked,
  proposed,
  interactive,
  open,
  draggable,
  onOpen,
  onClear,
  onLock,
  onExclude,
  onDragStart,
  onDrop,
}: {
  slot: SlotDef;
  operator: Entity | null;
  members: Entity[];
  locked?: boolean;
  proposed?: boolean;
  interactive?: boolean;
  open?: boolean;
  draggable?: boolean;
  onOpen?: () => void;
  onClear?: () => void;
  onLock?: () => void;
  onExclude?: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}) {
  const combo = operator ? evaluateCombo(operator, members) : null;
  const classes = [
    "slot",
    operator ? "filled" : "",
    locked ? "anchor" : "",
    proposed ? "proposed" : "",
    interactive ? "pickable" : "",
    open ? "open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      draggable={Boolean(draggable && operator)}
      onDragStart={
        draggable && operator
          ? (event) => {
              event.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDrop={
        draggable
          ? (event) => {
              event.preventDefault();
              onDrop?.();
            }
          : undefined
      }
      onClick={interactive ? onOpen : proposed && operator ? onLock : undefined}
    >
      <p className="eyebrow">{slot.label}</p>
      {operator ? (
        <>
          <Portrait path={operator.portraitPath || operator.iconPath} alt={displayName(operator)} />
          <div className="slot-body">
            <h3>
              {displayName(operator)}
              {operator.info.rarity ? (
                <span className="rarity">{rankLabel(operator.info.rarity)}</span>
              ) : null}
            </h3>
            <p className="muted">{operatorElementLine(operator, "operators")}</p>
            {locked ? <p className="anchor-mark">Выбран</p> : null}
            {proposed ? <p className="anchor-mark proposed-mark">Предложение · нажмите, чтобы взять</p> : null}
            {combo ? (
              <p className={`combo-flag ${combo.status}`} title={combo.details.join("\n")}>
                {combo.summary}
              </p>
            ) : null}
            {interactive && onClear ? (
              <button
                type="button"
                className="ghost slot-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
              >
                Убрать
              </button>
            ) : null}
            {proposed && onExclude ? (
              <button
                type="button"
                className="ghost slot-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onExclude();
                }}
              >
                Не предлагать
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="muted">{interactive ? "Нажмите, чтобы выбрать · можно перетащить сюда" : "Пусто"}</p>
      )}
    </article>
  );
}

function SynergyBlock({ suggestion }: { suggestion: TeamSuggestion }) {
  return (
    <div className="synergy">
      {suggestion.slotHint ? <p className="rotation-hint">{suggestion.slotHint}</p> : null}
      {suggestion.rotation.length ? (
        <div className="rotation">
          <p className="eyebrow">Ротация</p>
          <ol>
            {suggestion.rotation.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {suggestion.missing.length ? (
        <p className="error">Не хватает слотов: {suggestion.missing.join(", ")}.</p>
      ) : null}
      {suggestion.why.length ? (
        <ul className="why">
          {suggestion.why.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Явных синергий мало — состав держится на совпадении ударов и тегов.</p>
      )}
      {suggestion.sharedTags.length ? (
        <div className="tags">
          {suggestion.sharedTags.map((item) => (
            <span
              key={`${item.kind}-${item.tag}`}
              className={item.kind === "family" ? "tag implied" : "tag"}
            >
              {item.tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TeamCard({
  suggestion,
  featured,
  onLock,
  onTakeAll,
  onExclude,
}: {
  suggestion: TeamSuggestion;
  featured?: boolean;
  onLock: (slotId: RoleSlotId, operator: Entity) => void;
  onTakeAll: () => void;
  onExclude: (operator: Entity) => void;
}) {
  const lockedIds = new Set(suggestion.locked.map((item) => item.id));
  const hasProposed = suggestion.slots.some(
    (item) => item.operator && !lockedIds.has(item.operator.id),
  );

  return (
    <article className={`team-card ${featured ? "featured" : ""}`}>
      <div className="team-card-head">
        <div>
          <p className="eyebrow">
            {suggestion.archetype.label}
            {" · "}
            {suggestion.locked.length === 4
              ? "Ваш состав"
              : featured
                ? "Лучший добор"
                : "Ещё состав"}
          </p>
          <h3>
            {hasProposed
              ? `К ${suggestion.locked.map(displayName).join(" · ")}`
              : suggestion.locked.map(displayName).join(" · ")}
          </h3>
        </div>
        <div className="team-card-actions">
          {hasProposed ? (
            <button type="button" onClick={onTakeAll}>
              Взять всю пачку
            </button>
          ) : null}
          <p className="muted">{scoreLine(suggestion.score)}</p>
        </div>
      </div>
      <div className="slots">
        {TEAM_SLOTS.map((slot) => {
          const operator = suggestion.slots.find((item) => item.slot.id === slot.id)?.operator ?? null;
          const isLocked = Boolean(operator && lockedIds.has(operator.id));
          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              operator={operator}
              members={suggestion.members}
              locked={isLocked}
              proposed={Boolean(operator && !isLocked)}
              onLock={operator && !isLocked ? () => onLock(slot.id, operator) : undefined}
              onExclude={operator && !isLocked ? () => onExclude(operator) : undefined}
            />
          );
        })}
      </div>
      <SynergyBlock suggestion={suggestion} />
    </article>
  );
}

export default function Teams({ operators, weapons = [] }: Props) {
  const roster = useMemo(
    () =>
      operators.filter(isOwned).sort((a, b) => displayName(a).localeCompare(displayName(b), "ru")),
    [operators],
  );
  const [picked, setPicked] = useState<Partial<Record<RoleSlotId, string>>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [openSlot, setOpenSlot] = useState<RoleSlotId | null>(null);
  const dragFrom = useRef<RoleSlotId | null>(null);

  const lockedBySlot = useMemo(() => {
    const next: Partial<Record<RoleSlotId, Entity>> = {};
    for (const slot of TEAM_SLOTS) {
      const id = picked[slot.id];
      const operator = id ? roster.find((item) => item.id === id) : null;
      if (operator) next[slot.id] = operator;
    }
    return next;
  }, [picked, roster]);

  const pickedIds = useMemo(
    () => new Set(Object.values(lockedBySlot).map((item) => item.id)),
    [lockedBySlot],
  );
  const pickedCount = Object.keys(lockedBySlot).length;
  const suggestions = useMemo(
    () => suggestCompletions(roster, lockedBySlot, 5, weapons.filter(isOwned), excluded),
    [roster, lockedBySlot, weapons, excluded],
  );

  const excludedPeople = roster.filter((item) => excluded.includes(item.id));

  const candidates = openSlot
    ? roster.filter(
        (operator) =>
          (!pickedIds.has(operator.id) || picked[openSlot] === operator.id) &&
          !excluded.includes(operator.id),
      )
    : [];

  function setSlot(slotId: RoleSlotId, operatorId: string | null) {
    setPicked((current) => {
      const next = { ...current };
      if (!operatorId) delete next[slotId];
      else next[slotId] = operatorId;
      return next;
    });
    setOpenSlot(null);
  }

  function swapSlots(from: RoleSlotId, to: RoleSlotId) {
    if (from === to) return;
    setPicked((current) => {
      const next = { ...current };
      const a = current[from];
      const b = current[to];
      if (a) next[to] = a;
      else delete next[to];
      if (b) next[from] = b;
      else delete next[from];
      return next;
    });
    setOpenSlot(null);
  }

  function takeSuggestion(suggestion: TeamSuggestion) {
    const next: Partial<Record<RoleSlotId, string>> = {};
    for (const item of suggestion.slots) {
      if (item.operator) next[item.slot.id] = item.operator.id;
    }
    setPicked(next);
    setOpenSlot(null);
  }

  function excludeOperator(operator: Entity) {
    setExcluded((current) => (current.includes(operator.id) ? current : [...current, operator.id]));
    setPicked((current) => {
      const next = { ...current };
      for (const slot of TEAM_SLOTS) {
        if (next[slot.id] === operator.id) delete next[slot.id];
      }
      return next;
    });
  }

  if (!operators.length) {
    return (
      <section className="empty">
        <h2>Подбор команд</h2>
        <p>Сначала добавьте оперативников во вкладке «Редактор».</p>
      </section>
    );
  }

  if (!roster.length) {
    return (
      <section className="empty">
        <h2>Подбор команд</h2>
        <p>
          Отметьте, кто у вас уже есть: на карточке оперативника или в редакторе включите «В
          наличии». Команды собираются только из них.
        </p>
      </section>
    );
  }

  return (
    <section className="teams">
      <div className="teams-head">
        <div>
          <h2>Подбор команд</h2>
          <p className="muted">
            Перетаскивайте слоты: слот 1 задаёт стихию Си и срез комбо с её ульты. «Взять всю пачку»
            ставит всех четверых. «Не предлагать» убирает персонажа из добора. Ниже — ротация, если
            состав совпал с эталоном.
          </p>
        </div>
        {pickedCount || excluded.length ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setPicked({});
              setExcluded([]);
            }}
          >
            Сбросить слоты
          </button>
        ) : null}
      </div>

      <div className="slots builder-slots">
        {TEAM_SLOTS.map((slot) => {
          const operator = lockedBySlot[slot.id] ?? null;
          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              operator={operator}
              members={Object.values(lockedBySlot)}
              locked={Boolean(operator)}
              interactive
              draggable
              open={openSlot === slot.id}
              onOpen={() => setOpenSlot((current) => (current === slot.id ? null : slot.id))}
              onClear={operator ? () => setSlot(slot.id, null) : undefined}
              onDragStart={() => {
                dragFrom.current = slot.id;
              }}
              onDrop={() => {
                if (dragFrom.current) swapSlots(dragFrom.current, slot.id);
                dragFrom.current = null;
              }}
            />
          );
        })}
      </div>

      {excludedPeople.length ? (
        <div className="exclude-row">
          <p className="eyebrow">Не предлагать</p>
          <div className="exclude-chips">
            {excludedPeople.map((person) => (
              <button
                key={person.id}
                type="button"
                className="ghost"
                onClick={() => setExcluded((current) => current.filter((id) => id !== person.id))}
              >
                {displayName(person)} ×
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {openSlot ? (
        <div className="picker">
          <p className="eyebrow">
            {TEAM_SLOTS.find((slot) => slot.id === openSlot)?.label}: кто в наличии
          </p>
          {candidates.length ? (
            <div className="picker-grid">
              {candidates.map((operator) => (
                <button
                  key={operator.id}
                  type="button"
                  className={picked[openSlot] === operator.id ? "active picker-card" : "ghost picker-card"}
                  onClick={() =>
                    setSlot(openSlot, picked[openSlot] === operator.id ? null : operator.id)
                  }
                >
                  <Portrait
                    path={operator.portraitPath || operator.iconPath}
                    alt={displayName(operator)}
                  />
                  <span>
                    {displayName(operator)}
                    <small>
                      {operator.info.class}
                      {operator.info.rarity ? ` · ${rankLabel(operator.info.rarity)}` : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Больше некого поставить — остальные уже в слотах или скрыты.</p>
          )}
        </div>
      ) : null}

      {!pickedCount ? (
        <section className="empty">
          <p>Выберите оперативника в слоте — ниже появятся остальные трое, ротация и почему они вместе работают.</p>
        </section>
      ) : (
        suggestions.map((suggestion, index) => (
          <TeamCard
            key={suggestion.members.map((member) => member.id).join("-")}
            suggestion={suggestion}
            featured={index === 0}
            onLock={(slotId, operator) => setSlot(slotId, operator.id)}
            onTakeAll={() => takeSuggestion(suggestion)}
            onExclude={excludeOperator}
          />
        ))
      )}
    </section>
  );
}
