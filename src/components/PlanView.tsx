import type { ReactNode } from 'react';
import { useStore } from '../store';
import type { Quarter, ReadingItem } from '../types';
import { seriesVar } from '../lib/colors';
import { NEXT_STATUS, readingCategories, STATUS_LABEL } from '../lib/reading';

/** The quarter's core focus, then its year goals, projects, reading list and the user's own sections as checklists. Edit the lists themselves on the Edit tab. */
export function PlanView({ onEdit }: { onEdit: () => void }) {
  const { quarter: q, dispatch } = useStore();
  const patch = (p: Partial<Omit<Quarter, 'id'>>) => dispatch({ type: 'updateQuarter', quarterId: q.id, patch: p });

  const known = new Set(q.categories.map((c) => c.id));
  const projectGroups = [
    ...q.categories.map((c, i) => ({ key: c.id, title: c.name, color: seriesVar(i), items: q.projects.filter((p) => p.categoryId === c.id) })),
    { key: 'other', title: 'Other', color: undefined, items: q.projects.filter((p) => !p.categoryId || !known.has(p.categoryId)) },
  ].filter((g) => g.items.length > 0);

  const readingCats = readingCategories(q);
  const knownReading = new Set(readingCats.map((c) => c.id));
  const readingGroups = [
    ...readingCats.map((c) => ({ key: c.id, title: c.name, books: q.reading.filter((r) => r.kind === c.id) })),
    { key: 'unsorted', title: 'Unsorted', books: q.reading.filter((r) => !r.kind || !knownReading.has(r.kind)) },
  ];

  const goalsTotal = q.yearGoals.reduce((a, g) => a + g.items.length, 0);
  const goalsDone = q.yearGoals.reduce((a, g) => a + g.items.filter((it) => g.done?.includes(it)).length, 0);

  const toggleProject = (id: string, done: boolean) => patch({ projects: q.projects.map((p) => (p.id === id ? { ...p, done } : p)) });
  const toggleGoal = (area: number, item: string, done: boolean) =>
    patch({
      yearGoals: q.yearGoals.map((g, i) =>
        i !== area ? g : { ...g, done: done ? [...(g.done ?? []), item] : (g.done ?? []).filter((x) => x !== item) },
      ),
    });
  const toggleItem = (sectionId: string, itemId: string, done: boolean) =>
    patch({
      sections: q.sections?.map((sec) => (sec.id !== sectionId ? sec : { ...sec, items: sec.items.map((it) => (it.id === itemId ? { ...it, done } : it)) })),
    });
  const stepBook = (id: string) => patch({ reading: q.reading.map((r) => (r.id === id ? { ...r, status: NEXT_STATUS[r.status] } : r)) });

  const removeProject = (id: string) => patch({ projects: q.projects.filter((p) => p.id !== id) });
  const removeGoal = (area: number, k: number, item: string) =>
    patch({
      yearGoals: q.yearGoals.map((g, i) =>
        i !== area ? g : { ...g, items: g.items.filter((_, j) => j !== k), done: g.done?.filter((x) => x !== item), indented: g.indented?.filter((x) => x !== item) },
      ),
    });
  const removeItem = (sectionId: string, itemId: string) =>
    patch({ sections: q.sections?.map((sec) => (sec.id !== sectionId ? sec : { ...sec, items: sec.items.filter((it) => it.id !== itemId) })) });
  const removeBook = (id: string) => patch({ reading: q.reading.filter((r) => r.id !== id) });

  return (
    <div className="plan">
      <section className="panel plan-core">
        <h2>Core focus</h2>
        {q.core.length > 0 ? (
          <ul className="plan-core-lines">
            {q.core.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            No focus set for this quarter.{' '}
            <button type="button" className="link-btn" onClick={onEdit}>
              Add it on the Edit tab
            </button>
          </p>
        )}
      </section>

      <PlanPanel title={`${q.year} goals`} done={goalsDone} total={goalsTotal} empty="No year goals yet." onEdit={onEdit}>
        {q.yearGoals.map(
          (g, i) =>
            g.items.length > 0 && (
              <PlanGroup key={`${i}-${g.title}`} title={g.title}>
                {g.items.map((it, k) => (
                  <CheckItem key={`${k}-${it}`} label={it} checked={!!g.done?.includes(it)} indent={g.indented?.includes(it)} onChange={(v) => toggleGoal(i, it, v)} onRemove={() => removeGoal(i, k, it)} />
                ))}
              </PlanGroup>
            ),
        )}
      </PlanPanel>

      <PlanPanel title={`${q.id.replace('-', ' ')} projects`} done={q.projects.filter((p) => p.done).length} total={q.projects.length} empty="No projects yet." onEdit={onEdit}>
        {projectGroups.map((g) => (
          <PlanGroup key={g.key} title={g.title} color={g.color}>
            {g.items.map((p) => (
              <CheckItem key={p.id} label={p.text} checked={p.done} indent={p.indent} onChange={(v) => toggleProject(p.id, v)} onRemove={() => removeProject(p.id)} />
            ))}
          </PlanGroup>
        ))}
      </PlanPanel>

      <PlanPanel title="Reading list" done={q.reading.filter((r) => r.status === 'done').length} total={q.reading.length} empty="No books yet." onEdit={onEdit}>
        {readingGroups.map((g) => {
          const books = g.books;
          return (
            books.length > 0 && (
              <PlanGroup key={g.key} title={g.title}>
                {books.map((r) => (
                  <BookItem key={r.id} book={r} onStep={() => stepBook(r.id)} onRemove={() => removeBook(r.id)} />
                ))}
              </PlanGroup>
            )
          );
        })}
      </PlanPanel>

      {(q.sections ?? []).map((sec) => (
        <PlanPanel key={sec.id} title={sec.title} done={sec.items.filter((x) => x.done).length} total={sec.items.length} empty="Nothing here yet." onEdit={onEdit}>
          <ul className="checklist plan-list">
            {sec.items.map((it) => (
              <CheckItem key={it.id} label={it.text} checked={it.done} indent={it.indent} onChange={(v) => toggleItem(sec.id, it.id, v)} onRemove={() => removeItem(sec.id, it.id)} />
            ))}
          </ul>
        </PlanPanel>
      ))}
    </div>
  );
}

function PlanPanel({ title, done, total, empty, onEdit, children }: { title: string; done: number; total: number; empty: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="panel plan-panel">
      <h2>
        {title}
        <span className="count">
          {done}/{total} done
        </span>
      </h2>
      <div className="bar plan-bar" role="img" aria-label={`${done} of ${total} done`}>
        <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
      </div>
      {total === 0 ? (
        <p className="muted">
          {empty}{' '}
          <button type="button" className="link-btn" onClick={onEdit}>
            Add some on the Edit tab
          </button>
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function PlanGroup({ title, color, children }: { title: string; color?: string; children: ReactNode }) {
  return (
    <div className="plan-group">
      <h3 className="project-cat-title">
        {color && <span className="swatch" style={{ background: color }} aria-hidden />}
        {title}
      </h3>
      <ul className="checklist plan-list">{children}</ul>
    </div>
  );
}

/** A book with its status pill; clicking the pill steps To read → Reading → Read. */
function BookItem({ book: r, onStep, onRemove }: { book: ReadingItem; onStep: () => void; onRemove: () => void }) {
  return (
    <li className={r.status === 'done' ? 'is-done' : undefined}>
      <div className="plan-item">
        <button type="button" className={`status-pill status-${r.status}`} onClick={onStep} title={`Change to “${STATUS_LABEL[NEXT_STATUS[r.status]]}”`} aria-label={`${r.title}: ${STATUS_LABEL[r.status]}. Change to ${STATUS_LABEL[NEXT_STATUS[r.status]]}`}>
          {STATUS_LABEL[r.status]}
        </button>
        <span className="plan-item-text">
          {r.title}
          {r.note && <span className="plan-note">{r.note}</span>}
        </span>
      </div>
      <RemoveButton label={r.title} onClick={onRemove} />
    </li>
  );
}

function CheckItem({ label, note, checked, indent, onChange, onRemove }: { label: string; note?: string; checked: boolean; indent?: boolean; onChange: (v: boolean) => void; onRemove: () => void }) {
  return (
    <li className={[checked && 'is-done', indent && 'is-indented'].filter(Boolean).join(' ') || undefined}>
      <label className="plan-item">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="plan-item-text">
          {label}
          {note && <span className="plan-note">{note}</span>}
        </span>
      </label>
      <RemoveButton label={label} onClick={onRemove} />
    </li>
  );
}

/** Deletes the item outright (same as × on the Edit tab). Shown on hover or focus where there's a pointer, always on touch. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-icon btn-quiet plan-remove" aria-label={`Remove “${label}”`} title="Remove" onClick={onClick}>
      ×
    </button>
  );
}
