import { useMemo } from 'react';
import type { Hero, RecommendationResult, RecommendationLevel, ScoreBreakdown, BootType, RetributionBlessing } from '../../types/hero';
import { getLatestStats, getMobilityScore, getCCScore, hasSustainCapability, hasImmunityCapability } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './CompactRecommendationCard.module.css';

interface CompactRecommendationCardProps {
  result: RecommendationResult;
  rank: number;
  expanded?: boolean;
  enemyTeam?: Hero[];
}

const RECOMMENDATION_BADGES: Record<RecommendationLevel, {
  label: string;
  gradient: string;
  glow: string;
  border: string;
  textColor: string;
}> = {
  'BEST_PICK': {
    label: 'BEST',
    gradient: 'linear-gradient(135deg, #D0A215 0%, #AD8301 100%)',
    glow: 'rgba(208, 162, 21, 0.4)',
    border: '#D0A215',
    textColor: '#100F0F'
  },
  'STRONG_PICK': {
    label: 'STRONG',
    gradient: 'linear-gradient(135deg, #879A39 0%, #66800B 100%)',
    glow: 'rgba(135, 154, 57, 0.4)',
    border: '#879A39',
    textColor: '#fff'
  },
  'GOOD_PICK': {
    label: 'GOOD',
    gradient: 'linear-gradient(135deg, #3AA99F 0%, #24837B 100%)',
    glow: 'rgba(58, 169, 159, 0.4)',
    border: '#3AA99F',
    textColor: '#fff'
  },
  'SAFE_PICK': {
    label: 'SAFE',
    gradient: 'linear-gradient(135deg, #DA702C 0%, #BC5215 100%)',
    glow: 'rgba(218, 112, 44, 0.4)',
    border: '#DA702C',
    textColor: '#100F0F'
  },
  'RISKY_PICK': {
    label: 'RISKY',
    gradient: 'linear-gradient(135deg, #D14D41 0%, #AF3029 100%)',
    glow: 'rgba(209, 77, 65, 0.4)',
    border: '#D14D41',
    textColor: '#fff'
  }
};

const JUNGLER_TYPE_COLORS: Record<string, string> = {
  'DAMAGE': 'var(--red)',
  'UTILITY': 'var(--blue)',
  'HYBRID': 'var(--purple)'
};

const BOOT_COLORS: Record<BootType, string> = {
  'Tough Boots': 'var(--blue)',
  'Warrior Boots': 'var(--orange)',
  'Arcane Boots': 'var(--purple)',
  'Swift Boots': 'var(--yellow)',
  'Magic Shoes': 'var(--cyan)',
};

const BOOT_SHORT_NAMES: Record<BootType, string> = {
  'Tough Boots': 'Tough',
  'Warrior Boots': 'Warrior',
  'Arcane Boots': 'Arcane',
  'Swift Boots': 'Swift',
  'Magic Shoes': 'CDR',
};

const BOOT_ICONS: Record<BootType, string> = {
  'Tough Boots': '\u{1F6E1}\u{FE0F}',
  'Warrior Boots': '\u{2694}\u{FE0F}',
  'Arcane Boots': '\u{1F52E}',
  'Swift Boots': '\u{26A1}',
  'Magic Shoes': '\u{23F3}',
};

const BLESSING_COLORS: Record<RetributionBlessing, string> = {
  'Ice': 'var(--cyan)',
  'Flame': 'var(--red)',
  'Bloody': 'var(--magenta)',
};

const BLESSING_ICONS: Record<RetributionBlessing, string> = {
  'Ice': '\u{2744}\u{FE0F}',
  'Flame': '\u{1F525}',
  'Bloody': '\u{1FA78}',
};

const HERO_RADAR_AXES = ['Burst', 'Mobility', 'CC', 'Sustain', 'AOE'] as const;

