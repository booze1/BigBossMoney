# Big Boss Money — audit and plan of attack

> **Status: Phases 0–3 complete.** See the closing section for what was
> actually delivered against each exit test, including the one that was not met
> and the one that turned out to be unachievable as written.


Status of the current build (commit `d75aaf4`): ~7,000 lines, all six pillars
wired end-to-end and playable. This document records what a code-level audit
found and the order in which to finish it.

Everything below was verified against the code or measured by running the
engine headlessly — nothing here is a guess.

---

## Part 1 — Audit findings

### P0 · Bugs that silently break a system

**1. Property listings deplete permanently and never regenerate.**
`sim.ts::stepListings` removes ~40% of unowned listings every 5 minutes. The
only things that ever *add* listings are `state.ts` at run start and the paid
`refreshListings` action. Over a long session every city's market drains to
empty and the player is forced to pay to see any property at all. One of the
three pillars quietly dies.

**2. "Work the floor" has no cooldown — unbounded tap exploit.**
`TUNING.hustleCooldown: 0.35` is declared and never referenced anywhere. The
payout is `45 + netWorth × 0.0004`, so it *scales with net worth*: at $250M
that is ~$100K per tap, and an autoclicker at 10 taps/sec yields ~$1M/sec.
This trivially outperforms the entire empire and invalidates the economy.

**3. `Boost.kind` values `'luck'` and `'offline'` are never produced.**
Luck rewards write straight to `s.luck`; offline rewards write to
`legacyUpgrades._offlineBonus`. But `selectors.totalLuck` sums luck-kind
boosts, and the Luck screen renders an "Active boosts" row from it — a line
that is permanently, structurally `0`. Dead surface presented as real.

**4. Event cards are silently dropped when the queue is full.**
`stepEvents` skips card creation entirely once `pendingEvents.length >= 6`.
With a dozen unmanaged businesses most cards never reach the player and there
is no indication anything was lost.

### P1 · Claims the build does not currently honour

**5. There is no service worker, and `manifest.webmanifest` has `"icons": []`.**
The README and I both described this as an installable offline-capable PWA. It
is installable in name only: a cold load with no network will fail, and the
install prompt has no icon. This needs fixing or the claim needs withdrawing.

**6. Zero tests.** No runner, no specs. The economy is a compounding
simulation with many interacting multipliers — exactly the kind of code where
a refactor breaks balance invisibly.

**7. Accessibility is unaddressed.** One `aria-label` in the entire app, no
`:focus-visible` styles anywhere, and 8 clickable `<div>`s that are not
reachable or activatable by keyboard (business rows, asset rows, property
rows — i.e. the primary navigation of three screens).

### P2 · Depth gaps, measured

**8. The event deck is the thinnest pillar relative to its importance.**
48 cards: exactly 6 per category plus 12 generic. Measured on a single-business
run: **first repeat at 4.7 minutes**, and only **9 distinct cards seen in 45
minutes**. This is the system the whole "more interaction" design rests on, and
it is the first thing to feel exhausted.

**9. Cards have no memory and no consequences.** Every card is independent.
Nothing references a previous decision, no choice ever spawns a follow-up, and
a business that was wrecked by a bad call last week reads identically to one
that has never had a problem.

**10. Late-game growth is exponential and self-accelerating.** Measured: a 60×
increase in the IPO threshold ($50M → $3B) added only ~3 minutes of bot time.
Duplicate businesses cost `1.3^n` but earn a flat amount, which should
self-limit — yet the optimal bot still ends a run holding 92–145 businesses,
because late-game cash is effectively unlimited. There is no saturation
mechanic and no soft cap.

**11. Per-facet depth, honestly assessed:**

