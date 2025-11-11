import { useState } from 'react';
import type { Hero } from '../../types/hero';
import styles from './TeamCompositionBar.module.css';

interface TeamCompositionBarProps {
  enemyTeam: Hero[];
  yourTeam: Hero[];
}

interface TeamAnalysis {
  roles: Map<string, number>;
  damageTypes: {
    physical: number;
    magic: number;
    hybrid: number;
  };
  specialties: Map<string, number>;
}

function analyzeTeam(team: Hero[]): TeamAnalysis {
  const roles = new Map<string, number>();
  const damageTypes = { physical: 0, magic: 0, hybrid: 0 };
  const specialties = new Map<string, number>();

  team.forEach(hero => {
    hero.role.forEach(role => {
      roles.set(role, (roles.get(role) || 0) + 1);
    });

    if (hero.role.includes('Mage')) {
      damageTypes.magic++;
    } else if (hero.role.includes('Marksman') || hero.role.includes('Assassin')) {
      damageTypes.physical++;
    } else if (hero.role.includes('Fighter')) {
      damageTypes.physical++;
    } else {
      damageTypes.hybrid++;
    }

    hero.speciality.forEach(spec => {
      specialties.set(spec, (specialties.get(spec) || 0) + 1);
    });
  });

  return { roles, damageTypes, specialties };
}

export default function TeamCompositionBar({ enemyTeam, yourTeam }: TeamCompositionBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (enemyTeam.length === 0) {
    return null;
  }

  const enemyAnalysis = analyzeTeam(enemyTeam);
  const yourAnalysis = analyzeTeam(yourTeam);

  const enemyPhysical = enemyAnalysis.damageTypes.physical;
  const enemyMagic = enemyAnalysis.damageTypes.magic;

  const yourPhysical = yourAnalysis.damageTypes.physical;
  const yourMagic = yourAnalysis.damageTypes.magic;

  const needPhysical = enemyMagic > enemyPhysical && yourPhysical < 2;
  const needMagic = enemyPhysical > enemyMagic && yourMagic < 2;
  const needTank = !yourAnalysis.roles.has('Tank') && enemyAnalysis.roles.has('Assassin');

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.header}>
          <h3 className={styles.title}>Team Composition</h3>
          <button
            className={styles.toggleButton}
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
            aria-label={isExpanded ? 'Collapse composition' : 'Expand composition'}
          >
            <svg
              className={`${styles.arrow} ${isExpanded ? styles.arrowUp : ''}`}
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className={styles.teamsGrid}>
          <div className={styles.teamColumn}>
            <div className={styles.teamLabel}>Enemy Team</div>
            <div className={styles.stats}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Damage:</span>
                <div className={styles.damageBar}>
                  {enemyPhysical > 0 && (
                    <div className={styles.physicalBar} style={{ width: `${(enemyPhysical / enemyTeam.length) * 100}%` }}>
                      {enemyPhysical}P
                    </div>
                  )}
                  {enemyMagic > 0 && (
                    <div className={styles.magicBar} style={{ width: `${(enemyMagic / enemyTeam.length) * 100}%` }}>
                      {enemyMagic}M
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Roles:</span>
                <div className={styles.rolesList}>
                  {Array.from(enemyAnalysis.roles.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([role, count]) => (
                      <span key={role} className={styles.roleTag}>
                        {role} {count > 1 ? `×${count}` : ''}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.teamColumn}>
            <div className={styles.teamLabel}>Your Team</div>
            <div className={styles.stats}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Damage:</span>
                <div className={styles.damageBar}>
                  {yourPhysical > 0 && (
                    <div className={styles.physicalBar} style={{ width: `${(yourPhysical / Math.max(yourTeam.length, 1)) * 100}%` }}>
                      {yourPhysical}P
                    </div>
                  )}
                  {yourMagic > 0 && (
                    <div className={styles.magicBar} style={{ width: `${(yourMagic / Math.max(yourTeam.length, 1)) * 100}%` }}>
                      {yourMagic}M
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Roles:</span>
                <div className={styles.rolesList}>
                  {yourTeam.length === 0 ? (
                    <span className={styles.roleTag}>None</span>
                  ) : (
                    Array.from(yourAnalysis.roles.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([role, count]) => (
                        <span key={role} className={styles.roleTag}>
                          {role} {count > 1 ? `×${count}` : ''}
                        </span>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.teamColumn}>
            <div className={styles.teamLabel}>Recommended</div>
            <div className={styles.recommendations}>
              {needMagic && (
                <div className={styles.needItem}>
                  <span className={styles.needIcon}>🔮</span>
                  <span>Magic Damage</span>
                </div>
              )}
              {needPhysical && (
                <div className={styles.needItem}>
                  <span className={styles.needIcon}>⚔️</span>
                  <span>Physical Damage</span>
                </div>
              )}
              {needTank && (
                <div className={styles.needItem}>
                  <span className={styles.needIcon}>🛡️</span>
                  <span>Tanky Jungler</span>
                </div>
              )}
              {!needMagic && !needPhysical && !needTank && (
                <div className={styles.needItem}>
                  <span className={styles.needIcon}>✓</span>
                  <span>Balanced</span>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
