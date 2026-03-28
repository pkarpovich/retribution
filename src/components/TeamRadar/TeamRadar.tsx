import { useMemo } from 'react';
import type { Hero } from '../../types/hero';
import { getMobilityScore, getCCScore } from '../../utils/heroUtils';
import styles from './TeamRadar.module.css';

interface TeamRadarProps {
  enemyTeam: Hero[];
  yourTeam: Hero[];
}

interface TeamProfile {
  physical: number;
  magic: number;
  cc: number;
  mobility: number;
  durability: number;
  burst: number;
}

const AXES: { key: keyof TeamProfile; label: string }[] = [
  { key: 'physical', label: 'Physical' },
  { key: 'burst', label: 'Burst' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'magic', label: 'Magic' },
  { key: 'durability', label: 'Durability' },
  { key: 'cc', label: 'CC' },
];

function buildProfile(team: Hero[], maxSize: number): TeamProfile {
  if (team.length === 0) {
    return { physical: 0, magic: 0, cc: 0, mobility: 0, durability: 0, burst: 0 };
  }

  let physical = 0;
  let magic = 0;
  let cc = 0;
  let mobility = 0;
  let durability = 0;
  let burst = 0;

  for (const hero of team) {
    const isPhysical = hero.role.some(r => ['Fighter', 'Marksman', 'Assassin'].includes(r))
      && !hero.role.includes('Mage');
    const isMagic = hero.role.includes('Mage') || hero.speciality.includes('Magic Damage');

    if (isPhysical) physical += 1;
    if (isMagic) magic += 1;

    cc += Math.min(getCCScore(hero), 3);
    mobility += Math.min(getMobilityScore(hero), 3);

    if (hero.role.includes('Tank') || hero.role.includes('Fighter')) {
      durability += 1;
    }
    if (hero.capabilities?.hasSustain) {
      durability += 0.5;
    }

    const burstSpecs = ['Burst', 'Finisher', 'Damage', 'Magic Damage'];
    if (burstSpecs.some(s => hero.speciality.includes(s))) {
      burst += 1;
    }
    if (hero.capabilities?.maxBurstDamage && hero.capabilities.maxBurstDamage > 500) {
      burst += 0.5;
    }
  }

  const maxValues = {
    physical: maxSize,
    magic: maxSize,
    cc: maxSize * 3,
    mobility: maxSize * 3,
    durability: maxSize * 1.5,
    burst: maxSize * 1.5,
  };

  return {
    physical: Math.min(physical / maxValues.physical, 1),
    magic: Math.min(magic / maxValues.magic, 1),
    cc: Math.min(cc / maxValues.cc, 1),
    mobility: Math.min(mobility / maxValues.mobility, 1),
    durability: Math.min(durability / maxValues.durability, 1),
    burst: Math.min(burst / maxValues.burst, 1),
  };
}

function polarToCartesian(cx: number, cy: number, r: number, angleIndex: number, total: number) {
  const angle = (Math.PI * 2 * angleIndex) / total - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function profileToPath(profile: TeamProfile, cx: number, cy: number, maxR: number): string {
  const values = AXES.map(a => profile[a.key]);
  const points = values.map((v, i) => {
    const r = Math.max(v, 0.05) * maxR;
    return polarToCartesian(cx, cy, r, i, values.length);
  });
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
}

export default function TeamRadar({ enemyTeam, yourTeam }: TeamRadarProps) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const maxTeam = 5;

  const enemyProfile = useMemo(() => buildProfile(enemyTeam, maxTeam), [enemyTeam]);
  const yourProfile = useMemo(() => buildProfile(yourTeam, maxTeam), [yourTeam]);

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const gaps = useMemo(() => {
    const result: string[] = [];
    for (const axis of AXES) {
      const enemyVal = enemyProfile[axis.key];
      const yourVal = yourProfile[axis.key];
      if (enemyVal > 0.5 && yourVal < 0.3) {
        result.push(`Enemy ${axis.label} dominant`);
      }
      if (yourVal < 0.15 && enemyVal > 0.3) {
        result.push(`Low ${axis.label}`);
      }
    }
    return result.slice(0, 3);
  }, [enemyProfile, yourProfile]);

  if (enemyTeam.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.radarWrap}>
        <svg viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
          {gridLevels.map((level) => {
            const points = AXES.map((_, i) => {
              const p = polarToCartesian(cx, cy, maxR * level, i, AXES.length);
              return `${p.x},${p.y}`;
            }).join(' ');
            return (
              <polygon
                key={level}
                points={points}
                className={styles.gridLine}
              />
            );
          })}

          {AXES.map((_, i) => {
            const end = polarToCartesian(cx, cy, maxR, i, AXES.length);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                className={styles.axisLine}
              />
            );
          })}

          <path
            d={profileToPath(enemyProfile, cx, cy, maxR)}
            className={styles.enemyArea}
          />

          {yourTeam.length > 0 && (
            <path
              d={profileToPath(yourProfile, cx, cy, maxR)}
              className={styles.yourArea}
            />
          )}

          {AXES.map((axis, i) => {
            const labelR = maxR + 16;
            const p = polarToCartesian(cx, cy, labelR, i, AXES.length);
            return (
              <text
                key={axis.key}
                x={p.x}
                y={p.y}
                className={styles.axisLabel}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {axis.label}
              </text>
            );
          })}
        </svg>

        <div className={styles.sidebar}>
          <div className={styles.legend}>
            <span className={styles.legendEnemy}>Enemy</span>
            {yourTeam.length > 0 && <span className={styles.legendYour}>Your Team</span>}
          </div>

          {gaps.length > 0 && (
            <div className={styles.gaps}>
              {gaps.map((gap, i) => (
                <span key={i} className={styles.gapTag}>{gap}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
