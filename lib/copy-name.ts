/**
 * Strips a trailing " Copy" or " Copy (N)" suffix (case-insensitive) to get
 * the root name, then appends " Copy".  makeUniqueName handles the rest.
 *
 *   "Standard ADU"          → "Standard ADU Copy"
 *   "Standard ADU Copy"     → "Standard ADU Copy"  (makeUniqueName → "(2)")
 *   "Standard ADU Copy (2)" → "Standard ADU Copy"  (makeUniqueName → "(3)")
 *
 * @param name     The source name (may be null/undefined/blank).
 * @param fallback Used when name is blank, e.g. "Untitled template".
 */
export function makeCopyName(name: string | null | undefined, fallback: string): string {
  const base = name?.trim() || fallback;
  const root = base.replace(/\s+Copy(\s+\(\d+\))?$/i, "");
  return `${root} Copy`;
}

/**
 * Returns `base` if it does not appear in `existing` (case-insensitive,
 * trimmed), otherwise appends the lowest available numeric suffix:
 *   "Foo" → "Foo (2)" → "Foo (3)" …
 */
export function makeUniqueName(base: string, existing: Set<string>): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const existingNorm = new Set([...existing].map(norm));
  if (!existingNorm.has(norm(base))) return base;
  let n = 2;
  while (existingNorm.has(norm(`${base} (${n})`))) n++;
  return `${base} (${n})`;
}
