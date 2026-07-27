import type { EventCardDef } from '../../types';

/**
 * Cards that exist because of what a premises is.
 *
 * Every one of these is gated on a trait, which makes them the road out of a
 * bad purchase. Buying the cheap site with damp is only a real decision if the
 * damp can eventually be dealt with — otherwise the discount is a trap and the
 * shortlist collapses back into "always take the good one".
 *
 * The shape is deliberately consistent: a safe expensive fix that always works,
 * and a cheap one that usually does. Both remove the trait permanently. What
 * varies is how much the failure costs, which is where the category character
 * comes through.
 */

export const PREMISES_CARDS: EventCardDef[] = [
  {
    id: 'prem_damp_survey',
    category: 'any',
    title: 'The Damp Is Worse Than That',
    body: 'A surveyor puts a meter to the back wall and stops talking for a moment. It is coming up from the ground, and it has been for years.',
    requiresTrait: 'damp',
    choices: [
      {
        label: 'Full tanking job',
        hint: 'Expensive, permanent',
        odds: 1,
        good: {
          text: 'Three weeks of noise, a new membrane, and the wall is dry for the first time since the war.',
          cashSeconds: -260,
          removeTrait: 'damp',
        },
        bad: { text: '', cashSeconds: -260, removeTrait: 'damp' },
      },
      {
        label: 'Have a man look at it',
        hint: 'Cheap, might hold',
        odds: 0.5,
        good: {
          text: 'He seals it, charges you almost nothing, and it never comes back. You do not ask how.',
          cashSeconds: -60,
          removeTrait: 'damp',
        },
        bad: {
          text: 'It comes back through the paint within a fortnight, and it brought friends.',
          cashSeconds: -90,
          morale: -0.06,
        },
      },
    ],
  },
  {
    id: 'prem_vermin_contract',
    category: 'any',
    title: 'Something In The Ceiling',
    body: 'A customer heard it first and said so loudly. The staff have known for a while and said nothing, which tells you what they think of you.',
    requiresTrait: 'vermin',
    choices: [
      {
        label: 'Proper eradication contract',
        hint: 'Solves it for good',
        odds: 1,
        good: {
          text: 'Bait, traps, proofing, and a certificate you can put in the window. Gone.',
          cashSeconds: -220,
          removeTrait: 'vermin',
        },
        bad: { text: '', cashSeconds: -220, removeTrait: 'vermin' },
      },
      {
        label: 'Traps and hope',
        hint: 'Cheap, unreliable',
        odds: 0.45,
        good: {
          text: 'Two bad weeks and then nothing. Whatever it was, it has moved on.',
          cashSeconds: -40,
          removeTrait: 'vermin',
        },
        bad: {
          text: 'They learn the traps. Someone films one and the video does numbers.',
          cashSeconds: -130,
          morale: -0.08,
          addTag: { tag: 'bad_press', seconds: 600 },
        },
      },
    ],
  },
  {
    id: 'prem_flood_defence',
    category: 'any',
    title: 'The River Is Up Again',
    body: 'Not into the building. Not yet. The insurer has written to say they have noticed too, and would like to discuss the excess.',
    requiresTrait: 'flood_risk',
    choices: [
      {
        label: 'Barriers, pumps, raised plant',
        hint: 'Ends it',
        odds: 1,
        good: {
          text: 'Flood boards, a sump pump, and everything that matters moved a metre up. Let it rain.',
          cashSeconds: -300,
          removeTrait: 'flood_risk',
        },
        bad: { text: '', cashSeconds: -300, removeTrait: 'flood_risk' },
      },
      {
        label: 'Sandbags and nerve',
        hint: 'Free, and a gamble',
        odds: 0.55,
        good: {
          text: 'It peaks four inches below the door. You watch it all night and it holds.',
          cashSeconds: 0,
          luck: 3,
        },
        bad: {
          text: 'It comes in at three in the morning and takes the stock, the floor and the week.',
          cashSeconds: -340,
          morale: -0.1,
        },
      },
    ],
  },
  {
    id: 'prem_landlord_buyout',
    category: 'any',
    title: 'Your Landlord Wants A Word',
    body: 'Unreachable for eight months about the roof, and here within a day about the review. He has a figure in mind and a smile you do not like.',
    requiresTrait: 'bad_landlord',
    choices: [
      {
        label: 'Buy out the lease terms',
        hint: 'Costly, done with',
        odds: 1,
        good: {
          text: 'A one-off payment, a new schedule, and repairs become his problem in writing.',
          cashSeconds: -240,
          removeTrait: 'bad_landlord',
        },
        bad: { text: '', cashSeconds: -240, removeTrait: 'bad_landlord' },
      },
      {
        label: 'Take him to the tribunal',
        hint: 'Slow, could go either way',
        odds: 0.5,
        good: {
          text: 'The tribunal reads the schedule of dilapidations and finds for you on every point.',
          cashSeconds: 120,
          removeTrait: 'bad_landlord',
          luck: 2,
        },
        bad: {
          text: 'You lose on a technicality about notice, and he is now a landlord with a grudge.',
          cashSeconds: -180,
        },
      },
    ],
  },
  {
    id: 'prem_shoplift_security',
    category: 'retail',
    title: 'They Know Which Shop This Is',
    body: 'Shrinkage is running at a number your accountant reads out twice. It is not one person. It is a reputation.',
    requiresTrait: 'shoplifted',
    choices: [
      {
        label: 'Guard, cameras, gates',
        hint: 'Fixes the reputation',
        odds: 1,
        good: {
          text: 'Two weeks of a visible guard and the traffic simply stops coming. Word travels both ways.',
          cashSeconds: -230,
          removeTrait: 'shoplifted',
        },
        bad: { text: '', cashSeconds: -230, removeTrait: 'shoplifted' },
      },
      {
        label: 'Make an example of one',
        hint: 'Fast, ugly if it lands wrong',
        odds: 0.45,
        good: {
          text: 'A prosecution, a local news item, and the shop drops off the list.',
          cashSeconds: -50,
          removeTrait: 'shoplifted',
        },
        bad: {
          text: 'It was a fifteen-year-old, the footage is everywhere, and you are the villain of it.',
          cashSeconds: -160,
          morale: -0.1,
          addTag: { tag: 'bad_press', seconds: 720 },
        },
      },
    ],
  },
  {
    id: 'prem_noise_soundproof',
    category: 'nightclub',
    title: 'The Flat Upstairs Has A Solicitor',
    body: 'Forty-one logged complaints, timestamped, in a spreadsheet, appended to a licence review. She is not unreasonable. She is just extremely organised.',
    requiresTrait: 'noise_complaints',
    choices: [
      {
        label: 'Acoustic isolation, properly',
        hint: 'Ends the war',
        odds: 1,
        good: {
          text: 'Floating floor, isolated ceiling, a lobby on the fire door. She writes to withdraw.',
          cashSeconds: -280,
          removeTrait: 'noise_complaints',
        },
        bad: { text: '', cashSeconds: -280, removeTrait: 'noise_complaints' },
      },
      {
        label: 'Buy her out of the flat',
        hint: 'Solves the person, not the room',
        odds: 0.6,
        good: {
          text: 'She takes over the asking price and goes. The next tenant is a DJ.',
          cashSeconds: -200,
          removeTrait: 'noise_complaints',
          luck: 2,
        },
        bad: {
          text: 'She declines, in writing, and attaches your offer to the licence review as evidence.',
          cashSeconds: -60,
          morale: -0.06,
        },
      },
    ],
  },
  {
    id: 'prem_legacy_rewrite',
    category: 'tech',
    title: 'The Weekend Is Over',
    body: 'Nobody has understood the billing module for two years. It went down for nine minutes on Tuesday and came back on its own, which is somehow worse.',
    requiresTrait: 'built_on_a_weekend',
    choices: [
      {
        label: 'Stop everything and rewrite it',
        hint: 'A quarter of pain',
        odds: 1,
        good: {
          text: 'No features shipped for a season. Then it is boring, documented, and it stays up.',
          cashSeconds: -290,
          removeTrait: 'built_on_a_weekend',
        },
        bad: { text: '', cashSeconds: -290, removeTrait: 'built_on_a_weekend' },
      },
      {
        label: 'Rewrite it around the edges',
        hint: 'Keep shipping, mostly',
        odds: 0.45,
        good: {
          text: 'Strangled a piece at a time over months. Nobody notices, which is the highest praise.',
          cashSeconds: -110,
          removeTrait: 'built_on_a_weekend',
        },
        bad: {
          text: 'The seam between old and new fails under load and takes billing with it for a day.',
          cashSeconds: -220,
          morale: -0.08,
          addTag: { tag: 'tech_debt', seconds: 720 },
        },
      },
    ],
  },
  {
    id: 'prem_consent_remediation',
    category: 'bank',
    title: "You Inherited Somebody Else's Problem",
    body: 'The findings predate you by six years. The regulator is aware of that and has explained, politely, that it changes nothing.',
    requiresTrait: 'regulator_watch',
    choices: [
      {
        label: 'Full remediation programme',
        hint: 'Gets you off the list',
        odds: 1,
        good: {
          text: 'Eighteen months of consultants and a closing letter. The list no longer has you on it.',
          cashSeconds: -320,
          removeTrait: 'regulator_watch',
        },
        bad: { text: '', cashSeconds: -320, removeTrait: 'regulator_watch' },
      },
      {
        label: 'Argue it was inherited',
        hint: 'Cheap if it works',
        odds: 0.4,
        good: {
          text: 'The successor-liability argument lands. Supervision steps down a level.',
          cashSeconds: -70,
          removeTrait: 'regulator_watch',
          luck: 3,
        },
        bad: {
          text: 'They take the argument as evidence you have not understood the finding. Escalated.',
          cashSeconds: -240,
          addTag: { tag: 'consent_order', seconds: 900 },
        },
      },
    ],
  },
  {
    id: 'prem_title_settlement',
    category: 'devco',
    title: 'The Cousin Has Flown In',
    body: 'Two generations and four thousand miles of distance, and a document she believes settles it. Her lawyer thinks it might.',
    requiresTrait: 'contested_title',
    choices: [
      {
        label: 'Settle and register clean',
        hint: 'Pay her, own it outright',
        odds: 1,
        good: {
          text: 'A number, a signature, and a title with nothing on it for the first time in decades.',
          cashSeconds: -300,
          removeTrait: 'contested_title',
        },
        bad: { text: '', cashSeconds: -300, removeTrait: 'contested_title' },
      },
      {
        label: 'Let it go to court',
        hint: 'Win it all or lose the years',
        odds: 0.45,
        good: {
          text: 'The document is a copy of a copy. The court finds for you and awards costs.',
          cashSeconds: 140,
          removeTrait: 'contested_title',
          luck: 3,
        },
        bad: {
          text: 'It is genuine. You keep the land and a bill that could have bought another plot.',
          cashSeconds: -360,
          morale: -0.08,
        },
      },
    ],
  },

  // --------------------------------------------------------------------------
  // The way in. A trait can also be acquired, which is what stops the good
  // sites from being permanently good and gives the fix-it cards above
  // something to do on a premises that started clean.
  {
    id: 'prem_big_night',
    category: 'nightclub',
    title: 'The Biggest Night You Have Had',
    body: 'A booking lands that is three sizes too big for the room. It will be the best night of the year and it will be heard four streets away.',
    excludesTrait: 'noise_complaints',
    minLevel: 3,
    choices: [
      {
        label: 'Take the booking',
        hint: 'Huge, and loud',
        odds: 0.6,
        good: {
          text: 'Sold out, queue round the corner, and the neighbours somehow slept through it.',
          cashSeconds: 340,
          morale: 0.08,
        },
        bad: {
          text: 'Sold out, and by Monday there is a file at the council with your name on it.',
          cashSeconds: 260,
          addTrait: 'noise_complaints',
        },
      },
      {
        label: 'Turn it down',
        hint: 'Keep the licence quiet',
        odds: 1,
        good: {
          text: 'You pass it to a bigger room and take a finder’s fee. Nobody complains about anything.',
          cashSeconds: 60,
        },
        bad: { text: '', cashSeconds: 60 },
      },
    ],
  },
];
