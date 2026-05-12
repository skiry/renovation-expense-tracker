/**
 * Generate a slug from a title (first 2 words, lowercase, diacritics stripped).
 * "Vopsire pereți living" -> "vopsire-pereti"
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/gi, 's')
    .replace(/[țţ]/gi, 't')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('-');
  return slug || 'cheltuiala';
}

export function uniqueSlug(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function uuid(): string {
  // Use crypto for a real UUID; SWA Functions runtime has it globally.
  return (globalThis.crypto?.randomUUID?.() as string) ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}
