import { Fragment, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../store';
import type { Quarter, ReadingItem } from '../types';
import { seriesVar } from '../lib/colors';
import { NEXT_STATUS, readingCategories, STATUS_LABEL } from '../lib/reading';
import { setNote } from '../lib/notes';
import { arrangeColumns, useColumnCount } from '../lib/useColumns';
import { useDragColumns } from '../lib/useDragReorder';
import { Linkify } from './Linkify';
import { Grip } from './Sortable';

/** The quarter's core focus, year goals, projects, reading list and the user's own sections as checklists, in columns the user arranges by dragging. Edit the lists themselves on the Edit tab. */
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
  const setProjectNote = (id: string, note: string) => patch({ projects: q.projects.map((p) => (p.id === id ? { ...p, note: note || undefined } : p)) });
  const setGoalItemNote = (area: number, item: string, note: string) =>
    patch({ yearGoals: q.yearGoals.map((g, i) => (i !== area ? g : { ...g, notes: setNote(g.notes, item, note) })) });
  const toggleItem = (sectionId: string, itemId: string, done: boolean) =>
    patch({
      sections: q.sections?.map((sec) => (sec.id !== sectionId ? sec : { ...sec, items: sec.items.map((it) => (it.id === itemId ? { ...it, done } : it)) })),
    });
  const setItemNote = (sectionId: string, itemId: string, note: string) =>
    patch({
      sections: q.sections?.map((sec) => (sec.id !== sectionId ? sec : { ...sec, items: sec.items.map((it) => (it.id === itemId ? { ...it, note: note || undefined } : it)) })),
    });
  const setBookNote = (id: string, note: string) => patch({ reading: q.reading.map((r) => (r.id === id ? { ...r, note: note || undefined } : r)) });
  const stepBook = (id: string) => patch({ reading: q.reading.map((r) => (r.id === id ? { ...r, status: NEXT_STATUS[r.status] } : r)) });

  const removeProject = (id: string) => patch({ projects: q.projects.filter((p) => p.id !== id) });
  const removeGoal = (area: number, k: number, item: string) =>
    patch({
      yearGoals: q.yearGoals.map((g, i) =>
        i !== area ? g : { ...g, items: g.items.filter((_, j) => j !== k), done: g.done?.filter((x) => x !== item), indented: g.indented?.filter((x) => x !== item), notes: setNote(g.notes, item, '') },
      ),
    });
  const removeItem = (sectionId: string, itemId: string) =>
    patch({ sections: q.sections?.map((sec) => (sec.id !== sectionId ? sec : { ...sec, items: sec.items.filter((it) => it.id !== itemId) })) });
  const removeBook = (id: string) => patch({ reading: q.reading.filter((r) => r.id !== id) });
  const [grid, colCount] = useColumnCount<HTMLDivElement>(300);

  const panels: { id: string; label: string; render: (box: PanelBox, grip: ReactNode) => ReactNode }[] = [
    {
      id: 'core',
      label: 'Core focus',
      render: (box, grip) => (
        <section {...box} className={['panel plan-core', box.className].filter(Boolean).join(' ')}>
          <h2>
            {grip}
            Core focus
          </h2>
          {q.core.length > 0 ? (
            <ul className="plan-core-lines">
              {q.core.map((l, i) => (
                <CoreLine key={`${i}-${l}`} line={l} note={q.coreNotes?.[l]} onNoteChange={(n) => patch({ coreNotes: setNote(q.coreNotes, l, n) })} />
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
      ),
    },
    {
      id: 'goals',
      label: `${q.year} goals`,
      render: (box, grip) => (
        <PlanPanel box={box} grip={grip} title={`${q.year} goals`} done={goalsDone} total={goalsTotal} empty="No year goals yet." onEdit={onEdit}>
          {q.yearGoals.map(
            (g, i) =>
              g.items.length > 0 && (
                <PlanGroup key={`${i}-${g.title}`} title={g.title}>
                  {g.items.map((it, k) => (
                    <CheckItem
                      key={`${k}-${it}`}
                      label={it}
                      note={g.notes?.[it]}
                      checked={!!g.done?.includes(it)}
                      indent={g.indented?.includes(it)}
                      onChange={(v) => toggleGoal(i, it, v)}
                      onNoteChange={(n) => setGoalItemNote(i, it, n)}
                      onRemove={() => removeGoal(i, k, it)}
                    />
                  ))}
                </PlanGroup>
              ),
          )}
        </PlanPanel>
      ),
    },
    {
      id: 'projects',
      label: `${q.id.replace('-', ' ')} projects`,
      render: (box, grip) => (
        <PlanPanel box={box} grip={grip} title={`${q.id.replace('-', ' ')} projects`} done={q.projects.filter((p) => p.done).length} total={q.projects.length} empty="No projects yet." onEdit={onEdit}>
          {projectGroups.map((g) => (
            <PlanGroup key={g.key} title={g.title} color={g.color}>
              {g.items.map((p) => (
                <CheckItem
                  key={p.id}
                  label={p.text}
                  note={p.note}
                  checked={p.done}
                  indent={p.indent}
                  onChange={(v) => toggleProject(p.id, v)}
                  onNoteChange={(n) => setProjectNote(p.id, n)}
                  onRemove={() => removeProject(p.id)}
                />
              ))}
            </PlanGroup>
          ))}
        </PlanPanel>
      ),
    },
    {
      id: 'reading',
      label: 'Reading list',
      render: (box, grip) => (
        <PlanPanel box={box} grip={grip} title="Reading list" done={q.reading.filter((r) => r.status === 'done').length} total={q.reading.length} empty="No books yet." onEdit={onEdit}>
          {readingGroups.map((g) => {
            const books = g.books;
            return (
              books.length > 0 && (
                <PlanGroup key={g.key} title={g.title}>
                  {books.map((r) => (
                    <BookItem key={r.id} book={r} onStep={() => stepBook(r.id)} onNoteChange={(n) => setBookNote(r.id, n)} onRemove={() => removeBook(r.id)} />
                  ))}
                </PlanGroup>
              )
            );
          })}
        </PlanPanel>
      ),
    },
    ...(q.sections ?? []).map((sec) => ({
      id: sec.id,
      label: sec.title,
      render: (box: PanelBox, grip: ReactNode) => (
        <PlanPanel box={box} grip={grip} title={sec.title} done={sec.items.filter((x) => x.done).length} total={sec.items.length} empty="Nothing here yet." onEdit={onEdit}>
          <ul className="checklist plan-list">
            {sec.items.map((it) => (
              <CheckItem key={it.id} label={it.text} note={it.note} checked={it.done} indent={it.indent} onChange={(v) => toggleItem(sec.id, it.id, v)} onNoteChange={(n) => setItemNote(sec.id, it.id, n)} onRemove={() => removeItem(sec.id, it.id)} />
            ))}
          </ul>
        </PlanPanel>
      ),
    })),
  ];
  const byId = new Map(panels.map((p) => [p.id, p]));
  const cols = arrangeColumns(q.planLayout, panels.map((p) => p.id), colCount);
  const drag = useDragColumns(cols, (planLayout) => patch({ planLayout }));

  return (
    <div className="plan" ref={grid} style={{ '--plan-cols': colCount } as CSSProperties}>
      {cols.map((col, j) => (
        <div key={j} {...drag.column(j)} className={['plan-col', drag.column(j).className].filter(Boolean).join(' ')}>
          {col.map((id) => {
            const p = byId.get(id)!;
            return <Fragment key={id}>{p.render(drag.panel(id, p.label), <Grip {...drag.grip(id, p.label)} />)}</Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}

type PanelBox = ReturnType<ReturnType<typeof useDragColumns>['panel']>;

function PlanPanel({ box, grip, title, done, total, empty, onEdit, children }: { box: PanelBox; grip: ReactNode; title: string; done: number; total: number; empty: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section {...box} className={['panel plan-panel', box.className].filter(Boolean).join(' ')}>
      <h2>
        {grip}
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

/** A core focus line with its note. */
function CoreLine({ line, note, onNoteChange }: { line: string; note?: string; onNoteChange: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li>
      <span className="plan-core-text">
        {line}
        <PlanNote note={note} label={line} editing={editing} onSave={onNoteChange} onDone={() => setEditing(false)} />
      </span>
      <NoteButton label={line} hasNote={!!note} onClick={() => setEditing(true)} />
    </li>
  );
}

/** A book with its status pill; clicking the pill steps To read → Reading → Read. */
function BookItem({ book: r, onStep, onNoteChange, onRemove }: { book: ReadingItem; onStep: () => void; onNoteChange: (note: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={r.status === 'done' ? 'is-done' : undefined}>
      <div className="plan-item">
        <button type="button" className={`status-pill status-${r.status}`} onClick={onStep} title={`Change to “${STATUS_LABEL[NEXT_STATUS[r.status]]}”`} aria-label={`${r.title}: ${STATUS_LABEL[r.status]}. Change to ${STATUS_LABEL[NEXT_STATUS[r.status]]}`}>
          {STATUS_LABEL[r.status]}
        </button>
        <span className="plan-item-text">
          {r.title}
          <PlanNote note={r.note} label={r.title} editing={editing} onSave={onNoteChange} onDone={() => setEditing(false)} />
        </span>
      </div>
      <NoteButton label={r.title} hasNote={!!r.note} onClick={() => setEditing(true)} />
      <RemoveButton label={r.title} onClick={onRemove} />
    </li>
  );
}

function CheckItem({
  label,
  note,
  checked,
  indent,
  onChange,
  onNoteChange,
  onRemove,
}: {
  label: string;
  note?: string;
  checked: boolean;
  indent?: boolean;
  onChange: (v: boolean) => void;
  /** Set to let the note be added or edited here; otherwise the note only shows. */
  onNoteChange?: (note: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={[checked && 'is-done', indent && 'is-indented'].filter(Boolean).join(' ') || undefined}>
      <label className="plan-item">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="plan-item-text">
          {label}
          <PlanNote note={note} label={label} editing={editing} onSave={onNoteChange} onDone={() => setEditing(false)} />
        </span>
      </label>
      {onNoteChange && <NoteButton label={label} hasNote={!!note} onClick={() => setEditing(true)} />}
      <RemoveButton label={label} onClick={onRemove} />
    </li>
  );
}

/** An item's note with its links, or a box to edit it. Enter or leaving the box saves; Esc cancels. */
function PlanNote({ note, label, editing, onSave, onDone }: { note?: string; label: string; editing: boolean; onSave?: (note: string) => void; onDone: () => void }) {
  const cancelled = useRef(false);
  if (editing && onSave)
    return (
      <input
        className="line-input plan-note-input"
        defaultValue={note ?? ''}
        placeholder="Note"
        aria-label={`Note on ${label}`}
        autoFocus
        onFocus={() => (cancelled.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!cancelled.current && v !== (note ?? '')) onSave(v);
          onDone();
        }}
      />
    );
  return note ? (
    <span className="plan-note">
      <Linkify text={note} />
    </span>
  ) : null;
}

function NoteButton({ label, hasNote, onClick }: { label: string; hasNote: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-icon btn-quiet plan-note-btn" aria-label={`${hasNote ? 'Edit' : 'Add'} note on “${label}”`} title={hasNote ? 'Edit note' : 'Add note'} onClick={onClick}>
      ✎
    </button>
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
