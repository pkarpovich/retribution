const HARD_CC_TEXT = /\b(stun\w*|immobiliz\w*|suppress\w*|petrif\w*|freez\w*|put to sleep|taunt\w*|charm\w*|abduct\w*)\b|\bknock\w*(\s+\w+){0,2}\s+(up|back|airborne)\b|\bairborne for \d|\b(become|becomes|becoming|are|is|be)\s+airborne\b/i;
const SOFT_CC_TEXT = /\b(slow(s|ed|ing)?\b|silenc\w*|blind\w*)/i;

const MOBILITY_TEXT = /\b(dash(es|ed|ing)?|blink(s|ed|ing)?|leap(s|ed|ing)?|teleport\w*|lunge\w*|charge(s|d)? (forward|in|toward)|pounce\w*|flick\w*)\b/i;

const IMMUNITY_TEXT = /(control[ -]immun\w*|cc[ -]immun\w*|immun\w* to (crowd )?control|immun\w* to damage|damage immunity|untargetable|cannot be (targeted|selected)|invincib\w*|unstoppable|invulnerab\w*)/i;

const ALLY_TEXT = /\b(allied hero|allied heroes|nearby allies|allies|teammate|target ally|ally)\b/i;
const NEAR = '(?:[^.]|\\.(?=\\d))';

const HEAL_HP_TEXT = new RegExp(
  `\\b(heal\\w*|restor\\w*|recover\\w*|regenerat\\w*)\\b${NEAR}{0,60}\\b(hp|health|hit points)\\b`
  + `|\\b(hp|health)\\b${NEAR}{0,60}\\b(heal\\w*|restor\\w*|recover\\w*|regenerat\\w*)\\b`,
  'i',
);
const LIFESTEAL_TEXT = /\b(lifesteal|life steal|spell vamp|physical vamp|hybrid lifesteal)\b/i;
const SELF_TEXT = /\b(himself|herself|itself|his own|her own|its own|for himself|for herself)\b/i;

const PERCENT_HP_TEXT = new RegExp(
  `\\d+(\\.\\d+)?%\\s+of\\s+(the\\s+)?(target|enemy|their|its)('s)?\\s*${NEAR}{0,20}\\b(hp|health)\\b`,
  'i',
);
const TRUE_DAMAGE_TEXT = /\btrue damage\b/i;
const DEFENSE_BREAK_TEXT = new RegExp(
  `\\b(reduc\\w*|ignor\\w*|penetrat\\w*|shred\\w*|strip\\w*)\\b${NEAR}{0,50}\\b(physical defense|magic defense|defense|armor|resistance)\\b`,
  'i',
);

const ANTI_HEAL_TEXT = new RegExp(
  `\\b(reduc\\w*|lower\\w*|weaken\\w*|decreas\\w*)\\b${NEAR}{0,60}\\b(shield|hp regen|healing|heal effect|health regen|restoration)\\b`
  + `|\\b(healing|shield)\\b${NEAR}{0,40}\\b(reduc\\w*|decreas\\w*)\\b`,
  'i',
);
const DAMAGE_REDUCTION_TEXT = new RegExp(
  `damage reduction|\\breduc\\w*\\b${NEAR}{0,40}\\bdamage (received|taken)\\b|\\btakes? \\d+% less damage\\b`,
  'i',
);

const CC_EFFECTS = new Set(['CC', 'Slow']);
const MOBILITY_EFFECTS = new Set(['Mobility', 'Teleport', 'Charge', 'Blink', 'Dash']);
const STRONG_MOBILITY_EFFECTS = new Set(['Teleport', 'Blink']);
const IMMUNITY_EFFECTS = new Set(['Invincible', 'CC Immune', 'Death Immunity', 'Remove CC']);
const AOE_EFFECTS = new Set(['AOE']);
const HEAL_EFFECTS = new Set(['Heal']);
const SHIELD_EFFECTS = new Set(['Shield']);
const DAMAGE_REDUCTION_EFFECTS = new Set(['Reduce DMG']);

const STAT_KEYS = ['hp', 'hpReg', 'phyAtk', 'phyDef', 'magDef', 'moveSpeed', 'atkSpeed'];

function hasAny(effects, set) {
  return effects.some(effect => set.has(effect));
}

function ccWeight(skill) {
  const tagged = hasAny(skill.effects, CC_EFFECTS);
  if (HARD_CC_TEXT.test(skill.description)) return 2;
  if (tagged || SOFT_CC_TEXT.test(skill.description)) return 1;
  return 0;
}

function mobilityWeight(skill) {
  if (hasAny(skill.effects, STRONG_MOBILITY_EFFECTS)) return 2;
  if (hasAny(skill.effects, MOBILITY_EFFECTS)) return 1;
  if (MOBILITY_TEXT.test(skill.description)) return 1;
  return 0;
}

