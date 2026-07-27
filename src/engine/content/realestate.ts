import type { City, Property, PropertyKind } from '../types';
import { pick, range, uid } from '../rng';

/**
 * Real estate spans three uses that feed each other:
 *  - residential: pure rental yield
 *  - commercial: rental yield, and can house a business (kills its rent,
 *    adds a margin bonus)
 *  - land: no yield until you build on it, then it beats everything
 */

interface CitySeed {
  id: string;
  name: string;
  country: string;
  /** Multiplies the base value of every listing generated here. */
  priceLevel: number;
  /** Typical annual rent yield in this market. */
  yieldLevel: number;
  indexDrift: number;
  unlockAt: number;
  districts: string[];
}

export const CITY_SEEDS: CitySeed[] = [
  {
    id: 'miami', name: 'Miami', country: 'USA', priceLevel: 1, yieldLevel: 0.072,
    indexDrift: 0.000022, unlockAt: 0,
    districts: ['Brickell', 'South Beach', 'Coconut Grove', 'Wynwood', 'Key Biscayne', 'Design District'],
  },
  {
    id: 'manhattan', name: 'Manhattan', country: 'USA', priceLevel: 3.4, yieldLevel: 0.048,
    indexDrift: 0.000018, unlockAt: 400_000,
    districts: ['Tribeca', 'Upper East Side', 'SoHo', 'Central Park South', 'West Village', 'Hudson Yards'],
  },
  {
    id: 'london', name: 'London', country: 'UK', priceLevel: 4.1, yieldLevel: 0.041,
    indexDrift: 0.000015, unlockAt: 2_500_000,
    districts: ['Mayfair', 'Knightsbridge', 'Chelsea', 'Belgravia', 'Notting Hill', 'The City'],
  },
  {
    id: 'dubai', name: 'Dubai', country: 'UAE', priceLevel: 5.2, yieldLevel: 0.082,
    indexDrift: 0.000042, unlockAt: 12_000_000,
    districts: ['Palm Jumeirah', 'Downtown', 'Emirates Hills', 'Marina', 'Business Bay', 'Jumeirah Bay'],
  },
  {
    id: 'tokyo', name: 'Tokyo', country: 'Japan', priceLevel: 6.8, yieldLevel: 0.038,
    indexDrift: 0.000012, unlockAt: 60_000_000,
    districts: ['Ginza', 'Minato', 'Shibuya', 'Aoyama', 'Marunouchi', 'Roppongi Hills'],
  },
  {
    id: 'monaco', name: 'Monaco', country: 'Monaco', priceLevel: 11.5, yieldLevel: 0.029,
    indexDrift: 0.000026, unlockAt: 250_000_000,
    districts: ['Monte Carlo', 'La Condamine', 'Larvotto', 'Fontvieille', 'Port Hercule', 'Le Rocher'],
  },
];

export function createCities(): City[] {
  return CITY_SEEDS.map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    index: 1,
    indexDrift: s.indexDrift,
    history: Array.from({ length: 40 }, () => 1),
    unlockAt: s.unlockAt,
  }));
}

export const CITY_SEED_BY_ID: Record<string, CitySeed> = Object.fromEntries(
  CITY_SEEDS.map((c) => [c.id, c]),
);

const RESIDENTIAL_TYPES = ['Penthouse', 'Apartment', 'Townhouse', 'Villa', 'Loft', 'Duplex', 'Residence'];
const COMMERCIAL_TYPES = ['Retail Unit', 'Office Floor', 'Mixed-Use Block', 'Corner Building', 'Warehouse', 'Storefront'];
const LAND_TYPES = ['Vacant Lot', 'Development Site', 'Cleared Parcel', 'Corner Plot', 'Waterfront Site'];

