import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import type { Project, ProjectDetails, ProjectNote, ProjectTask, Quarter } from '../types';
import { seriesVar } from '../lib/colors';
import { todayISO } from '../lib/dates';
import { projectGroups } from '../lib/projects';
import { Linkify } from './Linkify';
import { SortableList } from './Sortable';

const CATEGORY = 'category:';

/**
 * The Projects tab: this quarter's projects down the side, and the selected one's page with its description, tasks
 * and notes. Projects from other quarters are listed too once they have a page.
 */
export function ProjectsView({ selected, onSelect, onEdit }: { selected: string | null; onSelect: (id: string) => void; onEdit: () => void }) {
  const { state, quarter: q } = useStore();
  const details = state.projectDetails ?? {};

  const here = new Set(q.projects.map((p) => p.id));
  const elsewhere = [...state.quarters]
    .filter((x) => x.id !== q.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .flatMap((x) => x.projects.filter((p) => details[p.id] && !here.has(p.id)).map((p) => ({ p, q: x })))
    .filter((e, i, all) => all.findIndex((o) => o.p.id === e.p.id) === i);

  // A category's name can be selected too, as "category:<key>", to show all of its projects at once.
  const groups = projectGroups(q);
  const category = selected?.startsWith(CATEGORY) ? groups.find((g) => g.key === selected.slice(CATEGORY.length)) : undefined;

  const inQuarter = q.projects.find((p) => p.id === selected);
  const found = inQuarter ? { p: inQuarter, q } : elsewhere.find((e) => e.p.id === selected);
  const current = found ?? (q.projects.length ? { p: category?.items[0] ?? groups[0].items[0], q } : elsewhere[0]);

  if (!current) {
    return (
      <p className="muted">
        No projects this quarter.{' '}
        <button type="button" className="link-btn" onClick={onEdit}>
          Add some on the Edit tab
        </button>
      </p>
    );
  }

  // A top-level project's sub-projects are the indented ones listed right after it in its category.
  const subProjects = (() => {
    if (category) return category.items.slice(1);
    if (current.q !== q || current.p.indent) return [];
    const items = groups.find((g) => g.items.some((p) => p.id === current.p.id))?.items ?? [];
    const after = items.slice(items.findIndex((p) => p.id === current.p.id) + 1);
    const end = after.findIndex((p) => !p.indent);
    return end < 0 ? after : after.slice(0, end);
  })();

  const item = (p: Project, color?: string, sub?: string) => (
    <li key={p.id} className={p.indent && !sub ? 'is-indented' : undefined}>
      <button
        type="button"
        className={['projects-nav-btn', !category && p.id === current.p.id && 'is-active', p.done && 'is-done'].filter(Boolean).join(' ')}
        aria-current={!category && p.id === current.p.id ? 'page' : undefined}
        onClick={() => onSelect(p.id)}
      >
        {color && <span className="swatch" style={{ background: color }} aria-hidden />}
        <span className="projects-nav-text">{p.text}</span>
        {sub && <span className="count">{sub}</span>}
      </button>
    </li>
  );

  return (
    <div className="projects-layout">
      <nav className="panel projects-nav" aria-label="Projects">
        {groups.map((g) => (
          <div key={g.key} className="plan-group">
            <h3 className="project-cat-title">
              <button
                type="button"
                className={['projects-cat-btn', g === category && 'is-active'].filter(Boolean).join(' ')}
                aria-current={g === category ? 'page' : undefined}
                title={`Show all ${g.title} projects`}
                onClick={() => onSelect(CATEGORY + g.key)}
              >
                {g.title}
              </button>
            </h3>
            <ul className="projects-nav-list">{g.items.map((p) => item(p, g.color))}</ul>
          </div>
        ))}
        {elsewhere.length > 0 && (
          <div className="plan-group">
            <h3 className="project-cat-title">Other quarters</h3>
            <ul className="projects-nav-list">{elsewhere.map((e) => item(e.p, undefined, `Q${e.q.quarter} ${e.q.year}`))}</ul>
          </div>
        )}
      </nav>
      <div className="projects-pages">
        {category && (
          <h2 className="project-page-title projects-cat-heading">
            {category.color && <span className="swatch" style={{ background: category.color }} aria-hidden />}
            {category.title}
            <span className="count">
              {category.items.length} {category.items.length === 1 ? 'project' : 'projects'} · Q{q.quarter} {q.year}
            </span>
          </h2>
        )}
        <ProjectPage key={current.p.id} project={current.p} quarter={current.q} details={details[current.p.id] ?? {}} sub={!!category && !!current.p.indent} />
        {subProjects.map((p) => (
          <ProjectPage key={p.id} project={p} quarter={q} details={details[p.id] ?? {}} sub={!category || !!p.indent} />
        ))}
      </div>
    </div>
  );
}

function ProjectPage({ project: p, quarter: q, details: d, sub = false }: { project: Project; quarter: Quarter; details: ProjectDetails; sub?: boolean }) {
  const { dispatch } = useStore();
  const set = (patch: Partial<ProjectDetails>) => dispatch({ type: 'setProjectDetails', projectId: p.id, patch });

  const catIndex = q.categories.findIndex((c) => c.id === p.categoryId);

  // The task or note just added, which opens for typing. Empty sections are hidden; their add buttons sit in a row.
  const [added, setAdded] = useState<string | null>(null);
  const tasks = d.tasks ?? [];
  const notes = d.notes ?? [];
  const addTask = () => {
    const t = { id: uid(), text: '', done: false };
    setAdded(t.id);
    set({ tasks: [...tasks, t] });
  };
  const addNote = () => {
    const n = { id: uid(), date: todayISO(), text: '' };
    setAdded(n.id);
    set({ notes: [...notes, n] });
  };

  return (
    <article className={['panel project-page', sub && 'is-sub'].filter(Boolean).join(' ')} aria-label={p.text}>
      <h2 className="project-page-title">
        <span className={p.done ? 'is-done' : undefined}>{p.text}</span>
        <span className="count">
          {catIndex >= 0 && <span className="swatch" style={{ background: seriesVar(catIndex) }} aria-hidden />}
          {catIndex >= 0 ? q.categories[catIndex].name : 'Other'} · Q{q.quarter} {q.year}
        </span>
      </h2>
      {p.note && (
        <p className="plan-note">
          <Linkify text={p.note} />
        </p>
      )}
      <TextField label="Description" heading={null} value={d.description} rows={4} className="project-description" onSave={(v) => set({ description: v })} />
      {tasks.length > 0 && <Tasks tasks={tasks} added={added} setAdded={setAdded} onAdd={addTask} onChange={(tasks) => set({ tasks })} />}
      {notes.length > 0 && <Notes notes={notes} added={added} setAdded={setAdded} onAdd={addNote} onChange={(notes) => set({ notes })} />}
      {(!tasks.length || !notes.length) && (
        <div className="project-text project-add-row">
          {!tasks.length && <AddButton label="Task" onClick={addTask} />}
          {!notes.length && <AddButton label="Note" onClick={addNote} />}
        </div>
      )}
    </article>
  );
}

const uid = () => Math.random().toString(36).slice(2, 9);

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-sm project-add-btn" aria-label={`Add ${label.toLowerCase()}`} title={`Add ${label.toLowerCase()}`} onClick={onClick}>
      + {label}
    </button>
  );
}

