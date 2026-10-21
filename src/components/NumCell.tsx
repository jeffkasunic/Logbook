import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseHours, parseNumber } from '../lib/calc';

interface Props {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  /** "hours" accepts 1:30 / 90m style input; "number" accepts plain numbers. */
  kind?: 'hours' | 'number';
  format: (v: number | null | undefined) => string;
  label: string;
  /** Grid coordinates for spreadsheet-style arrow-key navigation. */
  row?: number;
  col?: number;
  grid?: string;
  min?: number;
  max?: number | null;
  allowEmpty?: boolean;
  className?: string;
}

/** Move focus to a neighbouring cell in the same grid. */
function focusCell(grid: string, row: number, col: number) {
  const el = document.querySelector<HTMLInputElement>(
    `input[data-grid="${grid}"][data-row="${row}"][data-col="${col}"]`,
  );
  if (el) {
    el.focus();
    el.select();
  }
}

export function NumCell({
  value,
  onCommit,
  kind = 'hours',
  format,
  label,
  row,
  col,
  grid,
  min,
  max,
  allowEmpty = true,
  className,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setInvalid(false), [value]);

  function commit(): boolean {
    if (draft == null) return true;
    const parsed = kind === 'hours' ? parseHours(draft) : parseNumber(draft);
    if (
      parsed === 'invalid' ||
      (parsed == null && !allowEmpty) ||
      (parsed != null && ((min != null && parsed < min) || (max != null && parsed > max)))
    ) {
      setInvalid(true);
      return false;
    }
    setDraft(null);
    setInvalid(false);
    if (parsed !== (value ?? null)) onCommit(parsed);
    return true;
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setDraft(null);
      setInvalid(false);
      ref.current?.blur();
      return;
    }
    if (grid == null || row == null || col == null) {
      if (e.key === 'Enter') commit();
      return;
    }
    const moves: Record<string, [number, number]> = {
      Enter: [e.shiftKey ? -1 : 1, 0],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const atStart = ref.current?.selectionStart === 0 && ref.current?.selectionEnd === 0;
    const atEnd = ref.current?.selectionStart === (ref.current?.value.length ?? 0);
    if (e.key === 'ArrowLeft' && atStart) moves.ArrowLeft = [0, -1];
    if (e.key === 'ArrowRight' && atEnd) moves.ArrowRight = [0, 1];
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      if (commit()) focusCell(grid, row + mv[0], col + mv[1]);
    }
  }

  const shown = draft ?? format(value);
  return (
    <input
      ref={ref}
      className={`numcell${invalid ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={invalid ? (kind === 'hours' ? 'Use hours like 1.5, 1:30 or 90m' : 'Enter a number in range') : label}
      data-grid={grid}
      data-row={row}
      data-col={col}
      value={shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        if (!commit()) {
          // Revert invalid entry on blur rather than trapping focus.
          setDraft(null);
          setInvalid(false);
        }
      }}
      onKeyDown={onKeyDown}
    />
  );
}
