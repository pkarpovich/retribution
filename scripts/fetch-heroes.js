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

async function fetchHeroDetails(heroName, maxRetries = 2) {
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
        await wait(1000 * (attempt + 1));
        continue;
      }
      console.error(`Failed to fetch ${heroName} after ${maxRetries + 1} attempts:`, response.message);
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`Error fetching ${heroName} (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message} — retrying...`);
        await wait(1000 * (attempt + 1));
        continue;
      }
      console.error(`Error fetching ${heroName} after ${maxRetries + 1} attempts:`, error.message);
    }
  }
  return null;
}

function parseSkillTypes(skills) {
  if (!skills || !Array.isArray(skills)) return [];

  return skills.map(skill => {
    const rawType = skill.skill_type || '';
    const tags = rawType.split('|').map(t => t.trim()).filter(Boolean);
    const scaling = skill.skill_scaling || {};

    return {
      name: skill.skill_name,
      tags,
      cooldown: scaling.cooldown ? parseFloat(scaling.cooldown) : null,
      maxBaseDamage: Array.isArray(scaling.base_damage)
        ? scaling.base_damage[scaling.base_damage.length - 1]
        : null,
    };
  });
}

function computeCapabilities(hero) {
  const parsed = parseSkillTypes(hero.skills);

  const placeholderPattern = /^(skill \d+|ultimate|passive)$/i;
  const placeholderCount = parsed.filter(s =>
    placeholderPattern.test(s.name.trim()) && s.tags.length === 0
  ).length;
  if (placeholderCount >= 2) {
    return null;
  }

  const skillsWithTags = parsed.filter(s => s.tags.length > 0).length;
  const hasDescriptions = (hero.skills || []).some(
    s => s.skill_description && s.skill_description.trim().length > 20
  );
  if (skillsWithTags <= 1 && !hasDescriptions && parsed.length >= 3) {
    return null;
  }

  let mobilityScore = 0;
  let ccScore = 0;
  let hasSustain = false;
  let hasAOE = false;
  let hasImmunity = false;
  let maxBurstDamage = 0;
  const cooldowns = [];

  for (const skill of parsed) {
    if (skill.tags.includes('Mobility')) mobilityScore += 1;
    if (skill.tags.includes('Blink')) mobilityScore += 1;
    if (skill.tags.includes('CC') || skill.tags.includes('Stun') || skill.tags.includes('Immobilize')) ccScore += 1;
    if (skill.tags.includes('Heal') || skill.tags.includes('Regen')) hasSustain = true;
    if (skill.tags.includes('AOE')) hasAOE = true;
    if (skill.tags.includes('Immunity')) hasImmunity = true;

    if (skill.maxBaseDamage && skill.maxBaseDamage > maxBurstDamage) {
      maxBurstDamage = skill.maxBaseDamage;
    }

    if (skill.cooldown !== null && skill.cooldown > 0) {
      cooldowns.push(skill.cooldown);
    }
  }

  const description = hero.skills
    ?.map(s => (s.skill_description || '').toLowerCase())
    .join(' ') || '';

  if (description.includes('immun') || description.includes('untargetable') || description.includes('invincib')) {
    hasImmunity = true;
  }
  if (!hasSustain) {
    for (const s of hero.skills || []) {
      const desc = (s.skill_description || '').toLowerCase();
      if (!desc) continue;
      if (desc.includes('heal')) {
        hasSustain = true;
        break;
      }
      const hasHPContext = desc.includes('hp') || desc.includes('health') || desc.includes('hit point') || desc.includes('life');
      if ((desc.includes('regenerat') || desc.includes('restore')) && hasHPContext) {
        hasSustain = true;
        break;
      }
    }
  }

  if (mobilityScore === 0) {
    let descMobility = 0;
    for (const s of hero.skills || []) {
      const desc = (s.skill_description || '').toLowerCase();
      if (!desc) continue;
      if (desc.includes('dash') || desc.includes('blink') || desc.includes('leap') ||
          desc.includes('teleport') || desc.includes('lunge') || desc.includes('jump') ||
          desc.includes('pounce') || desc.includes('sprint') || desc.includes('vault')) {
        descMobility++;
      }
    }
    mobilityScore = descMobility;
  }

  const speciality = hero.speciality || [];

  const mobilitySpecs = ['Chase', 'Charge', 'Blink'];
  const specMobility = mobilitySpecs.filter(s => speciality.includes(s)).length;
  mobilityScore = Math.max(mobilityScore, specMobility);

  const ccSpecs = ['Crowd Control', 'Control', 'Initiator'];
  const specCC = ccSpecs.filter(s => speciality.includes(s)).length;
  ccScore = Math.max(ccScore, Math.min(specCC * 2, 3));

  if (!hasSustain && speciality.includes('Regen')) {
    hasSustain = true;
  }

  const avgCooldown = cooldowns.length > 0
    ? Math.round(cooldowns.reduce((a, b) => a + b, 0) / cooldowns.length * 10) / 10
    : null;

  return {
    mobilityScore,
    ccScore,
    hasSustain,
    hasAOE,
    hasImmunity,
    maxBurstDamage,
    avgCooldown,
    skillsSummary: parsed.map(s => ({
      name: s.name,
      tags: s.tags,
      cooldown: s.cooldown,
    })),
  };
}

