# Retribution

> Smart jungler recommendations for Mobile Legends: Bang Bang

**Retribution** is a Progressive Web App that helps Mobile Legends: Bang Bang players make optimal jungler hero selections based on team composition, enemy picks, and advanced game theory.

## 🎯 The Problem

Choosing the right jungler in MLBB can make or break a match. Players need to consider:
- Enemy team composition (roles, damage types, specialties)
- Team synergy and balance
- Counter-pick opportunities
- Meta tier rankings and win rates
- Physical vs Magic damage distribution
- Early/late game matchups

Making these calculations mentally during draft phase is difficult and error-prone.

## 💡 The Solution

Retribution analyzes all these factors instantly and recommends the top 8 junglers with detailed scoring breakdowns:

- **Smart Analysis:** Evaluates 130+ heroes across 8 scoring dimensions
- **Real-time Recommendations:** Updates as you select team members and enemies
- **Traffic Light System:** Color-coded picks (Gold → Green → Lime → Orange → Red)
- **Detailed Insights:** Score breakdowns, strengths, warnings for each pick
- **Team Composition:** Visual damage type analysis and role distribution
- **Offline Ready:** Works without internet after first load (PWA)

## ✨ Features

### Core Functionality
- **Enemy Team Selection:** Pick up to 5 enemy heroes
- **Your Team Selection:** Add up to 4 teammates
- **Top 8 Recommendations:** Best jungler picks ranked by comprehensive scoring
- **Expandable Details:** Toggle between compact and detailed views

### Recommendation System
The algorithm considers:
- **Base Score:** Hero tier (SS/S/A/B/C/D) and win/pick/ban rates
- **Team Balance:** Role distribution and jungler type needs
- **Damage Type Balance:** Physical vs Magic damage optimization
- **Enemy Analysis:** Counter-pick opportunities and matchup advantages
- **Counter Penalty:** Warnings when enemies counter your pick
- **Synergy Bonus:** Team composition synergies
- **Meta Bonus:** Current meta performance multiplier
- **Early/Late Game:** Match length considerations

### Team Composition Analysis
- **Damage Distribution:** Visual bars showing Physical vs Magic split
- **Role Overview:** Top 3 roles for each team
- **Smart Recommendations:** Suggests Magic/Physical/Tank based on imbalance
- **Collapsible:** Hide when not needed to save space

### User Experience
- **Hero Search:** Quick filter by name
- **Compact Cards:** High-density hero grid (30-40% more visible per row)
- **Mobile Optimized:** Designed for phone screens first
- **PWA Support:** Install as app, works offline
- **Auto-Updates:** Prompts for new versions

## 🛠 Tech Stack

### Frontend
- **React 19** - UI framework with latest concurrent features
- **TypeScript** - Type safety and better DX
- **Vite** (rolldown-vite) - Ultra-fast bundler
- **CSS Modules** - Scoped styling

### PWA
- **vite-plugin-pwa** - Service worker generation
- **Workbox** - Advanced caching strategies
- **Web Manifest** - App metadata and icons

### Data
- **Static JSON** - Hero data from mlbb.io API (pre-fetched)
- **No Runtime API Calls** - Fully offline capable

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (uses React 19)
- pnpm 9+ (uses pnpm workspaces)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd retribution

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:50200`

### Fetching Latest Hero Data

```bash
# Set your mlbb.io API secret
export MLBB_API_SECRET=your_secret_here

# Fetch latest hero data
node scripts/fetch-heroes.js
```

This updates `src/data/heroes.json` with current statistics, tiers, and counters.

## 📦 Build & Deploy

```bash
# Production build
pnpm build

# Preview production build
pnpm preview
```

The PWA will:
- Generate service worker for offline support
- Create web manifest with app metadata
- Optimize and bundle all assets
- Enable installability on mobile/desktop

Build output in `dist/` directory.

## 📁 Project Structure

```
retribution/
├── public/                    # Static assets
│   ├── android-chrome-*.png  # PWA icons
│   └── favicon.ico           # Favicon
├── scripts/
│   └── fetch-heroes.js       # Hero data fetcher
├── src/
│   ├── components/           # React components
│   │   ├── CompactRecommendationCard/
│   │   ├── EnemyPicker/
│   │   ├── HeroAvatar/
│   │   ├── StickyRecommendations/
│   │   ├── TeamCompositionBar/
│   │   └── ...
│   ├── data/
│   │   └── heroes.json       # Hero database (130+ heroes)
│   ├── types/
│   │   └── hero.ts           # TypeScript definitions
│   ├── utils/
│   │   └── heroUtils.ts      # Recommendation algorithm
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point + PWA registration
├── vite.config.ts            # Vite + PWA configuration
└── package.json
```

## 🧮 Recommendation Algorithm

The scoring system uses weighted factors:

```typescript
Base Score (40%)        - Tier + Win Rate
Team Balance (20%)      - Role distribution
Damage Type (15%)       - Physical/Magic balance
Enemy Analysis (15%)    - Counter opportunities
Synergy (5%)            - Team composition fit
Meta Performance (5%)   - Current patch strength
```

Final recommendations are classified:
- **BEST PICK** (Gold) - 100+ points
- **STRONG PICK** (Green) - 80-99 points
- **GOOD PICK** (Lime) - 70-79 points
- **SAFE PICK** (Orange) - 60-69 points
- **RISKY PICK** (Red) - <60 points

## 🎨 Design Philosophy

### Mobile-First
- Compact layouts optimized for small screens
- Touch-friendly targets and gestures
- Minimal scrolling required

### Information Density
- Show maximum useful data in minimal space
- Expandable sections for details
- Visual encodings (colors, bars) over text

### Performance
- Static data loading (no API latency)
- Offline capability via PWA
- Lazy loading and code splitting
- Instant UI updates (no loading states)

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- **Algorithm Tuning:** Adjust scoring weights based on player feedback
- **More Metrics:** Add KDA ratios, item builds, skill combos
- **UI Enhancements:** Better visualizations, animations
- **Data Updates:** Automated hero data refresh pipeline
- **Analytics:** Track pick success rates for algorithm validation

## 📄 License

MIT License - feel free to use for your own MLBB tools!

## 🙏 Credits

- Hero data powered by [mlbb.io](https://mlbb.io) API
- Built with modern web technologies
- Inspired by the MLBB community's need for better draft tools

---

**Made with ❤️ for MLBB players worldwide**
