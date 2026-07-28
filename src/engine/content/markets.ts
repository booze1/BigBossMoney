import type { Asset } from '../types';

/**
 * Tradeable instruments. Everything is a parody — no real company is named or
 * represented. Stocks drift gently; crypto is deliberately unhinged.
 *
 * `drift` and `vol` are per-second parameters for a geometric random walk.
 */

interface AssetSeed {
  id: string;
  name: string;
  ticker: string;
  kind: 'stock' | 'crypto';
  price: number;
  drift: number;
  vol: number;
  sector: string;
}

export const ASSET_SEEDS: AssetSeed[] = [
  // Equities
  { id: 'nile', name: 'Nile Commerce', ticker: 'NILE', kind: 'stock', price: 184.2, drift: 0.000021, vol: 0.0042, sector: 'Retail' },
  { id: 'tezla', name: 'Tezla Motors', ticker: 'TZLA', kind: 'stock', price: 246.8, drift: 0.000026, vol: 0.0088, sector: 'Automotive' },
  { id: 'megahard', name: 'MegaHard Corp', ticker: 'MGHD', kind: 'stock', price: 412.5, drift: 0.000019, vol: 0.0034, sector: 'Software' },
  { id: 'gargle', name: 'Gargle Inc', ticker: 'GRGL', kind: 'stock', price: 158.9, drift: 0.000018, vol: 0.0036, sector: 'Search' },
  { id: 'applesauce', name: 'Applesauce', ticker: 'APLS', kind: 'stock', price: 229.4, drift: 0.000017, vol: 0.0031, sector: 'Hardware' },
  { id: 'nvidiya', name: 'Nvidiya Systems', ticker: 'NVDY', kind: 'stock', price: 892.0, drift: 0.000034, vol: 0.0105, sector: 'Semiconductors' },
  { id: 'fizzr', name: 'Fizzr Social', ticker: 'FIZZ', kind: 'stock', price: 43.7, drift: 0.000012, vol: 0.0092, sector: 'Social' },
  { id: 'netflicks', name: 'Netflicks', ticker: 'NTFX', kind: 'stock', price: 521.3, drift: 0.000016, vol: 0.0058, sector: 'Media' },
  { id: 'boing', name: 'Boing Aerospace', ticker: 'BONG', kind: 'stock', price: 178.6, drift: 0.000008, vol: 0.0064, sector: 'Aerospace' },
  { id: 'goldensacks', name: 'Golden Sacks', ticker: 'GSAX', kind: 'stock', price: 386.1, drift: 0.000015, vol: 0.0041, sector: 'Banking' },
  { id: 'wallmert', name: 'Wall-Mert', ticker: 'WMRT', kind: 'stock', price: 76.4, drift: 0.000011, vol: 0.0025, sector: 'Retail' },
  { id: 'starbux', name: 'Starbux Coffee', ticker: 'SBUX', kind: 'stock', price: 94.2, drift: 0.000013, vol: 0.0033, sector: 'Food & Beverage' },

  // Crypto
  { id: 'bitcorn', name: 'Bitcorn', ticker: 'BTCN', kind: 'crypto', price: 62_400, drift: 0.000048, vol: 0.021, sector: 'Store of Value' },
  { id: 'aetherium', name: 'Aetherium', ticker: 'AETH', kind: 'crypto', price: 3_180, drift: 0.000052, vol: 0.026, sector: 'Smart Contracts' },
  { id: 'solano', name: 'Solano', ticker: 'SOLA', kind: 'crypto', price: 142.6, drift: 0.000061, vol: 0.034, sector: 'Layer 1' },
  { id: 'dogeboss', name: 'DogeBoss', ticker: 'DGBS', kind: 'crypto', price: 0.184, drift: 0.00007, vol: 0.052, sector: 'Meme' },
  { id: 'rugcoin', name: 'RugCoin', ticker: 'RUGZ', kind: 'crypto', price: 2.41, drift: 0.00012, vol: 0.078, sector: 'Extremely High Risk' },
  { id: 'stableish', name: 'StableIsh', ticker: 'USDI', kind: 'crypto', price: 1.0, drift: 0.0000004, vol: 0.0016, sector: 'Stablecoin (allegedly)' },
];

export function createAssets(): Asset[] {
  return ASSET_SEEDS.map((s) => ({
    ...s,
    shock: 0,
    history: Array.from({ length: 40 }, () => s.price),
  }));
}

/** News templates. `{name}` and `{ticker}` are substituted at fire time. */
export interface NewsTemplate {
  headline: string;
  detail: string;
  tone: 'good' | 'bad' | 'neutral';
  /** Immediate proportional price jump. */
  jump: number;
  /** Added to drift and decayed over the following minute. */
  shock: number;
  kind?: 'stock' | 'crypto';
}