function getHeroRadarValues(hero: Hero): number[] {
  const mob = Math.min(getMobilityScore(hero) / 3, 1);
  const cc = Math.min(getCCScore(hero) / 3, 1);
  const sustain = hasSustainCapability(hero) ? 1 : 0;
  const aoe = hero.capabilities?.hasAOE ? 1 : 0;

  const burstSpecs = ['Burst', 'Finisher', 'Damage', 'Magic Damage'];
  let burst = burstSpecs.filter(s => hero.speciality.includes(s)).length > 0 ? 0.5 : 0;
  if (hero.capabilities?.maxBurstDamage && hero.capabilities.maxBurstDamage > 500) burst = 1;
  else if (hero.capabilities?.maxBurstDamage && hero.capabilities.maxBurstDamage > 200) burst = 0.7;

  return [burst, mob, cc, sustain, aoe];
}

function miniRadarPath(values: number[], cx: number, cy: number, r: number): string {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const vr = Math.max(v, 0.08) * r;
    const x = cx + vr * Math.cos(angle);
    const y = cy + vr * Math.sin(angle);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + 'Z';
}

function miniRadarLabelPos(i: number, total: number, cx: number, cy: number, r: number) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function getSignificantBars(breakdown: ScoreBreakdown) {
  const all = [
    { label: 'Team', value: breakdown.team_balance },
    { label: 'Enemy', value: breakdown.enemy_analysis },
    { label: 'Strong vs', value: breakdown.strong_against },
    { label: 'CC Chain', value: breakdown.cc_chain_synergy },
    { label: 'Invade', value: breakdown.invade_resistance },
    { label: 'Counter', value: breakdown.counter_penalty },
    { label: 'Synergy', value: breakdown.synergy_bonus },
    { label: 'Meta', value: breakdown.meta_bonus },
    { label: 'Tempo', value: breakdown.early_late_game },
    { label: 'DMG Type', value: breakdown.damage_type_balance },
    { label: 'Base', value: breakdown.base },
  ];
  return all
    .filter(item => Math.abs(item.value) >= 3)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6);
}

function getMatchups(hero: Hero, enemyTeam: Hero[]): { strong: Hero[]; weak: Hero[] } {
  const strong: Hero[] = [];
  const weak: Hero[] = [];

  if (hero.weakAgainst) {
    for (const sa of hero.weakAgainst) {
      const match = enemyTeam.find(e => e.id === sa.id);
      if (match) strong.push(match);
    }
  }

  if (hero.counters) {
    for (const wa of hero.counters) {
      const match = enemyTeam.find(e => e.id === wa.id);
      if (match) weak.push(match);
    }
  }

  return { strong: strong.slice(0, 3), weak: weak.slice(0, 3) };
}

