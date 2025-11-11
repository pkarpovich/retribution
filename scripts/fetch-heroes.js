import fs from 'fs';
import https from 'https';

const API_SECRET = process.env.MLBB_API_SECRET;
const BASE_URL = 'https://mlbb.io/api/hero';

if (!API_SECRET) {
  console.error('Error: MLBB_API_SECRET environment variable is not set');
  process.exit(1);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'x-client-secret': API_SECRET }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
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

async function fetchHeroDetails(heroName) {
  const encodedName = encodeURIComponent(heroName);
  const url = `${BASE_URL}/detail/${encodedName}`;

  try {
    const response = await httpsGet(url);
    if (response.success) {
      return response.data;
    }
    console.error(`Failed to fetch ${heroName}:`, response.message);
    return null;
  } catch (error) {
    console.error(`Error fetching ${heroName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Fetching hero tier list...');

  const tierResponse = await httpsGet(`${BASE_URL}/hero-tiers`);

  if (!tierResponse.success) {
    console.error('Failed to fetch tier list');
    process.exit(1);
  }

  const heroes = tierResponse.data;
  console.log(`Found ${heroes.length} heroes`);

  const heroesWithDetails = [];

  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i];
    console.log(`[${i + 1}/${heroes.length}] Fetching details for ${hero.hero_name}...`);

    const details = await fetchHeroDetails(hero.hero_name);

    if (details) {
      heroesWithDetails.push(details);
    }

    await wait(200);
  }

  const outputDir = './src/data';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    totalHeroes: heroesWithDetails.length,
    heroes: heroesWithDetails
  };

  fs.writeFileSync(
    `${outputDir}/heroes.json`,
    JSON.stringify(output, null, 2)
  );

  console.log(`\nDone! Saved ${heroesWithDetails.length} heroes to ${outputDir}/heroes.json`);

  const junglers = heroesWithDetails.filter(h => h.lane?.includes('Jungle'));
  console.log(`Jungle heroes: ${junglers.length}`);
}

main().catch(console.error);
