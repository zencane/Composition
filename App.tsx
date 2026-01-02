
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, Agent, MapData, MapComposition } from './types';
import { fetchAgents, fetchMaps } from './services/valorantApi';
import PlayerSlot from './components/PlayerSlot';
import MapCompRow from './components/MapCompRow';
import FinalRosterOverview from './components/FinalRosterOverview';

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCompVisible, setIsCompVisible] = useState(false);
  
  const [teamName, setTeamName] = useState(() => {
    return localStorage.getItem('valorant_team_name') || 'MY TEAM';
  });
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);
  const teamInputRef = useRef<HTMLInputElement>(null);
  const smartViewRef = useRef<HTMLDivElement>(null);

  const [mainRoster, setMainRoster] = useState<Player[]>(() => {
    const saved = localStorage.getItem('valorant_roster_main');
    return saved ? JSON.parse(saved) : Array.from({ length: 5 }, (_, i) => ({
      id: `main-${i}`,
      name: `Player ${i + 1}`,
      agentPool: [],
      isMain: true
    }));
  });

  const [subRoster, setSubRoster] = useState<Player[]>(() => {
    const saved = localStorage.getItem('valorant_roster_subs');
    if (saved) return JSON.parse(saved);
    return Array.from({ length: 2 }, (_, i) => ({
      id: `sub-${i}`,
      name: '',
      agentPool: [],
      isMain: false
    }));
  });

  const [mapComps, setMapComps] = useState<MapComposition[]>(() => {
    const saved = localStorage.getItem('valorant_map_comps');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeMapIds, setActiveMapIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('valorant_active_maps');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [agentsData, mapsData] = await Promise.all([
          fetchAgents(), 
          fetchMaps()
        ]);
        setAgents(agentsData);
        setMaps(mapsData);

        const savedComps = localStorage.getItem('valorant_map_comps');
        if (!savedComps) {
          const initialComps = mapsData.map(map => ({
            mapId: map.uuid,
            slots: Array.from({ length: 5 }, (_, i) => ({
              playerId: `main-${i}`,
              agentId: ''
            }))
          }));
          setMapComps(initialComps);
        }
        
        const savedActive = localStorage.getItem('valorant_active_maps');
        if (savedActive === null) {
          const nextActMaps = ['Split', 'Pearl', 'Abyss', 'Corrode', 'Haven', 'Breeze', 'Bind'];
          const defaultIds = mapsData
            .filter(m => nextActMaps.includes(m.displayName))
            .map(m => m.uuid);
          
          if (defaultIds.length > 0) setActiveMapIds(defaultIds);
          else setActiveMapIds(mapsData.map(m => m.uuid));
        }
      } catch (error) {
        console.error("Failed to load Valorant data", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    localStorage.setItem('valorant_team_name', teamName);
  }, [teamName]);

  useEffect(() => {
    localStorage.setItem('valorant_roster_main', JSON.stringify(mainRoster));
  }, [mainRoster]);

  useEffect(() => {
    localStorage.setItem('valorant_roster_subs', JSON.stringify(subRoster));
  }, [subRoster]);

  useEffect(() => {
    localStorage.setItem('valorant_map_comps', JSON.stringify(mapComps));
  }, [mapComps]);

  useEffect(() => {
    localStorage.setItem('valorant_active_maps', JSON.stringify(activeMapIds));
  }, [activeMapIds]);

  useEffect(() => {
    if (isEditingTeamName && teamInputRef.current) {
      teamInputRef.current.focus();
      teamInputRef.current.select();
    }
  }, [isEditingTeamName]);

  const updatePlayerName = useCallback((id: string, name: string) => {
    const update = (prev: Player[]) => prev.map(p => p.id === id ? { ...p, name } : p);
    if (id.startsWith('main')) setMainRoster(update);
    else setSubRoster(update);
  }, []);

  const toggleAgentInPool = useCallback((playerId: string, agentId: string) => {
    const update = (prev: Player[]) => prev.map(p => {
      if (p.id !== playerId) return p;
      const newPool = p.agentPool.includes(agentId)
        ? p.agentPool.filter(id => id !== agentId)
        : [...p.agentPool, agentId];
      return { ...p, agentPool: newPool };
    });

    if (playerId.startsWith('main')) setMainRoster(update);
    else setSubRoster(update);
  }, []);

  const updateMapSlot = useCallback((mapId: string, index: number, playerId: string, agentId: string) => {
    setMapComps(prev => {
      const existing = prev.find(c => c.mapId === mapId);
      const newSlots = existing ? [...existing.slots] : Array.from({ length: 5 }, () => ({ playerId: '', agentId: '' }));
      newSlots[index] = { playerId, agentId };
      if (existing) {
        return prev.map(c => c.mapId === mapId ? { ...c, slots: newSlots } : c);
      } else {
        return [...prev, { mapId, slots: newSlots }];
      }
    });
  }, []);

  const toggleMapActive = (mapId: string) => {
    setActiveMapIds(prev => 
      prev.includes(mapId) ? prev.filter(id => id !== mapId) : [...prev, mapId]
    );
  };

  const handleHidePicker = () => {
    setIsCompVisible(false);
    setTimeout(() => {
      smartViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const allPlayers = useMemo(() => [...mainRoster, ...subRoster], [mainRoster, subRoster]);
  const activeMaps = useMemo(() => maps.filter(m => activeMapIds.includes(m.uuid)), [maps, activeMapIds]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1923]">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-t-[#ff4655] border-gray-800 rounded-full animate-spin"></div>
          <p className="mt-4 text-[#ff4655] font-black uppercase tracking-widest text-xl">Initializing Roster Tool...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-gray-800 pb-8">
        <div className="flex flex-col max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
             <span className="text-[#ff4655] text-xs font-black tracking-[0.4em] uppercase">Team Composition Visualiser</span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-x-4 text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-md leading-none">
              {isEditingTeamName ? (
                <input
                  ref={teamInputRef}
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.toUpperCase())}
                  onBlur={() => setIsEditingTeamName(false)}
                  className="bg-transparent border-b-2 border-[#ff4655] text-white outline-none w-auto"
                />
              ) : (
                <span onDoubleClick={() => setIsEditingTeamName(true)} className="cursor-pointer underline decoration-[#ff4655]/40 underline-offset-8">
                  {teamName}
                </span>
              )}
            </h1>
          </div>
        </div>
        <div className="shrink-0">
          <img 
            src="media/premierlogo2.png" 
            alt="Premier Logo" 
            className="h-20 md:h-28 w-auto drop-shadow-[0_0_15px_rgba(255,70,85,0.2)]" 
            onError={(e) => {
              // Hide the image if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </header>

      <section className="space-y-12">
        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-6 bg-[#ff4655]"></span> Main Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {mainRoster.map(player => (
              <PlayerSlot 
                key={player.id} 
                player={player} 
                allAgents={agents}
                onUpdateName={updatePlayerName}
                onToggleAgent={toggleAgentInPool}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-8 pt-12 border-t border-gray-800">
        <div className="flex flex-col gap-6 items-center text-center">
          <h2 className="text-4xl font-black uppercase tracking-widest italic">Map Selection</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
            {maps.map(map => {
              const isActive = activeMapIds.includes(map.uuid);
              return (
                <button
                  key={map.uuid}
                  onClick={() => toggleMapActive(map.uuid)}
                  className={`group relative h-24 rounded overflow-hidden border-2 transition-all ${
                    isActive ? 'border-[#ff4655] scale-105' : 'border-gray-800 grayscale opacity-40'
                  }`}
                >
                  <img src={map.splash} alt={map.displayName} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-base font-black uppercase tracking-tighter text-white drop-shadow-md">
                      {map.displayName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 pt-12">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black uppercase tracking-widest">Map Compositions</h2>
            <button 
              onClick={() => setIsCompVisible(!isCompVisible)}
              className="px-6 py-2 rounded bg-[#1a252e] border border-gray-700 text-gray-300 text-xs font-black uppercase hover:border-[#ff4655]"
            >
              {isCompVisible ? 'Hide Picker' : 'Show Picker'}
            </button>
          </div>
          
          {isCompVisible && (
            <div className="grid gap-8">
              {maps.filter(m => activeMapIds.includes(m.uuid)).map(map => (
                <MapCompRow 
                  key={map.uuid}
                  map={map}
                  allPlayers={allPlayers}
                  allAgents={agents}
                  comp={mapComps.find(c => c.mapId === map.uuid)?.slots || []}
                  onUpdateSlot={updateMapSlot}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section ref={smartViewRef} className="pt-12 border-t border-gray-800 scroll-mt-12">
        <FinalRosterOverview 
          activeMaps={activeMaps}
          mapComps={mapComps}
          allPlayers={allPlayers}
          allAgents={agents}
        />
      </section>

      <footer className="text-center py-12 text-gray-500 text-sm font-black uppercase italic border-t border-gray-800 mt-24">
        Premier Agent Pool Visualizer Tool
      </footer>
    </div>
  );
};

export default App;
