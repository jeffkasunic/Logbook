import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import type { Project, ProjectDetails, ProjectNote, ProjectTask, Quarter } from '../types';
import { seriesVar } from '../lib/colors';
import { todayISO } from '../lib/dates';
import { projectGroups } from '../lib/projects';
import { Linkify } from './Linkify';

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

  const inQuarter = q.projects.find((p) => p.id === selected);
  const found = inQuarter ? { p: inQuarter, q } : elsewhere.find((e) => e.p.id === selected);
  const current = found ?? (q.projects.length ? { p: projectGroups(q)[0].items[0], q } : elsewhere[0]);

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

  const item = (p: Project, color?: string, sub?: string) => (
    <li key={p.id} className={p.indent && !sub ? 'is-indented' : undefined}>
      <button
        type="button"
        className={['projects-nav-btn', p.id === current.p.id && 'is-active', p.done && 'is-done'].filter(Boolean).join(' ')}
        aria-current={p.id === current.p.id ? 'page' : undefined}
        onClick={() => onSelect(p.id)}
      >
        {color && <span className="swatch" style={{ background: color }} aria-hidden />}
        <span className="projects-nav-text">{p.text}</span>
        {sub && <span className="count">{sub}</span>}
      </button>
    </li>
  );

  return (
    <div className="projects">
      <nav className="panel projects-nav" aria-label="Projects">
        {projectGroups(q).map((g) => (
          <div key={g.key} className="plan-group">
            <h3 className="project-cat-title">{g.title}</h3>
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
      <ProjectPage key={current.p.id} project={current.p} quarter={current.q} details={details[current.p.id] ?? {}} />
    </div>
  );
}

function ProjectPage({ project: p, quarter: q, details: d }: { project: Project; quarter: Quarter; details: ProjectDetails }) {
  const { dispatch } = useStore();
  const set = (patch: Partial<ProjectDetails>) => dispatch({ type: 'setProjectDetails', projectId: p.id, patch });

  const catIndex = q.categories.findIndex((c) => c.id === p.categoryId);

  return (
    <article className="panel project-page">
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
      <Tasks tasks={d.tasks ?? []} onChange={(tasks) => set({ tasks })} />
      <Notes notes={d.notes ?? []} onChange={(notes) => set({ notes })} />
    </article>
  );
}

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * The project's to-dos as a checklist. A new task opens for typing, and Enter starts another below it at the same
 * indent; Enter on an empty task stops. Clearing a task's text removes it.
 */
function Tasks({ tasks, onChange }: { tasks: ProjectTask[]; onChange: (tasks: ProjectTask[]) => void }) {
  const update = (id: string, t: Partial<ProjectTask>) => onChange(tasks.map((x) => (x.id === id ? { ...x, ...t } : x)));
  const remove = (id: string) => onChange(tasks.filter((x) => x.id !== id));
  const [added, setAdded] = useState<string | null>(null);

  return (
    <section className="project-text">
      <h3 className="project-cat-title">
        Tasks
        <button
          type="button"
          className="btn btn-sm project-notes-add"
          aria-label="Add task"
          title="Add task"
          onClick={() => {
            const t = { id: uid(), text: '', done: false };
            setAdded(t.id);
            onChange([...tasks, t]);
          }}
        >
          +
        </button>
      </h3>
      <ul className="checklist project-tasks">
        {tasks.map((t) => (
          <li key={t.id} className={[t.done && 'is-done', t.indent && 'is-indented'].filter(Boolean).join(' ') || undefined}>
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
                const next = { id: uid(), text: '', done: false, indent: t.indent };
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
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The project's notes, oldest first. A new note opens for typing, and one left empty goes away. */
function Notes({ notes, onChange }: { notes: ProjectNote[]; onChange: (notes: ProjectNote[]) => void }) {
  const [added, setAdded] = useState<string | null>(null);
  const update = (id: string, text: string) => onChange(notes.map((n) => (n.id === id ? { ...n, text } : n)));
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id));

  return (
    <section className="project-text">
      <h3 className="project-cat-title">
        Notes
        <button
          type="button"
          className="btn btn-sm project-notes-add"
          aria-label="Add note"
          title="Add note"
          onClick={() => {
            const n = { id: uid(), date: todayISO(), text: '' };
            setAdded(n.id);
            onChange([...notes, n]);
          }}
        >
          +
        </button>
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

  const add = draft === null && !value && (
    <button type="button" className="btn btn-sm project-notes-add" aria-label={`Add ${label.toLowerCase()}`} title={`Add ${label.toLowerCase()}`} onClick={() => setDraft('')}>
      +
    </button>
  );

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
