// Planning sections shown on the Edit tab: core focus, projects, year goals and the reading list.
import { Fragment, useState } from 'react';
import type { Category, GoalArea, PlanSection, Project, ReadingCategory, ReadingItem } from '../types';
import { seriesVar } from '../lib/colors';
import { setNote, type TextNotes } from '../lib/notes';
import { mergeSubset } from '../lib/useDragReorder';
import { SortableList } from './Sortable';

const uid = () => Math.random().toString(36).slice(2, 9);

export function TextLines({
  lines,
  notes,
  onChange,
  placeholder,
}: {
  lines: string[];
  /** Notes on the lines, keyed by their text. */
  notes?: TextNotes;
  onChange: (l: string[], notes?: TextNotes) => void;
  placeholder: string;
}) {
  return (
    <SortableList
      className="lines custom-items"
      items={lines}
      onReorder={(l) => onChange(l, notes)}
      itemKey={(l, i) => `${i}-${l}`}
      itemLabel={(l) => l}
      renderItem={(l, i) => (
        <>
          <div className="custom-item-text">
            <input
              className="line-input line-input-lg"
              defaultValue={l}
              aria-label={`Focus ${i + 1}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === l) return;
                // Carry the note over to the renamed line, or drop it with a removed one.
                const rest = setNote(notes, l, '');
                onChange(v ? lines.map((x, j) => (j === i ? v : x)) : lines.filter((_, j) => j !== i), v ? setNote(rest, v, notes?.[l] ?? '') : rest);
              }}
            />
            <input
              className="line-input custom-item-note"
              defaultValue={notes?.[l] ?? ''}
              placeholder="Note"
              aria-label={`Note on ${l}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (notes?.[l] ?? '')) onChange(lines, setNote(notes, l, v));
              }}
            />
          </div>
          <button type="button" className="btn btn-icon btn-quiet" aria-label={`Remove “${l}”`} onClick={() => onChange(lines.filter((_, j) => j !== i), setNote(notes, l, ''))}>
            ×
          </button>
        </>
      )}
      after={
        <li className="sortable-add">
          <AddInput placeholder={placeholder} onAdd={(v) => onChange([...lines, v], notes)} />
        </li>
      }
    />
  );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form
      className="add-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) {
          onAdd(v.trim());
          setV('');
        }
      }}
    >
      <input className="line-input" value={v} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setV(e.target.value)} />
      <button type="submit" className="btn btn-sm" disabled={!v.trim()}>
        Add
      </button>
    </form>
  );
}