type SectionProps = {
  added: string | null;
  setAdded: (id: string | null) => void;
  onAdd: () => void;
};

/**
 * The project's to-dos as a checklist. A new task opens for typing, and Enter starts another below it at the same
 * indent; Enter on an empty task stops. Clearing a task's text removes it. Drag a task by its grip to reorder;
 * its sub-tasks (the indented tasks below it) come along. Hidden when there are none.
 */
function Tasks({
  tasks,
  added,
  setAdded,
  onAdd,
  onChange,
}: SectionProps & {
  tasks: ProjectTask[];
  onChange: (tasks: ProjectTask[]) => void;
}) {
  const update = (id: string, t: Partial<ProjectTask>) => onChange(tasks.map((x) => (x.id === id ? { ...x, ...t } : x)));
  const remove = (id: string) => onChange(tasks.filter((x) => x.id !== id));

  return (
    <section className="project-text">
      <h3 className="project-cat-title">
        Tasks
        <AddButton label="Task" onClick={onAdd} />
      </h3>
      <SortableList
        className="checklist project-tasks"
        items={tasks}
        onReorder={onChange}
        itemKey={(t) => t.id}
        itemLabel={(t) => t.text}
        itemLevel={(t) => (t.indent ? 1 : 0)}
        itemClass={(t) => [t.done && 'is-done', t.indent && 'is-indented'].filter(Boolean).join(' ') || undefined}
        renderItem={(t) => (
          <>
            <input type="checkbox" checked={t.done} aria-label={`Done: ${t.text}`} onChange={(e) => update(t.id, { done: e.target.checked })} />
            <input
              className="line-input"
              defaultValue={t.text}
              aria-label="Task"
              autoFocus={t.id === added}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const v = e.currentTarget.value.trim();
                if (!v) return e.currentTarget.blur();
                const next = {
                  id: uid(),
                  text: '',
                  done: false,
                  indent: t.indent,
                };
                const i = tasks.findIndex((x) => x.id === t.id);
                setAdded(next.id);
                onChange([...tasks.slice(0, i), { ...t, text: v }, next, ...tasks.slice(i + 1)]);
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (t.id === added) setAdded(null);
                if (!v) remove(t.id);
                else if (v !== t.text) update(t.id, { text: v });
              }}
            />
            <button
              type="button"
              className="btn btn-icon btn-quiet project-task-btn"
              aria-label={t.indent ? `Outdent “${t.text}”` : `Indent “${t.text}”`}
              title={t.indent ? 'Outdent' : 'Indent'}
              aria-pressed={!!t.indent}
              onClick={() => update(t.id, { indent: !t.indent || undefined })}
            >
              {t.indent ? '←' : '→'}
            </button>
            <button type="button" className="btn btn-icon btn-quiet project-task-btn" aria-label={`Remove “${t.text}”`} title="Remove" onClick={() => remove(t.id)}>
              ×
            </button>
          </>
        )}
      />
    </section>
  );
}

