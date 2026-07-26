import fs from 'fs';
import https from 'https';
import { computeCapabilities, computeStatProfiles } from './lib/capabilities.js';
import { deriveJungleAdditions } from './lib/pro-meta.js';

const API_SECRET = process.env.MLBB_API_SECRET;
const LIQUIPEDIA_PATH = './src/data/liquipedia-heroes.json';
const PRO_DRAFTS_PATH = './src/data/pro-drafts.json';

const useProxy = !API_SECRET;
const BASE_URL = useProxy
  ? 'https://mlbb.io/api/proxy/hero'
  : 'https://mlbb.io/api/hero';

function buildHeaders() {
  if (useProxy) {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://mlbb.io/hero-tier',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Cookie': 'locale=en',
    };
  }
  return { 'x-client-secret': API_SECRET };
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: buildHeaders() }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHeroDetails(heroName, maxRetries = 3) {
  const encodedName = encodeURIComponent(heroName);
  const url = `${BASE_URL}/detail/${encodedName}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await httpsGet(url);
      if (response.success) {
        return response.data;
      }
      if (attempt < maxRetries) {
        console.warn(`Failed to fetch ${heroName} (attempt ${attempt + 1}/${maxRetries + 1}): ${response.message} — retrying...`);
        await wait(2000 * (attempt + 1));
        continue;
      }
      console.error(`Failed to fetch ${heroName} after ${maxRetries + 1} attempts:`, response.message);
    } catch (error) {
      const isServerOverload = error.message.includes('429') || error.message.includes('502') || error.message.includes('503');
      const delayMs = isServerOverload ? 30000 * (attempt + 1) : 3000 * (attempt + 1);

      if (attempt < maxRetries) {
        if (isServerOverload) {
          console.warn(`Server overloaded fetching ${heroName} — waiting ${delayMs / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        } else {
          console.warn(`Error fetching ${heroName} (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message} — retrying in ${delayMs / 1000}s...`);
        }
        await wait(delayMs);
        continue;
      }
      console.error(`Failed to fetch ${heroName} after ${maxRetries + 1} attempts:`, error.message);
    }
  }
  return null;
}

