import { useEffect, useRef, useState } from 'react';
import type { Quarter } from '../types';
import { weeklyGoalTotal, weeklyTable, fmtHours } from '../lib/calc';
import { seriesVar } from '../lib/colors';
import { weekRange, quarterWeeks } from '../lib/dates';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  const steps = [5, 10, 20, 25, 40, 50, 60, 80, 100, 120, 150, 200];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 50) * 50;
}

/** Stacked weekly hours by category, with the combined weekly goal as a reference line. */
export function WeeklyChart({ quarter: q, currentWeek }: { quarter: Quarter; currentWeek: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const rows = weeklyTable(q);
  const goal = weeklyGoalTotal(q);
  const totals = Array.from({ length: quarterWeeks(q) }, (_, w) => rows.reduce((a, r) => a + r.weeks[w], 0));
  const max = niceMax(Math.max(goal, ...totals, 1));

  const height = 240;
  const pad = { t: 12, r: 8, b: 26, l: 34 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const band = iw / totals.length;
  const barW = Math.min(36, band * 0.62);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];

  return (
    <figure className="chart" ref={ref}>
      <figcaption className="chart-head">
        <span className="chart-title">Hours per week</span>
        <ul className="legend">
          {q.categories.map((c, i) => (
            <li key={c.id}>
              <span className="swatch" style={{ background: seriesVar(i) }} aria-hidden />
              {c.name}
            </li>
          ))}
          <li>
            <span className="swatch swatch-line" aria-hidden />
            Weekly goal ({fmtHours(goal)} h)
          </li>
        </ul>
      </figcaption>
      <div className="chart-body">
        <svg width={width} height={height} role="img" aria-label={`Stacked weekly hours by category for ${q.id}. See the table below for values.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tick">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {totals.map((_, w) => {
            const cx = pad.l + band * w + band / 2;
            let acc = 0;
            const segs = rows
              .map((r, i) => ({ v: r.weeks[w], i, id: r.categoryId }))
              .filter((s) => s.v > 0);
            return (
              <g key={w} className={hover === w ? 'is-hover' : undefined}>
                {segs.map((s, k) => {
                  const y0 = y(acc);
                  acc += s.v;
                  const y1 = y(acc);
                  const top = k === segs.length - 1;
                  const h = Math.max(0, y0 - y1 - (top ? 0 : 2)); // 2px surface gap between segments
                  return top ? (
                    <path
                      key={s.id}
                      d={roundedTop(cx - barW / 2, y1, barW, y0 - y1, Math.min(4, (y0 - y1) / 2))}
                      fill={seriesVar(s.i)}
                    />
                  ) : (
                    <rect key={s.id} x={cx - barW / 2} y={y1 + 2} width={barW} height={h} fill={seriesVar(s.i)} />
                  );
                })}
                <text x={cx} y={height - 8} textAnchor="middle" className={`tick${w === currentWeek ? ' is-current' : ''}`}>
                  {w + 1}
                </text>
                <rect
                  x={pad.l + band * w}
                  y={pad.t}
                  width={band}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(w)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          {goal > 0 && <line x1={pad.l} x2={width - pad.r} y1={y(goal)} y2={y(goal)} className="goal-line" />}
        </svg>
        {hover != null && (
          <div
            className="tooltip"
            style={{
              left: Math.min(width - 200, Math.max(0, pad.l + band * hover + band / 2 - 100)),
              top: 8,
            }}
          >
            <strong>
              Week {hover + 1} · {weekRange(q.startDate, hover)}
            </strong>
            <table>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.categoryId}>
                    <td>
                      <span className="swatch" style={{ background: seriesVar(i) }} aria-hidden />
                      {q.categories[i].name}
                    </td>
                    <td className="num">{fmtHours(r.weeks[hover]) || '–'}</td>
                  </tr>
                ))}
                <tr className="tooltip-total">
                  <td>Total</td>
                  <td className="num">
                    {fmtHours(totals[hover]) || '0'} / {fmtHours(goal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </figure>
  );
}

function roundedTop(x: number, yTop: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  return `M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${yTop + h} Z`;
}