function buildStrongAgainst(heroes) {
  const strongAgainstMap = {};

  for (const hero of heroes) {
    strongAgainstMap[hero.id] = [];
  }

  for (const hero of heroes) {
    if (!hero.weakAgainst) continue;

    for (const weak of hero.weakAgainst) {
      if (!strongAgainstMap[weak.id]) {
        strongAgainstMap[weak.id] = [];
      }

      strongAgainstMap[weak.id].push({
        id: hero.id,
        hero_name: hero.hero_name,
        img_src: hero.img_src,
        role: hero.role,
        lane: hero.lane,
        speciality: hero.speciality,
        weighted_score: weak.weighted_score,
        tier: hero.tier,
      });
    }
  }

  for (const id of Object.keys(strongAgainstMap)) {
    strongAgainstMap[id].sort((a, b) => b.weighted_score - a.weighted_score);
    strongAgainstMap[id] = strongAgainstMap[id].slice(0, 10);
  }

  return strongAgainstMap;
}

function enrichHeroes(heroes) {
  const strongAgainstMap = buildStrongAgainst(heroes);

  return heroes.map(hero => {
    const hasSkillData = hero.skills && Array.isArray(hero.skills) && hero.skills.length > 0;
    const capabilities = hasSkillData ? computeCapabilities(hero) : null;
    const strongAgainst = strongAgainstMap[hero.id] || [];

    const { skills, ...heroWithoutSkills } = hero;

    return {
      ...heroWithoutSkills,
      capabilities,
      strongAgainst,
    };
  });
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

    await wait(200);
  }

  if (droppedHeroes.length > 0) {
    console.error(`\nERROR: ${droppedHeroes.length} hero(es) failed to fetch and were dropped:`);
    for (const name of droppedHeroes) {
      console.error(`  - ${name}`);
    }
    console.error('Dropped heroes will be missing from output and will corrupt strongAgainst matchup data.');

    const dropRate = droppedHeroes.length / heroes.length;
    if (dropRate > 0.05) {
      console.error(`\nABORTING: ${(dropRate * 100).toFixed(1)}% of heroes dropped (threshold: 5%). Fix fetch errors before regenerating data.`);
      process.exit(1);
    }
    dataDegraded = true;
    console.warn('Proceeding with partial data — re-run to include dropped heroes.\n');
  }

  const missingSkills = heroesWithDetails.filter(h => !h.skills || !Array.isArray(h.skills) || h.skills.length === 0);
  if (missingSkills.length > 0) {
    console.warn(`\nWARNING: ${missingSkills.length} hero(es) have missing/empty skills data (capabilities derived from speciality only):`);
    for (const h of missingSkills) {
      console.warn(`  - ${h.hero_name} (speciality: ${(h.speciality || []).join(', ') || 'none'})`);
    }
    dataDegraded = true;
  }

  console.log('\nEnriching hero data...');
  const enrichedHeroes = enrichHeroes(heroesWithDetails);

  const capsStats = {
    withMobility: enrichedHeroes.filter(h => h.capabilities?.mobilityScore > 0).length,
    withCC: enrichedHeroes.filter(h => h.capabilities?.ccScore > 0).length,
    withSustain: enrichedHeroes.filter(h => h.capabilities?.hasSustain).length,
    withAOE: enrichedHeroes.filter(h => h.capabilities?.hasAOE).length,
    withImmunity: enrichedHeroes.filter(h => h.capabilities?.hasImmunity).length,
    withSkillData: enrichedHeroes.filter(h => h.capabilities !== null).length,
    withStrongAgainst: enrichedHeroes.filter(h => h.strongAgainst.length > 0).length,
  };
  console.log('Capabilities breakdown:', capsStats);

  const missingSkillsNames = new Set(missingSkills.map(h => h.hero_name));
  const placeholderHeroes = enrichedHeroes.filter(h => h.capabilities === null && !missingSkillsNames.has(h.hero_name));
  if (placeholderHeroes.length > 0) {
    console.warn(`\nWARNING: ${placeholderHeroes.length} hero(es) have placeholder/malformed skill data (capabilities could not be computed):`);
    for (const h of placeholderHeroes) {
      console.warn(`  - ${h.hero_name} (speciality: ${(h.speciality || []).join(', ') || 'none'})`);
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
      console.log(`  ${j.hero_name}: capabilities=null (malformed skill data) strongVs=${j.strongAgainst.length}`);
      continue;
    }
    console.log(`  ${j.hero_name}: mob=${j.capabilities.mobilityScore} cc=${j.capabilities.ccScore} sustain=${j.capabilities.hasSustain} aoe=${j.capabilities.hasAOE} immune=${j.capabilities.hasImmunity} burst=${j.capabilities.maxBurstDamage} strongVs=${j.strongAgainst.length}`);
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