/** Base value of a listing before the city index is applied. */
export function generateListing(cityId: string, forceKind?: PropertyKind): Property {
  const seed = CITY_SEED_BY_ID[cityId];
  const kind: PropertyKind =
    forceKind ?? pick<PropertyKind>(['residential', 'residential', 'commercial', 'commercial', 'land']);

  const district = pick(seed.districts);
  const sizeFactor = range(0.55, 2.6);

  let typeName: string;
  let baseValue: number;
  let rentYield: number;

  if (kind === 'residential') {
    typeName = pick(RESIDENTIAL_TYPES);
    baseValue = 420_000 * seed.priceLevel * sizeFactor;
    rentYield = seed.yieldLevel * range(0.85, 1.15);
  } else if (kind === 'commercial') {
    typeName = pick(COMMERCIAL_TYPES);
    baseValue = 640_000 * seed.priceLevel * sizeFactor;
    rentYield = seed.yieldLevel * range(1.0, 1.35);
  } else {
    typeName = pick(LAND_TYPES);
    baseValue = 260_000 * seed.priceLevel * sizeFactor;
    rentYield = 0;
  }

  return {
    id: uid('prop'),
    cityId,
    name: `${typeName}, ${district}`,
    kind,
    purchasePrice: 0,
    baseValue: Math.round(baseValue),
    rentYield,
    owned: false,
    development: null,
    developedType: null,
  };
}

export function generateCityListings(cityId: string, count: number): Property[] {
  const out: Property[] = [];
  // Guarantee at least one commercial unit so business housing is always available.
  out.push(generateListing(cityId, 'commercial'));
  out.push(generateListing(cityId, 'land'));
  for (let i = 2; i < count; i++) out.push(generateListing(cityId));
  return out;
}

export interface DevelopmentOption {
  type: string;
  label: string;
  description: string;
  /** Build cost as a multiple of the plot's current value. */
  costRatio: number;
  /** Real seconds to build. */
  buildSeconds: number;
  /** Value multiplier applied on completion. */
  valueMultiplier: number;
  /** Rent yield the finished building produces. */
  yieldBonus: number;
}

export const DEVELOPMENT_OPTIONS: DevelopmentOption[] = [
  {
    type: 'townhomes',
    label: 'Townhome Row',
    description: 'Six units, quick build, reliable rent. Nothing clever.',
    costRatio: 0.9,
    buildSeconds: 180,
    valueMultiplier: 2.3,
    yieldBonus: 0.075,
  },
  {
    type: 'retail_strip',
    label: 'Retail Parade',
    description: 'Ground-floor commercial. Fast money, moderate ceiling.',
    costRatio: 1.2,
    buildSeconds: 300,
    valueMultiplier: 2.9,
    yieldBonus: 0.095,
  },
  {
    type: 'apartments',
    label: 'Apartment Block',
    description: 'Forty units. Slower, considerably more valuable.',
    costRatio: 2.1,
    buildSeconds: 600,
    valueMultiplier: 4.4,
    yieldBonus: 0.088,
  },
  {
    type: 'tower',
    label: 'Signature Tower',
    description: 'The one that goes on the skyline. Enormous cost, enormous return.',
    costRatio: 4.5,
    buildSeconds: 1_500,
    valueMultiplier: 9.5,
    yieldBonus: 0.105,
  },
];

export const DEVELOPMENT_BY_TYPE: Record<string, DevelopmentOption> = Object.fromEntries(
  DEVELOPMENT_OPTIONS.map((d) => [d.type, d]),
);

/** Random flavour used when a city index moves sharply. */
export const PROPERTY_HEADLINES = [
  { city: '{city}', text: 'Foreign buyers pile into {city} prime property', tone: 'good' as const },
  { city: '{city}', text: '{city} planning reform unlocks new supply', tone: 'bad' as const },
  { city: '{city}', text: 'Record price per square foot set in {city}', tone: 'good' as const },
  { city: '{city}', text: '{city} rental market softens on new completions', tone: 'bad' as const },
  { city: '{city}', text: 'Infrastructure announcement lifts {city} values', tone: 'good' as const },
  { city: '{city}', text: 'Vacancy rates climb across {city}', tone: 'bad' as const },
];