export function Projects({ projects, categories, onChange }: { projects: Project[]; categories: Category[]; onChange: (p: Project[]) => void }) {
  const update = (id: string, p: Partial<Project>) => onChange(projects.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const add = (text: string, categoryId?: string) => onChange([...projects, { id: uid(), text, done: false, group: 0, categoryId }]);
  const known = new Set(categories.map((c) => c.id));
  const other = projects.filter((p) => !p.categoryId || !known.has(p.categoryId));
  const otherGroups = [...new Set(other.map((p) => p.group))].sort((a, b) => a - b);

  const list = (items: Project[], moveable: boolean) => (
    <SortableList
      className="checklist custom-items"
      items={items}
      onReorder={(r) => onChange(mergeSubset(projects, items, r))}
      itemKey={(p) => p.id}
      itemLabel={(p) => p.text}
      itemClass={(p) => [p.done && 'is-done', p.indent && 'is-indented'].filter(Boolean).join(' ') || undefined}
      renderItem={(p) => row(p, moveable)}
    />
  );

  const row = (p: Project, moveable: boolean) => (
    <>
      <div className="custom-item-text">
        <input
          className="line-input"
          defaultValue={p.text}
          aria-label="Project"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) onChange(projects.filter((x) => x.id !== p.id));
            else if (v !== p.text) update(p.id, { text: v });
          }}
        />
        <input
          className="line-input custom-item-note"
          defaultValue={p.note ?? ''}
          placeholder="Note"
          aria-label={`Note on ${p.text}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (p.note ?? '')) update(p.id, { note: v || undefined });
          }}
        />
      </div>
      <button
        type="button"
        className="btn btn-icon btn-quiet"
        aria-label={p.indent ? `Outdent "${p.text}"` : `Indent "${p.text}"`}
        title={p.indent ? 'Outdent' : 'Indent'}
        aria-pressed={!!p.indent}
        onClick={() => update(p.id, { indent: !p.indent || undefined })}
      >
        {p.indent ? '←' : '→'}
      </button>
      {moveable && categories.length > 0 && (
        <select className="project-move" value="" aria-label={`Move "${p.text}" to a category`} onChange={(e) => e.target.value && update(p.id, { categoryId: e.target.value })}>
          <option value="">Move to…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button type="button" className="btn btn-icon btn-quiet" aria-label={`Remove "${p.text}"`} onClick={() => onChange(projects.filter((x) => x.id !== p.id))}>
        ×
      </button>
    </>
  );

  return (
    <div className="projects">
      {categories.map((c, i) => (
        <div key={c.id} className="project-cat">
          <h3 className="project-cat-title">
            <span className="swatch" style={{ background: seriesVar(i) }} aria-hidden />
            {c.name}
          </h3>
          {list(projects.filter((p) => p.categoryId === c.id), false)}
          <AddInput placeholder={`Add a ${c.name} project`} onAdd={(text) => add(text, c.id)} />
        </div>
      ))}
      {(other.length > 0 || categories.length === 0) && (
        <div className="project-cat">
          {categories.length > 0 && <h3 className="project-cat-title">Other</h3>}
          {otherGroups.map((g) => (
            <Fragment key={g}>{list(other.filter((p) => p.group === g), true)}</Fragment>
          ))}
          {categories.length === 0 && (
            <>
              {projects.length === 0 && <p className="muted">No projects yet. Add the few things this quarter should finish.</p>}
              <AddInput placeholder="Add a project" onAdd={(text) => add(text)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function YearGoals({ areas, onChange }: { areas: GoalArea[]; onChange: (a: GoalArea[]) => void }) {
  const setArea = (i: number, a: GoalArea | null) =>
    onChange(a ? areas.map((x, j) => (j === i ? a : x)) : areas.filter((_, j) => j !== i));
  return (
    <div className="goals">
      {areas.length === 0 && <p className="muted">No yearly goals on this quarter. Add an area, like “Writing”, then what it means this year.</p>}
      <SortableList
        className="goal-list"
        items={areas}
        onReorder={onChange}
        itemKey={(a, i) => `${i}-${a.title}`}
        itemLabel={(a) => a.title}
        itemClass={() => 'goal-area'}
        renderItem={(a, i) => (
          <div className="goal-area-body">
            <div className="goal-area-head">
              <input
                className="line-input goal-title"
                defaultValue={a.title}
                aria-label="Goal area"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v && a.items.length === 0) setArea(i, null);
                  else if (v && v !== a.title) setArea(i, { ...a, title: v });
                }}
              />
              <button
                type="button"
                className="btn btn-icon btn-quiet"
                aria-label={`Remove ${a.title}`}
                onClick={() => {
                  if (a.items.length && !confirm(`Remove “${a.title}” and its ${a.items.length} goal${a.items.length === 1 ? '' : 's'}?`)) return;
                  setArea(i, null);
                }}
              >
                ×
              </button>
            </div>
            <SortableList
              className="lines custom-items"
              items={a.items}
              onReorder={(items) => setArea(i, { ...a, items })}
              itemKey={(it, k) => `${k}-${it}`}
              itemLabel={(it) => it}
              itemClass={(it) => (a.indented?.includes(it) ? 'is-indented' : undefined)}
              renderItem={(it, k) => (
                <>
                  <div className="custom-item-text">
                    <input
                      className="line-input"
                      defaultValue={it}
                      aria-label={`${a.title} goal`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === it) return;
                        // Carry the Plan tab's check mark, the indent and the note over to the renamed item, or drop them with a removed one.
                        const carry = (list?: string[]) => (list?.includes(it) ? [...list.filter((x) => x !== it), ...(v ? [v] : [])] : list);
                        const notes = setNote(a.notes, it, '');
                        setArea(i, {
                          ...a,
                          items: v ? a.items.map((x, j) => (j === k ? v : x)) : a.items.filter((_, j) => j !== k),
                          done: carry(a.done),
                          indented: carry(a.indented),
                          notes: v ? setNote(notes, v, a.notes?.[it] ?? '') : notes,
                        });
                      }}
                    />
                    <input
                      className="line-input custom-item-note"
                      defaultValue={a.notes?.[it] ?? ''}
                      placeholder="Note"
                      aria-label={`Note on ${it}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (a.notes?.[it] ?? '')) setArea(i, { ...a, notes: setNote(a.notes, it, v) });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-icon btn-quiet"
                    aria-label={a.indented?.includes(it) ? `Outdent “${it}”` : `Indent “${it}”`}
                    title={a.indented?.includes(it) ? 'Outdent' : 'Indent'}
                    aria-pressed={!!a.indented?.includes(it)}
                    onClick={() => {
                      const indented = a.indented?.includes(it) ? a.indented.filter((x) => x !== it) : [...(a.indented ?? []), it];
                      setArea(i, { ...a, indented: indented.length ? indented : undefined });
                    }}
                  >
                    {a.indented?.includes(it) ? '←' : '→'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-quiet"
                    aria-label={`Remove “${it}”`}
                    onClick={() =>
                      setArea(i, { ...a, items: a.items.filter((_, j) => j !== k), done: a.done?.filter((x) => x !== it), indented: a.indented?.filter((x) => x !== it), notes: setNote(a.notes, it, '') })
                    }
                  >
                    ×
                  </button>
                </>
              )}
              after={
                <li className="sortable-add">
                  <AddInput placeholder={`Add to ${a.title}`} onAdd={(v) => setArea(i, { ...a, items: [...a.items, v] })} />
                </li>
              }
            />
          </div>
        )}
      />
      <AddInput placeholder="Add a goal area" onAdd={(title) => onChange([...areas, { title, items: [] }])} />
    </div>
  );
}