| Pillar | Built | Missing for "finished" |
|---|---|---|
| Businesses | level, staff, manager, premises, morale | every instance in a category is identical; no traits; no cross-category synergy |
| Event cards | 48 cards, odds, luck coupling, auto-resolve | volume; chains; memory; consequence |
| Luck | rarity bands, luck-weighted odds, 27 rewards, reveal | no pity counter; no bad outcomes; nothing to *spend* Luck on |
| Markets | 18 assets, random walk, news shocks, charts | no dividends; no portfolio history; owning a bank does not correlate with bank tickers |
| Real estate | rent, development, business housing, city indices | only raw land is developable; no renovation; city index is pure weather the player cannot influence |
| Luxury / Flex | 24 items, Flex→income/luck/credit/managers | list-only presentation for a system that is entirely about display; no per-item variance |
| Prestige | Legacy Points, 7 upgrades | no milestone unlocks; run 2 is run 1 but faster — nothing changes structurally |

### P3 · Dead code

19 exported symbols are never referenced outside their own declaration:
`Segmented`, `headerLuck`, `hasSave`, `nextRollPrice`, `rollFlexBonus`,
`moneyExact`, `randomDevelopmentTime`, `rand`, `shuffle`, `unlockedCities`,
`cityPriceLevel`, `holdingValue`, `legacyUpgradeCost`, `autoLineBalance`,
`CATEGORY_LOOKUP`, `DEV_LOOKUP`, `visibleCategories`, `TierId`, `useGameState`.

Also dead: `TUNING.tickSeconds`, `TUNING.hustleCooldown`, and the
`settings.compactNumbers` flag (stored, defaulted, never read, never shown).
`Business.lifetimeRevenue` is accumulated every tick and displayed nowhere.

---

## Part 2 — Plan of attack

Ordered so that each phase leaves the game in a better *shippable* state than
it found it. Phases 0–2 are correctness and honesty; 3–5 are depth.

### Phase 0 — Stop the bleeding
*Fixes things that are actively wrong. Nothing new.*

- Regenerate property listings on the churn timer instead of only deleting
  them; keep a minimum floor per unlocked city.
- Wire `hustleCooldown` (client-side gate **and** an engine-side timestamp so
  it cannot be dispatched around), and cap the net-worth scaling so it decays
  into irrelevance rather than growing forever.
- Either produce `luck`/`offline` boosts properly or delete both kinds and the
  UI row that reads them. Prefer deleting — the direct-to-stat path is simpler.
- Queue overflow: replace the oldest unresolved card rather than dropping the
  new one, and surface a count so the player knows the queue is saturated.
- Delete all 19 dead exports, 2 dead tuning keys, and `compactNumbers`.

**Exit test:** a 4-hour headless run ends with every city still holding
listings, and the hustle button contributing <2% of lifetime earnings.

### Phase 1 — Make the claims true
*Small, high-leverage, unblocks confident shipping.*

- Vitest + engine invariant suite: net worth never NaN/Infinity; cash and debt
  never negative simultaneously; offline simulation ≈ equivalent online
  simulation within tolerance; save→load→save round-trips identically; every
  roll reward and every one of the 48 cards applies without throwing.
- Real service worker (precache the built assets, cache-first) and a generated
  icon set, or drop the PWA claim from the README.
- Accessibility: convert the 8 clickable `div`s to buttons, add
  `:focus-visible` rings, label icon-only controls, verify contrast on
  `--text-faint` against `--surface`.

**Exit test:** `npm test` green; app loads with the network disabled; full
keyboard traversal of every screen.

### Phase 2 — Fix the economic shape
*The one balance problem that content cannot paper over.*

- Add market saturation: the *n*-th business in a category earns a decaying
  share (e.g. `0.92^n`, floored) so stacking duplicates has a natural ceiling
  and the answer to "what do I buy next" stops being "more of the same".
- Re-tune `baseIncomeScale` against the headless bot once saturation lands,
  targeting a bot median of 40–60 min (which should map to the 2–3h human run
  originally specified).
- Give the top of the ladder somewhere to go: property development and market
  positions should become the dominant late-game income, not a 93rd nightclub.

**Exit test:** bot median 40–60 min to IPO; bot ends with <25 businesses; no
single system contributes >60% of lifetime earnings.

### Phase 3 — Event cards to full depth
*The headline pillar. Biggest player-visible win.*

- Expand 48 → ~140 cards (18–20 per category, ~30 generic). Target: **45+
  minutes before a repeat**, verified with the existing `repeats.ts` harness.
- Card chains: an outcome can queue a specific follow-up card minutes later,
  so decisions have a second act.
