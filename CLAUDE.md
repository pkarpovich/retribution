# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Retribution is a Mobile Legends: Bang Bang (MLBB) jungler recommendation app built with React, TypeScript, and Vite. It helps players select optimal jungler heroes based on enemy team composition using tier rankings, win rates, and counter-play logic.

## Development Commands

```bash
pnpm dev              # Start dev server on port 50200
pnpm build            # TypeScript compilation + Vite build
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
  - `bans.svelte.ts` - personal bans, heroes never to suggest to this player
  - `matches.svelte.ts` - the match log (see below)
- `draftStorage.ts` persists the board itself (allies, enemies, match bans, pick, mode) so an OS eviction mid-draft does not cost a hand-rebuilt draft. It stores hero **ids** and resolves them against the live roster on load, the opposite choice from the match log and for the opposite reason. A draft older than `DRAFT_TTL_MS` (3h) is discarded rather than restored: a board that looks ready but answers yesterday's enemy team is worse than an empty one
- No external state management library

### Match Log (`src/lib/matches.svelte.ts`, `src/utils/matchStats.ts`)
- A record is written when a jungle pick is locked, and carries the draft plus everything the engine saw and said: the 12-component breakdown, warnings, strengths, the boot recommendation, the team needs, where the pick ranked among the suggestions and whether the top suggestion was taken
- Records are self-contained on purpose - `heroes.json` moves twice a week, so a log that only named heroes would stop being readable
- One pending record at a time: locking again replaces it. A pending record survives RESET because the result arrives long after the draft is cleared
- Notes persist on a 400ms debounce; every other write is immediate
- `exportMatches()` produces self-describing JSON intended to be handed to an agent with no other context

### Core Logic (`src/utils/heroUtils.ts`)
- `getJunglers()`: Filters heroes by Jungle lane
- `recommendJunglers()`: Scores junglers using a 12-component pipeline:
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
- Capability helpers: `getMobilityScore()`, `getCCScore()`, `hasSustainCapability()`, `hasImmunityCapability()` read from `hero.capabilities`
- `recommendBoots()`: Selects optimal boots and Retribution blessing based on hero type + enemy team composition (CC threats, physical-heavy teams, hero role). Called from `calculateJunglerRecommendation()` and attached to each `RecommendationResult`

### Component Structure
Components follow a co-located pattern (component + CSS in same directory):
- `EnemyPicker`: Grid of all heroes for enemy selection
- `CompactEnemyTeam`: Header display of selected enemies
- `StickyRecommendations`: Top 8 jungler recommendations
- `CompactRecommendationCard`: Individual recommendation card with expandable details
- `SearchBar`: Hero search filter
- `HeroAvatar`: Reusable hero image component
- `TierBadge`: Hero tier display (SS/S/A/B/C/D)

### Data Flow
1. User selects enemy heroes (max 5) and optionally ally heroes (max 4). Two separate ban lists: personal bans (`src/lib/bans.svelte.ts`, localStorage, "never suggest this to me") only shrink the candidate pool; match bans (App state, cleared on reset) also take the hero off the board for the enemy and so feed `counter_threat`
2. `recommendJunglers()` calculates scores combining 12 components:
   - Base score (tier: SS=100..D=10, quadratic win rate bonus, pick rate reliability)
   - Matchup data (strong-against bonus from weakAgainst victims, counter penalty from counters, counter threat from counters the enemy can still take, synergy bonus)
   - Team composition (balance, damage type balance, CC chain synergy)
   - Situational (enemy vulnerability, invade resistance, early/late game tempo)
   - Meta relevance (ban rate and pick rate signals)
3. Top 8 recommendations displayed with score breakdowns, warnings, strengths, and boot/blessing recommendations

## Type System

All types defined in `src/types/hero.ts`:
- `Hero`: Complete hero data including role, lane, tier, specialties, statistics, capabilities, counters/weakAgainst/synergies
- `HeroStatistic`: Pick/win/ban rates by rank and timeframe
- `HeroCapabilities`: mobilityScore, ccScore, hasSustain, hasAOE, hasImmunity, maxBurstDamage, skillsSummary
- `HeroRelation`: Counter/synergy/weakAgainst relationship with weighted_score
- `ScoreBreakdown`: Individual score for each of the 12 scoring components
- `BootType`: Boot options (`Tough Boots` | `Warrior Boots` | `Arcane Boots` | `Swift Boots` | `Magic Shoes`)
- `RetributionBlessing`: Blessing options (`Ice` | `Flame` | `Bloody`)
- `BootRecommendation`: Boot + blessing recommendation with reason strings
- `RecommendationResult`: Full recommendation output with hero, scores, breakdown, warnings, strengths, bootRecommendation
- `UserRank`: Epic | Legend | Mythic | Mythical Honor | Mythical Glory+

## Key Implementation Details

- Hero data loaded as static JSON import (not async)
- Latest stats prioritize "Past 7 days" timeframe with rank-specific data (defaults to Mythic)
- Recommendations recalculated via `useMemo` when enemy or team selection changes
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
