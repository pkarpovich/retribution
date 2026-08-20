# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Retribution is a Mobile Legends: Bang Bang (MLBB) jungler recommendation app built with Svelte 5 (runes mode), TypeScript, and Vite. It helps players select optimal jungler heroes based on enemy team composition using tier rankings, win rates, and counter-play logic.

## Development Commands

```bash
pnpm dev              # Start dev server on port 50200
pnpm build            # svelte-check + Vite build
pnpm check            # svelte-check on its own
pnpm lint             # Run ESLint
pnpm test             # Run unit tests (vitest)
pnpm preview          # Preview production build
```

Note: This project uses Vite 8 with native Rolldown bundler.

## Data Management

Hero data is fetched from the mlbb.io API and stored in `src/data/heroes.json`:

```bash
# Direct API mode:
MLBB_API_SECRET=your_secret node scripts/fetch-heroes.js

# Proxy mode (browser cookie auth):
MLBB_CSRF_TOKEN=your_token node scripts/fetch-heroes.js
```

The script fetches all 130+ heroes with statistics, counter/synergy/weakAgainst relationships, and computes `capabilities` (mobilityScore, ccScore, hasSustain, hasImmunity) from skill data. The frontend filters for jungle heroes only.

## Architecture

### State Management
- Draft state lives in `App.svelte` as `$state`; it flows down through props and callbacks flow up
- Two localStorage-backed rune stores in `src/lib/`, both singletons:
  - `pool.svelte.ts` - two hero lists over one factory, mutually exclusive and set through `setStance()`: `bans` (never suggest, removes the candidate, never touches a score) and `signatures` (heroes the player mains, leaves every candidate in place and nudges one). Invariant tests hold the pair apart
  - `matches.svelte.ts` - the match log (see below)
- `draftStorage.ts` persists the board itself (allies, enemies, match bans, pick, mode - `DraftMode` is `ally | enemy | ban | pick`, and an unknown stored mode falls back to the default) so an OS eviction mid-draft does not cost a hand-rebuilt draft. It stores hero **ids** and resolves them against the live roster on load, the opposite choice from the match log and for the opposite reason. A draft older than `DRAFT_TTL_MS` (3h) is discarded rather than restored: a board that looks ready but answers yesterday's enemy team is worse than an empty one
- No external state management library

### Match Log (`src/lib/matches.svelte.ts`, `src/utils/matchStats.ts`)
- A record is written every time a pick is taken, by whichever route, and carries the draft plus everything the engine saw and said: the 13-component breakdown, warnings, strengths, the boot recommendation, the team needs, where the pick ranked among the suggestions and whether the top suggestion was taken
- `rank` has three shapes, because the roster offers every undrafted hero while the engine shows only eight suggestions: the position in the list when the hero is in it (`shown` = list length, `followedAdvice` = `rank === 1`); `shown + 1` when suggestions were on screen and the hero was not among them, meaning "below the displayed list", which is an override and not a blind pick; and `null` with `shown: 0` when no suggestions were on screen at all - the pick was marked blind. `MatchBanner` and `StatsScreen` must never render `shown + 1` as a literal position ("#9 of 8") and must not emit a leading separator for a null rank. Both go through `rankLabel()` in `matchStats.ts`; that is the only place the three shapes become text. It reads anything that is not a pair of numbers as blind, because the log's loader checks `id` and `outcome` and nothing else, so a record written before this shape existed arrives with the field missing rather than `null` - `summarise()` tallies it the same way, keeping `followed + overrode + blind === settled` whole
- `matchStats.ts` splits settled games three ways, not two: `followed` and `overrode` only count records with a rank, and blind picks land in their own `blind` tally, so `followed + overrode + blind === settled`. The engine never advised on a blind pick, so counting it as disagreement would be a lie about the engine. `ABOUT` in the export explains all three to a reading agent
- Records are self-contained on purpose - `heroes.json` moves twice a week, so a log that only named heroes would stop being readable
- One pending record at a time: locking again replaces it. A pending record survives RESET because the result arrives long after the draft is cleared
- Notes persist on a 400ms debounce; every other write is immediate
- `exportMatches()` produces self-describing JSON intended to be handed to an agent with no other context

### Core Logic (`src/utils/heroUtils.ts`)
- `getJunglers()`: Filters heroes by Jungle lane
- `recommendJunglers()`: Scores junglers using a 13-component pipeline:
  - base_score (tier + win rate + pick rate reliability)
  - strong_against_bonus (hero.weakAgainst = victims this hero beats)
  - team_balance (damage/utility/tank composition needs)
  - damage_type_balance (physical vs magic diversity)
  - enemy_vulnerability (squishy targets weighted by mobility, immunity vs CC)
  - cc_chain_synergy (team CC followup or CC gap filling)
  - invade_resistance (sustain/mobility vs early-game enemies)
  - counter_penalty (hero.counters = heroes that beat this hero, already picked)
  - counter_threat (hero.counters still available while the enemy holds open slots)
  - synergy_bonus (synergy data with teammates)
  - meta_bonus (ban rate and pick rate signals)
  - early_late_game (tempo mismatch bonuses)
  - comfort (a flat bonus for heroes the player mains, applied outside the situational squash)
