import { useStore } from '../store';
import { fmtHours, fmtPct, quarterStats, weeklyGoalTotal, weeklyTable } from '../lib/calc';
import { heatStep, seriesVar } from '../lib/colors';
import { quarterWeeks, weekIndexOf, weekRange } from '../lib/dates';
import { NumCell } from './NumCell';
import { WeeklyChart } from './WeeklyChart';
import { Linkify } from './Linkify';
import { QuarterStrip } from './QuarterStrip';

/** The weekly sheet: each category's hours per week against its weekly goal. */
export function WeeklySummary({ today, onOpenDay }: { today: string; onOpenDay: (d: string) => void }) {
  const { quarter: q, dispatch } = useStore();
  const rows = weeklyTable(q);
  const goal = weeklyGoalTotal(q);
  const weeks = quarterWeeks(q);
  const totals = Array.from({ length: weeks }, (_, w) => rows.reduce((a, r) => a + r.weeks[w], 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const currentWeek = weekIndexOf(q, today);
  const stats = quarterStats(q, today);
  const weeksElapsed = currentWeek < 0 ? (today > q.startDate ? weeks : 0) : currentWeek + 1;

  function setWeeklyGoal(id: string, v: number) {
    dispatch({
      type: 'updateQuarter',
      quarterId: q.id,
      patch: { categories: q.categories.map((c) => (c.id === id ? { ...c, weeklyGoal: v } : c)) },
    });
  }

  return (
    <div className="weekly">
      <section className="panel sheet-panel" aria-label="Weekly totals by category">
        <div className="sheet-wrap sheet-wrap-x">
          <table className="sheet weekly-sheet">
            <thead>
              <tr>
                <th scope="col" className="col-name">
                  Category
                </th>
                <th scope="col" className="col-goal">
                  Goal / wk
                </th>
                {Array.from({ length: weeks }, (_, w) => (
                  <th key={w} scope="col" className={`col-week${w === currentWeek ? ' is-current' : ''}`} title={weekRange(q.startDate, w)}>
                    W{w + 1}
                  </th>
                ))}
                <th scope="col" className="col-total">
                  Quarter
                </th>
                <th scope="col" className="col-pct">
                  % of {weeks} wks
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = q.categories[i];
                return (
                  <tr key={r.categoryId}>
                    <th scope="row" className="col-name">
                      <span className="th-swatch" style={{ background: seriesVar(i) }} aria-hidden />
                      {c.name}
                      {c.note && (
                        <span className="weekly-note">
                          <Linkify text={c.note} />
                        </span>
                      )}
                    </th>
                    <td className="col-goal">
                      <NumCell
                        kind="number"
                        grid={`wk-${q.id}`}
                        row={i}
                        col={0}
                        value={c.weeklyGoal}
                        format={(v) => (v == null ? '' : String(v))}
                        label={`Weekly goal for ${c.name}`}
                        min={0}
                        allowEmpty={false}
                        onCommit={(v) => v != null && setWeeklyGoal(c.id, v)}
                      />
                    </td>
                    {r.weeks.map((h, w) => {
                      const pct = c.weeklyGoal ? h / c.weeklyGoal : null;
                      return (
                        <td
                          key={w}
                          className={`num heatcell heat-${h ? heatStep(pct) : 0}${w === currentWeek ? ' is-current' : ''}`}
                          title={`${c.name}, week ${w + 1}: ${fmtHours(h) || 0} h of ${c.weeklyGoal} (${fmtPct(pct)})`}
                        >
                          <span className="heat-h">{fmtHours(h)}</span>
                          {h > 0 && pct != null && <span className="heat-p">{fmtPct(pct)}</span>}
                        </td>
                      );
                    })}
                    <td className="num col-total">{fmtHours(r.total)}</td>
                    <td className="num col-pct">{c.weeklyGoal ? fmtPct(r.total / (c.weeklyGoal * weeks)) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="col-name">
                  Total
                </th>
                <td className="num col-goal">{fmtHours(goal)}</td>
                {totals.map((t, w) => {
                  const pct = goal ? t / goal : null;
                  return (
                    <td key={w} className={`num heatcell heat-${t ? heatStep(pct) : 0}${w === currentWeek ? ' is-current' : ''}`}>
                      <span className="heat-h">{fmtHours(t)}</span>
                      {t > 0 && <span className="heat-p">{fmtPct(pct)}</span>}
                    </td>
                  );
                })}
                <td className="num col-total">{fmtHours(grand)}</td>
                <td className="num col-pct">{goal ? fmtPct(grand / (goal * weeks)) : ''}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="panel overview">
        <QuarterStrip quarter={q} today={today} onSelect={onOpenDay} />
        <dl className="stats">
          <div>
            <dt>Logged this quarter</dt>
            <dd>{fmtHours(grand) || '0'} h</dd>
          </div>
          <div>
            <dt>Against goal to date</dt>
            <dd>{weeksElapsed ? fmtPct(grand / (goal * weeksElapsed)) : '–'}</dd>
          </div>
          <div>
            <dt>Days with time logged</dt>
            <dd>{stats.daysLogged}</dd>
          </div>
          <div>
            <dt>Days that met the daily goal</dt>
            <dd>{stats.daysMetGoal}</dd>
          </div>
          <div>
            <dt>Average on logged days</dt>
            <dd>{fmtHours(stats.avgPerLoggedDay) || '0'} h</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <WeeklyChart quarter={q} currentWeek={currentWeek} />
      </section>
    </div>
  );
}
