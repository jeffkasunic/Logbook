import type { Quarter } from '../types';
import { addDays, longDate, quarterWeeks } from '../lib/dates';
import { dayPct, dayTotal, fmtHours, fmtPct } from '../lib/calc';
import { heatStep } from '../lib/colors';

interface Props {
  quarter: Quarter;
  today: string;
  selected?: string;
  onSelect?: (date: string) => void;
}

const ROW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The quarter at a glance: 13 (or 14) week columns × 7 weekday rows, each square
 * shaded by how much of that day's goal was logged.
 */
export function QuarterStrip({ quarter, today, selected, onSelect }: Props) {
  const ids = quarter.categories.map((c) => c.id);
  const weeks = quarterWeeks(quarter);
  return (
    <figure className="strip" aria-label={`Daily progress for ${quarter.id}`}>
      <div className="strip-grid" role="grid" style={{ gridTemplateColumns: `14px repeat(${weeks}, minmax(0, 1fr))` }}>
        <div className="strip-corner" aria-hidden />
        {Array.from({ length: weeks }, (_, w) => (
          <div key={`h${w}`} className="strip-week" aria-hidden>
            {w + 1}
          </div>
        ))}
        {ROW_LABELS.map((label, r) => (
          <div key={`row${r}`} className="strip-row" role="row">
            <div className="strip-daylabel" aria-hidden>
              {label}
            </div>
            {Array.from({ length: weeks }, (_, w) => {
              const date = addDays(quarter.startDate, w * 7 + r);
              const e = quarter.days[date];
              const pct = dayPct(e, ids);
              const total = dayTotal(e, ids);
              const future = date > today;
              const desc = `${longDate(date)}: ${total ? `${fmtHours(total)} h of ${e?.goal ?? quarter.defaultDailyGoal} (${fmtPct(pct)})` : future ? 'upcoming' : 'nothing logged'}`;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  className={`strip-cell heat-${heatStep(pct)}${future ? ' is-future' : ''}${date === today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}`}
                  title={desc}
                  aria-label={desc}
                  onClick={() => onSelect?.(date)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <figcaption className="strip-legend">
        <span>Share of daily goal</span>
        <span className="strip-key">
          {[1, 2, 3, 4, 5].map((s) => (
            <i key={s} className={`strip-cell heat-${s}`} aria-hidden />
          ))}
        </span>
        <span>under ¼ → goal met</span>
      </figcaption>
    </figure>
  );
}
