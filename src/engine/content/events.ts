import type { EventCardDef } from '../types';

/**
 * The event deck. Cards are the primary way the player *plays* a business
 * rather than watching it. Each card offers a safe option and a greedy option;
 * the greedy one usually has odds under 1 that the Luck stat nudges upward.
 *
 * `cashSeconds` is denominated in multiples of the business's net income per
 * second, so a card written once stays meaningful from the first corner store
 * to a billion-dollar development arm.
 */

export const EVENT_CARDS: EventCardDef[] = [
  // ---------------------------------------------------------------- retail
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
        bad: { text: 'Two weeks of empty shelves while the new contract clears. Customers go elsewhere.', cashSeconds: -110, morale: -0.15 },
      },
    ],
  },
  {
    id: 'retail_shoplifting',
    category: 'retail',
    title: 'Shrinkage Problem',
    body: 'Inventory counts are off. Somewhere between the loading dock and the register, product is walking out the door.',
    choices: [
      {
        label: 'Install cameras',
        hint: 'Upfront cost, permanent fix',
        odds: 0.85,
        good: { text: 'Losses stop within a week. Worth the install.', cashSeconds: -45, morale: 0.08 },
        bad: { text: 'The cameras catch nothing. The shrinkage continues.', cashSeconds: -70, morale: -0.05 },
      },
      {
        label: 'Search staff bags',
        hint: 'Cheap, morale risk',
        odds: 0.4,
        good: { text: 'You find the culprit on day two. Problem solved, quietly.', cashSeconds: 20, morale: -0.04 },
        bad: { text: 'You find nothing and insult everyone. Two people quit on the spot.', morale: -0.3, staff: -1 },
      },
      {
        label: 'Write it off',
        hint: 'Do nothing',
        odds: 1,
        good: { text: 'You absorb the loss as a cost of doing business.', cashSeconds: -60 },
        bad: { text: '', cashSeconds: -60 },
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
        good: { text: 'Five years locked at today\'s rate. Predictable and cheap.', boost: { label: 'Locked Lease', kind: 'income', power: 1.18, duration: 600, scope: 'business' } },
        bad: { text: 'You lock in right before the district softens. Overpaying for years.', cashSeconds: -120 },
      },
      {
        label: 'Call their bluff',
        hint: 'High risk',
        odds: 0.45,
        good: { text: 'They fold. Rent drops 15% and you get two months free.', cashSeconds: 200 },
        bad: { text: 'They had another tenant lined up. You pay a premium to stay put.', cashSeconds: -180, morale: -0.1 },
      },
    ],
  },
  {
    id: 'retail_ownbrand',
    category: 'retail',
    title: 'Launch a House Brand',
    body: 'Your buyer thinks you could private-label the top-selling items at double the margin. It means capital up front.',
    minLevel: 4,
    choices: [
      {
        label: 'Fund the line',
        hint: 'Expensive, strong upside',
        odds: 0.65,
        good: { text: 'The house brand outsells the name brand within a month.', boost: { label: 'House Brand', kind: 'income', power: 1.55, duration: 900, scope: 'business' } },
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

  // ------------------------------------------------------------ restaurant
  {
    id: 'rest_critic',
    category: 'restaurant',
    title: 'A Critic Is In The Dining Room',
    body: 'Table nine. No reservation under a real name, photographing every course. Your head chef has noticed and is visibly unravelling.',
    choices: [
      {
        label: 'Send out the tasting menu',
        hint: 'Swing for the fence',
        odds: 0.55,
        good: {
          text: 'Three stars. The phone has not stopped ringing since the review dropped.',
          boost: { label: 'Rave Review', kind: 'income', power: 2.4, duration: 420, scope: 'business' },
          morale: 0.25,
        },
        bad: { text: 'The kitchen buckles under the pressure. "Ambitious and undercooked," they write.', cashSeconds: -150, morale: -0.28 },
      },
      {
        label: 'Play the hits',
        hint: 'Safe, modest reward',
        odds: 0.85,
        good: { text: '"Reliable, warm, unpretentious." Not a rave, but bookings tick up.', boost: { label: 'Solid Notice', kind: 'income', power: 1.35, duration: 300, scope: 'business' } },
        bad: { text: '"Competent but forgettable." No harm done, no help either.', morale: -0.05 },
      },
    ],
  },
  {
    id: 'rest_chef',
    category: 'restaurant',
    title: 'Your Chef Has an Offer',
    body: 'A competitor offered your head chef their own kitchen and 40% more. They came to you first, which means something.',
    choices: [
      {
        label: 'Beat the offer',
        hint: 'Costly, keeps the talent',
        odds: 0.9,
        good: { text: 'They stay, and they are loyal about it. The kitchen settles.', cashSeconds: -140, morale: 0.3 },
        bad: { text: 'They take your counter to the competitor and leverage it higher. Gone anyway.', cashSeconds: -140, morale: -0.25, staff: -1 },
      },
      {
        label: 'Offer equity instead',
        hint: 'Clever, uncertain',
        odds: 0.6,
        good: { text: 'A share of the restaurant means more than salary. They are all in now.', boost: { label: 'Chef-Owner', kind: 'income', power: 1.45, duration: 900, scope: 'business' }, morale: 0.35 },
        bad: { text: 'They wanted cash, not paper. They leave and take two line cooks with them.', morale: -0.35, staff: -2 },
      },
      {
        label: 'Let them go',
        hint: 'Cheap now, hurts later',
        odds: 1,
        good: { text: 'You wish them well and promote the sous chef. Rocky few weeks ahead.', morale: -0.18, staff: -1, cashSeconds: 40 },
        bad: { text: '', morale: -0.18, staff: -1, cashSeconds: 40 },
      },
    ],
  },
  {
    id: 'rest_inspection',
    category: 'restaurant',
    title: 'Health Inspector',
    body: 'Unannounced visit. The walk-in has been running two degrees warm all week and you have been meaning to call someone about it.',
    choices: [
      {
        label: 'Full transparency',
        hint: 'Honest, small penalty',
        odds: 0.8,
        good: { text: 'You flag it yourself. They note the repair order and pass you with a warning.', cashSeconds: -50, morale: 0.1 },
        bad: { text: 'Honesty earns you a formal citation anyway. Bureaucracy is bureaucracy.', cashSeconds: -130 },
      },
      {
        label: 'Hope they miss it',
        hint: 'Gamble',
        odds: 0.5,
        good: { text: 'They never open the walk-in. Clean pass, and you fix it that night.', cashSeconds: -15 },
        bad: { text: 'Immediate closure order. Three days dark and a public notice on the door.', cashSeconds: -320, morale: -0.3 },
      },
    ],
  },
  {
    id: 'rest_delivery',
    category: 'restaurant',
    title: 'Delivery Apps Come Calling',
    body: 'A delivery platform wants you on their marketplace. They take 28% of every order and own the customer relationship.',
    choices: [
      {
        label: 'Sign up',
        hint: 'Volume at low margin',
        odds: 0.75,
        good: { text: 'Order volume doubles. The margin is ugly but the kitchen is never idle.', boost: { label: 'Delivery Volume', kind: 'income', power: 1.4, duration: 480, scope: 'business' } },
        bad: { text: 'Delivery orders cannibalise your dine-in covers at a third of the margin.', cashSeconds: -100 },
      },
      {
        label: 'Build your own ordering',
        hint: 'Slow burn, keeps margin',
        odds: 0.55,
        good: { text: 'Regulars order direct. You keep every cent and own the data.', boost: { label: 'Direct Orders', kind: 'income', power: 1.6, duration: 900, scope: 'business' } },
        bad: { text: 'Nobody downloads a single-restaurant app. The development bill arrives regardless.', cashSeconds: -180 },
      },
    ],
  },
  {
    id: 'rest_private',
    category: 'restaurant',
    title: 'Private Buyout Request',
    body: 'A wedding party wants the entire dining room on your busiest Saturday of the year. They are offering well above a normal night.',
    choices: [
      {
        label: 'Take the booking',
        hint: 'Guaranteed money',
        odds: 1,
        good: { text: 'One party, one bill, no walk-ins. Easiest money you will make this month.', cashSeconds: 190 },
        bad: { text: '', cashSeconds: 190 },
      },
      {
        label: 'Hold the room',
        hint: 'Bet on regulars',
        odds: 0.5,
        good: { text: 'A packed regular service outperforms the buyout, and the regulars remember.', cashSeconds: 280, morale: 0.12 },
        bad: { text: 'Rain. Half the reservations no-show. You turned down a sure thing.', cashSeconds: -60 },
      },
    ],
  },
  {
    id: 'rest_expand',
    category: 'restaurant',
    title: 'The Space Next Door Is Free',
    body: 'The unit adjoining yours went dark. You could double your covers, or open a bar that feeds the dining room.',
    minLevel: 4,
    choices: [
      {
        label: 'Double the dining room',
        hint: 'Big spend, big capacity',
        odds: 0.7,
        good: { text: 'Covers double and the wait list finally clears. The room hums.', boost: { label: 'Expanded Room', kind: 'income', power: 1.7, duration: 900, scope: 'business' } },
        bad: { text: 'You built for a crowd that never arrived. Empty tables cost more than no tables.', cashSeconds: -280, morale: -0.12 },
      },
      {
        label: 'Open a cocktail bar',
        hint: 'Higher margin, needs a crowd',
        odds: 0.6,
        good: { text: 'Waiting guests drink. Drink margins are obscene. Everybody wins.', boost: { label: 'Bar Program', kind: 'income', power: 1.85, duration: 720, scope: 'business' } },
        bad: { text: 'The licence takes four months and the buildout runs over budget.', cashSeconds: -240 },
      },
    ],
  },

  // ------------------------------------------------------------- nightclub
  {
    id: 'club_dj',
    category: 'nightclub',
    title: 'Headline DJ Available',
    body: 'A name act had a festival cancel and has one open Saturday. The booking fee is eye-watering and non-refundable.',
    choices: [
      {
        label: 'Book them',
        hint: 'Expensive, huge night',
        odds: 0.65,
        good: { text: 'Sold out in ninety minutes. The queue goes around the block twice.', boost: { label: 'Headline Night', kind: 'income', power: 2.6, duration: 300, scope: 'business' }, morale: 0.2 },
        bad: { text: 'They cancel the morning of. The fee is gone and the room is half empty.', cashSeconds: -300, morale: -0.2 },
      },
      {
        label: 'Push your resident',
        hint: 'Cheap, loyal crowd',
        odds: 0.85,
        good: { text: 'Your resident packs it out anyway. The regulars prefer them.', cashSeconds: 120, morale: 0.15 },
        bad: { text: 'A slow night. The regulars went to see the DJ you passed on.', cashSeconds: -60 },
      },
    ],
  },
  {
    id: 'club_bottle',
    category: 'nightclub',
    title: 'Whale in the VIP Booth',
    body: 'Someone just ordered the entire top shelf and is asking what else you have in the back. Your floor manager is asking whether to keep pouring.',
    choices: [
      {
        label: 'Keep it coming',
        hint: 'Enormous tab, some risk',
        odds: 0.7,
        good: { text: 'The tab clears five figures and they book the booth for next month.', cashSeconds: 380 },
        bad: { text: 'The card declines at 3am. The tab is a write-off and the booth is destroyed.', cashSeconds: -200, morale: -0.1 },
      },
      {
        label: 'Card on file first',
        hint: 'Safe, slightly smaller',
        odds: 0.95,
        good: { text: 'Pre-authorised and poured. Big tab, zero risk.', cashSeconds: 240 },
        bad: { text: 'They take offence at being asked and leave with their entourage.', cashSeconds: -40 },
      },
    ],
  },
  {
    id: 'club_noise',
    category: 'nightclub',
    title: 'Noise Complaints',
    body: 'The new residential building across the street has filed for the third time this month. The licensing board has taken notice.',
    choices: [
      {
        label: 'Soundproof the building',
        hint: 'Costly permanent fix',
        odds: 0.9,
        good: { text: 'Acoustic treatment throughout. The complaints stop and the sound is better inside.', cashSeconds: -220, morale: 0.1 },
        bad: { text: 'The work helps but not enough. Complaints continue at lower volume.', cashSeconds: -260 },
      },
      {
        label: 'Charm the neighbours',
        hint: 'Cheap, unpredictable',
        odds: 0.5,
        good: { text: 'Free guest list and a bottle for the building committee. Complaints evaporate.', cashSeconds: -40 },
        bad: { text: 'They were never going to be bought off. Your licence hours are cut.', cashSeconds: -180, morale: -0.15 },
      },
    ],
  },
  {
    id: 'club_security',
    category: 'nightclub',
    title: 'Incident at the Door',
    body: 'A fight spilled onto the street at closing. There is phone footage and your head of security wants a decision before the morning.',
    choices: [
      {
        label: 'Get ahead of it',
        hint: 'Costly, protects reputation',
        odds: 0.85,
        good: { text: 'Statement issued, extra security hired, licence intact. Nobody remembers by Friday.', cashSeconds: -120, morale: 0.08 },
        bad: { text: 'The statement reads as an admission. The board schedules a hearing anyway.', cashSeconds: -200 },
      },
      {
        label: 'Say nothing',
        hint: 'Gamble on it dying down',
        odds: 0.55,
        good: { text: 'The footage gets nine views. The news cycle moves on.', cashSeconds: 0 },
        bad: { text: 'It gets picked up. Two weeks of closure while the licence is reviewed.', cashSeconds: -400, morale: -0.25 },
      },
    ],
  },
  {
    id: 'club_brand',
    category: 'nightclub',
    title: 'Spirits Brand Sponsorship',
    body: 'A vodka brand wants exclusive pour rights and a logo on everything. The cheque is large. The vodka is not good.',
    choices: [
      {
        label: 'Take the deal',
        hint: 'Cash now, quality down',
        odds: 0.8,
        good: { text: 'The cheque clears and almost nobody notices the pour changed.', cashSeconds: 260, morale: -0.05 },
        bad: { text: 'Regulars notice immediately. The VIP crowd starts drinking elsewhere.', cashSeconds: 120, morale: -0.25 },
      },
      {
        label: 'Stay independent',
        hint: 'No money, keeps prestige',
        odds: 1,
        good: { text: 'You keep the back bar exactly as it is. The bartenders respect you for it.', morale: 0.15, luck: 1 },
        bad: { text: '', morale: 0.15, luck: 1 },
      },
    ],
  },
  {
    id: 'club_afterhours',
    category: 'nightclub',
    title: 'After-Hours Licence',
    body: 'You could apply to trade until 6am. The application is expensive, the approval uncertain, and the revenue between 4 and 6 is nearly all profit.',
    minLevel: 3,
    choices: [
      {
        label: 'Apply',
        hint: 'Expensive gamble',
        odds: 0.55,
        good: { text: 'Approved. Two extra hours of the highest-margin trading of the night, permanently.', boost: { label: 'After-Hours Licence', kind: 'income', power: 1.65, duration: 1200, scope: 'business' } },
        bad: { text: 'Denied on residential grounds. The application fee is non-refundable.', cashSeconds: -160 },
      },
      {
        label: 'Not worth the risk',
        hint: 'Skip',
        odds: 1,
        good: { text: 'You close at two like everyone else and sleep marginally better.', morale: 0.05 },
        bad: { text: '', morale: 0.05 },
      },
    ],
  },

  // ------------------------------------------------------------------ tech
  {
    id: 'tech_funding',
    category: 'tech',
    title: 'Term Sheet on the Table',
    body: 'A fund wants in at a valuation that flatters everyone. The terms include a liquidation preference you had to read three times.',
    choices: [
      {
        label: 'Sign it',
        hint: 'Capital now, strings attached',
        odds: 0.75,
        good: { text: 'Money in the bank. You hire aggressively and ship twice as fast.', boost: { label: 'Series A', kind: 'income', power: 1.9, duration: 600, scope: 'business' }, staff: 2 },
        bad: { text: 'The preference triggers on a down round. You work for the fund now.', cashSeconds: -260, morale: -0.2 },
      },
      {
        label: 'Bootstrap',
        hint: 'Slower, keeps control',
        odds: 0.6,
        good: { text: 'Profitable and independent. Growth is slower and entirely yours.', boost: { label: 'Default Alive', kind: 'income', power: 1.35, duration: 1200, scope: 'business' }, morale: 0.2 },
        bad: { text: 'A funded competitor outspends you on every channel. Growth stalls.', cashSeconds: -180 },
      },
    ],
  },
  {
    id: 'tech_outage',
    category: 'tech',
    title: 'Production Is Down',
    body: 'Everything is on fire. The status page is red, the largest customer is on the phone, and the on-call engineer just said the word "irrecoverable".',
    choices: [
      {
        label: 'All hands, all night',
        hint: 'Burnout risk, fast recovery',
        odds: 0.85,
        good: { text: 'Restored in six hours. The postmortem is excellent and the customer stays.', cashSeconds: -80, morale: -0.12 },
        bad: { text: 'Eighteen hours down. Two engineers quit the following week.', cashSeconds: -300, morale: -0.3, staff: -2 },
      },
      {
        label: 'Restore from backup',
        hint: 'Loses data, restores fast',
        odds: 0.7,
        good: { text: 'Back up in ninety minutes. Four hours of data gone and nobody complains loudly.', cashSeconds: -120 },
        bad: { text: 'The backup was untested. It restores into the same broken state.', cashSeconds: -380, morale: -0.2 },
      },
    ],
  },
  {
    id: 'tech_acquihire',
    category: 'tech',
    title: 'Acquisition Interest',
    body: 'A larger company wants to buy the team. It is a good offer for a product they intend to shut down.',
    choices: [
      {
        label: 'Take the exit',
        hint: 'Big one-off payment',
        odds: 1,
        good: { text: 'The deal closes. Your team is absorbed, the product sunsets, the money is real.', cashSeconds: 600, morale: -0.2, staff: -2 },
        bad: { text: '', cashSeconds: 600, morale: -0.2, staff: -2 },
      },
      {
        label: 'Turn it down',
        hint: 'Bet on yourself',
        odds: 0.5,
        good: { text: 'Six months later you are worth four times the offer. The team is electric.', boost: { label: 'Proved Them Wrong', kind: 'income', power: 2.2, duration: 900, scope: 'business' }, morale: 0.3, luck: 2 },
        bad: { text: 'The market turns. The offer is never repeated and morale never recovers.', cashSeconds: -200, morale: -0.3 },
      },
    ],
  },
  {
    id: 'tech_pivot',
    category: 'tech',
    title: 'The Data Says Pivot',
    body: 'One tiny feature accounts for 80% of engagement. The rest of the product is dead weight and everyone can see it.',
    choices: [
      {
        label: 'Bet everything on it',
        hint: 'Wholesale rewrite',
        odds: 0.6,
        good: { text: 'You strip the product to its one good idea. Retention triples overnight.', boost: { label: 'Product-Market Fit', kind: 'income', power: 2.5, duration: 720, scope: 'business' }, morale: 0.25 },
        bad: { text: 'You killed the features paying customers were quietly relying on. Churn spikes.', cashSeconds: -320, morale: -0.25 },
      },
      {
        label: 'Ship it as a mode',
        hint: 'Hedged, slower',
        odds: 0.8,
        good: { text: 'You keep both audiences. Growth is real if unspectacular.', boost: { label: 'Careful Growth', kind: 'income', power: 1.4, duration: 600, scope: 'business' } },
        bad: { text: 'Two half-products, one confused roadmap. Engineering velocity halves.', cashSeconds: -140, morale: -0.1 },
      },
    ],
  },
  {
    id: 'tech_breach',
    category: 'tech',
    title: 'Security Disclosure',
    body: 'A researcher emailed a working exploit and a 90-day disclosure deadline. Nothing has leaked. Yet.',
    choices: [
      {
        label: 'Patch and pay the bounty',
        hint: 'Costs money, ends the problem',
        odds: 0.95,
        good: { text: 'Patched in four days. The researcher writes a flattering post about your response.', cashSeconds: -90, luck: 1 },
        bad: { text: 'The patch is incomplete. A second researcher finds the same hole.', cashSeconds: -180 },
      },
      {
        label: 'Ignore the email',
        hint: 'Free, reckless',
        odds: 0.35,
        good: { text: 'They lose interest. You get away with it entirely.', cashSeconds: 0 },
        bad: { text: 'Full public disclosure on day 91. Enterprise customers leave in a block.', cashSeconds: -520, morale: -0.3 },
      },
    ],
  },
  {
    id: 'tech_hire',
    category: 'tech',
    title: 'A Famous Engineer Is Available',
    body: 'Someone whose name carries weight is between jobs. They would cost more than the rest of the team combined.',
    minLevel: 3,
    choices: [
      {
        label: 'Pay whatever it takes',
        hint: 'Enormous salary',
        odds: 0.7,
        good: { text: 'They rewrite the core in three weeks and mentor everyone around them.', boost: { label: 'Ten-X Hire', kind: 'income', power: 1.8, duration: 900, scope: 'business' }, staff: 1, morale: 0.2 },
        bad: { text: 'Brilliant and impossible. Three people quit rather than work with them.', cashSeconds: -280, morale: -0.3, staff: -2 },
      },
      {
        label: 'Hire three juniors instead',
        hint: 'Same cost, slower',
        odds: 0.85,
        good: { text: 'They grow into the role. Steady, cheap, loyal capacity.', staff: 3, morale: 0.1, cashSeconds: -60 },
        bad: { text: 'Nobody has time to mentor them. They flounder for a quarter.', cashSeconds: -100, morale: -0.08 },
      },
    ],
  },

  // ------------------------------------------------------------------ bank
  {
    id: 'bank_loan',
    category: 'bank',
    title: 'Large Commercial Loan Request',
    body: 'A developer wants a nine-figure facility. The collateral is a project that does not exist yet and the relationship is worth a fortune.',
    choices: [
      {
        label: 'Approve it',
        hint: 'Large fees, real risk',
        odds: 0.65,
        good: { text: 'The project completes on time. Origination fees and a client for life.', cashSeconds: 340 },
        bad: { text: 'They default in month eight. You own a half-built car park.', cashSeconds: -420, morale: -0.15 },
      },
      {
        label: 'Approve with covenants',
        hint: 'Smaller fee, protected',
        odds: 0.88,
        good: { text: 'Tighter terms, smaller fee, and you sleep at night.', cashSeconds: 160 },
        bad: { text: 'They take the deal to a competitor who asked fewer questions.', cashSeconds: -60 },
      },
      {
        label: 'Decline',
        hint: 'No risk, no reward',
        odds: 1,
        good: { text: 'You pass. The credit committee agrees it was the right call.', morale: 0.05 },
        bad: { text: '', morale: 0.05 },
      },
    ],
  },
  {
    id: 'bank_regulator',
    category: 'bank',
    title: 'Regulatory Examination',
    body: 'The examiners are in for two weeks. Your capital ratios are fine. Your documentation is a different conversation.',
    choices: [
      {
        label: 'Full cooperation',
        hint: 'Slow, safe',
        odds: 0.85,
        good: { text: 'Minor findings, remediation plan accepted, clean bill of health.', cashSeconds: -100, morale: 0.05 },
        bad: { text: 'Cooperation surfaces problems you did not know you had. Consent order.', cashSeconds: -300 },
      },
      {
        label: 'Lawyer up',
        hint: 'Expensive, combative',
        odds: 0.6,
        good: { text: 'Counsel narrows the scope dramatically. The exam closes early and quietly.', cashSeconds: -140 },
        bad: { text: 'Stonewalling invites a broader review. This will take a year.', cashSeconds: -450, morale: -0.2 },
      },
    ],
  },
  {
    id: 'bank_rates',
    category: 'bank',
    title: 'Rate Decision Ahead',
    body: 'The central bank meets Thursday. Your treasury desk wants to position the book one way or the other, hard.',
    choices: [
      {
        label: 'Position for a cut',
        hint: 'Directional bet',
        odds: 0.5,
        good: { text: 'They cut. The bond book rips and the desk takes a victory lap.', cashSeconds: 420 },
        bad: { text: 'They hold. The position bleeds and the desk head goes very quiet.', cashSeconds: -300 },
      },
      {
        label: 'Stay neutral',
        hint: 'Boring, safe',
        odds: 1,
        good: { text: 'Duration matched, risk flat. You make exactly what you planned to make.', cashSeconds: 60 },
        bad: { text: '', cashSeconds: 60 },
      },
    ],
  },
  {
    id: 'bank_fraud',
    category: 'bank',
    title: 'Suspicious Transfers',
    body: 'Compliance flagged a pattern across forty accounts. Freezing them will infuriate legitimate customers if the pattern is noise.',
    choices: [
      {
        label: 'Freeze immediately',
        hint: 'Safe, angers customers',
        odds: 0.8,
        good: { text: 'You catch a live fraud ring. Regulators note your systems approvingly.', cashSeconds: 140, luck: 2 },
        bad: { text: 'False positives. Forty furious customers and a viral complaint thread.', cashSeconds: -180, morale: -0.15 },
      },
      {
        label: 'Monitor quietly',
        hint: 'Gamble on more data',
        odds: 0.55,
        good: { text: 'A week of surveillance builds an airtight case. Every cent recovered.', cashSeconds: 260 },
        bad: { text: 'The funds are gone by Friday. The write-off is entirely yours.', cashSeconds: -400 },
      },
    ],
  },
  {
    id: 'bank_wealth',
    category: 'bank',
    title: 'Private Wealth Division',
    body: 'You could stand up a private bank for ultra-high-net-worth clients. It requires poaching an entire team.',
    minLevel: 3,
    choices: [
      {
        label: 'Poach the team',
        hint: 'Enormous cost, sticky revenue',
        odds: 0.7,
        good: { text: 'They bring their book with them. Fee income with almost no capital cost.', boost: { label: 'Private Bank', kind: 'income', power: 1.75, duration: 1200, scope: 'business' } },
        bad: { text: 'Their non-competes hold. You paid signing bonuses for people who cannot work.', cashSeconds: -500 },
      },
      {
        label: 'Build it slowly',
        hint: 'Cheap, gradual',
        odds: 0.9,
        good: { text: 'Two advisors and a plan. It compounds quietly for years.', boost: { label: 'Wealth Desk', kind: 'income', power: 1.25, duration: 1500, scope: 'business' } },
        bad: { text: 'Without a marquee name nobody moves their money. Slow start.', cashSeconds: -80 },
      },
    ],
  },
  {
    id: 'bank_run',
    category: 'bank',
    title: 'Deposit Flight',
    body: 'A rumour is circulating on social media. Withdrawals are running at eleven times normal and it is only Tuesday.',
    minLevel: 2,
    choices: [
      {
        label: 'Publicly guarantee deposits',
        hint: 'Expensive, decisive',
        odds: 0.85,
        good: { text: 'A calm, specific statement with real numbers. The flight stops within a day.', cashSeconds: -240, morale: 0.15 },
        bad: { text: 'Reassurance reads as panic. The outflow accelerates.', cashSeconds: -520, morale: -0.25 },
      },
      {
        label: 'Say nothing and hold',
        hint: 'Risky silence',
        odds: 0.45,
        good: { text: 'The rumour burns out on its own. Deposits return within the week.', cashSeconds: -40 },
        bad: { text: 'Silence confirms the story. You sell assets at fire-sale prices to meet withdrawals.', cashSeconds: -700, morale: -0.35 },
      },
    ],
  },

  // ----------------------------------------------------------------- devco
  {
    id: 'dev_permit',
    category: 'devco',
    title: 'Planning Permission Stalled',
    body: 'The council has sat on your application for seven months. A consultant says they know who to talk to.',
    choices: [
      {
        label: 'Hire the consultant',
        hint: 'Expensive, effective',
        odds: 0.8,
        good: { text: 'Approved within a month. Whatever they did, it worked and it was legal.', cashSeconds: -160 },
        bad: { text: 'They took the fee and achieved nothing. The application sits where it was.', cashSeconds: -260 },
      },
      {
        label: 'Redesign to fit policy',
        hint: 'Slow, certain',
        odds: 0.95,
        good: { text: 'Two floors shorter, fully compliant, approved without objection.', cashSeconds: -100, morale: 0.05 },
        bad: { text: 'Even the compliant scheme draws objections. Another six months.', cashSeconds: -200 },
      },
    ],
  },
  {
    id: 'dev_contractor',
    category: 'devco',
    title: 'Main Contractor in Trouble',
    body: 'Your builder is 60% through the tower and rumoured to be insolvent. Their subcontractors have not been paid in five weeks.',
    choices: [
      {
        label: 'Pay the subs directly',
        hint: 'Costly, keeps the site moving',
        odds: 0.85,
        good: { text: 'The site keeps working. You take over the contract and finish on schedule.', cashSeconds: -300, morale: 0.1 },
        bad: { text: 'The administrator claws back the direct payments. You pay twice.', cashSeconds: -600 },
      },
      {
        label: 'Call the bond',
        hint: 'Slow, protected',
        odds: 0.75,
        good: { text: 'The surety appoints a replacement. Four months lost, no money lost.', cashSeconds: -160 },
        bad: { text: 'The bond is disputed. The site sits idle through the wet season.', cashSeconds: -480, morale: -0.2 },
      },
    ],
  },
  {
    id: 'dev_presale',
    category: 'devco',
    title: 'Presale Launch',
    body: 'Units go on sale Saturday. You can price to sell out fast or hold for the number you think the market will bear.',
    choices: [
      {
        label: 'Price to sell out',
        hint: 'Fast cash, lower total',
        odds: 0.95,
        good: { text: 'Sold out in a weekend. The bank is delighted and the cash lands early.', cashSeconds: 320 },
        bad: { text: 'Even priced keenly the market is thin. Half the building is unsold.', cashSeconds: 80 },
      },
      {
        label: 'Hold for top dollar',
        hint: 'Patient, higher ceiling',
        odds: 0.55,
        good: { text: 'You hold the line and the market comes to you. Record price per square foot.', cashSeconds: 620 },
        bad: { text: 'Sentiment turns while you wait. You discount harder than you would have needed to.', cashSeconds: -180 },
      },
    ],
  },
  {
    id: 'dev_heritage',
    category: 'devco',
    title: 'Heritage Objection',
    body: 'A campaign group has applied to list the Victorian frontage on your site. Demolition is scheduled for Monday.',
    choices: [
      {
        label: 'Incorporate the facade',
        hint: 'Costly, universally praised',
        odds: 0.9,
        good: { text: 'Facade retention adds cost and enormous goodwill. The scheme wins an award.', cashSeconds: -220, luck: 3, morale: 0.15 },
        bad: { text: 'Retention proves structurally impossible after you committed to it publicly.', cashSeconds: -380 },
      },
      {
        label: 'Demolish before the listing',
        hint: 'Fast, ugly',
        odds: 0.6,
        good: { text: 'Cleared by Tuesday. Entirely legal, thoroughly unpopular, project on schedule.', cashSeconds: 60, morale: -0.15 },
        bad: { text: 'An emergency injunction lands Sunday night. Now you are in court and in the papers.', cashSeconds: -500, morale: -0.3 },
      },
    ],
  },
  {
    id: 'dev_anchor',
    category: 'devco',
    title: 'Anchor Tenant Negotiation',
    body: 'A major retailer will anchor the ground floor, but they want fifteen years of rent-free fit-out and naming rights.',
    choices: [
      {
        label: 'Give them the terms',
        hint: 'Cheap rent, fills the building',
        odds: 0.85,
        good: { text: 'Their name on the building fills every other unit at a premium.', boost: { label: 'Anchor Secured', kind: 'income', power: 1.5, duration: 1200, scope: 'business' } },
        bad: { text: 'They downsize nationally two years later and hand back the space.', cashSeconds: -300 },
      },
      {
        label: 'Hold out for market rent',
        hint: 'Risky',
        odds: 0.5,
        good: { text: 'They blink. Full rent, shorter term, better building.', cashSeconds: 400 },
        bad: { text: 'They walk. An empty ground floor makes the whole scheme look failed.', cashSeconds: -360, morale: -0.15 },
      },
    ],
  },
  {
    id: 'dev_landbank',
    category: 'devco',
    title: 'Land Bank Opportunity',
    body: 'Three adjoining sites are available from a distressed seller. Assembled they are worth far more than the sum. Assembling them takes capital and nerve.',
    minLevel: 3,
    choices: [
      {
        label: 'Buy all three',
        hint: 'Heavy capital, big prize',
        odds: 0.7,
        good: { text: 'Assembled and rezoned. The combined site is worth triple what you paid.', boost: { label: 'Site Assembly', kind: 'income', power: 2.0, duration: 1200, scope: 'business' } },
        bad: { text: 'The middle owner refuses to sell at the last moment. You own two useless plots.', cashSeconds: -650 },
      },
      {
        label: 'Take the best one',
        hint: 'Modest, safe',
        odds: 0.9,
        good: { text: 'One good site at a distressed price. Unglamorous and profitable.', cashSeconds: 180 },
        bad: { text: 'Ground conditions are worse than the survey suggested. Remediation is expensive.', cashSeconds: -200 },
      },
    ],
  },

  // ------------------------------------------------------------- any/empire
  {
    id: 'any_audit',
    category: 'any',
    title: 'Tax Audit',
    body: 'The revenue service has questions about a deduction from two years ago. Your accountant is "not worried, exactly".',
    choices: [
      {
        label: 'Settle quietly',
        hint: 'Pay and move on',
        odds: 1,
        good: { text: 'You pay the assessment and the file closes. Expensive peace.', cashSeconds: -120 },
        bad: { text: '', cashSeconds: -120 },
      },
      {
        label: 'Fight it',
        hint: 'Could win outright',
        odds: 0.55,
        good: { text: 'The deduction was legitimate and the ruling says so. Costs recovered.', cashSeconds: 90, luck: 2 },
        bad: { text: 'You lose, plus penalties, plus interest, plus the legal bill.', cashSeconds: -280 },
      },
    ],
  },
  {
    id: 'any_press',
    category: 'any',
    title: 'A Journalist Is Writing About You',
    body: 'A business magazine is profiling your empire. They want access, a photographer, and an honest answer about the debt.',
    choices: [
      {
        label: 'Give full access',
        hint: 'Big exposure',
        odds: 0.65,
        good: { text: 'A flattering cover story. Doors open that were locked last week.', boost: { label: 'Cover Story', kind: 'income', power: 1.3, duration: 480, scope: 'empire' }, luck: 3 },
        bad: { text: 'They found the one bad quarter and led with it.', cashSeconds: -150, morale: -0.1 },
      },
      {
        label: 'Send a statement',
        hint: 'Controlled, dull',
        odds: 0.9,
        good: { text: 'Three careful paragraphs. Nothing gained, nothing lost.', morale: 0.03 },
        bad: { text: '"Declined to comment" reads badly in print.', cashSeconds: -60 },
      },
    ],
  },
  {
    id: 'any_charity',
    category: 'any',
    title: 'Charity Gala Invitation',
    body: 'A table at the season\'s gala costs a fortune. The room will be full of people who could make you money.',
    choices: [
      {
        label: 'Buy the table',
        hint: 'Expensive networking',
        odds: 0.75,
        good: { text: 'You leave with two deals and a great deal of goodwill.', cashSeconds: -100, luck: 5, boost: { label: 'Well Connected', kind: 'income', power: 1.2, duration: 420, scope: 'empire' } },
        bad: { text: 'You spend the evening seated next to a man who sells industrial adhesive.', cashSeconds: -160 },
      },
      {
        label: 'Donate anonymously',
        hint: 'Cheaper, quiet',
        odds: 1,
        good: { text: 'The money does more good than your presence would have. Luck finds you anyway.', cashSeconds: -50, luck: 3 },
        bad: { text: '', cashSeconds: -50, luck: 3 },
      },
      {
        label: 'Decline',
        hint: 'Free',
        odds: 1,
        good: { text: 'You stay in and work. Nobody notices your absence.', cashSeconds: 0 },
        bad: { text: '', cashSeconds: 0 },
      },
    ],
  },
  {
    id: 'any_lawsuit',
    category: 'any',
    title: 'Someone Is Suing You',
    body: 'A former partner claims they were owed a share of a deal you closed without them. Their lawyer is good.',
    choices: [
      {
        label: 'Settle out of court',
        hint: 'Certain cost',
        odds: 1,
        good: { text: 'A cheque and a non-disclosure agreement. Gone by Friday.', cashSeconds: -200 },
        bad: { text: '', cashSeconds: -200 },
      },
      {
        label: 'Take it to trial',
        hint: 'Win big or lose big',
        odds: 0.5,
        good: { text: 'Dismissed with costs awarded to you. Word gets around that you do not fold.', cashSeconds: 180, luck: 4 },
        bad: { text: 'A judgment against you plus both sets of legal fees.', cashSeconds: -500, morale: -0.15 },
      },
    ],
  },
  {
    id: 'any_headhunt',
    category: 'any',
    title: 'A Rival Is Poaching Your People',
    body: 'A competitor has approached four of your best operators with offers well above market.',
    choices: [
      {
        label: 'Match every offer',
        hint: 'Costly retention',
        odds: 0.9,
        good: { text: 'All four stay. Payroll is heavier and the bench is intact.', cashSeconds: -180, morale: 0.2 },
        bad: { text: 'Two stay, two go anyway, and everyone now knows what the market pays.', cashSeconds: -180, morale: -0.1, staff: -1 },
      },
      {
        label: 'Counter with equity',
        hint: 'No cash, needs belief',
        odds: 0.6,
        good: { text: 'They believe in where this is going. Cheaper than cash and far stickier.', morale: 0.3, luck: 2 },
        bad: { text: 'Equity in a private company is not rent money. Three leave.', morale: -0.25, staff: -2 },
      },
    ],
  },
  {
    id: 'any_windfall',
    category: 'any',
    title: 'Unexpected Windfall',
    body: 'An old investment you had written off entirely has just paid out. There is a cheque on your desk and a decision to make.',
    choices: [
      {
        label: 'Bank it',
        hint: 'Straight cash',
        odds: 1,
        good: { text: 'Straight into the operating account. Boring and useful.', cashSeconds: 240 },
        bad: { text: '', cashSeconds: 240 },
      },
      {
        label: 'Reinvest it aggressively',
        hint: 'Compound it or lose it',
        odds: 0.6,
        good: { text: 'You put it all back to work and it doubles inside a quarter.', cashSeconds: 560 },
        bad: { text: 'The reinvestment goes sideways. Most of the windfall evaporates.', cashSeconds: -80 },
      },
      {
        label: 'Buy roll tokens with it',
        hint: 'Convert to luck',
        odds: 1,
        good: { text: 'You put the whole cheque into deal flow. Three opportunities land on your desk.', rolls: 3 },
        bad: { text: '', rolls: 3 },
      },
    ],
  },
  {
    id: 'any_mentor',
    category: 'any',
    title: 'An Old Mentor Calls',
    body: 'The person who gave you your first break wants a favour. It is not a small one and they are not asking twice.',
    choices: [
      {
        label: 'Do it, no questions',
        hint: 'Costly, builds fortune',
        odds: 1,
        good: { text: 'You handle it. They remember, and people like them have long memories.', cashSeconds: -180, luck: 8 },
        bad: { text: '', cashSeconds: -180, luck: 8 },
      },
      {
        label: 'Politely decline',
        hint: 'Free, closes a door',
        odds: 1,
        good: { text: 'They understand. They do not call again.', cashSeconds: 0, luck: -2 },
        bad: { text: '', cashSeconds: 0, luck: -2 },
      },
    ],
  },
  {
    id: 'any_insider',
    category: 'any',
    title: 'A Very Specific Tip',
    body: 'Someone at the gala mentioned, unprompted and in detail, what a listed company will announce on Thursday. They should not know that.',
    choices: [
      {
        label: 'Act on it',
        hint: 'Illegal. Profitable. Risky.',
        odds: 0.55,
        good: { text: 'The announcement lands exactly as described. Nobody asks how you knew.', cashSeconds: 480 },
        bad: { text: 'A regulator asks how you knew. The fine is larger than the trade.', cashSeconds: -600, morale: -0.2 },
      },
      {
        label: 'Report it',
        hint: 'Clean, quietly rewarding',
        odds: 1,
        good: { text: 'You report it. It costs you nothing and buys you a reputation that pays for years.', luck: 10 },
        bad: { text: '', luck: 10 },
      },
      {
        label: 'Forget you heard it',
        hint: 'Nothing happens',
        odds: 1,
        good: { text: 'You finish your drink and change the subject.', cashSeconds: 0 },
        bad: { text: '', cashSeconds: 0 },
      },
    ],
  },
  {
    id: 'any_expansion',
    category: 'any',
    title: 'Overseas Expansion Pitch',
    body: 'A local partner wants to bring your operation to their market. They know the regulators. You know nothing about the market.',
    choices: [
      {
        label: 'Fund the expansion',
        hint: 'Big spend, empire-wide upside',
        odds: 0.6,
        good: { text: 'It works. A second market, running itself, paying you monthly.', boost: { label: 'International', kind: 'income', power: 1.45, duration: 900, scope: 'empire' } },
        bad: { text: 'You misread the market completely and your partner keeps the deposit.', cashSeconds: -400 },
      },
      {
        label: 'License the brand instead',
        hint: 'Low risk, low reward',
        odds: 0.9,
        good: { text: 'They pay a royalty and take all the risk. Small, clean, permanent income.', boost: { label: 'Licensing Deal', kind: 'income', power: 1.15, duration: 1500, scope: 'empire' } },
        bad: { text: 'They run the brand badly and it takes a year to unwind the agreement.', cashSeconds: -140 },
      },
    ],
  },
  {
    id: 'any_burnout',
    category: 'any',
    title: 'You Have Not Slept Properly In Weeks',
    body: 'The empire runs, the numbers are good, and you feel terrible. Something has to give.',
    choices: [
      {
        label: 'Take two weeks off',
        hint: 'Costs income, restores everything',
        odds: 1,
        good: { text: 'You come back sharp. Decisions get better across the board.', cashSeconds: -150, luck: 6, morale: 0.25 },
        bad: { text: '', cashSeconds: -150, luck: 6, morale: 0.25 },
      },
      {
        label: 'Push through',
        hint: 'Free, and it shows',
        odds: 0.45,
        good: { text: 'You get away with it. This time.', cashSeconds: 60 },
        bad: { text: 'You make an expensive mistake that a rested person would not have made.', cashSeconds: -320, morale: -0.2 },
      },
    ],
  },
  {
    id: 'any_counterfeit',
    category: 'any',
    title: 'Someone Is Copying You',
    body: 'A competitor has cloned your branding almost exactly, down to the typeface. Customers are confused and some of them are theirs now.',
    choices: [
      {
        label: 'Sue for infringement',
        hint: 'Slow and expensive',
        odds: 0.7,
        good: { text: 'Injunction granted. They rebrand entirely at their own cost.', cashSeconds: -120, morale: 0.1 },
        bad: { text: 'Your trademark filing was weaker than you thought. Case dismissed.', cashSeconds: -280 },
      },
      {
        label: 'Out-execute them',
        hint: 'No legal fees, pure competition',
        odds: 0.65,
        good: { text: 'You ship better and faster. Customers sort it out for themselves.', boost: { label: 'Out-Executed', kind: 'income', power: 1.35, duration: 480, scope: 'empire' }, morale: 0.15 },
        bad: { text: 'They undercut you on price and take the low end of your market.', cashSeconds: -220 },
      },
    ],
  },
  {
    id: 'any_luckystreak',
    category: 'any',
    title: 'Everything Is Going Right',
    body: 'Three deals closed this week without a hitch. Your accountant used the word "unusual". Do you press the advantage?',
    choices: [
      {
        label: 'Press it hard',
        hint: 'Ride the streak',
        odds: 0.6,
        good: { text: 'The streak holds. Everything you touch this month works.', boost: { label: 'Hot Streak', kind: 'income', power: 1.9, duration: 360, scope: 'empire' }, rolls: 2 },
        bad: { text: 'The streak ends the moment you rely on it. Two deals collapse.', cashSeconds: -240 },
      },
      {
        label: 'Bank the gains',
        hint: 'Lock in',
        odds: 1,
        good: { text: 'You take the money off the table and stop tempting fate.', cashSeconds: 200, luck: 2 },
        bad: { text: '', cashSeconds: 200, luck: 2 },
      },
    ],
  },
];

export const EVENTS_BY_CATEGORY = EVENT_CARDS.reduce<Record<string, EventCardDef[]>>((acc, card) => {
  (acc[card.category] ??= []).push(card);
  return acc;
}, {});

export const EVENT_BY_ID: Record<string, EventCardDef> = Object.fromEntries(
  EVENT_CARDS.map((c) => [c.id, c]),
);
