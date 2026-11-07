import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { displayName, isOwned, operatorElementLine, rankLabel, statLabel } from "./catalog";
import Editor from "./Editor";
import Portrait from "./Portrait";
import Teams from "./Teams";
import type { EditorTarget, Entity, Kind, Library, TabId } from "./types";
import "./App.css";

function roleLine(entity: Entity, kind: Kind) {
  return operatorElementLine(entity, kind);
}

function statsLine(entity: Entity) {
  if (!entity.info.stats?.primary) return null;
  return `${statLabel(entity.info.stats.primary)} (осн.) · ${statLabel(entity.info.stats.secondary)} (поб.)`;
}

function Card({
  entity,
  kind,
  onEdit,
  onToggleOwned,
}: {
  entity: Entity;
  kind: Kind;
  onEdit: () => void;
  onToggleOwned?: () => void;
}) {
  const owned = isOwned(entity);
  return (
    <article className={`card ${owned ? "owned" : ""}`}>
      <Portrait path={entity.portraitPath || entity.iconPath} alt={displayName(entity)} />
      <div className="card-body">
        <h2>
          {displayName(entity)}
          {entity.info.rarity ? <span className="rarity">{rankLabel(entity.info.rarity)}</span> : null}
        </h2>
        <p className="muted">{roleLine(entity, kind)}</p>
        {kind === "operators" ? <p className="muted">{statsLine(entity)}</p> : null}
        <div className="tags">
          {(entity.info.tags ?? []).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        {entity.error ? <p className="error">{entity.error}</p> : null}
        {kind === "operators" && onToggleOwned ? (
          <button
            type="button"
            className={owned ? "card-edit" : "ghost card-edit"}
            onClick={onToggleOwned}
          >
            {owned ? "В наличии" : "Нет в наличии"}
          </button>
        ) : null}
        <button type="button" className="ghost card-edit" onClick={onEdit}>
          Править
        </button>
      </div>
    </article>
  );
}

function App() {
  const [tab, setTab] = useState<TabId>("editor");
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorTarget, setEditorTarget] = useState<EditorTarget>({
    kind: "operators",
    mode: "create",
  });
  const [ownedFilter, setOwnedFilter] = useState<"all" | "owned" | "missing">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<Library>("load_library");
      setLibrary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openFolder = useCallback(async () => {
    try {
      await invoke("open_data_dir");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const items = useMemo(() => {
    if (!library) return [];
    if (tab === "weapons") return library.weapons;
    if (ownedFilter === "owned") return library.operators.filter(isOwned);
    if (ownedFilter === "missing") return library.operators.filter((entity) => !isOwned(entity));
    return library.operators;
  }, [library, tab, ownedFilter]);

  const ownedCount = library?.operators.filter(isOwned).length ?? 0;

  async function toggleOwned(entity: Entity) {
    try {
      await invoke("save_entity", {
        kind: "operators",
        id: entity.id,
        info: { ...entity.info, owned: !isOwned(entity) },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function openEditor(target: EditorTarget) {
    setEditorTarget(target);
    setTab("editor");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Arknights: Endfield</p>
          <h1>Suggester</h1>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void load()}>
            Обновить
          </button>
          <button type="button" className="ghost" onClick={() => void openFolder()}>
            Открыть папку data
          </button>
        </div>
      </header>

      <p className="path">{library?.dataDir ?? "Читаю папку data…"}</p>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "operators" ? "active" : ""}
          onClick={() => setTab("operators")}
        >
          Оперативники
          <span>
            {ownedCount}/{library?.operators.length ?? 0}
          </span>
        </button>
        <button
          type="button"
          className={tab === "weapons" ? "active" : ""}
          onClick={() => setTab("weapons")}
        >
          Оружие
          <span>{library?.weapons.length ?? 0}</span>
        </button>
        <button
          type="button"
          className={tab === "teams" ? "active" : ""}
          onClick={() => setTab("teams")}
        >
          Команды
        </button>
        <button
          type="button"
          className={tab === "editor" ? "active" : ""}
          onClick={() => setTab("editor")}
        >
          Редактор
        </button>
      </nav>

      {error ? <p className="error banner">{error}</p> : null}

      {tab === "teams" ? (
        <Teams operators={library?.operators ?? []} weapons={library?.weapons ?? []} />
      ) : tab === "editor" ? (
        library ? (
          <Editor
            library={library}
            target={editorTarget}
            onTargetChange={setEditorTarget}
            onSaved={load}
          />
        ) : (
          <p className="muted">Загрузка…</p>
        )
      ) : loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <>
          {tab === "operators" ? (
            <div className="seed-list filter-row">
              <button
                type="button"
                className={ownedFilter === "all" ? "active" : "ghost"}
                onClick={() => setOwnedFilter("all")}
              >
                Все
              </button>
              <button
                type="button"
                className={ownedFilter === "owned" ? "active" : "ghost"}
                onClick={() => setOwnedFilter("owned")}
              >
                В наличии
              </button>
              <button
                type="button"
                className={ownedFilter === "missing" ? "active" : "ghost"}
                onClick={() => setOwnedFilter("missing")}
              >
                Нет в наличии
              </button>
            </div>
          ) : null}
          <section className="grid">
            {items.map((entity) => (
              <Card
                key={entity.id}
                entity={entity}
                kind={tab}
                onEdit={() => openEditor({ kind: tab, mode: "edit", id: entity.id })}
                onToggleOwned={tab === "operators" ? () => void toggleOwned(entity) : undefined}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