/** The project's notes, oldest first. A new note opens for typing, and one left empty goes away. Hidden when there are none. */
function Notes({
  notes,
  added,
  setAdded,
  onAdd,
  onChange,
}: SectionProps & {
  notes: ProjectNote[];
  onChange: (notes: ProjectNote[]) => void;
}) {
  const update = (id: string, text: string) => onChange(notes.map((n) => (n.id === id ? { ...n, text } : n)));
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id));

  return (
    <section className="project-text">
      <h3 className="project-cat-title">
        Notes
        <AddButton label="Note" onClick={onAdd} />
      </h3>
      <ol className="project-notes">
        {notes.map((n) => (
          <li key={n.id} className="project-note">
            <TextField
              label="Note"
              heading={null}
              value={n.text}
              placeholder="Write a note…"
              rows={6}
              startEditing={n.id === added}
              onSave={(v) => update(n.id, v)}
              onClose={(v) => {
                if (n.id === added) setAdded(null);
                if (!v) remove(n.id);
              }}
              actions={
                <button
                  type="button"
                  className="btn btn-icon btn-quiet"
                  aria-label="Delete note"
                  title="Delete note"
                  // Keeps the box from saving on blur before the note is gone.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (!n.text || confirm('Delete this note?')) && remove(n.id)}
                >
                  ×
                </button>
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Long text with its links, or a box to edit it. Saves a moment after typing stops, and on leaving the box. */
function TextField({
  label,
  heading = label,
  value,
  placeholder,
  rows,
  className,
  startEditing = false,
  actions,
  onSave,
  onClose,
}: {
  label: string;
  /** Shown above the text instead of the label; null for none. */
  heading?: ReactNode;
  value?: string;
  placeholder?: string;
  rows: number;
  className?: string;
  startEditing?: boolean;
  /** Buttons beside the text. */
  actions?: ReactNode;
  onSave: (v: string) => void;
  /** Called with the final text on leaving the box. */
  onClose?: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(startEditing ? (value ?? '') : null);
  const commit = (v: string) => {
    if (v.trim() !== (value ?? '')) onSave(v.trim());
  };

  useEffect(() => {
    if (draft === null) return;
    const t = setTimeout(() => commit(draft), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const add = draft === null && !value && <AddButton label={label} onClick={() => setDraft('')} />;

  return (
    <div className={['project-text', className].filter(Boolean).join(' ')}>
      {heading !== null ? (
        <h3 className="project-cat-title">
          {heading}
          {add}
        </h3>
      ) : (
        add && <div className="project-text-add">{add}</div>
      )}
      <div className="project-text-row">
        {draft !== null ? (
          <textarea
            className="project-textarea"
            value={draft}
            rows={rows}
            placeholder={placeholder}
            aria-label={label}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commit(draft);
              setDraft(null);
              onClose?.(draft.trim());
            }}
          />
        ) : value ? (
          <div
            className="project-text-body"
            tabIndex={0}
            aria-label={`${label}, press Enter to edit`}
            onClick={(e) => !(e.target as HTMLElement).closest('a') && setDraft(value)}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && (e.preventDefault(), setDraft(value))}
          >
            <Linkify text={value} />
          </div>
        ) : null}
        {actions && <span className="project-text-actions">{actions}</span>}
      </div>
    </div>
  );
}
