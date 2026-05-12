import { ExchangeRate } from '../shared/types';

interface CacheEntry {
  rate: ExchangeRate;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;
const FALLBACK_EUR_TO_RON = 5.0;

/** Fetch latest EUR->RON rate from BNR. Cached 24h in memory. */
export async function getEurToRon(forceRefresh = false): Promise<ExchangeRate> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return { ...cache.rate, source: 'cache' };
  }

  try {
    const res = await fetch('https://www.bnr.ro/nbrfxrates.xml', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`BNR responded ${res.status}`);
    const xml = await res.text();
    const match = xml.match(/<Rate\s+currency="EUR"[^>]*>([\d.]+)<\/Rate>/i);
    if (!match) throw new Error('EUR rate not found in BNR response');
    const eurToRon = parseFloat(match[1]);
    if (!Number.isFinite(eurToRon) || eurToRon <= 0) throw new Error('Invalid EUR rate parsed');

    const rate: ExchangeRate = {
      eurToRon,
      updatedAt: new Date().toISOString(),
      source: 'BNR',
    };
    cache = { rate, expiresAt: Date.now() + TTL_MS };
    return rate;
  } catch (err) {
    // On failure, fall back to last cached value if any, else hardcoded fallback.
    if (cache) return { ...cache.rate, source: 'cache' };
    return {
      eurToRon: FALLBACK_EUR_TO_RON,
      updatedAt: new Date().toISOString(),
      source: 'fallback',
    };
  }
}
