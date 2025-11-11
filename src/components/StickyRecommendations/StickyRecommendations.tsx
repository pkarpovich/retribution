import { useState } from 'react';
import type { Hero } from '../../types/hero';
import CompactRecommendationCard from '../CompactRecommendationCard/CompactRecommendationCard';
import JunglerRecommendations from '../JunglerRecommendations/JunglerRecommendations';
import styles from './StickyRecommendations.module.css';

interface StickyRecommendationsProps {
  recommendations: Hero[];
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

  const topRecommendations = recommendations.slice(0, 3);

  return (
    <>
      <div className={styles.compactBar}>
        <div className={styles.compactScroll}>
          {topRecommendations.map((hero, index) => (
            <CompactRecommendationCard
              key={hero.id}
              hero={hero}
              rank={index + 1}
              onClick={() => setIsExpanded(true)}
            />
          ))}
        </div>
        {recommendations.length > 3 && (
          <button
            className={styles.expandButton}
            onClick={() => setIsExpanded(true)}
            type="button"
          >
            View All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className={styles.overlay} onClick={() => setIsExpanded(false)}>
          <div className={styles.expandedPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.expandedHeader}>
              <button
                className={styles.closeButton}
                onClick={() => setIsExpanded(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className={styles.expandedContent}>
              <JunglerRecommendations recommendations={recommendations} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
