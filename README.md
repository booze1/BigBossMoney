# Big Boss Money

**▶ Play: https://booze1.github.io/BigBossMoney/**

A business empire simulator that runs in the browser. Mobile-first, offline-first,
no accounts, no server. Open one corner store with $1,500 and build it into
something worth taking public.

Best on a phone, or in a desktop browser at a narrow width — the layout is built
for 390px. It installs to your home screen and keeps working with no signal.

Every push to the default branch redeploys via `.github/workflows/deploy-pages.yml`,
gated on the test suite.

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # engine invariant suite
npm run build    # static bundle in dist/, including a generated service worker
```

The build in `dist/` is fully static — drop it on any host. It installs as a PWA
and a cold load with no network works: `scripts/build-sw.mjs` precaches the
build output and the worker serves it cache-first.

## The game

**Businesses** earn every second, including while the app is closed. Six
categories unlock as your net worth grows: retail, restaurants, nightclubs, tech
startups, banks and development companies. Each has its own margins, volatility
and event deck.

Opening one is a decision rather than a button. Three premises come to the table
per category, each carrying its traits openly and priced by them: one that is
simply good, one that is cheap because something is wrong with it, and one that
cuts both ways. Traits are permanent and do real work — they move revenue,
upkeep and the staff cap, change how often the place surfaces a decision, and
gate which cards it can draw. A flaw can be cured, at a price, by the card it
unlocks; the shortlist does not reshuffle until you buy, so the choice cannot be
dodged.

**Staff are people.** Everyone has a name, a job and a start date. Tenure pays —
a lifer is worth up to a quarter more than a new hire — and severance costs,
growing with service and charged for the whole roster at once when you close a
business. Trimming a wage bill means choosing who, and the button tells you what
it will cost before you press it.

**Event cards** are the part you actually play. Businesses periodically surface a
decision — a supplier hikes prices, a critic is in the dining room, production is
down, deposits are fleeing the bank. Each card offers a safe line and a greedy
one, and the greedy one has stated odds that your Luck stat quietly improves.
Hire a manager and they will handle cards for you at a reduced payoff, which is
the real trade: attention for throughput.

The deck is 142 cards across eight files in `engine/content/events/`. Two things
give it depth beyond volume:

- **Memory tags.** Outcomes write situational tags onto the business —
  `shrinkage`, `bad_press`, `tech_debt`, `consent_order`, `delayed` — and later
  cards require or exclude them. A store that has been robbed draws different
  cards from one that has not, and tags fade so nothing is permanent.
- **Chains.** An outcome can queue a specific follow-up minutes later, giving a
  decision a second act. Take the funding and the board meeting arrives; let the
  critic in and you have to decide what to do about being fully booked.

Cards are drawn without replacement per business, with the memory window scaled
to the drawable pool. `tools/repeats.ts` measures the result: a levelling
business goes 44–49 minutes before seeing any card twice, against 4.7 minutes
before this system existed.

**Luck** is a first-class stat. Roll tokens accrue on a timer, and every roll
lands in a rarity band — Common through Mythic — with the odds visibly reweighted
by your Luck. Legendary and Mythic pulls take over the screen. Luck also improves
every event card you play.

**Markets** simulate eighteen fictional instruments on a geometric random walk.
Stocks drift; crypto does not. News events shock individual tickers or the whole
board, and RugCoin behaves exactly as advertised.

**Real estate** works three ways at once: buy for rental yield, buy raw land and
develop it over real time for a large multiple, or buy a commercial unit and move
one of your businesses into it — which kills that business's rent and widens its
margin. City indices drift independently, so where you buy matters.

**Flex** is what luxury buys. Cars, watches, jets, yachts and estates each grant
Flex, and Flex raises your empire income, your Luck, your borrowing rate and the
manager tiers you can reach. Items also appreciate or depreciate, so the
collection is a portfolio too.

**Debt** compounds every second. Borrow against your net worth to move faster,
and if it gets away from you, file for bankruptcy and restart with a fraction of
the Legacy Points an IPO would have paid.

**Coming back** shows you what the empire did without you: earnings split by
source, net worth across the absence as a curve, and the handful of things worth
remarking on — a development finishing, a ticker moving hard, somebody passing
ten years on the tills. Capped at six lines, because a wall of text reads the
same as no report at all.

**Going public** ends a run at $250M net worth. You lose everything and bank
Legacy Points, which buy permanent upgrades — starting capital, starting Luck,
empire-wide income, offline capacity, cheaper purchases — that carry into every
future run.

## Layout

```
src/
  engine/            all game logic, no React
    types.ts         the single serialisable GameState
    sim.ts           the tick: income, markets, events, developments, offline
    actions.ts       every player verb, as one reducer
    selectors.ts     derived numbers — the UI and the sim read the same values
    events.ts        card resolution, where luck meets the odds
    rolls.ts         rarity rolling and reward application
    save.ts          localStorage persistence and offline catch-up
    premises.ts      the three-site shortlist and what traits do to the money
    content/         tuning, businesses, traits, staff, event decks, markets,
                     cities, luxury
  ui/                screens and components
  store.tsx          mutable state + rAF loop + React bridge
