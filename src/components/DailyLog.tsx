import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { quarterFor, useStore } from '../store';
import { addDays, shortDate, weekday, weekRange, quarterWeeks, longDate, weekIndexOf } from '../lib/dates';
import { dayPct, dayTotal, fmtHours, fmtPct, weekHours, weeklyGoalTotal } from '../lib/calc';
import { heatStep, seriesVar } from '../lib/colors';
import { NumCell } from './NumCell';

interface Props {
  today: string;
  selected: string;
  onSelect: (d: string) => void;
}

/** The full quarter as an editable sheet: one row per day, one column per category. */
export function DailyLog({ today, selected, onSelect }: Props) {
  const { quarter: q, dispatch } = useStore();
  const span = 4 + q.categories.length + q.metrics.length + (q.metrics.length > 0 ? 1 : 0);
  const hasWeeklyGoals = q.categories.some((c) => c.weeklyGoal);
  const headSpan = hasWeeklyGoals ? 2 : undefined;
  // Weekly goal progress follows the selected day's week.
  const selWeek = weekIndexOf(q, selected);
  const ids = q.categories.map((c) => c.id);
  const wrapRef = useRef<HTMLDivElement>(null);
  const grid = `daily-${q.id}`;
  const [barEnd, setBarEnd] = useState<number | null>(null);

  // Line the day bar's last progress block up with the right edge of the last
  // category column, by sizing the slot after it to the rest of the bar. Only
  // when the sheet fits without scrolling sideways; otherwise the bar just wraps.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const bar = wrap?.parentElement?.querySelector<HTMLElement>('.daybar');
    if (!wrap || !bar) return;
    const measure = () => {
      const cats = wrap.querySelectorAll<HTMLElement>('thead tr:first-child th.col-cat');
      const last = cats[cats.length - 1];
      if (!last || wrap.scrollWidth > wrap.clientWidth) return setBarEnd(null);
      const cs = getComputedStyle(bar);
      const end = bar.getBoundingClientRect().right - parseFloat(cs.paddingRight) - last.getBoundingClientRect().right - parseFloat(cs.columnGap);
      setBarEnd(end > 0 ? Math.round(end) : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(wrap.querySelector('table')!);
    return () => ro.disconnect();
  }, [q.id, q.categories.length, q.metrics.length]);

  // Bring the selected day's week into view when it changes (e.g. from the strip),
  // with its week header directly under the sticky column heads.
  useEffect(() => {
    const wrap = wrapRef.current;
    let row = wrap?.querySelector<HTMLElement>(`tr[data-date="${selected}"]`);
    while (row && !row.classList.contains('week-row')) row = row.previousElementSibling as HTMLElement | null;
    if (row && wrap) {
      const head = wrap.querySelector('thead')?.getBoundingClientRect().height ?? 0;
      const top = wrap.scrollTop + row.getBoundingClientRect().top - wrap.getBoundingClientRect().top - head;
      wrap.scrollTo({ top, behavior: 'smooth' });
    }
  }, [selected, q.id]);

  return (
    <section className="panel sheet-panel" aria-label="Daily log">
      <DayBar date={selected} today={today} onDateChange={onSelect} endWidth={barEnd} />
      <div className="sheet-wrap" ref={wrapRef}>
        <table className="sheet daily-sheet">
          <thead>
            <tr>
              <th className="col-date" scope="col">
                Day
              </th>
              {q.categories.map((c, i) => (
                <th key={c.id} scope="col" className="col-cat">
                  <span className="th-swatch" style={{ background: seriesVar(i) }} aria-hidden />
                  {c.name}
                </th>
              ))}
              <th scope="col" rowSpan={headSpan} className="col-goal">
                Goal
              </th>
              <th scope="col" rowSpan={headSpan} className="col-total">
                Total
              </th>
              <th scope="col" rowSpan={headSpan} className="col-pct">
                % of goal
              </th>
              {q.metrics.length > 0 && <th rowSpan={headSpan} className="col-gap" aria-hidden />}
              {q.metrics.map((m) => (
                <th key={m.id} scope="col" rowSpan={headSpan} className="col-metric">
                  {m.name}
                </th>
              ))}
            </tr>
            {hasWeeklyGoals && (
              <tr className="goal-row">
                <th scope="row" className="col-date">
                  Weekly goal
                </th>
                {q.categories.map((c, i) => {
                  if (!c.weeklyGoal) return <th key={c.id} className="col-cat" />;
                  const done = selWeek < 0 ? null : weekHours(q, selWeek, c.id);
                  return (
                    <th key={c.id} className="col-cat num">
                      {done == null ? `${c.weeklyGoal} h` : `${fmtHours(done) || '0'} / ${c.weeklyGoal} h`}
                      {done != null && (
                        <span
                          className="goalbar"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={c.weeklyGoal}
                          aria-valuenow={done}
                          aria-label={`${c.name}, week ${selWeek + 1} against weekly goal`}
                        >
                          <span style={{ width: `${Math.min(100, (done / c.weeklyGoal) * 100)}%`, background: seriesVar(i) }} />
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {Array.from({ length: quarterWeeks(q) }, (_, w) => {
              const weekDates = Array.from({ length: 7 }, (_, d) => addDays(q.startDate, w * 7 + d));
              const weekSum = weekDates.reduce((a, d) => a + dayTotal(q.days[d], ids), 0);
              return (
                <Fragment key={w}>
                  <tr className="week-row">
                    <th scope="rowgroup" colSpan={span}>
                      <span className="week-num">Week {w + 1}</span>
                      <span className="week-range">{weekRange(q.startDate, w)}</span>
                      {weekSum > 0 && <span className="week-sum">{fmtHours(weekSum)} h</span>}
                    </th>
                  </tr>
                  {weekDates.map((date, d) => {
                    const r = w * 7 + d;
                    const e = q.days[date];
                    const total = dayTotal(e, ids);
                    const pct = dayPct(e, ids);
                    const cls = [date === today && 'is-today', date === selected && 'is-selected', date > today && 'is-future', d >= 5 && 'is-weekend']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <tr key={date} data-date={date} className={cls}>
                        <th scope="row" className="col-date">
                          <button type="button" className="daybtn" onClick={() => onSelect(date)} title={`Select ${longDate(date)}`}>
                            <span className="dow">{weekday(date)}</span>
                            <span className="dom">{shortDate(date)}</span>
                          </button>
                        </th>
                        {q.categories.map((c, ci) => (
                          <td key={c.id}>
                            <NumCell
                              grid={grid}
                              row={r}
                              col={ci}
                              value={e?.hours?.[c.id]}
                              format={fmtHours}
                              label={`${c.name}, ${longDate(date)}`}
                              min={0}
                              max={24}
                              onCommit={(v) =>
                                dispatch({
                                  type: 'setHours',
                                  quarterId: q.id,
                                  date,
                                  categoryId: c.id,
                                  value: v,
                                })
                              }
                            />
                          </td>
                        ))}
                        <td className="col-goal">
                          <NumCell
                            grid={grid}
                            row={r}
                            col={q.categories.length}
                            kind="number"
                            value={e?.goal ?? q.defaultDailyGoal}
                            format={(v) => (v == null ? '' : String(v))}
                            label={`Goal, ${longDate(date)}`}
                            min={0}
                            max={24}
                            allowEmpty={false}
                            onCommit={(v) =>
                              v != null &&
                              dispatch({
                                type: 'setGoal',
                                quarterId: q.id,
                                date,
                                value: v,
                              })
                            }
                          />
                        </td>
                        <td className="col-total num">{fmtHours(total)}</td>
                        <td className={`col-pct num heat-${heatStep(pct)}`}>{fmtPct(pct)}</td>
                        {q.metrics.length > 0 && <td className="col-gap" aria-hidden />}
                        {q.metrics.map((m, mi) => (
                          <td key={m.id} className="col-metric">
                            <NumCell
                              grid={grid}
                              row={r}
                              col={q.categories.length + 1 + mi}
                              kind="number"
                              value={e?.metrics?.[m.id]}
                              format={(v) => (v == null ? '' : String(v))}
                              label={`${m.name}, ${longDate(date)}`}
                              min={m.min}
                              max={m.max}
                              onCommit={(v) =>
                                dispatch({
                                  type: 'setMetric',
                                  quarterId: q.id,
                                  date,
                                  metricId: m.id,
                                  value: v,
                                })
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint sheet-hint">Arrow keys and Enter move between cells, like a spreadsheet. Type hours as 1.5, 1:30 or 90m. Click a date to select it.</p>
    </section>
  );
}

/** Day navigation and progress for the selected day, above the sheet. */
function DayBar({
  date,
  today,
  onDateChange,
  endWidth,
}: {
  date: string;
  today: string;
  onDateChange: (d: string) => void;
  /** Width of the slot after the progress blocks, so they end at the last category column. */
  endWidth: number | null;
}) {
  const { state } = useStore();
  const q = quarterFor(state, date);
  const entry = q?.days[date];
  const week = q ? weekIndexOf(q, date) : -1;
  const weekGoal = q ? weeklyGoalTotal(q) : 0;

  return (
    <header className={`daybar${endWidth != null ? ' is-aligned' : ''}`}>
      <div className="daynav">
        <button type="button" className="btn btn-icon" aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          ‹
        </button>
        <h2 className="daynav-date">
          {date === today ? 'Today' : longDate(date).split(',')[0]}
          <small>{longDate(date).split(', ').slice(1).join(', ')}</small>
        </h2>
        <button type="button" className="btn btn-icon" aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          ›
        </button>
      </div>

      {q ? (
        <>
          <Progress
            label="Day"
            goal={entry?.goal ?? q.defaultDailyGoal}
            parts={q.categories.map((c, i) => ({ name: c.name, hours: entry?.hours?.[c.id] ?? 0, color: seriesVar(i) }))}
          />
          {weekGoal > 0 && (
            <Progress
              label={`Week ${week + 1}`}
              goal={weekGoal}
              parts={q.categories.map((c, i) => ({ name: c.name, hours: weekHours(q, week, c.id), color: seriesVar(i) }))}
            />
          )}
        </>
      ) : (
        <p className="muted dayprogress">This date isn’t in any quarter yet. Add a quarter in Settings to start logging it.</p>
      )}

      <div className="daybar-end" style={endWidth != null ? { flexBasis: endWidth } : undefined}>
        {date !== today && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDateChange(today)}>
            Go to today
          </button>
        )}
      </div>
    </header>
  );
}

/** A big total against a goal, over a bar stacked by category. */
function Progress({ label, goal, parts }: { label: string; goal: number; parts: { name: string; hours: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.hours, 0);
  return (
    <div className="dayprogress">
      <div className="dayprogress-figures">
        <span className="dayprogress-label">{label}</span>
        <span className="dayprogress-total">{fmtHours(total) || '0'}</span>
        <span className="muted"> of {fmtHours(goal) || '0'} h</span>
        <span className="dayprogress-pct">{total && goal ? fmtPct(total / goal) : ''}</span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={total} aria-label={`${label}: hours logged against goal`}>
        {parts.map((p) =>
          p.hours && goal ? (
            <span
              key={p.name}
              style={{ width: `${Math.min(100, (p.hours / goal) * 100)}%`, background: p.color }}
              title={`${p.name}: ${fmtHours(p.hours)} h`}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
