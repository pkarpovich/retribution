const JUNGLE_INDEX = 1;
const MIN_JUNGLE_GAMES = 3;
const MIN_JUNGLE_SHARE = 0.5;

export function collectJungleUsage(games) {
  const usage = new Map();

  for (const game of games) {
    for (const team of game.teams) {
      team.picks.forEach((pick, index) => {
        const entry = usage.get(pick.name) ?? { total: 0, jungle: 0 };
        entry.total += 1;
        if (index === JUNGLE_INDEX) entry.jungle += 1;
        usage.set(pick.name, entry);
      });
    }
  }

  return usage;
}

export function deriveJungleAdditions(games, heroes) {
  const usage = collectJungleUsage(games);
  const additions = [];

  for (const hero of heroes) {
    if (hero.lane?.includes('Jungle')) continue;

    const entry = usage.get(hero.hero_name);
    if (!entry || entry.jungle < MIN_JUNGLE_GAMES) continue;

    const share = entry.jungle / entry.total;
    if (share < MIN_JUNGLE_SHARE) continue;

    additions.push({
      hero: hero.hero_name,
      jungleGames: entry.jungle,
      totalPicks: entry.total,
      share: Math.round(share * 100) / 100,
    });
  }

  return additions;
}
