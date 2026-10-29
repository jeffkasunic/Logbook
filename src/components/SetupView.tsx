import { useState } from 'react';
import { useStore } from '../store';
import type { Category, Metric, Quarter } from '../types';
import { seriesVar } from '../lib/colors';
import { NumCell } from './NumCell';
import { Grip } from './Sortable';
import { useDragReorder } from '../lib/useDragReorder';
import { useMasonry } from '../lib/useMasonry';
import { readingCategories } from '../lib/reading';
import { confirmRemoveProject } from '../lib/projects';
import { CustomSections, Projects, Reading, TextLines, YearGoals } from './PlanSections';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

function uniqueId(base: string, taken: string[]) {
  let id = slug(base);
  let n = 2;
  while (taken.includes(id)) id = `${slug(base)}-${n++}`;
  return id;
}

/** The Edit tab: what the daily log tracks (categories, measures) and what the Plan tab shows (focus, goals, projects, reading). Quarters and backups are on Settings. */
export function SetupView() {
  const { state, quarter: q, dispatch } = useStore();

  const setCats = (categories: Category[]) => dispatch({ type: 'updateQuarter', quarterId: q.id, patch: { categories } });
  const setMetrics = (metrics: Metric[]) => dispatch({ type: 'updateQuarter', quarterId: q.id, patch: { metrics } });
  const patch = (p: Partial<Omit<Quarter, 'id'>>) => dispatch({ type: 'updateQuarter', quarterId: q.id, patch: p });
  const prevGoals = state.quarters
    .filter((x) => x.year === q.year && x.startDate < q.startDate && x.yearGoals.length > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  const catDrag = useDragReorder(q.categories, setCats);
  const metricDrag = useDragReorder(q.metrics, setMetrics);
  const logGrid = useMasonry<HTMLDivElement>();
  const planGrid = useMasonry<HTMLDivElement>();

  const hoursFor = (id: string) => Object.values(q.days).reduce((a, d) => a + (d.hours?.[id] ?? 0), 0);

  function move<T>(arr: T[], i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }

  return (
    <div
      className="setup-page"
      // Text fields here save on blur, so Enter blurs them to save. Add rows are forms and submit on Enter themselves.
      onKeyDown={(e) => {
        const t = e.target;
        if (e.key === 'Enter' && t instanceof HTMLInputElement && !t.form && t.type !== 'checkbox') t.blur();
      }}
    >
      <section className="setup-group" aria-labelledby="edit-log">
        <h2 id="edit-log" className="setup-group-title">
          Daily log <span className="count">what you track each day</span>
        </h2>
        <div className="setup" ref={logGrid}>
          <section className="panel">
            <h2>Categories in {q.id.replace('-', ' ')}</h2>
            <p className="muted">Each category is a column in the daily log. Weekly goals feed the weekly summary.</p>
            <table className="setup-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Goal / week (h)</th>
                  <th scope="col">Logged</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.categories.map((c, i) => (
                  <tr key={c.id} {...catDrag.row(i, c.name)}>
                    <td>
                      <Grip {...catDrag.grip(i, c.name)} />
                      <span className="swatch" style={{ background: seriesVar(i) }} aria-hidden />
                      <input
                        className="line-input"
                        defaultValue={c.name}
                        aria-label="Category name"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== c.name) setCats(q.categories.map((x) => (x.id === c.id ? { ...x, name: v } : x)));
                          else e.target.value = c.name;
                        }}
                      />
                      <input
                        className="line-input category-note"
                        defaultValue={c.note ?? ''}
                        placeholder="Note"
                        aria-label={`Note on ${c.name}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (c.note ?? '')) setCats(q.categories.map((x) => (x.id === c.id ? { ...x, note: v || undefined } : x)));
                        }}
                      />
                    </td>
                    <td>
                      <NumCell
                        kind="number"
                        value={c.weeklyGoal}
                        format={(v) => (v == null ? '' : String(v))}
                        label={`Weekly goal for ${c.name}`}
                        min={0}
                        allowEmpty={false}
                        onCommit={(v) => v != null && setCats(q.categories.map((x) => (x.id === c.id ? { ...x, weeklyGoal: v } : x)))}
                      />
                    </td>
                    <td className="num muted">{Math.round(hoursFor(c.id) * 100) / 100} h</td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-icon btn-quiet" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => setCats(move(q.categories, i, -1))}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-quiet"
                        aria-label={`Move ${c.name} down`}
                        disabled={i === q.categories.length - 1}
                        onClick={() => setCats(move(q.categories, i, 1))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-quiet"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => {
                          const h = hoursFor(c.id);
                          if (h > 0 && !confirm(`Remove “${c.name}”? Its ${Math.round(h * 100) / 100} logged hours this quarter will be deleted too.`)) return;
                          const days = Object.fromEntries(
                            Object.entries(q.days).map(([d, e]) => {
                              if (!e.hours?.[c.id]) return [d, e];
                              const hours = { ...e.hours };
                              delete hours[c.id];
                              return [d, { ...e, hours: Object.keys(hours).length ? hours : undefined }];
                            }),
                          );
                          dispatch({ type: 'updateQuarter', quarterId: q.id, patch: { categories: q.categories.filter((x) => x.id !== c.id), days } });
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {q.categories.length > 1 && (
                <tfoot>
                  <tr>
                    <th scope="row" className="muted">
                      Total
                    </th>
                    <td className="num muted">
                      <span className="numcell-total">{Math.round(q.categories.reduce((a, c) => a + c.weeklyGoal, 0) * 100) / 100} h</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
            <AddNamed
              placeholder="New category, e.g. Houdini"
              onAdd={(name) => setCats([...q.categories, { id: uniqueId(name, q.categories.map((c) => c.id)), name, weeklyGoal: 0 }])}
            />
          </section>

          <section className="panel">
            <h2>Daily measures</h2>
            <p className="muted">Numbers you track each day that aren’t hours, like sleep score or cups of water.</p>
            {q.metrics.length > 0 && (
              <table className="setup-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Min</th>
                    <th scope="col">Max</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {q.metrics.map((m, i) => (
                    <tr key={m.id} {...metricDrag.row(i, m.name)}>
                      <td>
                        <Grip {...metricDrag.grip(i, m.name)} />
                        <input
                          className="line-input"
                          defaultValue={m.name}
                          aria-label="Measure name"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== m.name) setMetrics(q.metrics.map((x) => (x.id === m.id ? { ...x, name: v } : x)));
                          }}
                        />
                      </td>
                      <td>
                        <NumCell kind="number" value={m.min} format={(v) => (v == null ? '' : String(v))} label="Minimum" allowEmpty={false} onCommit={(v) => v != null && setMetrics(q.metrics.map((x) => (x.id === m.id ? { ...x, min: v } : x)))} />
                      </td>
                      <td>
                        <NumCell kind="number" value={m.max} format={(v) => (v == null ? '' : String(v))} label="Maximum (blank for none)" onCommit={(v) => setMetrics(q.metrics.map((x) => (x.id === m.id ? { ...x, max: v } : x)))} />
                      </td>
                      <td className="row-actions">
                        <button type="button" className="btn btn-icon btn-quiet" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => setMetrics(move(q.metrics, i, -1))}>
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-quiet"
                          aria-label={`Move ${m.name} down`}
                          disabled={i === q.metrics.length - 1}
                          onClick={() => setMetrics(move(q.metrics, i, 1))}
                        >
                          ↓
                        </button>
                        <button type="button" className="btn btn-icon btn-quiet" aria-label={`Remove ${m.name}`} onClick={() => setMetrics(q.metrics.filter((x) => x.id !== m.id))}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AddNamed placeholder="New measure, e.g. Sleep score" onAdd={(name) => setMetrics([...q.metrics, { id: uniqueId(name, q.metrics.map((m) => m.id)), name, min: 0, max: null }])} />
          </section>
        </div>
      </section>

      <section className="setup-group" aria-labelledby="edit-plan">
        <h2 id="edit-plan" className="setup-group-title">
          Plan <span className="count">what the Plan tab shows</span>
        </h2>
        <div className="setup" ref={planGrid}>
          <section className="panel setup-wide">
            <h2>Core focus</h2>
            <TextLines lines={q.core} notes={q.coreNotes} onChange={(core, coreNotes) => patch({ core, coreNotes })} placeholder="Add a core focus" />
          </section>

          <section className="panel setup-wide">
            <h2>{q.year} goals</h2>
            <YearGoals areas={q.yearGoals} onChange={(yearGoals) => patch({ yearGoals })} />
            {q.yearGoals.length === 0 && prevGoals && (
              <button type="button" className="btn btn-sm copy-goals" onClick={() => patch({ yearGoals: structuredClone(prevGoals.yearGoals) })}>
                Copy {q.year} goals from Q{prevGoals.quarter}
              </button>
            )}
          </section>

          <section className="panel">
            <h2>
              {q.id.replace('-', ' ')} projects
              <span className="count">
                {q.projects.filter((p) => p.done).length}/{q.projects.length} done
              </span>
            </h2>
            <Projects projects={q.projects} categories={q.categories} onChange={(projects) => patch({ projects })} confirmRemove={(p) => confirmRemoveProject(state, q.id, p)} />
          </section>

          <section className="panel">
            <h2>
              Reading list
              <span className="count">
                {q.reading.filter((r) => r.status === 'done').length}/{q.reading.length} read
              </span>
            </h2>
            <Reading
              items={q.reading}
              categories={readingCategories(q)}
              onChange={(reading) => patch({ reading })}
              onCategoriesChange={(readingCategories) => patch({ readingCategories })}
            />
          </section>

          <CustomSections sections={q.sections ?? []} onChange={(sections) => patch({ sections })} />
        </div>
      </section>
    </div>
  );
}

function AddNamed({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
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