- Per-business memory: a small tag set (`understaffed`, `bad_press`,
  `union_dispute`) written by outcomes and gated on by later cards.
- Rare high-stakes cards gated on business level, tier, and Flex, so the deck
  visibly matures as the empire does.

**Exit test:** measured first-repeat >45 min; at least one chain reachable per
category; deck coverage test asserts every card is drawable.

### Phase 4 — Depth pass on the remaining pillars
*One focused change each, chosen for the highest depth-per-complexity.*

- **Businesses:** per-instance traits rolled at founding (`prime location`,
  `cursed lease`, `loyal staff`) — makes two nightclubs different objects.
- **Luck:** pity counter (guaranteed Rare+ every N rolls), plus a Luck sink so
  the stat is spendable, not only accumulative.
- **Markets:** dividends on the value stocks, a portfolio value history chart,
  and correlation between owned business categories and matching tickers.
- **Real estate:** renovation for built property, and let commercial units be
  upgraded rather than only land developed.
- **Luxury:** a proper collection view — this system is *about* display and is
  currently a list of rows.
- **Prestige:** milestone unlocks across runs (new categories, cities, or
  card decks at 2/5/10 IPOs) so later runs differ structurally.

### Phase 5 — Finish and feel
- Achievements tied to the existing `stats` block (which already tracks
  everything needed and is barely surfaced).
- Progressive onboarding: one contextual explainer the first time each screen
  unlocks, instead of a single wall of text at launch.
- Audio and haptics on rarity reveals and card resolution.
- Surface `lifetimeRevenue` and run history; a post-IPO run summary screen.

---

## Suggested sequencing

Phases 0–2 are non-negotiable for a finished game and are mostly small,
well-understood edits. Phase 3 is where the game gets meaningfully better to
play and is the largest single content investment. Phases 4–5 are polish that
can ship incrementally.

If only one thing gets done: **Phase 0, then Phase 3.**


---

## Outcome — Phases 0 to 3

### Phase 0 · Stop the bleeding — done
All four bugs fixed and 20 dead exports removed. Verified by a four-hour
headless run: every city keeps a full page of listings with commercial and land
always available, and max-rate hustle spamming fell from **99.3% of lifetime
earnings to 0.00%**.

### Phase 1 · Make the claims true — done
33 engine invariant tests, mutation-tested (re-introducing either Phase 0 bug
makes the suite fail). A real generated service worker — a cold offline load now
works, verified in Chromium with the network disabled. Tappable rows are real
buttons, sheets close on Escape, focus is visible.

One implementation note worth keeping: the worker matches cached entries by URL
rather than Request identity. Vite emits script and style tags with
`crossorigin`, which makes those requests CORS-mode and stops them matching
precached entries — the shell loaded offline but the JS and CSS did not.

### Phase 2 · Fix the economic shape — mostly done
Saturation landed and did its job: the optimal bot went from holding 90–145
businesses and **zero** property to ~21 businesses and ~8 properties. Tuning
also surfaced two genuine scaling bugs (staff wages ignoring business level;
saturation ranking by millisecond timestamp).

**Exit test not met.** The target was a 40–60 minute bot median; the result is
~21 minutes. Every available lever was swept — income scale, cost growth,
upgrade growth, IPO threshold — and each moves the median by five to ten minutes
before the compounding reasserts itself. Reaching 40–60 minutes needs a
structural change (hard caps, or a substantially longer content ladder), not
tuning. The bot is a strict lower bound on a human run, so real play should land
comfortably inside the originally requested 2–3 hours.

### Phase 3 · Event cards — done
48 cards to **132**, split into one file per category. Memory tags and chains
both shipped, with tests asserting every chain target exists and is
chain-only, every chain-only card is reachable, and every required tag is
writable by some outcome.

**The exit test as originally written was unachievable and was replaced.** "45
minutes before a repeat" cannot be bought with content: independent draws
collide after roughly `sqrt(pi*n/2)` cards, so 45 minutes would have needed
~700 cards. The fix was mechanical — draw without replacement, with the memory
window scaled to the drawable pool. Measured result across all six categories:
**44–49 minutes** to first repeat for a levelling business, 33–40 minutes for
one pinned at level 1.

