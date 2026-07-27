/**
 * Number and time formatting. Idle games live or die on readable big numbers,
 * so this is the one place that decides how money looks anywhere in the UI.
 */

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

/** Compact money: 1_234_567 -> "$1.23M". Handles negatives and sub-$1. */
export function money(n: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (!Number.isFinite(n)) return '$∞';
  const neg = n < 0;
  const abs = Math.abs(n);
  const prefix = neg ? '-$' : opts.sign && n > 0 ? '+$' : '$';

  if (abs < 1000) {
    const d = opts.decimals ?? (abs < 10 && abs % 1 !== 0 ? 2 : 0);
    return prefix + abs.toFixed(d);
  }

  const tier = Math.min(Math.floor(Math.log10(abs) / 3), UNITS.length - 1);
  const scaled = abs / Math.pow(1000, tier);
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return prefix + scaled.toFixed(decimals) + UNITS[tier];
}

/** Money with full precision, for tooltips and confirmations. */
export function moneyExact(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  return (
    (neg ? '-$' : '$') +
    abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  );
}

/** A per-second rate, e.g. "$1.20K/s". */
export function rate(n: number): string {
  return `${money(n, { sign: n > 0 })}/s`;
}

export function pct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function signedPct(n: number, decimals = 2): string {
  const s = n >= 0 ? '+' : '';
  return `${s}${(n * 100).toFixed(decimals)}%`;
}

/** Seconds -> "2h 14m", "3m 02s", "45s". */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Short countdown for badges: "1:04", "12s". */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