```

The engine has no React dependency and can be driven headlessly, which is how the
economy was tuned (see *Balance* below).

State is mutated in place rather than copied. It is one large object stepped
several times a second; structural sharing would cost more than it buys. The
store publishes a version counter and re-renders React on a fixed 100ms cadence.

## Balance

Every tuning number lives in `src/engine/content/tuning.ts`. The two dials that
matter most:

- `baseIncomeScale` — master pacing dial. Multiplies every category's base
  revenue, which sets how many seconds a business takes to pay for itself and
  therefore how fast the whole empire compounds.
- `cashSecondsScale` — how much of your income comes from playing cards versus
  owning things. Cards are authored on a readable 0–600 "seconds of income"
  scale and multiplied by this.

Pacing is measured by `tools/pacing.ts`, which drives the engine with a bot
that reinvests into whichever purchase has the shortest payback — businesses,
upgrades, staff, property, development, and buying premises to house a
business, and it prices every premises on the shortlist individually rather
than assuming the category's list price. It resolves every card instantly and
never idles, so it is a strict lower bound on a human run. Median to the $250M
IPO is ~34 minutes.

**The master pacing dial is the reinvestment cost ramp.** Every purchase price
is multiplied by `1 + (netWorth / costRampReference) ^ costRampExponent`,
capped at `costRampMax`. This is the only lever that reliably controls run
length, because it lengthens the payback of *every* option at once — sweeping
income, upgrade cost, tier cost or level growth individually each moved the
median by only a few minutes, since the player simply reroutes into whichever
path is still cheap.

It ramps rather than being flat for a reason: most of a run's wall-clock time
is spent in the early doublings, so a flat multiplier big enough to slow the
endgame also makes the second shop cost half an hour of income. Ramping with
net worth leaves the opening almost untouched (the second store goes from
$6.5K to $8.4K) and bites hardest where growth used to run away.

**Market saturation** is what keeps this shaped. The n-th business in a category
earns `saturationDecay^n` of full output, floored so nothing is ever worthless.
Without it, duplicates cost `1.3^n` but earned a flat amount, and since
late-game cash is effectively unlimited the answer to "what next" was always
"another one of those" — the bot used to finish runs holding 90 to 145
businesses and never touched property.

**Premises trait prices are measured, not chosen.** `tools/traits.ts` derives
what each trait should cost from what it does to earnings; change an effect and
re-run it rather than editing a price by hand. Building that tool turned up two
levers that did the opposite of what they claimed:

- `eventRate` below 1 means more cards, and cards pay, so giving it to flaws
  made a neglected premises the most profitable thing on the shortlist — one
  measured at 1.44x a clean site. It now tracks how alive a location is instead.
- `stakes` scaled the cash swing of card outcomes, meant to make a risky site
  volatile. Instrumenting wins and losses separately showed why it could not
  work: over ten minutes cards take 6,858 and give back 2,084, so card *cash* is
  net negative and what cards actually pay is the boosts they grant. Scaling
  both directions made a risky site worth more than a safe one. It was removed.

Two related constraints are load-bearing and worth knowing before retuning:

- `staffWageRatio` must stay below `staffRevenueBonus × (1 - upkeepRatio -
  rentRatio)`, the margin a hire actually adds. Above it, hiring is a guaranteed
  loss at every level and the staffing system is dead weight.
- `upgradeCostGrowth` must exceed `revenuePerLevel` by enough that upgrade
  payback degrades with level. They were 1.35 against 1.28, so levelling was
  near-free exponential growth and dominated everything else.
- `tenureBonusMax` must stay bounded at all. Without a cap, staff output drifts
  arbitrarily far from the wages paying for it over a long run, and the first
  constraint above stops holding.

Growth is still exponential at the top end — that is characteristic of the genre
and the prestige wall is the intended answer. Raising the IPO threshold 200×
only adds about eight minutes of bot time.

## Tests

`npm test` runs the engine invariant suite (`src/engine/engine.test.ts`). It
covers content integrity (every card resolvable, every roll reward grants
something, no dead table entries), economy invariants (cash never negative, no
buy-then-sell arbitrage, fresh businesses profitable while renting), the luck
distribution, offline simulation bounds, save round-tripping, prestige, and the
real-estate systems.

The premises and staff systems bring their own, several of which exist to stop
a feature quietly becoming a trap: every curable flaw must have a card that can
actually clear it, a cure card must only be drawable where the flaw exists, no
single trait may leave a fresh business unable to pay its rent or make hiring a
loss, severance may never take the player below zero, and the offline report's
earnings must equal income minus repayments exactly.

The suite is mutation-tested: re-introducing the listing-depletion bug or the
uncapped hustle each make it fail.

## Accessibility

Every tappable list row is a real button with an accessible name, so the primary
navigation of the Empire, Markets and Estate screens is keyboard-reachable.
Sheets are `role="dialog"` and close on Escape. Focus is visible throughout, and
toasts and rarity reveals are announced via live regions.

## Notes

- Every company, brand and city listing is fictional. Any resemblance to real
  tickers is a joke, not a reference.
- Saves live in `localStorage` under `bigbossmoney.save.v1`, and can be exported
  and restored as a text code from Settings.
