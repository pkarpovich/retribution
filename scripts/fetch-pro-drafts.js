import fs from 'fs';
import { fetchPages } from './lib/liquipedia.js';
import { parseTemplates, stripMarkup } from './lib/wikitext.js';

const HEROES_PATH = './src/data/heroes.json';
const OUTPUT_PATH = './src/data/pro-drafts.json';

const TOURNAMENTS = [
  { id: 'MSC/2026', pages: ['MSC/2026/Wildcard', 'MSC/2026/Group_Stage', 'MSC/2026/Knockout_Stage'] },
];

const ALIASES = {
  yz: 'Yu Zhong',
  yss: 'Yi Sun-shin',
  esme: 'Esmeralda',
  haya: 'Hayabusa',
  popol: 'Popol and Kupa',
  cici: 'Chip',
};

function buildResolver(heroes) {
  const index = new Map();
  const key = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const hero of heroes) {
    index.set(key(hero.hero_name), hero);
  }
  for (const [alias, name] of Object.entries(ALIASES)) {
    const hero = heroes.find(h => h.hero_name === name);
    if (hero) index.set(key(alias), hero);
  }

  return raw => {
    const cleaned = stripMarkup(raw || '');
    if (!cleaned) return null;

    const direct = index.get(key(cleaned));
    if (direct) return direct;

    const prefix = [...index.entries()].filter(([indexed]) => indexed.startsWith(key(cleaned)));
    if (prefix.length === 1) return prefix[0][1];

    return null;
  };
}

function parseGames(wikitext, resolve, tournament, page, unresolved) {
  const games = [];

  for (const map of parseTemplates(wikitext, 'Map')) {
    if (!map.t1h5 || !map.winner) continue;

    const teams = [];
    let broken = false;

    for (const side of ['t1', 't2']) {
      const picks = [];
      const bans = [];

      for (let i = 1; i <= 5; i++) {
        const pick = resolve(map[`${side}h${i}`]);
        if (!pick) {
          unresolved.add(stripMarkup(map[`${side}h${i}`] || '(empty)'));
          broken = true;
          break;
        }
        picks.push({ id: pick.id, name: pick.hero_name });

        const ban = resolve(map[`${side}b${i}`]);
        if (ban) bans.push({ id: ban.id, name: ban.hero_name });
      }

      if (broken) break;
      teams.push({ picks, bans, side: stripMarkup(map[`${side === 't1' ? 'team1' : 'team2'}side`] || '') || null });
    }

    if (broken || teams.length !== 2) continue;

    games.push({
      tournament,
      page,
      winner: map.winner === '1' ? 0 : 1,
      teams,
    });
  }

  return games;
}

async function main() {
  if (!fs.existsSync(HEROES_PATH)) {
    console.error(`${HEROES_PATH} not found — run fetch-heroes.js first`);
    process.exit(1);
  }

  const heroes = JSON.parse(fs.readFileSync(HEROES_PATH, 'utf8')).heroes;
  const resolve = buildResolver(heroes);

  const pageList = TOURNAMENTS.flatMap(t => t.pages.map(page => ({ tournament: t.id, page })));
  console.log(`Fetching ${pageList.length} tournament pages from Liquipedia...`);

  const pages = await fetchPages(pageList.map(p => p.page.replace(/_/g, ' ')));

  const games = [];
  const unresolved = new Set();
  const emptyPages = [];

  for (const { tournament, page } of pageList) {
    const wikitext = pages.get(page.replace(/_/g, ' '));
    if (!wikitext) {
      emptyPages.push(page);
      continue;
    }
    const parsed = parseGames(wikitext, resolve, tournament, page, unresolved);
    if (!parsed.length) emptyPages.push(page);
    console.log(`  ${page}: ${parsed.length} games`);
    games.push(...parsed);
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'liquipedia.net/mobilelegends',
    license: 'CC-BY-SA 3.0',
    note: 'Hero index within a team is LANE order (Exp, Jungle, Mid, Gold, Roam), not pick order.',
    totalGames: games.length,
    games,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${games.length} games to ${OUTPUT_PATH}`);

  if (unresolved.size) {
    console.error(`\nERROR: unresolved hero names (add to ALIASES): ${[...unresolved].join(', ')}`);
    process.exit(2);
  }
  if (emptyPages.length) {
    console.warn(`\nWARNING: no games parsed from: ${emptyPages.join(', ')}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