A second finding from that measurement: the deck felt small at low levels not
because it was small but because `minLevel` gating left a level-1 business only
eight drawable cards, and empire-wide cards were only sampled 25% of the time.
The pool is now stable and weighted rather than intermittent.

### Still open
Phases 4 and 5 are untouched: per-business traits, a luck pity counter,
dividends and portfolio history, property renovation, a real luxury collection
view, cross-run milestone unlocks, achievements, onboarding, and audio.

## Deployment — the blank page

The public URL served a blank page for the first day it was live. Pages had been
enabled in **Deploy from a branch** mode, so `https://booze1.github.io/BigBossMoney/`
was the branch's own file tree rather than the artifact `deploy-pages.yml`
uploads. That tree's `index.html` is Vite's dev entry, which loads
`/src/main.tsx` — a source file that 404s when served statically. The result was
a correct `<title>` over an empty `#root`, indistinguishable from a blank page,
while four green deploys uploaded a working bundle nothing was serving.

It was reproduced by mounting the repo root at `/BigBossMoney/` on a static
server: `#root content length: 0`, plus `404 /src/main.tsx`. Serving `dist/` at
the same path rendered normally, which ruled out both the subpath and a stale
service worker.

The source is now set to **GitHub Actions**, so the uploaded artifact is the
site and the mismatch cannot recur. The interim workaround — a committed copy of
the build, a redirect out of the dev entry, `.nojekyll`, and a staleness check
in CI — has been removed. Attempting the switch from the workflow itself does
not work: `PUT /repos/.../pages` returns `403 Resource not accessible by
integration`, as the endpoint requires repository admin.

One piece was worth keeping. `index.html` now carries an inline-styled splash
inside `#root` that React replaces on mount, and which after ten seconds says
the game files did not load. It is a first paint in the normal case, and in the
abnormal one it means this class of failure can never again be silent.

## Phase 4 — everything you own is specific

Chosen with the brief "no opponent, go deeper; something with teeth; progress
you can see". Three pieces, each measured and shipped separately.

**Premises and traits.** Opening a business is a shortlist of three, priced by
what is right and wrong with each. Traits are permanent, move four different
numbers, gate cards, and can be cured by the card they unlock. The prices are
derived by `tools/traits.ts` rather than chosen — and building that tool found
two levers pointing the wrong way. `eventRate` below 1 means more cards and
cards pay, so giving it to flaws made neglect the most profitable purchase on
the board (one flaw measured at 1.44x a clean site). `stakes` could not be made
to work at all: instrumenting card wins and losses separately showed cards take
6,858 and return 2,084 over ten minutes, so card cash is net negative and what
cards really pay is the boosts they grant — scaling the swing symmetrically made
a risky site *more* valuable, and scaling only the downside moved the total by
2%. It was removed and those traits re-expressed in revenue and upkeep.

**Staff.** A roster rather than a count. Tenure pays up to 25%, severance grows
with service and is charged in full when a business closes. Both caps are
load-bearing: uncapped tenure drifts staff output away from the wages paying for
it and breaks the hiring invariant.

**The return.** The offline simulation is instrumented — income attributed to
source, net worth sampled into a curve, and up to six notable events collected.
Writing the test for long-service milestones found a real bug: tenure runs on
the wall clock, which has already advanced by the time the offline sim is
called, so the "before" snapshot was comparing the present against itself and
the note could never have fired in production. It also found the attribution
was wrong — debt interest compounds onto the principal rather than leaving your
cash, so counting it as an outgoing double-counted and broke the identity that
earnings equals income minus repayments.

Pacing held throughout: 34.2m median to IPO against a 35.0m baseline, with
businesses per run unchanged and property use up from ~21 to ~30. The suite went
from 36 tests to 65, and was run ten times consecutively to shake out a flaky
assertion that compared a `Date.now()`-derived severance to four decimal places.

### Still open
Phase 5 is untouched: a luck pity counter, dividends and portfolio history,
property renovation, a real luxury collection view, cross-run milestone
unlocks, achievements, onboarding, and audio.
