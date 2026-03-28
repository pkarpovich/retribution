# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Retribution is a Mobile Legends: Bang Bang (MLBB) jungler recommendation app built with React, TypeScript, and Vite. It helps players select optimal jungler heroes based on enemy team composition using tier rankings, win rates, and counter-play logic.

## Development Commands

```bash
pnpm dev              # Start dev server on port 50200
pnpm build            # TypeScript compilation + Vite build
pnpm lint             # Run ESLint
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

The script fetches all 130+ heroes with statistics, counter/synergy/weakAgainst relationships, and computes `capabilities` (mobilityScore, ccScore, hasSustain, hasImmunity) and `strongAgainst` matchups from skill data. The frontend filters for jungle heroes only.

## Architecture

### State Management
- Single-component state in `App.tsx` using React `useState`
- No external state management library
- State flows down through props, callbacks flow up

### Core Logic (`src/utils/heroUtils.ts`)
- `getJunglers()`: Filters heroes by Jungle lane
- `recommendJunglers()`: Scores junglers using an 11-component pipeline:
  - base_score (tier + win rate + pick rate reliability)
  - strong_against_bonus (hero's strongAgainst matchup data)
  - team_balance (damage/utility/tank composition needs)
  - damage_type_balance (physical vs magic diversity)
  - enemy_vulnerability (squishy targets weighted by mobility, immunity vs CC)
  - cc_chain_synergy (team CC followup or CC gap filling)
  - invade_resistance (sustain/mobility vs early-game enemies)
  - counter_penalty (weakAgainst matchup data)
  - synergy_bonus (synergy data with teammates)
  - meta_bonus (ban rate and pick rate signals)
  - early_late_game (tempo mismatch bonuses)
- Capability helpers: `getMobilityScore()`, `getCCScore()`, `hasSustainCapability()`, `hasImmunityCapability()` read from `hero.capabilities`

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
1. User selects enemy heroes (max 5) and optionally ally heroes (max 4)
2. `recommendJunglers()` calculates scores combining 11 components:
   - Base score (tier: SS=100..D=10, quadratic win rate bonus, pick rate reliability)
   - Matchup data (strongAgainst bonus, counter penalty, synergy bonus)
   - Team composition (balance, damage type balance, CC chain synergy)
   - Situational (enemy vulnerability, invade resistance, early/late game tempo)
   - Meta relevance (ban rate and pick rate signals)
3. Top 8 recommendations displayed with score breakdowns, warnings, and strengths

## Type System

All types defined in `src/types/hero.ts`:
- `Hero`: Complete hero data including role, lane, tier, specialties, statistics, capabilities, counters/weakAgainst/synergies/strongAgainst
- `HeroStatistic`: Pick/win/ban rates by rank and timeframe
- `HeroCapabilities`: mobilityScore, ccScore, hasSustain, hasAOE, hasImmunity, maxBurstDamage, skillsSummary
- `HeroRelation`: Counter/synergy/strongAgainst relationship with weighted_score
- `ScoreBreakdown`: Individual score for each of the 11 scoring components
- `RecommendationResult`: Full recommendation output with hero, scores, breakdown, warnings, strengths
- `UserRank`: Epic | Legend | Mythic | Mythical Honor | Mythical Glory+

## Key Implementation Details

- Hero data loaded as static JSON import (not async)
- Latest stats prioritize "Past 7 days" timeframe with rank-specific data (defaults to Mythic)
- Recommendations recalculated via `useMemo` when enemy or team selection changes
- Hero selection limited to 5 enemies and 4 allies (standard MLBB team size)
- Scoring weights are tuned per user rank (Epic through Mythical Glory+)
- Search is case-insensitive hero name matching
