import type { EventCardDef } from '../../types';

/**
 * Retail deck. Low margins, high footfall, constant small crises. The tags
 * this deck writes — `shrinkage`, `viral`, `house_brand`, `bad_lease` — gate
 * later cards so a store that has been robbed reads differently from one that
 * has not.
 */

export const RETAIL_CARDS: EventCardDef[] = [
  {
    id: 'retail_supplier',
    category: 'retail',
    title: 'Supplier Hikes Prices',
    body: 'Your main distributor wants 18% more, effective immediately. They know you have no alternative lined up. Probably.',
    choices: [
      {
        label: 'Pay it',
        hint: 'Certain, small cost',
        odds: 1,
        good: { text: 'You eat the increase. Shelves stay full and nobody notices.', cashSeconds: -30, morale: 0.02 },
        bad: { text: '', cashSeconds: -30 },
      },
      {
        label: 'Find a new supplier',
        hint: 'Risky — could save a lot',
        odds: 0.55,
        good: {
          text: 'You find a regional wholesaler running 12% under your old rate. Margins up.',
          boost: { label: 'Cheap Supply Line', kind: 'income', power: 1.3, duration: 300, scope: 'business' },
        },
        bad: {
          text: 'Two weeks of empty shelves while the new contract clears. Customers go elsewhere.',
          cashSeconds: -110,
          morale: -0.15,
        },
      },
    ],
  },
  {
    id: 'retail_shoplifting',
    category: 'retail',
    title: 'Shrinkage Problem',
    body: 'Inventory counts are off. Somewhere between the loading dock and the register, product is walking out the door.',
    excludesTag: 'shrinkage_solved',
    choices: [
      {
        label: 'Install cameras',
        hint: 'Upfront cost, permanent fix',
        odds: 0.85,
        good: {
          text: 'Losses stop within a week. Worth the install.',
          cashSeconds: -45,
          morale: 0.08,
          addTag: { tag: 'shrinkage_solved', seconds: 1200 },
        },
        bad: { text: 'The cameras catch nothing. The shrinkage continues.', cashSeconds: -70, morale: -0.05, addTag: { tag: 'shrinkage' } },
      },
      {
        label: 'Search staff bags',
        hint: 'Cheap, morale risk',
        odds: 0.4,
        good: { text: 'You find the culprit on day two. Problem solved, quietly.', cashSeconds: 20, morale: -0.04, addTag: { tag: 'shrinkage_solved', seconds: 900 } },
        bad: { text: 'You find nothing and insult everyone. Two people quit on the spot.', morale: -0.3, staff: -1, addTag: { tag: 'shrinkage' } },
      },
      {
        label: 'Write it off',
        hint: 'Do nothing',
        odds: 1,
        good: { text: 'You absorb the loss as a cost of doing business.', cashSeconds: -60, addTag: { tag: 'shrinkage' } },
        bad: { text: '', cashSeconds: -60 },
      },
    ],
  },
  {
    id: 'retail_shrinkage_ring',
    category: 'retail',
    title: 'It Was Organised',
    body: 'The losses you shrugged off were not opportunistic. A crew has been working your store on a schedule, and they have your delivery times.',
    requiresTag: 'shrinkage',
    choices: [
      {
        label: 'Bring in loss prevention',
        hint: 'Expensive, ends it',
        odds: 0.9,
        good: {
          text: 'Professionals map the pattern in four days and the crew moves on.',
          cashSeconds: -120,
          removeTag: 'shrinkage',
          addTag: { tag: 'shrinkage_solved', seconds: 1800 },
        },
        bad: { text: 'They bill you for a month and the crew simply changes days.', cashSeconds: -200 },
      },
      {
        label: 'Change the delivery schedule',
        hint: 'Free, might work',
        odds: 0.5,
        good: { text: 'Randomised deliveries break the pattern. Losses stop.', removeTag: 'shrinkage' },
        bad: { text: 'They adapt within a fortnight, and now your drivers are annoyed too.', cashSeconds: -140, morale: -0.1 },
      },
    ],
  },
  {
    id: 'retail_influencer',
    category: 'retail',
    title: 'An Influencer Walks In',
    body: 'Someone with 2.3 million followers is filming in aisle four. They want free product in exchange for "exposure".',
    choices: [
      {
        label: 'Load them up',
        hint: 'Gamble on reach',
        odds: 0.6,
        good: {
          text: 'The video does 4 million views. There is a line out the door by Saturday.',
          boost: { label: 'Viral Moment', kind: 'income', power: 2.1, duration: 240, scope: 'business' },
          addTag: { tag: 'viral', seconds: 420 },
          chain: { cardId: 'retail_viral_aftermath', delay: 260 },
        },
        bad: { text: 'The video flops. You gave away a pallet of inventory for 400 views.', cashSeconds: -90 },
      },
      {
        label: 'Charge them full price',
        hint: 'Safe, small upside',
        odds: 0.75,
        good: { text: 'They pay, film anyway, and mention you by name. Free marketing.', cashSeconds: 35 },
        bad: { text: 'They post a story calling your store "rude". Minor damage.', cashSeconds: -25, morale: -0.06 },
      },
    ],
  },
  {
    id: 'retail_viral_aftermath',
    category: 'retail',
    title: 'The Rush Is Ending',
    body: 'The video traffic is tailing off. You have a warehouse of stock bought for a crowd that is about to stop coming, and a mailing list of nine thousand people.',
    chainOnly: true,
    choices: [
      {
        label: 'Convert them to regulars',
        hint: 'Invest in retention',
        odds: 0.65,
        good: {
          text: 'A loyalty offer lands. A slice of the crowd becomes actual customers.',
          boost: { label: 'New Regulars', kind: 'income', power: 1.4, duration: 900, scope: 'business' },
          cashSeconds: -40,
        },
        bad: { text: 'They came for a video, not for you. The list goes cold.', cashSeconds: -90 },
      },
      {
        label: 'Discount the overstock',
        hint: 'Recover the cash',
        odds: 1,
        good: { text: 'You clear the excess at cost. No profit, no dead stock.', cashSeconds: 45 },
        bad: { text: '', cashSeconds: 45 },
      },
    ],
  },
  {
    id: 'retail_rush',
    category: 'retail',
    title: 'Unexpected Rush',
    body: 'A street festival two blocks over just let out. Three hundred people are heading your way and you have two people on shift.',
    choices: [
      {
        label: 'Call everyone in',
        hint: 'Overtime, big sales',
        odds: 0.8,
        good: { text: 'All hands on deck. Best sales day in the store\'s history.', cashSeconds: 160, morale: 0.05 },
        bad: { text: 'Half the team is unreachable. You pay overtime for a rush you half-missed.', cashSeconds: 20, morale: -0.05 },
      },
      {
        label: 'Ride it out',
        hint: 'No cost, capped upside',
        odds: 1,
        good: { text: 'You sell what you can. Long lines, some walkouts, solid day.', cashSeconds: 60 },
        bad: { text: '', cashSeconds: 60 },
      },
    ],
  },
  {
    id: 'retail_lease',
    category: 'retail',
    title: 'Landlord Wants to Renegotiate',
    body: 'Your lease is up in 60 days. The landlord has "options" and would love to hear yours.',
    minLevel: 3,
    choices: [
      {
        label: 'Sign a long lease',
        hint: 'Lock in stability',
        odds: 0.9,
        good: {
          text: 'Five years locked at today\'s rate. Predictable and cheap.',
          boost: { label: 'Locked Lease', kind: 'income', power: 1.18, duration: 600, scope: 'business' },
        },
        bad: { text: 'You lock in right before the district softens. Overpaying for years.', cashSeconds: -120, addTag: { tag: 'bad_lease', seconds: 900 } },
      },
      {
        label: 'Call their bluff',
        hint: 'High risk',
        odds: 0.45,
        good: { text: 'They fold. Rent drops 15% and you get two months free.', cashSeconds: 200 },
        bad: { text: 'They had another tenant lined up. You pay a premium to stay put.', cashSeconds: -180, morale: -0.1, addTag: { tag: 'bad_lease', seconds: 900 } },
      },
    ],
  },
  {
    id: 'retail_bad_lease_out',
    category: 'retail',
    title: 'A Way Out of the Lease',
    body: 'A chain wants your unit and will pay to take the lease off your hands. Getting out of the deal you regret means moving the store.',
    requiresTag: 'bad_lease',
    choices: [
      {
        label: 'Take the buyout and move',
        hint: 'Disruption, then relief',
        odds: 0.75,
        good: { text: 'Two weeks of chaos, then a better unit at a better rate.', cashSeconds: 140, removeTag: 'bad_lease', morale: -0.08 },
        bad: { text: 'The new location has half the footfall. You traded rent for customers.', cashSeconds: -160, morale: -0.15 },
      },
      {
        label: 'Stay and absorb it',
        hint: 'No change',
        odds: 1,
        good: { text: 'You stay put and pay the rate you agreed to. It stings monthly.', cashSeconds: -50 },
        bad: { text: '', cashSeconds: -50 },
      },
    ],
  },
  {
    id: 'retail_ownbrand',
    category: 'retail',
    title: 'Launch a House Brand',
    body: 'Your buyer thinks you could private-label the top-selling items at double the margin. It means capital up front.',
    minLevel: 4,
    excludesTag: 'house_brand',
    choices: [
      {
        label: 'Fund the line',
        hint: 'Expensive, strong upside',
        odds: 0.65,
        good: {
          text: 'The house brand outsells the name brand within a month.',
          boost: { label: 'House Brand', kind: 'income', power: 1.55, duration: 900, scope: 'business' },
          addTag: { tag: 'house_brand', seconds: 1800 },
        },
        bad: { text: 'Customers do not trust the packaging. The inventory sits.', cashSeconds: -200 },
      },
      {
        label: 'Stick to what works',
        hint: 'No change',
        odds: 1,
        good: { text: 'You pass. The shelves stay exactly as profitable as yesterday.', morale: 0.02 },
        bad: { text: '', morale: 0.02 },
      },
    ],
  },
  {
    id: 'retail_brand_expand',
    category: 'retail',
    title: 'Someone Wants to Stock Your Brand',
    body: 'A regional grocer has noticed your house label and wants it on their shelves. That means manufacturing at a volume you have never attempted.',
    requiresTag: 'house_brand',
    choices: [
      {
        label: 'Scale up production',
        hint: 'Big spend, big reach',
        odds: 0.6,
        good: {
          text: 'Your label is in forty stores. You are a supplier now, not just a shop.',
          boost: { label: 'Wholesale Channel', kind: 'income', power: 1.9, duration: 1200, scope: 'business' },
        },
        bad: { text: 'You miss the first two delivery windows and they cancel the order.', cashSeconds: -280, morale: -0.12 },
      },
      {
        label: 'License it to them',
        hint: 'Small, safe',
        odds: 0.9,
        good: { text: 'They manufacture, you collect a royalty on every unit.', boost: { label: 'Brand Royalty', kind: 'income', power: 1.25, duration: 1500, scope: 'business' } },
        bad: { text: 'They make it badly and your name is on it.', cashSeconds: -90, morale: -0.1 },
      },
    ],
  },
  {
    id: 'retail_selfcheckout',
    category: 'retail',
    title: 'Self-Checkout Pitch',
    body: 'A vendor will install four self-checkout terminals. Fewer cashiers, shorter queues, and a machine that says "unexpected item" forty times an hour.',
    minLevel: 2,
    choices: [
      {
        label: 'Install them',
        hint: 'Cuts wages, raises theft',
        odds: 0.7,
        good: { text: 'Queues halve and you redeploy staff to the floor. Sales tick up.', boost: { label: 'Automated Front End', kind: 'income', power: 1.3, duration: 600, scope: 'business' }, cashSeconds: -70 },
        bad: { text: 'Theft climbs and older regulars hate them. Net negative.', cashSeconds: -150, addTag: { tag: 'shrinkage' } },
      },
      {
        label: 'Keep the tills staffed',
        hint: 'Costlier, warmer',
        odds: 1,
        good: { text: 'People like being served by people. Costs stay, so does goodwill.', morale: 0.12 },
        bad: { text: '', morale: 0.12 },
      },
    ],
  },
  {
    id: 'retail_competitor',
    category: 'retail',
    title: 'A Chain Opens Across the Street',
    body: 'National branding, deeper pockets, and an opening-week promotion designed to take your customers permanently.',
    minLevel: 2,
    choices: [
      {
        label: 'Match their prices',
        hint: 'Painful, holds ground',
        odds: 0.7,
        good: { text: 'You hold your customers through the promo. Margins hurt for a month.', cashSeconds: -110, morale: 0.05 },
        bad: { text: 'They can lose money longer than you can. You blink first.', cashSeconds: -240, morale: -0.15 },
      },
      {
        label: 'Go where they cannot',
        hint: 'Specialise',
        odds: 0.65,
        good: {
          text: 'You lean into local, odd and specific. They cannot stock what you stock.',
          boost: { label: 'Not a Chain', kind: 'income', power: 1.45, duration: 900, scope: 'business' },
        },
        bad: { text: 'Your new range is too niche and the old range is gone.', cashSeconds: -180 },
      },
    ],
  },
  {
    id: 'retail_spoilage',
    category: 'retail',
    title: 'The Chiller Failed Overnight',
    body: 'Everything in the cold aisle is at room temperature and the engineer cannot come until Thursday.',
    choices: [
      {
        label: 'Emergency callout',
        hint: 'Expensive, immediate',
        odds: 0.9,
        good: { text: 'Fixed by lunchtime. You lose one morning of chilled sales.', cashSeconds: -70 },
        bad: { text: 'The part has to be ordered. You paid a premium to wait anyway.', cashSeconds: -140 },
      },
      {
        label: 'Rent a chiller van',
        hint: 'Improvised',
        odds: 0.65,
        good: { text: 'Stock survives in the van. Ugly, cheap, effective.', cashSeconds: -35 },
        bad: { text: 'The van is too small. You bin half the aisle.', cashSeconds: -160, morale: -0.08 },
      },
    ],
  },
  {
    id: 'retail_loyalty',
    category: 'retail',
    title: 'Loyalty Card Scheme',
    body: 'A points programme would tell you exactly what everyone buys. It also gives away a slice of every basket.',
    minLevel: 3,
    choices: [
      {
        label: 'Launch it',
        hint: 'Data for margin',
        odds: 0.8,
        good: {
          text: 'The data reshapes your ordering. You stop buying what nobody wants.',
          boost: { label: 'Loyalty Data', kind: 'income', power: 1.35, duration: 900, scope: 'business' },
        },
        bad: { text: 'Sign-ups are poor and you gave discounts to people who shopped anyway.', cashSeconds: -100 },
      },
      {
        label: 'Skip it',
        hint: 'Keep the margin',
        odds: 1,
        good: { text: 'You keep every cent of every basket and learn nothing.', cashSeconds: 20 },
        bad: { text: '', cashSeconds: 20 },
      },
    ],
  },
  {
    id: 'retail_nightshift',
    category: 'retail',
    title: 'Trade Through the Night?',
    body: 'The unit could open 24 hours. Overnight trade is thin but the rent is already paid and the neighbourhood has nowhere else at 3am.',
    minLevel: 4,
    choices: [
      {
        label: 'Go 24 hours',
        hint: 'More hours, more cost',
        odds: 0.6,
        good: {
          text: 'Overnight becomes a quiet, reliable earner with almost no competition.',
          boost: { label: 'Always Open', kind: 'income', power: 1.5, duration: 1200, scope: 'business' },
        },
        bad: { text: 'Three customers a night and a security bill. You close it after a month.', cashSeconds: -170, morale: -0.1 },
      },
      {
        label: 'Extend to midnight only',
        hint: 'Modest, safe',
        odds: 0.85,
        good: { text: 'The late-evening hours pay for themselves comfortably.', boost: { label: 'Late Hours', kind: 'income', power: 1.2, duration: 900, scope: 'business' } },
        bad: { text: 'The extra hours barely cover the extra wages.', cashSeconds: -40 },
      },
    ],
  },
  {
    id: 'retail_recall',
    category: 'retail',
    title: 'Product Recall',
    body: 'A supplier has recalled a line you have been selling for six weeks. Some of it went to regulars you know by name.',
    choices: [
      {
        label: 'Call every customer you can',
        hint: 'Costly, right',
        odds: 0.9,
        good: { text: 'Nobody was harmed, and the effort becomes a story people repeat about you.', cashSeconds: -80, morale: 0.2, luck: 4 },
        bad: { text: 'You reach most of them. The ones you miss are loud about it.', cashSeconds: -150, morale: -0.05 },
      },
      {
        label: 'Post the notice and move on',
        hint: 'Minimum required',
        odds: 0.7,
        good: { text: 'The notice goes up, the stock comes off, nothing comes of it.', cashSeconds: -40 },
        bad: { text: 'Someone got sick and went to the local paper first.', cashSeconds: -260, morale: -0.25 },
      },
    ],
  },
  {
    id: 'retail_pop_up',
    category: 'retail',
    title: 'Pop-Up Request',
    body: 'A local maker wants to run a stall inside your store for a month. They bring their own crowd and take a cut of nothing.',
    choices: [
      {
        label: 'Give them the space',
        hint: 'Free footfall',
        odds: 0.8,
        good: { text: 'Their crowd becomes some of your crowd. Both of you do well.', boost: { label: 'Pop-Up Traffic', kind: 'income', power: 1.35, duration: 480, scope: 'business' }, luck: 2 },
        bad: { text: 'They take a prime aisle and bring eleven people.', cashSeconds: -60 },
      },
      {
        label: 'Charge them rent',
        hint: 'Guaranteed small money',
        odds: 1,
        good: { text: 'A month of stall rent, paid up front, no risk.', cashSeconds: 55 },
        bad: { text: '', cashSeconds: 55 },
      },
    ],
  },
  {
    id: 'retail_union',
    category: 'retail',
    title: 'Staff Want to Organise',
    body: 'Your team has been talking. They want guaranteed hours and a say in the rota, and they have been reading up on how to ask for it.',
    minLevel: 3,
    choices: [
      {
        label: 'Negotiate in good faith',
        hint: 'Costs money, keeps the team',
        odds: 0.85,
        good: { text: 'You give ground on hours and gain a team that stays for years.', cashSeconds: -120, morale: 0.35 },
        bad: { text: 'Talks drag. The concessions land anyway, later and more expensively.', cashSeconds: -200, morale: 0.05 },
      },
      {
        label: 'Resist it',
        hint: 'Cheap now',
        odds: 0.45,
        good: { text: 'The push fizzles out. Nothing changes, including how they feel about you.', morale: -0.15 },
        bad: { text: 'Half the shift walks out on a Saturday and it is on the local news.', cashSeconds: -240, morale: -0.35, staff: -2 },
      },
    ],
  },
  {
    id: 'retail_flood',
    category: 'retail',
    title: 'Water Damage',
    body: 'A pipe in the unit above let go overnight. The stockroom is standing in two inches of water and the insurance line is busy.',
    choices: [
      {
        label: 'Claim on insurance',
        hint: 'Slow, mostly covered',
        odds: 0.8,
        good: { text: 'The claim pays out most of it. Three weeks of paperwork.', cashSeconds: -60 },
        bad: { text: 'The policy excludes water ingress from another tenant. Read the small print.', cashSeconds: -220 },
      },
      {
        label: 'Sue the upstairs tenant',
        hint: 'Slower, larger',
        odds: 0.55,
        good: { text: 'Liability is clear. They pay for everything plus lost trade.', cashSeconds: 130 },
        bad: { text: 'They are a shell company with no assets and a good lawyer.', cashSeconds: -180 },
      },
      {
        label: 'Absorb it and reopen',
        hint: 'Fast, costly',
        odds: 1,
        good: { text: 'You mop, restock, and open on Monday like nothing happened.', cashSeconds: -110, morale: 0.08 },
        bad: { text: '', cashSeconds: -110, morale: 0.08 },
      },
    ],
  },
];