- Capability helpers: `getMobilityScore()`, `getCCScore()`, `hasSustainCapability()`, `hasImmunityCapability()` read from `hero.capabilities`
- `matchupIndex(hero, enemyTeam, userRank)`: `strongAgainstRaw() - counterPenaltyRaw()`, the uncapped bodies of the two matchup components. `calculateStrongAgainstBonus()` and `calculateCounterPenalty()` are thin wrappers that apply the engine's `Math.min(..., 120)`, so the engine's own numbers are unchanged. See "The locked pick panel" below for why the index is raw
- `counterSeverity(weightedScore, weights)` grades one counter relation HIGH/MEDIUM/LOW. It takes the **raw** `weighted_score` and applies `weights.counter_penalty / 10` itself, so every call site passes the raw relation weight and never a pre-scaled one; scaling it twice silently downgrades relations near the boundary
- `liveCounterThreats(hero, yourTeam, enemyTeam, matchBans)`: the counters the enemy can still take, with the `exposure` each contributes. `calculateCounterThreat()` sums those exposures, so the list and the component cannot drift
- `recommendBoots()`: Selects optimal boots and Retribution blessing based on hero type + enemy team composition (CC threats, physical-heavy teams, hero role). Called from `calculateJunglerRecommendation()` and attached to each `RecommendationResult`

### The locked pick panel (`src/components/PickRead.svelte`, `pickReadout()` in `src/utils/presentation.ts`)

Once a pick is locked the engine stops evaluating it - `recommendJunglers()` drops everything already on the board from the candidate list. This panel keeps reading it as the rest of the draft is revealed: a headline **matchup index** with the delta since the lock, and four groups of named heroes (taken against you / you beat / works with you / they can still take).

- The index is `matchupIndex(pick, enemies)` - **raw and uncapped**, with zero-weight relations dropped from the number and from the lists alike, so the two always agree
- **It is deliberately not the engine's situational score, and must not be "upgraded" back to one.** That score measures how much of the draft is known as much as it measures the pick: several components return 0 on an empty enemy team and switch on with the first reveal, `calculateTeamBalance` does the same on the ally axis, and the shared `tanh` compression couples every component to every other. Measured on the frozen snapshot, a matchup-neutral enemy could move it by ~20 points and a matchup-neutral ally by ~25 - in a panel whose one job is to report that a counterpick appeared. The index moves only when a hero the engine actually prices as a relation appears on the **enemy** side; allies, match bans and team composition cannot move it by construction
- The 120 cap was removed for this number after measuring that 11 of the 39 junglers would be clipped by it on their five worst counters, which would freeze the index exactly when the draft is going worst. Range on five enemy slots: -140 to +79, so size the display for four digits and a sign
- `sinceLock` is **reconstructed, not stored**: the same function run over the enemies recorded in `matches.pending`, resolved against the roster. Both sides then use the same hero data and the same weights, so the difference isolates the enemy team and survives a hero-data refresh. It is `null` when there is no pending record for this pick; `+0` is shown rather than hidden, because "nothing has changed since you locked" is a real answer
- `PickBoard.roster` must be the **full** hero list, not `App`'s filtered `roster` - the baseline enemies are drafted by definition, so a filtered roster resolves them to nothing and turns every `sinceLock` into the whole index
- WORKS WITH YOU is the one group the index does not price. The panel says so on screen: an ally can matter to the pick without moving a number scoped to the enemy board

### Fourth draft mode

The pick can also be set before any enemy is revealed, which is the pick-first case the suggestion cards cannot serve. The empty jungle slot in `TeamsStrip` enters `mode = 'pick'`, `RosterPanel` swaps its tab row for YOUR JUNGLE PICK / CANCEL, and a tapped hero becomes `myPick` before the mode returns to `'enemy'`. Both entry points go through one pick-taking function in `App.svelte` so the match record cannot drift between them.

- The return to `'enemy'` lives **inside** that shared function, not in the roster branch. The two entry points are live at the same time - the empty JG slot puts the roster in pick mode while the suggestion card keeps its LOCK THIS PICK button - so a lock taken from the card while pick mode is on has to leave pick mode too. Left on, the roster's next tap replaces the pick and overwrites the pending record instead of adding an enemy, and `mode` is persisted, so the stuck state survives a reload
- That function is passed `allies`, never `myTeam`: `calculateTeamBalance` counts damage dealers and tanks in `yourTeam`, so a hero present in its own team list depresses its own `damageNeed`. `needs` on the next line **is** computed against the pick-inclusive team, on purpose - the two lines are not a copy-paste slip