function loadJson(path) {
  if (!fs.existsSync(path)) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Failed to read ${path}: ${error.message}`);
    return null;
  }
}

function applyJungleAdditions(heroes, proDrafts) {
  if (!proDrafts?.games?.length) return [];

  const additions = deriveJungleAdditions(proDrafts.games, heroes);
  const byName = new Map(heroes.map(hero => [hero.hero_name, hero]));

  for (const addition of additions) {
    byName.get(addition.hero).lane = [...byName.get(addition.hero).lane, 'Jungle'];
  }

  return additions;
}

function enrichHeroes(heroes, liquipediaHeroes) {
  const capabilitiesByHero = {};

  const enriched = heroes.map(hero => {
    const source = liquipediaHeroes?.[hero.hero_name] ?? null;
    const capabilities = source ? computeCapabilities(source) : null;
    if (capabilities) {
      capabilities.source = 'liquipedia';
      capabilitiesByHero[hero.hero_name] = capabilities;
    }

    const { skills, ...heroWithoutSkills } = hero;

    return { ...heroWithoutSkills, capabilities };
  });

  computeStatProfiles(capabilitiesByHero);

  return enriched;
}

const allowPartial = process.argv.includes('--allow-partial');

async function main() {
  let dataDegraded = false;
  console.log(`Using ${useProxy ? 'proxy' : 'API secret'} mode`);
  console.log('Fetching hero tier list...');

  const tierResponse = await httpsGet(`${BASE_URL}/hero-tiers`);

  if (!tierResponse.success) {
    console.error('Failed to fetch tier list:', tierResponse.message || 'unknown error');
    process.exit(1);
  }

  const heroes = useProxy ? tierResponse.data.heroes : tierResponse.data;
  console.log(`Found ${heroes.length} heroes`);

  const heroesWithDetails = [];
  const droppedHeroes = [];

  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i];
    console.log(`[${i + 1}/${heroes.length}] Fetching details for ${hero.hero_name}...`);

    const details = await fetchHeroDetails(hero.hero_name);

    if (details) {
      heroesWithDetails.push(details);
    } else {
      droppedHeroes.push(hero.hero_name);
    }

    await wait(2000);
  }

  if (droppedHeroes.length > 0) {
    console.error(`\nERROR: ${droppedHeroes.length} hero(es) failed to fetch and were dropped:`);
    for (const name of droppedHeroes) {
      console.error(`  - ${name}`);
    }
    console.error('Dropped heroes will be missing from output and may corrupt matchup data.');

    const dropRate = droppedHeroes.length / heroes.length;
    if (dropRate > 0.05) {
      console.error(`\nABORTING: ${(dropRate * 100).toFixed(1)}% of heroes dropped (threshold: 5%). Fix fetch errors before regenerating data.`);
      process.exit(1);
    }
    dataDegraded = true;
    console.warn('Proceeding with partial data — re-run to include dropped heroes.\n');
  }

  const liquipediaHeroes = loadJson(LIQUIPEDIA_PATH)?.heroes ?? null;
  if (!liquipediaHeroes) {
    console.warn(`\nWARNING: ${LIQUIPEDIA_PATH} not found — capabilities will be null for every hero.`);
    console.warn('Run: node scripts/fetch-liquipedia-skills.js');
    dataDegraded = true;
  }

  console.log('\nEnriching hero data...');
  const enrichedHeroes = enrichHeroes(heroesWithDetails, liquipediaHeroes);

  const withCapabilities = enrichedHeroes.filter(h => h.capabilities);
  const capsStats = {
    withSkillData: withCapabilities.length,
    withCC: withCapabilities.filter(h => h.capabilities.ccScore > 0).length,
    withMobility: withCapabilities.filter(h => h.capabilities.mobilityScore > 0).length,
    withSelfSustain: withCapabilities.filter(h => h.capabilities.selfSustain).length,
    withAllySustain: withCapabilities.filter(h => h.capabilities.allySustain).length,
    withImmunity: withCapabilities.filter(h => h.capabilities.hasImmunity).length,
    withAntiHeal: withCapabilities.filter(h => h.capabilities.antiHeal).length,
    withDamageReduction: withCapabilities.filter(h => h.capabilities.damageReduction).length,
    withShield: withCapabilities.filter(h => h.capabilities.hasShield).length,
    withAOE: withCapabilities.filter(h => h.capabilities.hasAOE).length,
  };
  console.log('Capabilities breakdown:', capsStats);

  const proDrafts = loadJson(PRO_DRAFTS_PATH);
  if (!proDrafts) {
    console.warn(`\nWARNING: ${PRO_DRAFTS_PATH} not found — meta jungle lanes will not be applied.`);
  }
  const laneAdditions = applyJungleAdditions(enrichedHeroes, proDrafts);
  if (laneAdditions.length > 0) {
    console.log('\nJungle lane added from pro drafts:');
    for (const addition of laneAdditions) {
      console.log(`  ${addition.hero}: ${addition.jungleGames}/${addition.totalPicks} picks as jungler (${Math.round(addition.share * 100)}%)`);
    }
  }

  const missingCapabilities = enrichedHeroes.filter(h => !h.capabilities);
  if (missingCapabilities.length > 0) {
    console.warn(`\nWARNING: ${missingCapabilities.length} hero(es) have no Liquipedia skill data:`);
    for (const h of missingCapabilities) {
      console.warn(`  - ${h.hero_name}`);
    }
    dataDegraded = true;
  }

  const outputDir = './src/data';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    totalHeroes: enrichedHeroes.length,
    laneAdditions,
    heroes: enrichedHeroes
  };

  fs.writeFileSync(
    `${outputDir}/heroes.json`,
    JSON.stringify(output, null, 2)
  );

  console.log(`\nDone! Saved ${enrichedHeroes.length} heroes to ${outputDir}/heroes.json`);

  const junglers = enrichedHeroes.filter(h => h.lane?.includes('Jungle'));
  console.log(`Jungle heroes: ${junglers.length}`);

  console.log('\nSample jungler capabilities:');
  for (const j of junglers.slice(0, 3)) {
    if (!j.capabilities) {
      console.log(`  ${j.hero_name}: capabilities=null (no Liquipedia data)`);
      continue;
    }
    const c = j.capabilities;
    console.log(`  ${j.hero_name}: cc=${c.ccScore} mob=${c.mobilityScore} self=${c.selfSustain} ally=${c.allySustain} immune=${c.hasImmunity} anti=${c.antiHeal} aoe=${c.hasAOE} burst=${c.maxBurstDamage}`);
  }

  if (dataDegraded) {
    const ghOutput = process.env.GITHUB_OUTPUT;
    if (ghOutput) {
      const parts = [];
      if (droppedHeroes.length > 0) {
        const names = droppedHeroes.slice(0, 3).join(', ');
        const more = droppedHeroes.length > 3 ? ` +${droppedHeroes.length - 3}` : '';
        parts.push(`dropped ${droppedHeroes.length}: ${names}${more}`);
      }
      if (missingCapabilities.length > 0) {
        const names = missingCapabilities.slice(0, 3).map(h => h.hero_name).join(', ');
        const more = missingCapabilities.length > 3 ? ` +${missingCapabilities.length - 3}` : '';
        parts.push(`no capabilities ${missingCapabilities.length}: ${names}${more}`);
      }
      fs.appendFileSync(ghOutput, `degraded=true\n`);
      fs.appendFileSync(ghOutput, `degradation_summary=${parts.join('; ')}\n`);
    }
  }

  if (dataDegraded && !allowPartial) {
    console.warn('\nData written but quality is degraded (dropped heroes or missing skills).');
    console.warn('Re-run to fix, or pass --allow-partial to suppress this exit code.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
