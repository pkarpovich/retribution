import { useState } from 'react';
import type { Hero, HeroRole } from '../../types/hero';
import { filterByRole } from '../../utils/heroUtils';
import HeroAvatar from '../HeroAvatar/HeroAvatar';
import styles from './EnemyPicker.module.css';

interface EnemyPickerProps {
  heroes: Hero[];
  selectedEnemies: Hero[];
  onSelectEnemy: (hero: Hero) => void;
}

const ROLES: Array<HeroRole | 'All'> = ['All', 'Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

export default function EnemyPicker({ heroes, selectedEnemies, onSelectEnemy }: EnemyPickerProps) {
  const [roleFilter, setRoleFilter] = useState<HeroRole | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHeroes = filterByRole(heroes, roleFilter).filter(hero =>
    hero.hero_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedIds = new Set(selectedEnemies.map(h => h.id));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Enemy Team</h2>
        <div className={styles.selectedCount}>
          {selectedEnemies.length}/5 selected
        </div>
      </div>

      {selectedEnemies.length > 0 && (
        <div className={styles.selectedEnemies}>
          {selectedEnemies.map(enemy => (
            <div key={enemy.id} className={styles.selectedChip}>
              <img src={enemy.img_src} alt={enemy.hero_name} className={styles.chipImage} />
              <span className={styles.chipName}>{enemy.hero_name}</span>
              <button
                className={styles.chipRemove}
                onClick={() => onSelectEnemy(enemy)}
                type="button"
                aria-label={`Remove ${enemy.hero_name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search hero by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className={styles.searchClear}
            onClick={() => setSearchQuery('')}
            type="button"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.filters}>
        {ROLES.map(role => (
          <button
            key={role}
            className={`${styles.filterButton} ${roleFilter === role ? styles.active : ''}`}
            onClick={() => setRoleFilter(role)}
            type="button"
          >
            {role}
          </button>
        ))}
      </div>

      <div className={styles.heroGrid}>
        {filteredHeroes.map(hero => (
          <HeroAvatar
            key={hero.id}
            hero={hero}
            selected={selectedIds.has(hero.id)}
            onClick={() => onSelectEnemy(hero)}
            size="medium"
          />
        ))}
      </div>
    </div>
  );
}
