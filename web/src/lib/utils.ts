import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRon(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrency(value: number, currency: 'RON' | 'EUR'): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Genereaza un slug din titlu: primele 2 cuvinte, lowercase, fara diacritice.
 * Ex: "Vopsire pereți living" -> "vopsire-pereti"
 *     "Ușă intrare casă" -> "usa-intrare"
 *     "Mobilier!!! @#$" -> "mobilier"
 *     "" sau doar simboluri -> "cheltuiala"
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Romanian-specific: ș/ț cu virgula sub si tilda
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

/** Daca slug-ul exista in lista existingIds, intoarce slug-2, slug-3, etc. */
export function uniqueSlug(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let i = 2;
  while (existingIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
