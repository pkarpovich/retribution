import fs from 'fs';
import https from 'https';

const API_SECRET = process.env.MLBB_API_SECRET;
const CSRF_TOKEN = process.env.MLBB_CSRF_TOKEN;

const useProxy = !API_SECRET;
const BASE_URL = useProxy
  ? 'https://mlbb.io/api/proxy/hero'
  : 'https://mlbb.io/api/hero';

if (!API_SECRET && !CSRF_TOKEN) {
  console.error('Error: Set MLBB_API_SECRET or MLBB_CSRF_TOKEN environment variable');
  console.error('  MLBB_CSRF_TOKEN — extract from browser cookies (__Host-next-auth.csrf-token value)');
  console.error('  MLBB_API_SECRET — direct API secret');
  process.exit(1);
}

function buildHeaders() {
  if (useProxy) {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://mlbb.io/hero-tier',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      'Cookie': `locale=en; __Host-next-auth.csrf-token=${CSRF_TOKEN}; __Secure-next-auth.callback-url=https%3A%2F%2Fmlbb.io`,
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
