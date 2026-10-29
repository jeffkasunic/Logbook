/** Notes on items stored by their text, as for year goals and core focus lines. */
export type TextNotes = Record<string, string>;

/** `notes` with `item`'s note set, or removed when `note` is empty. Unset once no notes are left. */
export function setNote(notes: TextNotes | undefined, item: string, note: string): TextNotes | undefined {
  const next = { ...notes };
  delete next[item];
  if (note) next[item] = note;
  return Object.keys(next).length ? next : undefined;
}