### Component Structure
Components follow a co-located pattern (component + CSS in same directory):
- `EnemyPicker`: Grid of all heroes for enemy selection
- `CompactEnemyTeam`: Header display of selected enemies
- `StickyRecommendations`: Top 8 jungler recommendations
- `CompactRecommendationCard`: Individual recommendation card with expandable details
- `SearchBar`: Hero search filter
- `HeroAvatar`: Reusable hero image component
- `TierBadge`: Hero tier display (SS/S/A/B/C/D)
- `SuggestionBlock`: The right-hand column. It tests `myPick` **first** and falls through to the "Start with the enemy team" prompt second - the other order hides the locked view behind `hasDraft`, which does not count the pick, so a hero marked on an otherwise blank board would never render
- `PickRead`: The locked pick panel (see below), rendered above WHAT TO BUY

### Data Flow
1. User selects enemy heroes (max 5) and optionally ally heroes (max 4). Two separate ban lists: personal bans (`src/lib/pool.svelte.ts`, localStorage, "never suggest this to me") only shrink the candidate pool; match bans (App state, cleared on reset) also take the hero off the board for the enemy and so feed `counter_threat`
2. `recommendJunglers()` calculates scores combining 13 components:
   - Comfort (flat bonus for a hero the player mains; sits outside the situational budget so it cannot eat the draft response. Sized at 8 points against a shown list that spans ~31: median displacement 3 places of 39, pulls a hero into the top 8 in 9% of drafts. The pro benchmark cannot validate this one - pros' mains are not yours - so the match log is the only thing that eventually will)
   - Base score (tier: SS=100..D=10, quadratic win rate bonus, pick rate reliability)
   - Matchup data (strong-against bonus from weakAgainst victims, counter penalty from counters, counter threat from counters the enemy can still take, synergy bonus)
   - Team composition (balance, damage type balance, CC chain synergy)
   - Situational (enemy vulnerability, invade resistance, early/late game tempo)
   - Meta relevance (ban rate and pick rate signals)
3. Top 8 recommendations displayed with score breakdowns, warnings, strengths, and boot/blessing recommendations
4. Taking a pick - from a suggestion card, or from the roster through the empty jungle slot - writes a match record and swaps the column for the locked view: the pick's header, the `PickRead` panel, then WHAT TO BUY. From there the panel, not the engine, is what keeps reading the pick as the draft fills in

## Type System

All types defined in `src/types/hero.ts`:
- `Hero`: Complete hero data including role, lane, tier, specialties, statistics, capabilities, counters/weakAgainst/synergies
- `HeroStatistic`: Pick/win/ban rates by rank and timeframe
- `HeroCapabilities`: mobilityScore, ccScore, hasSustain, hasAOE, hasImmunity, maxBurstDamage, skillsSummary
- `HeroRelation`: Counter/synergy/weakAgainst relationship with weighted_score
- `ScoreBreakdown`: Individual score for each of the 13 scoring components
- `BootType`: Boot options (`Tough Boots` | `Warrior Boots` | `Arcane Boots` | `Swift Boots` | `Magic Shoes`)
- `RetributionBlessing`: Blessing options (`Ice` | `Flame` | `Bloody`)
- `BootRecommendation`: Boot + blessing recommendation with reason strings
- `RecommendationResult`: Full recommendation output with hero, scores, breakdown, warnings, strengths, bootRecommendation
- `UserRank`: Epic | Legend | Mythic | Mythical Honor | Mythical Glory+

## Key Implementation Details

- Hero data loaded as static JSON import (not async)
- Latest stats prioritize "Past 7 days" timeframe with rank-specific data (defaults to Mythic)
- Recommendations recalculated by a `$derived` in `App.svelte` when enemy or team selection changes
- Hero selection limited to 5 enemies and 4 allies (standard MLBB team size)
- Scoring weights are tuned per user rank (Epic through Mythical Glory+)
- Search is case-insensitive hero name matching
- Unit tests use vitest (`vitest.config.ts`), test files in `src/utils/__tests__/`

## CI Workflow

Automated hero data updates run via Gitea Actions (`.gitea/workflows/update-heroes.yml`) on a self-hosted runner:
- Schedule: Mon/Thu 06:00 UTC (`0 6 * * 1,4`), plus manual `workflow_dispatch`
- Clones from GitHub, runs `node scripts/fetch-heroes.js --allow-partial`, commits and pushes back
- Uses corepack-managed pnpm with `actions/cache@v4` for pnpm store
- Push auth: `http.extraheader` with base64-encoded basic auth (`pkarpovich:<GH_TOKEN>`)
- Rebase guard: `pull --rebase` before push to handle concurrent master changes
- Telegram notifications on success/failure via `appleboy/telegram-action`
- Job timeout: 30 minutes (130 heroes x 2s sleep + overhead)
- Required Gitea secrets: `GH_TOKEN` (GitHub PAT), `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN`
