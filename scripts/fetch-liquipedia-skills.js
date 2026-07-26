import fs from 'fs';
import { fetchPages } from './lib/liquipedia.js';
import { parseTemplates, stripMarkup } from './lib/wikitext.js';

const HEROES_PATH = './src/data/heroes.json';
const OUTPUT_PATH = './src/data/liquipedia-heroes.json';

const NUMERIC_INFOBOX_FIELDS = {
  hp: 'hp',
  hpreg: 'hpReg',
  mana: 'mana',
  manareg: 'manaReg',
  phyatk: 'phyAtk',
  phydef: 'phyDef',
  magdef: 'magDef',
  movespeed: 'moveSpeed',
  atkspeed: 'atkSpeed',
};

function toNumber(value) {
  if (!value) return null;
  const match = stripMarkup(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function toNumberList(value) {
  if (!value) return null;
  const parts = stripMarkup(value).split('/').map(part => {
    const match = part.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }).filter(n => n !== null);
  return parts.length ? parts : null;
}

function parseEffects(value) {
  if (!value) return [];
  return stripMarkup(value)
    .split(/[,/]/)
    .map(part => part.trim().replace(/(\D)\d$/, '$1'))
    .filter(part => part.length > 0 && part.length < 24);
}

function parseScaling(card) {
  const scaling = {};
  for (let i = 1; i <= 8; i++) {
    const label = stripMarkup(card[`stats${i}`] || '');
    const values = toNumberList(card[`stats${i}_value`]);
    if (label && values) scaling[label] = values;
  }
  return scaling;
}

function parseSkills(wikitext) {
  return parseTemplates(wikitext, 'AbilityCard').map(card => ({
    name: stripMarkup(card.name) || null,
    effects: parseEffects(card.type),
    cooldown: toNumber(card.cd),
    manaCost: toNumber(card.mana),
    vamp: toNumber(card.vamp),
    description: stripMarkup(card.desc),
    scaling: parseScaling(card),
  }));
}

function parseInfobox(wikitext) {
  const [box] = parseTemplates(wikitext, 'Infobox hero');
  if (!box) return null;

  const baseStats = {};
  for (const [source, target] of Object.entries(NUMERIC_INFOBOX_FIELDS)) {
    const value = toNumber(box[source]);
    if (value !== null) baseStats[target] = value;
  }

  const specialities = [box.specialty1, box.specialty2, box.specialty3]
    .map(s => stripMarkup(s || ''))
    .filter(Boolean);

  return {
    lane: stripMarkup(box.lane || '') || null,
    primaryRole: stripMarkup(box.primaryrole || '') || null,
    specialities,
    releaseDate: stripMarkup(box.releasedate || '') || null,
    baseStats,
  };
}

async function main() {
  if (!fs.existsSync(HEROES_PATH)) {
    console.error(`${HEROES_PATH} not found — run fetch-heroes.js first`);
    process.exit(1);
  }

  const names = JSON.parse(fs.readFileSync(HEROES_PATH, 'utf8')).heroes.map(h => h.hero_name);
  console.log(`Fetching ${names.length} hero pages from Liquipedia...`);

  const pages = await fetchPages(names, (done, total) => {
    console.log(`  ${done}/${total}`);
  });

  const heroes = {};
  const missingPage = [];
  const missingSkills = [];
  const missingInfobox = [];

  for (const name of names) {
    const wikitext = pages.get(name);
    if (!wikitext) {
      missingPage.push(name);
      continue;
    }

    const skills = parseSkills(wikitext);
    const infobox = parseInfobox(wikitext);

    if (!skills.length) missingSkills.push(name);
    if (!infobox) missingInfobox.push(name);

    heroes[name] = { ...(infobox || {}), skills };
  }

  const skillCount = Object.values(heroes).reduce((sum, h) => sum + h.skills.length, 0);
  const withDescription = Object.values(heroes)
    .reduce((sum, h) => sum + h.skills.filter(s => s.description.length > 40).length, 0);
  const withEffects = Object.values(heroes)
    .reduce((sum, h) => sum + h.skills.filter(s => s.effects.length > 0).length, 0);

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'liquipedia.net/mobilelegends',
    license: 'CC-BY-SA 3.0',
    totalHeroes: Object.keys(heroes).length,
    heroes,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nSaved ${Object.keys(heroes).length} heroes to ${OUTPUT_PATH}`);
  console.log(`Skills: ${skillCount} (with description: ${withDescription}, with effects: ${withEffects})`);
  if (missingPage.length) console.warn(`No Liquipedia page: ${missingPage.join(', ')}`);
  if (missingSkills.length) console.warn(`No AbilityCard blocks: ${missingSkills.join(', ')}`);
  if (missingInfobox.length) console.warn(`No Infobox hero: ${missingInfobox.join(', ')}`);

  if (missingPage.length || missingSkills.length) process.exit(2);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
