// Checks that the parsers produced well-formed output. Nothing here has an
// opinion about the meta: no tier is wrong, no win rate is suspicious, no
// hero is too strong. Those move every week and are not this file's business.
//
// What it does catch is the shape going wrong quietly - the API changing a
// field name, a join failing, a relation list coming back empty - which
// otherwise writes a healthy-looking heroes.json and ships it to users.
//
// Floors are set well below what a healthy fetch produces, so they fire on a
// break rather than on drift. Measured on 133 heroes:
//   counters 100% of heroes, weakAgainst 97%, synergies 100%, 0 dangling ids
//   30 stat rows each, 6 ranks x 5 timeframes, 39 junglers

const MIN_HEROES = 100;
const MIN_JUNGLERS = 20;
const MIN_RELATION_COVERAGE = { counters: 0.9, weakAgainst: 0.85, synergies: 0.9 };
// The engine reads this pair for base_score; losing it silently zeroes the
// component that carries the most weight.
const REQUIRED_RANK = 'Mythic';
const REQUIRED_TIMEFRAME = 'Past 7 days';
const REQUIRED_FIELDS = ['id', 'hero_name', 'lane', 'tier', 'score', 'role', 'statistics'];
const KNOWN_TIERS = new Set(['SS', 'S', 'A', 'B', 'C', 'D']);

const pct = share => `${(share * 100).toFixed(1)}%`;
const sample = (names, limit = 3) =>
  names.slice(0, limit).join(', ') + (names.length > limit ? ` +${names.length - limit}` : '');

export function validateHeroes(heroes) {
  const errors = [];
  const name = hero => hero?.hero_name ?? `id ${hero?.id}`;

  if (heroes.length < MIN_HEROES) {
    errors.push(`roster collapsed to ${heroes.length} heroes (floor ${MIN_HEROES})`);
    return { errors, checked: 0 };
  }

  const ids = new Set();
  const duplicates = [];
  for (const hero of heroes) {
    if (ids.has(hero.id)) duplicates.push(name(hero));
    ids.add(hero.id);
  }
  if (duplicates.length > 0) errors.push(`duplicate hero ids: ${sample(duplicates)}`);

  for (const field of REQUIRED_FIELDS) {
    const missing = heroes.filter(hero => hero[field] === undefined || hero[field] === null);
    if (missing.length > 0) {
      errors.push(`${missing.length} hero(es) missing "${field}": ${sample(missing.map(name))}`);
    }
  }

  const badTier = heroes.filter(hero => hero.tier && !KNOWN_TIERS.has(hero.tier));
  if (badTier.length > 0) {
    const seen = [...new Set(badTier.map(hero => hero.tier))];
    errors.push(`unknown tier value(s) ${seen.join(', ')} on ${badTier.length} hero(es)`);
  }

  // A relation pointing at a hero the roster does not contain means the join
  // broke, not that the matchup changed.
  for (const field of Object.keys(MIN_RELATION_COVERAGE)) {
    const present = heroes.filter(hero => Array.isArray(hero[field]) && hero[field].length > 0);
    const coverage = present.length / heroes.length;
    if (coverage < MIN_RELATION_COVERAGE[field]) {
      errors.push(
        `only ${pct(coverage)} of heroes have "${field}" (floor ${pct(MIN_RELATION_COVERAGE[field])})`
      );
    }

    const dangling = heroes.flatMap(hero =>
      (hero[field] ?? []).filter(relation => !ids.has(relation.id)).map(relation => `${name(hero)}->${relation.id}`)
    );
    if (dangling.length > 0) {
      errors.push(`${dangling.length} "${field}" relation(s) point at unknown heroes: ${sample(dangling)}`);
    }
  }

  const noStats = heroes.filter(hero => !Array.isArray(hero.statistics) || hero.statistics.length === 0);
  if (noStats.length > 0) {
    errors.push(`${noStats.length} hero(es) have no statistics rows: ${sample(noStats.map(name))}`);
  }

  const missingRow = heroes.filter(
    hero =>
      Array.isArray(hero.statistics) &&
      hero.statistics.length > 0 &&
      !hero.statistics.some(
        row => row.rank_name === REQUIRED_RANK && row.timeframe_name === REQUIRED_TIMEFRAME
      )
  );
  if (missingRow.length / heroes.length > 1 - MIN_RELATION_COVERAGE.counters) {
    errors.push(
      `${missingRow.length} hero(es) have no "${REQUIRED_RANK} / ${REQUIRED_TIMEFRAME}" row - ` +
        'the field names the API returns may have changed'
    );
  }

  const badWinRate = heroes.flatMap(hero =>
    (hero.statistics ?? [])
      .filter(row => typeof row.win_rate !== 'number' || row.win_rate <= 0 || row.win_rate >= 100)
      .map(() => name(hero))
  );
  if (badWinRate.length > 0) {
    errors.push(`${badWinRate.length} statistics row(s) have an unparsable win_rate: ${sample([...new Set(badWinRate)])}`);
  }

  const junglers = heroes.filter(hero => (hero.lane ?? []).includes('Jungle'));
  if (junglers.length < MIN_JUNGLERS) {
    errors.push(`only ${junglers.length} heroes tagged Jungle (floor ${MIN_JUNGLERS}) - lane parsing may have broken`);
  }

  return { errors, checked: heroes.length };
}
