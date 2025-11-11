import { useState, useMemo } from 'react';
import type { Hero } from './types/hero';
import heroData from './data/heroes.json';
import { getJunglers, recommendJunglers } from './utils/heroUtils';
import EnemyPicker from './components/EnemyPicker/EnemyPicker';
import JunglerRecommendations from './components/JunglerRecommendations/JunglerRecommendations';
import './App.css';

function App() {
  const [selectedEnemies, setSelectedEnemies] = useState<Hero[]>([]);

  const allHeroes = heroData.heroes as Hero[];
  const junglers = useMemo(() => getJunglers(allHeroes), []);

  const recommendations = useMemo(
    () => recommendJunglers(junglers, selectedEnemies),
    [junglers, selectedEnemies]
  );

  const handleSelectEnemy = (hero: Hero) => {
    setSelectedEnemies(prev => {
      const isSelected = prev.some(h => h.id === hero.id);
      if (isSelected) {
        return prev.filter(h => h.id !== hero.id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, hero];
    });
  };

  const handleReset = () => {
    setSelectedEnemies([]);
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Retribution</h1>
        {selectedEnemies.length > 0 && (
          <button className="resetButton" onClick={handleReset}>
            Reset
          </button>
        )}
      </header>

      <main className="main">
        <div className="section">
          <EnemyPicker
            heroes={allHeroes}
            selectedEnemies={selectedEnemies}
            onSelectEnemy={handleSelectEnemy}
          />
        </div>

        <div className="section">
          <JunglerRecommendations recommendations={recommendations} />
        </div>
      </main>
    </div>
  );
}

export default App;
