import { useState, useMemo } from 'react';
import type { Hero } from './types/hero';
import heroData from './data/heroes.json';
import { getJunglers, recommendJunglers } from './utils/heroUtils';
import EnemyPicker from './components/EnemyPicker/EnemyPicker';
import CompactEnemyTeam from './components/CompactEnemyTeam/CompactEnemyTeam';
import TeamRadar from './components/TeamRadar/TeamRadar';
import StickyRecommendations from './components/StickyRecommendations/StickyRecommendations';
import SearchBar from './components/SearchBar/SearchBar';
import './App.css';

type PickerMode = 'team' | 'enemy';

const allHeroes = heroData.heroes as Hero[];

function App() {
  const [yourTeam, setYourTeam] = useState<Hero[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<Hero[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('enemy');

  const junglers = useMemo(() => getJunglers(allHeroes), []);

  const filteredHeroes = useMemo(
    () => allHeroes.filter(hero =>
      hero.hero_name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery]
  );

  const recommendations = useMemo(
    () => recommendJunglers(junglers, yourTeam, enemyTeam, [], 'Mythic'),
    [junglers, yourTeam, enemyTeam]
  );

  const handleSelectTeammate = (hero: Hero) => {
    if (enemyTeam.some(h => h.id === hero.id)) return;
    setYourTeam(prev => {
      const isSelected = prev.some(h => h.id === hero.id);
      if (isSelected) return prev.filter(h => h.id !== hero.id);
      if (prev.length >= 4) return prev;
      return [...prev, hero];
    });
  };

  const handleSelectEnemy = (hero: Hero) => {
    if (yourTeam.some(h => h.id === hero.id)) return;
    setEnemyTeam(prev => {
      const isSelected = prev.some(h => h.id === hero.id);
      if (isSelected) return prev.filter(h => h.id !== hero.id);
      if (prev.length >= 5) return prev;
      return [...prev, hero];
    });
  };

  const lockedIds = useMemo(() => {
    const ids = pickerMode === 'team'
      ? enemyTeam.map(h => h.id)
      : yourTeam.map(h => h.id);
    return new Set(ids);
  }, [pickerMode, enemyTeam, yourTeam]);

  const currentPickerProps = pickerMode === 'team'
    ? { selectedEnemies: yourTeam, onSelectEnemy: handleSelectTeammate, lockedIds }
    : { selectedEnemies: enemyTeam, onSelectEnemy: handleSelectEnemy, lockedIds };

  return (
    <div className="app">
      <header className="header">
        <div className="headerTop">
          {yourTeam.length === 0 && enemyTeam.length === 0 ? (
            <h1 className="logo">Retribution</h1>
          ) : (
            <div className="teamsContainer">
              <CompactEnemyTeam
                enemies={yourTeam}
                onRemove={handleSelectTeammate}
                maxSlots={4}
                label="Your Team"
                emptyText="Select your team"
              />
              <CompactEnemyTeam
                enemies={enemyTeam}
                onRemove={handleSelectEnemy}
                maxSlots={5}
                label="Enemy Team"
                emptyText="Select enemies"
              />
            </div>
          )}
        </div>
        {(yourTeam.length > 0 || enemyTeam.length > 0) && (
          <div className="resetWrap">
            <button
              className="resetButton"
              onClick={() => { setYourTeam([]); setEnemyTeam([]); }}
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Clear All
            </button>
          </div>
        )}
        <TeamRadar
          enemyTeam={enemyTeam}
          yourTeam={yourTeam}
        />
        <StickyRecommendations
          recommendations={recommendations}
          selectedEnemies={enemyTeam}
        />
      </header>

      <main className="main">
        <div className="pickerModeSelector">
          <button
            className={`modeButton ${pickerMode === 'team' ? 'active' : ''}`}
            onClick={() => setPickerMode('team')}
          >
            Your Team ({yourTeam.length}/4)
          </button>
          <button
            className={`modeButton ${pickerMode === 'enemy' ? 'active' : ''}`}
            onClick={() => setPickerMode('enemy')}
          >
            Enemy Team ({enemyTeam.length}/5)
          </button>
        </div>

        <div className="searchSection">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="pickerSection">
          <EnemyPicker
            heroes={filteredHeroes}
            {...currentPickerProps}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
