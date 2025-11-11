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

Note: This project uses `rolldown-vite` (a faster Vite variant with Rolldown bundler) via pnpm overrides.

## Data Management

Hero data is fetched from the mlbb.io API and stored in `src/data/heroes.json`:

```bash
MLBB_API_SECRET=your_secret node scripts/fetch-heroes.js
```

This script fetches all 130+ heroes with complete statistics (pick rate, win rate, ban rate, tier rankings) and saves to `src/data/heroes.json`. The frontend filters for jungle heroes only.

## Architecture

### State Management
- Single-component state in `App.tsx` using React `useState`
- No external state management library
- State flows down through props, callbacks flow up

### Core Logic (`src/utils/heroUtils.ts`)
- `getJunglers()`: Filters heroes by Jungle lane
- `recommendJunglers()`: Scores junglers based on tier, counter matchups, and win rates
- `getCounterScore()`: Implements rock-paper-scissors counter logic:
  - Assassins/Burst counter Marksman/Mage (+2)
  - Damage/Finisher counter Tank/Fighter (+1)
  - Tank/Fighter counter Assassin (+1.5)

### Component Structure
Components follow a co-located pattern (component + CSS in same directory):
- `EnemyPicker`: Grid of all heroes for enemy selection
- `CompactEnemyTeam`: Header display of selected enemies
- `StickyRecommendations`: Top 5 jungler recommendations
- `CompactRecommendationCard`: Individual recommendation card with expandable details
- `SearchBar`: Hero search filter
- `HeroAvatar`: Reusable hero image component
- `TierBadge`: Hero tier display (SS/S/A/B/C/D)

### Data Flow
1. User selects enemy heroes (max 5)
2. `recommendJunglers()` calculates scores combining:
   - Tier score (SS=5, S=4, A=3, B=2, C=1, D=0)
   - Counter score (role/specialty matchup bonuses)
   - Win rate bonus (normalized from 50% baseline)
3. Top 5 recommendations displayed with stats and reasoning

## Type System

All types defined in `src/types/hero.ts`:
- `Hero`: Complete hero data including role, lane, tier, specialties, statistics
- `HeroStatistic`: Pick/win/ban rates by rank and timeframe
- `HeroRole`: Tank | Fighter | Assassin | Mage | Marksman | Support
- `HeroLane`: Jungle | Exp Lane | Mid Lane | Gold Lane | Roam
- `HeroTier`: SS | S | A | B | C | D

## Key Implementation Details

- Hero data loaded as static JSON import (not async)
- Latest stats prioritize "Past 7 days" timeframe with "ALL" rank
- Recommendations recalculated via `useMemo` when enemy selection changes
- Hero selection limited to 5 enemies (standard MLBB team size)
- Search is case-insensitive hero name matching
