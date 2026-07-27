import type { CategoryId } from '../types';

/**
 * The people.
 *
 * Headcount used to be an integer you incremented. It is now a roster, and the
 * only reason for that is what it does to the decisions around it: closing a
 * business or trimming a wage bill stops being a number going down and starts
 * being a list of names, some of whom have been there since the beginning.
 *
 * Tenure is the mechanical half. Someone who has been with you for years is
 * worth more than a new hire and costs more to let go, so churning staff to
 * chase a margin is a real trade rather than free. Both effects are bounded —
 * see TUNING.tenure* — because the wage invariant that keeps hiring worthwhile
 * has to survive them.
 */

const FIRST_NAMES = [
  'Dee', 'Marcus', 'Priya', 'Tom', 'Nadia', 'Kwame', 'Ellie', 'Rafiq',
  'Joan', 'Bez', 'Ines', 'Callum', 'Yusuf', 'Marta', 'Ade', 'Fiona',
  'Otto', 'Lena', 'Sami', 'Bridget', 'Hugo', 'Nkechi', 'Cass', 'Dev',
  'Moira', 'Tariq', 'Suki', 'Ronan', 'Gia', 'Pavel', 'Winnie', 'Oskar',
  'Bea', 'Idris', 'Noor', 'Gus', 'Anouk', 'Femi', 'Rosa', 'Linus',
  'Maeve', 'Zhi', 'Colm', 'Tilda', 'Reuben', 'Sinead', 'Kofi', 'Vera',
  'Douglas', 'Amara', 'Piet', 'Nell', 'Hamza', 'Bobbie', 'Serge', 'Wren',
  'Agnes', 'Milo', 'Farrah', 'Stan',
];

const SURNAMES = [
  'Okafor', 'Brennan', 'Novak', 'Kaur', 'Whitlock', 'Ferreira', 'Osei',
  'Lindqvist', 'Abadi', 'Duffy', 'Marchetti', 'Nwosu', 'Halloran', 'Petrov',
  'Achebe', 'Vance', 'Kowalski', 'Rahman', 'Beaumont', 'Sørensen', 'Diallo',
  'Quinn', 'Mbeki', 'Ashworth', 'Tanaka', 'Grimaldi', 'Odell', 'Bhatt',
  'Lennox', 'Varga', 'Sowande', 'Prosser', 'Ivanova', 'Cronin', 'Adeyemi',
  'Blackwood', 'Nurse', 'Salvatierra', 'Doyle', 'Eze',
];

/**
 * What someone actually does, per category. These appear next to the name
 * everywhere a person does, and they are the difference between "3 staff" and
 * a shop with someone on the tills and someone in the stockroom.
 */
const ROLES: Record<CategoryId, string[]> = {
  retail: ['on the tills', 'stockroom', 'shop floor', 'weekend cover', 'deliveries'],
  restaurant: ['on the pass', 'front of house', 'kitchen porter', 'sous', 'on the bar'],
  nightclub: ['on the door', 'behind the bar', 'in the booth', 'glass collector', 'cloakroom'],
  tech: ['backend', 'design', 'support', 'infrastructure', 'data'],
  bank: ['on the counter', 'compliance', 'lending', 'back office', 'reconciliation'],
  devco: ['site foreman', 'quantity surveyor', 'plant operator', 'planning', 'groundworks'],
};

export function roleFor(category: CategoryId): string {
  const roles = ROLES[category] ?? ROLES.retail;
  return roles[Math.floor(Math.random() * roles.length)];
}

/**
 * A name not already on this business's books. Repeats across the empire are
 * fine — two shops can each have a Dee — but not within one team.
 */
export function staffName(taken: string[]): string {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 40; attempt++) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const name = `${first} ${last}`;
    if (!used.has(name)) return name;
  }
  // 2,400 combinations against a cap in the tens, so this is unreachable in
  // practice; the suffix is here so the loop can never fail to return a name.
  return `${FIRST_NAMES[0]} ${SURNAMES[0]} ${taken.length + 1}`;
}

/** How long someone has served, in game years. */
export function tenureYears(hiredAt: number, now: number, secondsPerGameYear: number): number {
  return Math.max(0, (now - hiredAt) / 1000 / secondsPerGameYear);
}

/** "3 years" / "8 months" — for the places a number would read as cold. */
export function tenureLabel(years: number): string {
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const rounded = Math.floor(years);
  return `${rounded} year${rounded === 1 ? '' : 's'}`;
}