function restoresHealth(skill) {
  if (LIFESTEAL_TEXT.test(skill.description)) return true;
  if (HEAL_HP_TEXT.test(skill.description)) return true;
  return hasAny(skill.effects, HEAL_EFFECTS) || hasAny(skill.effects, SHIELD_EFFECTS);
}

function healsAllies(skill) {
  if (!restoresHealth(skill)) return false;
  return ALLY_TEXT.test(skill.description);
}

function healsSelf(skill) {
  if (LIFESTEAL_TEXT.test(skill.description)) return true;
  if (!HEAL_HP_TEXT.test(skill.description)) return false;
  if (SELF_TEXT.test(skill.description)) return true;
  return !ALLY_TEXT.test(skill.description);
}

function grantsShield(skill) {
  return hasAny(skill.effects, SHIELD_EFFECTS) || /\bshield\b/i.test(skill.description);
}

function grantsImmunity(skill) {
  if (hasAny(skill.effects, IMMUNITY_EFFECTS)) return true;
  return IMMUNITY_TEXT.test(skill.description);
}

function maxScalingValue(skill, label) {
  const values = skill.scaling?.[label];
  if (!values || !values.length) return 0;
  return Math.max(...values);
}

export function computeCapabilities(hero) {
  const skills = hero?.skills ?? [];
  if (!skills.length) return null;

  let ccScore = 0;
  let mobilityScore = 0;
  let selfSustain = false;
  let allySustain = false;
  let antiHeal = false;
  let immunity = false;
  let damageReduction = false;
  let hasShield = false;
  let armorAgnostic = 0;
  let hasAOE = false;
  let maxBurstDamage = 0;
  const cooldowns = [];

  for (const skill of skills) {
    ccScore += ccWeight(skill);
    mobilityScore += mobilityWeight(skill);

    if (healsSelf(skill)) selfSustain = true;
    if (healsAllies(skill)) allySustain = true;
    if (grantsImmunity(skill)) immunity = true;
    if (grantsShield(skill)) hasShield = true;
    if (PERCENT_HP_TEXT.test(skill.description) || TRUE_DAMAGE_TEXT.test(skill.description)) {
      armorAgnostic = 2;
    } else if (armorAgnostic === 0 && DEFENSE_BREAK_TEXT.test(skill.description)) {
      armorAgnostic = 1;
    }
    if (hasAny(skill.effects, AOE_EFFECTS)) hasAOE = true;
    if (ANTI_HEAL_TEXT.test(skill.description)) antiHeal = true;
    if (hasAny(skill.effects, DAMAGE_REDUCTION_EFFECTS) || DAMAGE_REDUCTION_TEXT.test(skill.description)) {
      damageReduction = true;
    }

    const burst = Math.max(
      maxScalingValue(skill, 'Base Damage'),
      maxScalingValue(skill, 'Damage per Hit'),
      maxScalingValue(skill, 'Impact Damage'),
    );
    if (burst > maxBurstDamage) maxBurstDamage = burst;

    if (skill.cooldown > 0) cooldowns.push(skill.cooldown);
  }

  const avgCooldown = cooldowns.length
    ? Math.round((cooldowns.reduce((a, b) => a + b, 0) / cooldowns.length) * 10) / 10
    : null;

  return {
    ccScore: Math.min(ccScore, 6),
    mobilityScore: Math.min(mobilityScore, 6),
    hasSustain: selfSustain || allySustain,
    selfSustain,
    allySustain,
    antiHeal,
    hasImmunity: immunity,
    damageReduction,
    hasShield,
    armorAgnostic,
    hasAOE,
    maxBurstDamage,
    avgCooldown,
    baseStats: hero.baseStats ?? null,
    skillsSummary: skills.map(skill => ({
      name: skill.name,
      tags: skill.effects,
      cooldown: skill.cooldown,
    })),
  };
}

export function computeStatProfiles(capabilitiesByHero) {
  const ranges = {};
  for (const key of STAT_KEYS) {
    const values = Object.values(capabilitiesByHero)
      .map(c => c?.baseStats?.[key])
      .filter(v => typeof v === 'number');
    if (!values.length) continue;
    ranges[key] = { min: Math.min(...values), max: Math.max(...values) };
  }

  const normalize = (stats, key) => {
    const range = ranges[key];
    const value = stats?.[key];
    if (!range || typeof value !== 'number' || range.max === range.min) return 0;
    return (value - range.min) / (range.max - range.min);
  };

  const round = value => Math.round(value * 100) / 100;

  for (const capabilities of Object.values(capabilitiesByHero)) {
    if (!capabilities?.baseStats) continue;
    const stats = capabilities.baseStats;
    capabilities.statProfile = {
      durability: round((normalize(stats, 'hp') * 2 + normalize(stats, 'phyDef') + normalize(stats, 'magDef')) / 4),
      regen: round(normalize(stats, 'hpReg')),
      attack: round((normalize(stats, 'phyAtk') + normalize(stats, 'atkSpeed')) / 2),
      speed: round(normalize(stats, 'moveSpeed')),
    };
  }

  return capabilitiesByHero;
}
