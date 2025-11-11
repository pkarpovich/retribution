# Scripts

## fetch-heroes.js

Fetches all MLBB heroes data from mlbb.io API and saves to `src/data/heroes.json`

### Setup

Create a `.env` file in the project root:

```
MLBB_API_SECRET=your_api_secret_here
```

### Usage

```bash
MLBB_API_SECRET=your_secret node scripts/fetch-heroes.js
```

### Output

Creates `src/data/heroes.json` with:
- All 130+ heroes
- Complete statistics (pick rate, win rate, ban rate)
- Hero details (role, lane, specialty, tier)
- Statistics for different ranks and timeframes

The frontend will filter for jungle heroes only.
