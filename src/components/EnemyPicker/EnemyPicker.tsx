import type { Hero } from '../../types/hero';
import HeroAvatar from '../HeroAvatar/HeroAvatar';
import styles from './EnemyPicker.module.css';

interface EnemyPickerProps {
  heroes: Hero[];
  selectedEnemies: Hero[];
  lockedIds?: Set<number>;
  onSelectEnemy: (hero: Hero) => void;
}

export default function EnemyPicker({ heroes, selectedEnemies, lockedIds, onSelectEnemy }: EnemyPickerProps) {
  const selectedIds = new Set(selectedEnemies.map(h => h.id));

  return (
    <div className={styles.container}>
      <div className={styles.heroGrid}>
        {heroes.map(hero => (
          <HeroAvatar
            key={hero.id}
            hero={hero}
            selected={selectedIds.has(hero.id)}
            locked={lockedIds?.has(hero.id) ?? false}
            onClick={() => onSelectEnemy(hero)}
            size="small"
          />
        ))}
      </div>
    </div>
  );
}