interface ReadingProps {
  items: ReadingItem[];
  categories: ReadingCategory[];
  onChange: (r: ReadingItem[]) => void;
  onCategoriesChange: (c: ReadingCategory[]) => void;
}

export function Reading({ items, categories, onChange, onCategoriesChange }: ReadingProps) {
  const update = (id: string, p: Partial<ReadingItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const known = new Set(categories.map((c) => c.id));
  const unsorted = items.filter((r) => !r.kind || !known.has(r.kind));
  const setCategory = (id: string, p: Partial<ReadingCategory>) => onCategoriesChange(categories.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const list = (books: ReadingItem[]) => (
    <SortableList
      className="reading"
      items={books}
      onReorder={(r) => onChange(mergeSubset(items, books, r))}
      itemKey={(r) => r.id}
      itemLabel={(r) => r.title}
      itemClass={(r) => `status-${r.status}`}
      renderItem={row}
    />
  );

  const row = (r: ReadingItem) => (
    <>
      <div className="reading-text">
        <input
          className="line-input reading-title"
          defaultValue={r.title}
          aria-label="Title"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) onChange(items.filter((x) => x.id !== r.id));
            else if (v !== r.title) update(r.id, { title: v });
          }}
        />
        <input
          className="line-input reading-note"
          defaultValue={r.note ?? ''}
          placeholder="Note"
          aria-label={`Note on ${r.title}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (r.note ?? '')) update(r.id, { note: v || undefined });
          }}
        />
      </div>
      <select
        className="project-move"
        value={r.kind && known.has(r.kind) ? r.kind : ''}
        aria-label={`Reading category for ${r.title}`}
        onChange={(e) => e.target.value && update(r.id, { kind: e.target.value })}
      >
        {!(r.kind && known.has(r.kind)) && <option value="">Sort into…</option>}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-icon btn-quiet" aria-label={`Remove ${r.title}`} onClick={() => onChange(items.filter((x) => x.id !== r.id))}>
        ×
      </button>
    </>
  );

  return (
    <div className="projects">
      <SortableList
        className="reading-cats"
        items={categories}
        onReorder={onCategoriesChange}
        itemKey={(c) => c.id}
        itemLabel={(c) => c.name}
        itemClass={() => 'project-cat'}
        renderItem={(c) => (
          <div className="reading-cat-body">
            <div className="reading-cat-head">
              <input
                className="line-input project-cat-title"
                defaultValue={c.name}
                aria-label="Reading category name"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) setCategory(c.id, { name: v });
                  else e.target.value = c.name;
                }}
              />
              <button
                type="button"
                className="btn btn-icon btn-quiet"
                aria-label={`Remove ${c.name} category`}
                title="Remove category (its books move to Unsorted)"
                onClick={() => onCategoriesChange(categories.filter((x) => x.id !== c.id))}
              >
                ×
              </button>
            </div>
            {list(items.filter((r) => r.kind === c.id))}
            <AddInput placeholder={`Add a ${c.name} book`} onAdd={(title) => onChange([...items, { id: uid(), title, status: 'todo', kind: c.id }])} />
          </div>
        )}
      />
      <AddInput placeholder="New reading category, e.g. Poetry" onAdd={(name) => onCategoriesChange([...categories, { id: uid(), name }])} />
      {unsorted.length > 0 && (
        <div className="project-cat">
          <h3 className="project-cat-title">Unsorted</h3>
          {list(unsorted)}
        </div>
      )}
    </div>
  );
}

/**
 * The user's own Plan checklists, one panel each, plus a panel to add another.
 * Rendered straight into the Edit tab's grid, so it returns panels rather than one wrapper.
 */
export function CustomSections({ sections, onChange }: { sections: PlanSection[]; onChange: (s: PlanSection[]) => void }) {
  const set = (id: string, p: Partial<PlanSection>) => onChange(sections.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const shift = (i: number, d: number) => {
    const next = [...sections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <>
      {sections.map((sec, i) => (
        <section key={sec.id} className="panel">
          <div className="custom-head">
            <input
              className="line-input custom-title"
              defaultValue={sec.title}
              aria-label="Section name"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== sec.title) set(sec.id, { title: v });
                else e.target.value = sec.title;
              }}
            />
            <span className="count">
              {sec.items.filter((x) => x.done).length}/{sec.items.length} done
            </span>
            <span className="row-actions">
              <button type="button" className="btn btn-icon btn-quiet" aria-label={`Move ${sec.title} earlier`} disabled={i === 0} onClick={() => shift(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-icon btn-quiet" aria-label={`Move ${sec.title} later`} disabled={i === sections.length - 1} onClick={() => shift(i, 1)}>
                ↓
              </button>
              <button
                type="button"
                className="btn btn-icon btn-quiet"
                aria-label={`Remove ${sec.title}`}
                onClick={() => {
                  if (sec.items.length && !confirm(`Remove “${sec.title}” and its ${sec.items.length} item${sec.items.length === 1 ? '' : 's'}?`)) return;
                  onChange(sections.filter((x) => x.id !== sec.id));
                }}
              >
                ×
              </button>
            </span>
          </div>
          <SortableList
            className="checklist custom-items"
            items={sec.items}
            onReorder={(items) => set(sec.id, { items })}
            itemKey={(it) => it.id}
            itemLabel={(it) => it.text}
            itemClass={(it) => [it.done && 'is-done', it.indent && 'is-indented'].filter(Boolean).join(' ') || undefined}
            renderItem={(it) => (
              <>
                <div className="custom-item-text">
                  <input
                    className="line-input"
                    defaultValue={it.text}
                    aria-label={`${sec.title} item`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === it.text) return;
                      set(sec.id, { items: v ? sec.items.map((x) => (x.id === it.id ? { ...x, text: v } : x)) : sec.items.filter((x) => x.id !== it.id) });
                    }}
                  />
                  <input
                    className="line-input custom-item-note"
                    defaultValue={it.note ?? ''}
                    placeholder="Note"
                    aria-label={`Note on ${it.text}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (it.note ?? '')) set(sec.id, { items: sec.items.map((x) => (x.id === it.id ? { ...x, note: v || undefined } : x)) });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-quiet"
                  aria-label={it.indent ? `Outdent “${it.text}”` : `Indent “${it.text}”`}
                  title={it.indent ? 'Outdent' : 'Indent'}
                  aria-pressed={!!it.indent}
                  onClick={() => set(sec.id, { items: sec.items.map((x) => (x.id === it.id ? { ...x, indent: !it.indent || undefined } : x)) })}
                >
                  {it.indent ? '←' : '→'}
                </button>
                <button type="button" className="btn btn-icon btn-quiet" aria-label={`Remove “${it.text}”`} onClick={() => set(sec.id, { items: sec.items.filter((x) => x.id !== it.id) })}>
                  ×
                </button>
              </>
            )}
          />
          <AddInput placeholder={`Add to ${sec.title}`} onAdd={(text) => set(sec.id, { items: [...sec.items, { id: uid(), text, done: false }] })} />
        </section>
      ))}
      <section className="panel setup-wide">
        <h2>Your own sections</h2>
        <p className="muted">Add a checklist of your own, like Habits or Trips. Each one gets its own box on the Plan tab.</p>
        <AddInput placeholder="New section, e.g. Habits" onAdd={(title) => onChange([...sections, { id: uid(), title, items: [] }])} />
      </section>
    </>
  );
}
