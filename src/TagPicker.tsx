import { canonicalTag, impliedGroupTags } from "./tags";

type Props = {
  catalog: string[];
  value: string[];
  onChange: (tags: string[]) => void;
};

export default function TagPicker({ catalog, value, onChange }: Props) {
  const extra = value.filter((tag) => !catalog.includes(tag) && !catalog.includes(canonicalTag(tag)));
  const available = catalog.filter((tag) => !value.includes(tag) && !value.includes(canonicalTag(tag)));
  const implied = impliedGroupTags(value);

  function add(tag: string) {
    const next = canonicalTag(tag);
    if (!next || value.includes(next)) return;
    onChange([...value, next]);
  }

  function remove(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div className="tag-picker">
      <div className="tags">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            className={catalog.includes(tag) ? "tag" : "tag extra"}
            title="Убрать тег"
            onClick={() => remove(tag)}
          >
            {tag} ×
          </button>
        ))}
        {implied.map((tag) => (
          <span key={`implied-${tag}`} className="tag implied" title="Ставится автоматически по частному тегу">
            {tag}
          </span>
        ))}
        {value.length === 0 && implied.length === 0 ? <span className="muted">Нет тегов</span> : null}
      </div>
      {extra.length > 0 ? (
        <p className="muted">Серым отмечены теги, которых нет в tags.txt — их можно убрать.</p>
      ) : null}
      <select
        value=""
        disabled={available.length === 0}
        onChange={(event) => add(event.target.value)}
      >
        <option value="">{available.length ? "Добавить тег…" : "Все теги уже выбраны"}</option>
        {available.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
    </div>
  );
}