export const NEWS_TEMPLATES: NewsTemplate[] = [
  { headline: '{name} smashes earnings expectations', detail: '{ticker} beats on both revenue and margin. Analysts scramble to raise targets.', tone: 'good', jump: 0.055, shock: 0.00009, kind: 'stock' },
  { headline: '{name} misses guidance badly', detail: '{ticker} comes in well under consensus. Management blames "macro conditions".', tone: 'bad', jump: -0.06, shock: -0.0001, kind: 'stock' },
  { headline: '{name} announces record buyback', detail: 'The board authorises an enormous repurchase programme. {ticker} rallies.', tone: 'good', jump: 0.038, shock: 0.00006, kind: 'stock' },
  { headline: 'Regulators open probe into {name}', detail: 'Antitrust authorities confirm an investigation. {ticker} sells off.', tone: 'bad', jump: -0.072, shock: -0.00012, kind: 'stock' },
  { headline: '{name} CEO resigns abruptly', detail: 'No successor named. {ticker} traders are not enjoying the ambiguity.', tone: 'bad', jump: -0.045, shock: -0.00007, kind: 'stock' },
  { headline: '{name} lands landmark contract', detail: 'A multi-year deal materially changes the revenue picture for {ticker}.', tone: 'good', jump: 0.068, shock: 0.00011, kind: 'stock' },
  { headline: 'Short seller publishes report on {name}', detail: 'A well-known fund calls {ticker} "structurally impaired". The company denies everything.', tone: 'bad', jump: -0.085, shock: -0.00014, kind: 'stock' },
  { headline: '{name} added to major index', detail: 'Passive inflows are expected to be substantial. {ticker} gaps up.', tone: 'good', jump: 0.049, shock: 0.00008, kind: 'stock' },
  { headline: '{name} product launch underwhelms', detail: 'Reviews are polite. {ticker} drifts lower on soft preorders.', tone: 'bad', jump: -0.033, shock: -0.00005, kind: 'stock' },
  { headline: '{name} raises dividend 20%', detail: 'Income funds pile into {ticker}.', tone: 'good', jump: 0.029, shock: 0.00005, kind: 'stock' },

  { headline: '{name} surges on institutional inflows', detail: 'A major fund discloses a position. {ticker} goes vertical.', tone: 'good', jump: 0.14, shock: 0.00028, kind: 'crypto' },
  { headline: 'Exchange halts {name} withdrawals', detail: 'A major venue cites "technical maintenance". {ticker} holders are unconvinced.', tone: 'bad', jump: -0.19, shock: -0.00035, kind: 'crypto' },
  { headline: '{name} network upgrade goes live', detail: 'Throughput improves dramatically. {ticker} rallies on the news.', tone: 'good', jump: 0.11, shock: 0.00022, kind: 'crypto' },
  { headline: 'Whale wallet dumps {name}', detail: 'A single address moves nine figures of {ticker} to an exchange. Chaos follows.', tone: 'bad', jump: -0.16, shock: -0.0003, kind: 'crypto' },
  { headline: 'Country adopts {name} as legal tender', detail: 'A small nation makes {ticker} official currency. Economists are horrified. Traders are thrilled.', tone: 'good', jump: 0.22, shock: 0.0004, kind: 'crypto' },
  { headline: '{name} founders go quiet', detail: 'The team\'s social accounts have been dark for six days. {ticker} is bleeding.', tone: 'bad', jump: -0.26, shock: -0.00045, kind: 'crypto' },
  { headline: 'Celebrity endorses {name}', detail: 'An extremely famous person tweets a single {ticker} emoji. Volume explodes.', tone: 'good', jump: 0.18, shock: 0.00032, kind: 'crypto' },

  { headline: 'Central bank signals rate cut', detail: 'Risk assets broadly bid. Everything with a ticker is up.', tone: 'good', jump: 0.025, shock: 0.00005 },
  { headline: 'Inflation print comes in hot', detail: 'Markets reprice the path of rates. Broad-based selling.', tone: 'bad', jump: -0.03, shock: -0.00006 },
  { headline: 'Geopolitical tension escalates', detail: 'Risk-off across the board. Investors move to the sidelines.', tone: 'bad', jump: -0.04, shock: -0.00008 },
  { headline: 'Consumer confidence hits multi-year high', detail: 'Spending data is strong across every category.', tone: 'good', jump: 0.022, shock: 0.00004 },
];

/**
 * The market move a generated headline is allowed to cause.
 *
 * Derived from the authored templates above rather than written by hand, so
 * the two can never drift apart: a generated story lands in exactly the range
 * a written one occupies for the same kind of asset and the same tone. This is
 * the whole economic surface the AI press has — it chooses what happened and
 * to whom, and the numbers come from here.
 */
export interface PressEffect {
  jump: number;
  shock: number;
}

function averageOf(kind: NewsTemplate['kind'], tone: NewsTemplate['tone']): PressEffect {
  const matching = NEWS_TEMPLATES.filter((t) => t.kind === kind && t.tone === tone);
  if (matching.length === 0) return { jump: 0, shock: 0 };
  return {
    jump: matching.reduce((sum, t) => sum + t.jump, 0) / matching.length,
    shock: matching.reduce((sum, t) => sum + t.shock, 0) / matching.length,
  };
}

export const PRESS_EFFECTS: Record<'stock' | 'crypto' | 'macro', Record<'good' | 'bad' | 'neutral', PressEffect>> = {
  stock: { good: averageOf('stock', 'good'), bad: averageOf('stock', 'bad'), neutral: { jump: 0, shock: 0 } },
  crypto: { good: averageOf('crypto', 'good'), bad: averageOf('crypto', 'bad'), neutral: { jump: 0, shock: 0 } },
  // Macro templates carry no `kind`, which is what marks them board-wide.
  macro: { good: averageOf(undefined, 'good'), bad: averageOf(undefined, 'bad'), neutral: { jump: 0, shock: 0 } },
};
