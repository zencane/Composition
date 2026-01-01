
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
  
  // Set to false by default as per user request to "cascade" (collapse) the big section
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
        const [agentsData, mapsData] = await Promise.all([fetchAgents(), fetchMaps()]);
        setAgents(agentsData);
        setMaps(mapsData);

        const savedComps = localStorage.getItem('valorant_map_comps');
        if (!savedComps || JSON.parse(savedComps).length === 0) {
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
        // If no saved maps OR if the saved array is empty, force the default Next Act selection
        if (!savedActive || JSON.parse(savedActive).length === 0) {
          const nextActMaps = ['Split', 'Pearl', 'Abyss', 'Corrode', 'Haven', 'Breeze', 'Bind'];
          const defaultIds = mapsData
            .filter(m => nextActMaps.includes(m.displayName))
            .map(m => m.uuid);
          
          if (defaultIds.length > 0) {
            setActiveMapIds(defaultIds);
          } else {
            // Fallback to all maps only if the rotation list found nothing (e.g. API names differ)
            setActiveMapIds(mapsData.map(m => m.uuid));
          }
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
    const currentPlayer = [...mainRoster, ...subRoster].find(p => p.id === playerId);
    const isRemoving = currentPlayer?.agentPool.includes(agentId);

    const update = (prev: Player[]) => prev.map(p => {
      if (p.id !== playerId) return p;
      const newPool = p.agentPool.includes(agentId)
        ? p.agentPool.filter(id => id !== agentId)
        : [...p.agentPool, agentId];
      return { ...p, agentPool: newPool };
    });

    if (playerId.startsWith('main')) setMainRoster(update);
    else setSubRoster(update);

    if (isRemoving) {
      setMapComps(prev => prev.map(comp => ({
        ...comp,
        slots: comp.slots.map(slot => 
          (slot.playerId === playerId && slot.agentId === agentId)
            ? { ...slot, agentId: '' }
            : slot
        )
      })));
    }
  }, [mainRoster, subRoster]);

  const addSubstitute = () => {
    if (subRoster.length < 5) {
      const newId = `sub-${Date.now()}`;
      setSubRoster(prev => [...prev, {
        id: newId,
        name: '',
        agentPool: [],
        isMain: false
      }]);
    }
  };

  const removeSubstitute = (id: string) => {
    setSubRoster(prev => prev.filter(p => p.id !== id));
  };

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

  const scrollToSmartBoard = () => {
    setTimeout(() => {
      smartViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleHidePicker = () => {
    setIsCompVisible(false);
    scrollToSmartBoard();
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
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTeamName(false)}
                  className="bg-transparent border-b-2 border-[#ff4655] text-white outline-none w-auto inline-block min-w-[200px]"
                />
              ) : (
                <span 
                  onDoubleClick={() => setIsEditingTeamName(true)}
                  className="hover:text-white/80 transition-colors cursor-pointer decoration-[#ff4655]/40 underline underline-offset-8 decoration-2"
                  title="Double click to edit team name"
                >
                  {teamName}
                </span>
              )}
            </h1>
          </div>
          <p className="text-gray-400 font-medium tracking-tight mt-6 text-sm md:text-base leading-relaxed max-w-2xl">
            A tool to <span className="text-gray-100 font-bold">visualise agent pools</span> and <span className="text-gray-100 font-bold">team compositions</span> across different maps.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          <img 
            src="https://liquipedia.net/commons/images/b/b3/Valorant_Premier_mode_logo_allmode.png" 
            alt="Premier Logo" 
            className="h-16 w-auto drop-shadow-lg opacity-40 grayscale hover:grayscale-0 transition-all duration-500" 
          />
        </div>
      </header>

      <section className="space-y-12">
        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-6 bg-[#ff4655]"></span>
            Main Roster
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

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 text-gray-400">
              <span className="w-2 h-6 bg-gray-600"></span>
              Substitutes
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {subRoster.map(player => (
              <PlayerSlot 
                key={player.id} 
                player={player} 
                allAgents={agents}
                onUpdateName={updatePlayerName}
                onToggleAgent={toggleAgentInPool}
                onRemove={removeSubstitute}
              />
            ))}
            
            {subRoster.length < 5 && (
              <button
                onClick={addSubstitute}
                className="group flex flex-col items-center justify-center bg-[#1a252e] border-2 border-dashed border-gray-700 hover:border-[#ff4655] hover:bg-[#ff4655]/5 transition-all rounded p-8 min-h-[140px]"
              >
                <div className="w-10 h-10 rounded-full border-2 border-gray-600 group-hover:border-[#ff4655] flex items-center justify-center transition-all">
                  <span className="text-2xl font-black text-gray-500 group-hover:text-[#ff4655] group-hover:scale-125 transition-all">+</span>
                </div>
                <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-[#ff4655]">Add Substitute</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-8 pt-12 border-t border-gray-800">
        <div className="flex flex-col gap-6 items-center text-center">
          <div className="space-y-2">
            <h2 className="text-4xl font-black uppercase tracking-widest italic flex items-center justify-center gap-4">
              <svg className="w-10 h-10 text-[#ff4655]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
              </svg>
              Map Selection
            </h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Toggle maps to choose team compositions.</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
            {maps.map(map => {
              const isActive = activeMapIds.includes(map.uuid);
              return (
                <button
                  key={map.uuid}
                  onClick={() => toggleMapActive(map.uuid)}
                  className={`group relative h-24 rounded overflow-hidden border-2 transition-all ${
                    isActive ? 'border-[#ff4655] scale-105 shadow-lg shadow-[#ff4655]/20 z-10' : 'border-gray-800 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'
                  }`}
                >
                  <img src={map.splash} alt={map.displayName} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 flex items-center justify-center ${isActive ? 'bg-black/20' : 'bg-black/60'} group-hover:bg-transparent transition-colors`}>
                    <span className="text-base font-black uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] brightness-125">
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
            <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-8 bg-[#ff4655]"></span>
              Team Composition Per Map
            </h2>
            <button 
              onClick={() => {
                if (isCompVisible) {
                  handleHidePicker();
                } else {
                  setIsCompVisible(true);
                }
              }}
              className={`px-6 py-2 rounded transition-all text-xs font-black uppercase tracking-widest border ${
                isCompVisible 
                  ? 'bg-red-600/10 border-red-600/50 text-red-500 hover:bg-red-600/20' 
                  : 'bg-[#1a252e] border-gray-700 text-gray-300 hover:bg-[#25323d] hover:border-[#ff4655]'
              }`}
            >
              {isCompVisible ? 'Hide Picker' : 'Show Team Composition Per Map'}
            </button>
          </div>
          
          {isCompVisible ? (
            <div className="grid gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
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
              {activeMapIds.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-gray-800 rounded-xl">
                  <p className="text-gray-600 font-black uppercase tracking-widest italic">No maps selected for picking</p>
                </div>
              ) : (
                <div className="flex justify-center pt-4">
                   <button 
                    onClick={handleHidePicker}
                    className="px-12 py-4 bg-[#ff4655]/10 hover:bg-[#ff4655]/20 border border-[#ff4655]/30 text-[#ff4655] text-sm font-black uppercase tracking-[0.4em] rounded transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-[#ff4655]/5"
                  >
                    Collapse Picker
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => setIsCompVisible(true)}
              className="group cursor-pointer py-16 text-center border-2 border-dashed border-gray-800 rounded-xl hover:border-[#ff4655]/50 transition-all bg-[#16202a]/50"
            >
              <p className="text-white font-black uppercase tracking-[0.2em] italic group-hover:text-[#ff4655] transition-colors drop-shadow-lg">
                Section collapsed. Click here to expand Team Composition Per Map
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Visual Board / Final Picker Overview */}
      <section ref={smartViewRef} className="pt-12 border-t border-gray-800 scroll-mt-12">
        <FinalRosterOverview 
          activeMaps={activeMaps}
          mapComps={mapComps}
          allPlayers={allPlayers}
          allAgents={agents}
        />
      </section>

      <footer className="text-center py-12 text-gray-500 text-sm font-medium border-t border-gray-800 mt-24">
        <p className="tracking-widest font-black uppercase italic">2026 Agent Pool Visualizer & Picker Tool for Premier.</p>
      </footer>
    </div>
  );
};

export default App;
