import { useState } from 'react';
import type { Hero, RecommendationResult } from '../../types/hero';
import CompactRecommendationCard from '../CompactRecommendationCard/CompactRecommendationCard';
import styles from './StickyRecommendations.module.css';

interface StickyRecommendationsProps {
  recommendations: RecommendationResult[];
  selectedEnemies: Hero[];
}

export default function StickyRecommendations({ recommendations, selectedEnemies }: StickyRecommendationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (selectedEnemies.length === 0) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  const displayRecommendations = isExpanded ? recommendations : recommendations.slice(0, 3);

  return (
    <div className={styles.container}>
      <div className={styles.compactBar}>
        <div className={`${styles.compactScroll} ${isExpanded ? styles.expanded : ''}`}>
          {displayRecommendations.map((result, index) => (
            <CompactRecommendationCard
              key={result.hero.id}
              result={result}
              rank={index + 1}
              expanded={isExpanded}
            />
          ))}
        </div>
      </div>

      {recommendations.length > 3 && (
        <button
          className={styles.expandButton}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          aria-label={isExpanded ? 'Collapse recommendations' : 'Expand recommendations'}
        >
          <svg
            className={`${styles.arrow} ${isExpanded ? styles.arrowUp : ''}`}
            width="20"
            height="20"
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
      )}
    </div>
  );
}