export default function CompactRecommendationCard({ result, rank, expanded = false, enemyTeam = [] }: CompactRecommendationCardProps) {
  const { hero, breakdown, recommendation_level, jungler_type, warnings, strengths } = result;
  const stats = getLatestStats(hero);
  const badge = RECOMMENDATION_BADGES[recommendation_level];


  const heroRadar = useMemo(() => getHeroRadarValues(hero), [hero]);
  const matchups = useMemo(() => getMatchups(hero, enemyTeam), [hero, enemyTeam]);
  const bars = useMemo(() => getSignificantBars(breakdown), [breakdown]);
  const maxBar = useMemo(() => Math.max(...bars.map(b => Math.abs(b.value)), 1), [bars]);

  const capTags = useMemo(() => {
    const tags: { label: string; color: string }[] = [];
    const mob = getMobilityScore(hero);
    const cc = getCCScore(hero);
    if (mob > 0) tags.push({ label: `MOB ${mob}`, color: 'var(--cyan)' });
    if (cc > 0) tags.push({ label: `CC ${cc}`, color: 'var(--yellow)' });
    if (hasSustainCapability(hero)) tags.push({ label: 'SUST', color: 'var(--green)' });
    if (hero.capabilities?.hasAOE) tags.push({ label: 'AOE', color: 'var(--orange)' });
    if (hasImmunityCapability(hero)) tags.push({ label: 'IMM', color: 'var(--magenta)' });
    return tags;
  }, [hero]);

  return (
    <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
      {!expanded ? (
        <>
          <div className={styles.avatarContainer}>
            <img
              src={hero.img_src}
              alt={hero.hero_name}
              className={styles.heroImage}
              style={{ borderColor: badge.border, boxShadow: `0 0 12px ${badge.glow}` }}
            />
            <div
              className={styles.rankBadge}
              style={{ background: badge.gradient, color: badge.textColor }}
            >
              #{rank}
            </div>
          </div>
          <div className={styles.info}>
            <div className={styles.topRow}>
              <h4 className={styles.heroName}>{hero.hero_name}</h4>
              <div className={styles.topRowSpacer} />
              <TierBadge tier={hero.tier} />
            </div>
            <div className={styles.metaRow}>
              <div
                className={styles.pickLevelBadge}
                style={{ background: badge.gradient, color: badge.textColor }}
              >
                {badge.label}
              </div>
              <span className={styles.typeLabel} style={{ color: JUNGLER_TYPE_COLORS[jungler_type] }}>
                {jungler_type}
              </span>
            </div>
            <div className={styles.bootRow}>
              <span className={styles.bootTag} style={{ color: BOOT_COLORS[result.bootRecommendation.boots], borderColor: BOOT_COLORS[result.bootRecommendation.boots] }}>
                {BOOT_ICONS[result.bootRecommendation.boots]} {BOOT_SHORT_NAMES[result.bootRecommendation.boots]}
              </span>
              <span className={styles.bootTag} style={{ color: BLESSING_COLORS[result.bootRecommendation.blessing], borderColor: BLESSING_COLORS[result.bootRecommendation.blessing] }}>
                {BLESSING_ICONS[result.bootRecommendation.blessing]} {result.bootRecommendation.blessing}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.cardHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.headerTop}>
                <div className={styles.avatarContainer}>
                  <img src={hero.img_src} alt={hero.hero_name} className={styles.heroImage} style={{ borderColor: badge.border, boxShadow: `0 0 12px ${badge.glow}` }} />
                  <div className={styles.rankBadge} style={{ background: badge.gradient, color: badge.textColor }}>#{rank}</div>
                </div>
                <div className={styles.info}>
                  <div className={styles.topRow}>
                    <h4 className={styles.heroName}>{hero.hero_name}</h4>
                    <TierBadge tier={hero.tier} />
                    <div className={styles.pickLevelBadge} style={{ background: badge.gradient, color: badge.textColor }}>{badge.label}</div>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.typeLabel} style={{ color: JUNGLER_TYPE_COLORS[jungler_type] }}>{jungler_type}</span>
                  </div>
                  {stats && (
                    <div className={styles.statsInline}>
                      <span>{stats.win_rate.toFixed(1)}% WR</span>
                      <span className={styles.statDot}>·</span>
                      <span>{stats.pick_rate.toFixed(1)}% PR</span>
                      <span className={styles.statDot}>·</span>
                      <span>{stats.ban_rate.toFixed(1)}% BR</span>
                    </div>
                  )}
                </div>
              </div>
              {capTags.length > 0 && (
                <div className={styles.capRow}>
                  {capTags.map(tag => (
                    <span key={tag.label} className={styles.capTag} style={{ color: tag.color, borderColor: tag.color }}>{tag.label}</span>
                  ))}
                </div>
              )}
              {(matchups.strong.length > 0 || matchups.weak.length > 0) && (
                <div className={styles.matchups}>
                  {matchups.strong.length > 0 && (
                    <div className={styles.matchupGroup}>
                      <span className={styles.matchupLabel}>Strong vs</span>
                      <div className={styles.matchupAvatars}>
                        {matchups.strong.map(enemy => (
                          <img key={enemy.id} src={enemy.img_src} alt={enemy.hero_name} className={styles.matchupAvatar} style={{ borderColor: 'var(--green)' }} title={enemy.hero_name} />
                        ))}
                      </div>
                    </div>
                  )}
                  {matchups.weak.length > 0 && (
                    <div className={styles.matchupGroup}>
                      <span className={styles.matchupLabelWarn}>Weak vs</span>
                      <div className={styles.matchupAvatars}>
                        {matchups.weak.map(enemy => (
                          <img key={enemy.id} src={enemy.img_src} alt={enemy.hero_name} className={styles.matchupAvatar} style={{ borderColor: 'var(--red)' }} title={enemy.hero_name} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={styles.heroRadar}>
              <svg viewBox="0 0 120 120" className={styles.heroRadarSvg}>
                {[0.33, 0.66, 1].map(level => {
                  const pts = HERO_RADAR_AXES.map((_, i) => {
                    const p = miniRadarLabelPos(i, HERO_RADAR_AXES.length, 60, 60, 40 * level);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                  }).join(' ');
                  return <polygon key={level} points={pts} className={styles.heroRadarGrid} />;
                })}
                {HERO_RADAR_AXES.map((_, i) => {
                  const p = miniRadarLabelPos(i, HERO_RADAR_AXES.length, 60, 60, 40);
                  return <line key={i} x1="60" y1="60" x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} className={styles.heroRadarAxis} />;
                })}
                <path d={miniRadarPath(heroRadar, 60, 60, 40)} className={styles.heroRadarArea} style={{ stroke: badge.border }} />
                {HERO_RADAR_AXES.map((label, i) => {
                  const p = miniRadarLabelPos(i, HERO_RADAR_AXES.length, 60, 60, 52);
                  return (
                    <text key={label} x={p.x.toFixed(1)} y={p.y.toFixed(1)} className={styles.heroRadarLabel} textAnchor="middle" dominantBaseline="central">{label}</text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className={styles.buildAdvice}>
            <span
              className={styles.buildTag}
              style={{ color: BOOT_COLORS[result.bootRecommendation.boots], borderColor: BOOT_COLORS[result.bootRecommendation.boots] }}
            >
              {BOOT_ICONS[result.bootRecommendation.boots]} {result.bootRecommendation.boots}
              <span className={styles.buildReason}>{result.bootRecommendation.bootsReason}</span>
            </span>
            <span
              className={styles.buildTag}
              style={{ color: BLESSING_COLORS[result.bootRecommendation.blessing], borderColor: BLESSING_COLORS[result.bootRecommendation.blessing] }}
            >
              {BLESSING_ICONS[result.bootRecommendation.blessing]} {result.bootRecommendation.blessing}
              <span className={styles.buildReason}>{result.bootRecommendation.blessingReason}</span>
            </span>
          </div>

          <div className={styles.barChart}>
            {bars.map(bar => {
              const pct = (Math.abs(bar.value) / maxBar) * 100;
              const isPositive = bar.value >= 0;
              return (
                <div key={bar.label} className={styles.barRow}>
                  <span className={styles.barLabel}>{bar.label}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barCenter} />
                    {isPositive ? (
                      <div className={styles.barPositive} style={{ width: `${pct / 2}%`, left: '50%' }} />
                    ) : (
                      <div className={styles.barNegative} style={{ width: `${pct / 2}%`, right: '50%' }} />
                    )}
                  </div>
                  <span className={`${styles.barValue} ${isPositive ? styles.positive : styles.negative}`}>
                    {isPositive ? '+' : ''}{bar.value.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>

          {strengths.length > 0 && (
            <div className={styles.strengths}>
              {strengths.slice(0, 3).map((strength, idx) => (
                <span key={idx} className={styles.strengthTag}>{strength}</span>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className={styles.warnings}>
              {warnings.slice(0, 2).map((warning, idx) => (
                <span key={idx} className={`${styles.warningTag} ${styles[warning.severity.toLowerCase()]}`}>{warning.message}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
