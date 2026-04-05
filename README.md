# Retribution

> Smart jungler recommendations for Mobile Legends: Bang Bang

**Retribution** is a Progressive Web App that helps Mobile Legends: Bang Bang players make optimal jungler hero selections based on team composition, enemy picks, and advanced game theory.

## The Problem

Choosing the right jungler in MLBB can make or break a match. Players need to consider:
- Enemy team composition (roles, damage types, specialties)
- Team synergy and balance
- Counter-pick opportunities
- Meta tier rankings and win rates
- Physical vs Magic damage distribution
- Early/late game matchups
- Hero capabilities (mobility, CC, sustain, immunity)

Making these calculations mentally during draft phase is difficult and error-prone.

## The Solution

Retribution analyzes all these factors instantly and recommends the top 8 junglers with detailed scoring breakdowns:

- **11-Component Scoring:** Evaluates 130+ heroes across base stats, matchups, team balance, CC chains, invade resistance, and more
- **Real-time Recommendations:** Updates as you select team members and enemies
- **Team Radar Chart:** SVG radar comparing enemy vs your team across 6 axes (Physical, Magic, CC, Mobility, Durability, Burst)
- **Hero Capability Radar:** Per-hero radar showing Burst, Mobility, CC, Sustain, AOE profile
- **Matchup Visualization:** See which enemies your pick counters (green) or is weak against (red) with avatars
- **Flexoki Theme:** Light/dark theme support with the Flexoki color palette
- **Offline Ready:** Works without internet after first load (PWA)

## Features

### Core Functionality
- **Enemy Team Selection:** Pick up to 5 enemy heroes
- **Your Team Selection:** Add up to 4 teammates
- **Hero Locking:** Heroes picked by one team are visually locked in the other
- **Top 8 Recommendations:** Best jungler picks ranked by comprehensive scoring
- **Expandable Details:** Toggle between compact and detailed card views

### Recommendation Algorithm
The scoring pipeline combines 11 weighted components:
- **Base Score:** Hero tier (SS/S/A/B/C/D) and win/pick/ban rates
- **Strong Against:** Bonus when your pick counters enemy heroes
- **Team Balance:** Role distribution and damage dealer needs
- **Damage Type Balance:** Physical vs Magic optimization
- **Enemy Vulnerability:** Squishy targets weighted by mobility score
- **CC Chain Synergy:** Burst assassin bonus with high-CC teammates
- **Invade Resistance:** Sustain/mobility bonus vs early-aggression enemies
- **Counter Penalty:** Penalty when enemies counter your pick
- **Synergy Bonus:** Team composition synergies from API data
- **Meta Bonus:** Ban rate and pick rate signals
- **Early/Late Game:** Tempo mismatch bonuses

Weights scale by user rank (Epic through Mythical Glory+).

### Analytics
- **Team Radar Chart:** 6-axis SVG radar comparing team profiles with auto-detected gap warnings
- **Hero Radar:** Per-hero capability radar (Burst, Mobility, CC, Sustain, AOE)
- **Diverging Bar Chart:** Score breakdown showing positive/negative factors
- **Capability Tags:** MOB, CC, SUST, AOE, IMM at a glance
- **Matchup Avatars:** Green/red bordered enemy avatars showing who you counter or are weak against

## Tech Stack

- **React 19** with TypeScript
- **Vite 8** with native Rolldown bundler
- **CSS Modules** with Flexoki color palette (light/dark)
- **vite-plugin-pwa** + Workbox for offline support
- **GitHub Actions** for automated hero data updates

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 10+

### Installation

```bash
git clone https://github.com/pkarpovich/retribution.git
cd retribution
pnpm install
pnpm dev
```

The app will be available at `http://localhost:50200`

### Updating Hero Data

Hero data is fetched from the mlbb.io API and enriched with computed capabilities (mobility, CC, sustain, AOE, immunity) and strongAgainst matchup data.

```bash
# Uses proxy endpoint, no auth required
node scripts/fetch-heroes.js --allow-partial
```

Data updates twice a week (Mon/Thu) via Gitea Actions.

## Build & Deploy

```bash
pnpm build
pnpm preview
```

Build output in `dist/`. Deployed via Cloudflare Pages with auto-deploy on push to master.

## Data Enrichment

The fetch script parses raw hero skill data to compute:
- **mobilityScore** from Mobility/Blink skill tags
- **ccScore** from CC/Stun/Immobilize tags
- **hasSustain** from Heal/Regen tags and skill descriptions
- **hasAOE** from AOE skill tags
- **hasImmunity** from Immunity tags and description keywords (immune, untargetable)
- **maxBurstDamage** from skill scaling data
- **strongAgainst** reverse index built from all heroes' weakAgainst data

## Credits

- Hero data powered by [mlbb.io](https://mlbb.io) API
- Color palette: [Flexoki](https://stephango.com/flexoki) by Steph Ango
