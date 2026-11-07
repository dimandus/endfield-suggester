import { COMBO_TRIGGERS } from "./combo";
import type { ComboTriggerId, TriggerMatch } from "./types";

type Props = {
  value: ComboTriggerId[];
  onChange: (next: ComboTriggerId[]) => void;
  match?: TriggerMatch;
  onMatchChange?: (next: TriggerMatch) => void;
  label?: string;
  note?: string;
};

export default function ComboFromPicker({
  value,
  onChange,
  match = "all",
  onMatchChange,
  label,
  note = "Теги ниже — что навык делает. Здесь — от какого события вспыхивает комбо.",
}: Props) {
  const heading =
    label ??
    (match === "any"
      ? "Срабатывает от (достаточно одного)"
      : "Срабатывает от (все выбранные сразу)");

  function toggle(id: ComboTriggerId) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else onChange([...value, id]);
  }

  return (
    <div className="combo-from">
      <span className="field-label">{heading}</span>
      {onMatchChange && value.length > 1 ? (
        <label className="check-label">
          <input
            type="checkbox"
            checked={match === "any"}
            onChange={(event) => onMatchChange(event.target.checked ? "any" : "all")}
          />
          Достаточно любого из выбранных
        </label>
      ) : null}
      <div className="combo-from-list">
        {COMBO_TRIGGERS.map((item) => (
          <label key={item.id} className="check-label" title={item.hint}>
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            <span>
              {item.label}
              <small>{item.hint}</small>
            </span>
          </label>
        ))}
      </div>
      {note ? <p className="muted">{note}</p> : null}
    </div>
  );
}
