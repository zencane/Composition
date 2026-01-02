import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Player, Agent, MapData, MapComposition } from './types';
import { fetchAgents, fetchMaps } from './services/valorantApi';
import PlayerSlot from './components/PlayerSlot';
import MapCompRow from './components/MapCompRow';
import FinalRosterOverview from './components/FinalRosterOverview';

const PREMIER_SCHEDULE = [
  { week: '01', name: 'Split', dates: 'JAN 14 — 18', color: '#B2FF9E' },
  { week: '02', name: 'Breeze', dates: 'JAN 21 — 25', color: '#FFB08E' },
  { week: '03', name: 'Pearl', dates: 'JAN 28 — FEB 1', color: '#B2FF9E' },
  { week: '04', name: 'Bind', dates: 'FEB 4 — 8', color: '#FFB08E' },
  { week: '05', name: 'Abyss', dates: 'FEB 11 — 15', color: '#B2FF9E' },
  { week: '06', name: 'Corrode', dates: 'FEB 18 — 22', color: '#FFB08E' },
  { week: '07', name: 'Haven', dates: 'FEB 25 — 28', color: '#B2FF9E' },
];

const STORAGE_KEYS = {
  TEAM_NAME: 'valorant_team_name',
  ROSTER_MAIN: 'valorant_roster_main',
  ROSTER_SUBS: 'valorant_roster_subs',
  MAP_COMPS: 'valorant_map_comps',
  ACTIVE_MAPS: 'valorant_active_maps'
};

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompVisible, setIsCompVisible] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const isResetting = useRef(false);
  
  const [teamName, setTeamName] = useState(() => localStorage.getItem(STORAGE_KEYS.TEAM_NAME) || 'MY TEAM');
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);
  const teamInputRef = useRef<HTMLInputElement>(null);

  const [mainRoster, setMainRoster] = useState<Player[]>([]);
  const [subRoster, setSubRoster] = useState<Player[]>([]);
  const [mapComps, setMapComps] = useState<MapComposition[]>([]);
  const [activeMapIds, setActiveMapIds] = useState<string[]>([]);

  const initDefaultState = useCallback((sortedMaps: MapData[]) => {
    setTeamName('MY TEAM');
    setMainRoster(Array.from({ length: 5 }, (_, i) => ({
      id: `main-${i}`,
      name: `Player ${i + 1}`,
      agentPool: [],
      isMain: true
    })));
    setSubRoster([
      { id: `sub-${Date.now()}-0`, name: '', agentPool: [], isMain: false },
      { id: `sub-${Date.now()}-1`, name: '', agentPool: [], isMain: false }
    ]);
    const scheduledNames = PREMIER_SCHEDULE.map(s => s.name.toLowerCase());
    const initialActive = sortedMaps.filter(m => scheduledNames.includes(m.displayName.toLowerCase())).map(m => m.uuid);
    setActiveMapIds(initialActive);
    
    const defaultComps = sortedMaps.map(map => ({
      mapId: map.uuid,
      slots: Array.from({ length: 5 }, (_, i) => ({ playerId: `main-${i}`, agentId: '' }))
    }));
    setMapComps(defaultComps);
  }, []);

  // Initialize Data
  useEffect(() => {
    const init = async () => {
      try {
        const [agentsData, mapsData] = await Promise.all([fetchAgents(), fetchMaps()]);
        setAgents(agentsData);

        const sortedMaps = [...mapsData].sort((a, b) => {
          const indexA = PREMIER_SCHEDULE.findIndex(s => s.name.toLowerCase() === a.displayName.toLowerCase());
          const indexB = PREMIER_SCHEDULE.findIndex(s => s.name.toLowerCase() === b.displayName.toLowerCase());
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
        setMaps(sortedMaps);

        const savedMain = localStorage.getItem(STORAGE_KEYS.ROSTER_MAIN);
        const savedSub = localStorage.getItem(STORAGE_KEYS.ROSTER_SUBS);
        const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_MAPS);
        const savedCompsRaw = localStorage.getItem(STORAGE_KEYS.MAP_COMPS);

        if (savedMain && savedSub && savedActive && savedCompsRaw) {
          setMainRoster(JSON.parse(savedMain));
          setSubRoster(JSON.parse(savedSub));
          setActiveMapIds(JSON.parse(savedActive));
          const currentComps = JSON.parse(savedCompsRaw);
          setMapComps(sortedMaps.map(map => {
            const existing = currentComps.find((c: any) => c.mapId === map.uuid);
            return existing || { mapId: map.uuid, slots: Array.from({ length: 5 }, (_, i) => ({ playerId: `main-${i}`, agentId: '' })) };
          }));
        } else {
          initDefaultState(sortedMaps);
        }
      } catch (error) {
        console.error("Failed to load Valorant data", error);
      } finally {
        // Use a slightly longer delay to ensure the browser has parsed the initial data paint
        setTimeout(() => setLoading(false), 400);
      }
    };
    init();
  }, [initDefaultState]);

  // Save to LocalStorage
  useEffect(() => {
    if (loading || isResetting.current) return;
    localStorage.setItem(STORAGE_KEYS.TEAM_NAME, teamName);
    localStorage.setItem(STORAGE_KEYS.ROSTER_MAIN, JSON.stringify(mainRoster));
    localStorage.setItem(STORAGE_KEYS.ROSTER_SUBS, JSON.stringify(subRoster));
    localStorage.setItem(STORAGE_KEYS.MAP_COMPS, JSON.stringify(mapComps));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MAPS, JSON.stringify(activeMapIds));
  }, [teamName, mainRoster, subRoster, mapComps, activeMapIds, loading]);

  const updatePlayerName = useCallback((id: string, name: string) => {
    const update = (prev: Player[]) => prev.map(p => p.id === id ? { ...p, name } : p);
    if (id.startsWith('main')) setMainRoster(update);
    else setSubRoster(update);
  }, []);

  const toggleAgentInPool = useCallback((playerId: string, agentId: string) => {
    const update = (prev: Player[]) => prev.map(p => {
      if (p.id !== playerId) return p;
      const newPool = p.agentPool.includes(agentId) ? p.agentPool.filter(id => id !== agentId) : [...p.agentPool, agentId];
      return { ...p, agentPool: newPool };
    });
    if (playerId.startsWith('main')) setMainRoster(update);
    else setSubRoster(update);
  }, []);

  const updateMapSlot = useCallback((mapId: string, index: number, playerId: string, agentId: string) => {
    setMapComps(prev => prev.map(comp => {
      if (comp.mapId !== mapId) return comp;
      const newSlots = [...comp.slots];
      newSlots[index] = { playerId, agentId };
      return { ...comp, slots: newSlots };
    }));
  }, []);

  const toggleMapActive = (mapId: string) => {
    setActiveMapIds(prev => prev.includes(mapId) ? prev.filter(id => id !== mapId) : [...prev, mapId]);
  };

  const resetTeam = () => {
    if (!confirm("Are you sure? This will delete all your customized roster names, agent pools, and map compositions.")) return;
    
    isResetting.current = true;
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    initDefaultState(maps);
    setIsDataModalOpen(false);
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const exportToJson = () => {
    const data = { teamName, mainRoster, subRoster, mapComps, activeMapIds };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teamName.replace(/\s+/g, '_')}_Premier_Comp.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        applyData(data);
      } catch (err) {
        alert("Invalid team data file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyData = (data: any) => {
    if (data.teamName) setTeamName(data.teamName);
    if (data.mainRoster) setMainRoster(data.mainRoster);
    if (data.subRoster) setSubRoster(data.subRoster);
    if (data.mapComps) setMapComps(data.mapComps);
    if (data.activeMapIds) setActiveMapIds(data.activeMapIds);
    setIsDataModalOpen(false);
  };

  const allPlayers = useMemo(() => [...mainRoster, ...subRoster], [mainRoster, subRoster]);
  const activeMaps = useMemo(() => maps.filter(m => activeMapIds.includes(m.uuid)), [maps, activeMapIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#ff4655]/20 border-t-[#ff4655] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#ff4655] rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase italic tracking-[0.2em] text-white">Initializing Roster</h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">Fetching latest Agents and Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1923] p-4 md:p-8 max-w-[1800px] mx-auto space-y-12 pb-24 animate-fade-in">
      {/* Team Data Modal */}
      {isDataModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f1923]/95 backdrop-blur-sm" onClick={() => setIsDataModalOpen(false)}></div>
          <div className="relative bg-[#16202a] border-2 border-white/10 w-full max-w-xl rounded-sm p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Team Data Manager</h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest opacity-60">Manage your local storage</p>
              </div>
              <button onClick={() => setIsDataModalOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-black uppercase text-[#ff4655] tracking-widest border-b border-white/5 pb-2 text-white">File Operations</h3>
                <button onClick={exportToJson} className="w-full py-5 px-6 bg-white/5 border border-white/10 rounded-sm text-left hover:bg-white/10 transition-all flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Export Config</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Download as JSON</span>
                  </div>
                  <svg className="w-5 h-5 opacity-40 group-hover:translate-y-1 transition-transform text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
                </button>
                <label className="w-full py-5 px-6 bg-white/5 border border-white/10 rounded-sm text-left hover:bg-white/10 transition-all flex items-center justify-between group cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-widest text-white">Import Config</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Upload JSON file</span>
                  </div>
                  <svg className="w-5 h-5 opacity-40 group-hover:-translate-y-1 transition-transform text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 9l5-5m0 0l5 5m-5-5v12" /></svg>
                  <input type="file" className="hidden" accept=".json" onChange={importFromJson} />
                </label>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-black uppercase text-[#ff4655] tracking-widest border-b border-white/5 pb-2">Danger Zone</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed">
                  Resetting will wipe all player names, agent pools, and map compositions. This action is permanent.
                </p>
                <button onClick={resetTeam} className="w-full py-5 px-6 bg-red-600/10 border border-red-600/30 rounded-sm text-left hover:bg-red-600 text-red-500 hover:text-white transition-all flex items-center justify-between group">
                  <span className="text-xs font-black uppercase tracking-widest">Reset All Data</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with fixed height and stable structure to prevent layout jump */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-gray-800 pb-8 min-h-[180px] md:min-h-[140px] w-full">
        <div className="flex flex-col max-w-3xl flex-grow">
          <span className="text-[#ff4655] text-xs font-black tracking-[0.4em] uppercase mb-2">Team Composition Visualiser</span>
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-md leading-none min-w-[200px]">
              {isEditingTeamName ? (
                <input
                  ref={teamInputRef}
                  type="text"
                  autoFocus
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value.toUpperCase())}
                  onBlur={() => setIsEditingTeamName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTeamName(false)}
                  className="bg-transparent border-b-2 border-[#ff4655] text-white outline-none w-64 md:w-auto"
                />
              ) : (
                <span onDoubleClick={() => setIsEditingTeamName(true)} className="cursor-pointer underline decoration-[#ff4655]/40 underline-offset-8">
                  {teamName}
                </span>
              )}
            </h1>
            <button 
              onClick={() => setIsDataModalOpen(true)}
              className="px-6 py-2.5 rounded-sm border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 bg-[#ff4655]/10 border-[#ff4655]/30 text-[#ff4655] hover:bg-[#ff4655] hover:text-white shadow-[0_0_15px_rgba(255,70,85,0.1)] hover:shadow-[0_0_20px_rgba(255,70,85,0.3)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              Manage Data
            </button>
          </div>
        </div>
        <div className="shrink-0 h-24 md:h-32 w-auto flex items-center justify-center min-w-[120px] bg-white/5 rounded-lg overflow-hidden border border-white/5">
          <img 
            src="https://raw.githubusercontent.com/zencane/Composition/refs/heads/main/media/premierlogo2.png" 
            alt="Premier Logo"
            className="h-full w-auto drop-shadow-[0_0_20px_rgba(255,70,85,0.4)] opacity-0 transition-opacity duration-1000" 
            onLoad={(e) => (e.target as HTMLImageElement).classList.add('opacity-100')}
            onError={(e) => (e.target as HTMLImageElement).src = "https://placehold.co/200x200/eac783/fcf6ec?text=PREMIER"}
          />
        </div>
      </header>

      <section className="space-y-12">
        <div className="space-y-6">
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 text-white">
            <span className="w-2 h-6 bg-[#ff4655]"></span> Main Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {mainRoster.map(player => (
              <PlayerSlot key={player.id} player={player} allAgents={agents} onUpdateName={updatePlayerName} onToggleAgent={toggleAgentInPool} />
            ))}
          </div>
        </div>
        <div className="space-y-6 pt-6 border-t border-gray-800/30">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 text-white">
              <span className="w-2 h-6 bg-gray-500"></span> Substitutes
            </h2>
            <button onClick={() => setSubRoster(prev => [...prev, { id: `sub-${Date.now()}`, name: '', agentPool: [], isMain: false }])} className="px-4 py-2 rounded bg-[#ff4655]/10 border border-[#ff4655]/30 text-[#ff4655] text-[10px] font-black uppercase hover:bg-[#ff4655] hover:text-white transition-all">+ Add Sub</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {subRoster.map(player => (
              <PlayerSlot key={player.id} player={player} allAgents={agents} onUpdateName={updatePlayerName} onToggleAgent={toggleAgentInPool} onRemove={(id) => setSubRoster(prev => prev.filter(p => p.id !== id))} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-8 pt-12 border-t border-gray-800">
        <div className="flex flex-col gap-8 text-center">
            <h2 className="text-6xl md:text-7xl font-black uppercase tracking-widest italic text-white leading-none">EPISODE 2026 ACT I</h2>
            <p className="text-lg font-bold text-[#ff4655] tracking-[0.5em] uppercase">Premier Schedule Selection</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 w-full px-4 md:px-0">
            {maps.map(map => {
              const isActive = activeMapIds.includes(map.uuid);
              const scheduleInfo = PREMIER_SCHEDULE.find(s => s.name.toLowerCase() === map.displayName.toLowerCase());
              const isScheduled = !!scheduleInfo;
              const accentColor = scheduleInfo?.color || '#555';

              return (
                <button
                  key={map.uuid}
                  onClick={() => toggleMapActive(map.uuid)}
                  className={`group relative flex h-72 flex-col rounded-sm overflow-hidden border-2 transition-all duration-500 ${
                    isActive 
                      ? 'border-white scale-[1.04] shadow-[0_25px_60px_rgba(255,70,85,0.4)] z-20' 
                      : 'border-white/10 hover:border-white/30'
                  } bg-[#1a252e]`}
                >
                  <div className="absolute inset-0 z-0 bg-[#0f1923]">
                    <img 
                      src={map.splash} 
                      alt="" 
                      className={`w-full h-full object-cover object-center transition-all duration-700 ${
                        isActive 
                          ? 'grayscale-0 opacity-100 brightness-100 scale-110' 
                          : 'grayscale opacity-50 brightness-50 group-hover:brightness-90 group-hover:grayscale-0 group-hover:opacity-80'
                      }`} 
                    />
                  </div>
                  
                  <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isActive ? 'bg-gradient-to-tr from-black via-black/50 to-transparent opacity-100' : 'bg-gradient-to-t from-black via-black/40 to-transparent opacity-60'}`}></div>
                  <div className="h-2.5 w-full z-20 shrink-0" style={{ backgroundColor: accentColor }}></div>
                  <div className="relative z-20 flex-1 flex flex-col justify-end p-5 text-left">
                    <div className="mb-2">
                      <span className={`text-[10px] md:text-xs font-black tracking-[0.2em] uppercase transition-all drop-shadow-lg ${isActive ? 'text-[#ff4655]' : 'text-white/80'}`}>
                        {isScheduled ? `WEEK ${scheduleInfo.week}` : 'OFF POOL'}
                      </span>
                    </div>
                    <h3 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none transition-all drop-shadow-[0_4px_12px_rgba(0,0,0,1)] text-white ${isActive ? 'scale-105 origin-left' : ''}`}>
                      {map.displayName}
                    </h3>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-12 pt-12">
          <div className="flex flex-col items-center gap-6">
             <button onClick={() => setIsCompVisible(!isCompVisible)} className={`w-full max-w-2xl py-6 rounded-sm border transition-all duration-500 group flex flex-col items-center gap-1.5 ${isCompVisible ? 'bg-[#1a252e] border-[#ff4655]/60 text-[#ff4655]' : 'bg-[#1a252e]/40 border-gray-800 text-gray-500 hover:text-white'}`}>
                <span className="text-base font-black uppercase tracking-[0.5em] italic">{isCompVisible ? 'Close Composition Picker' : 'Open Composition Picker'}</span>
              </button>
          </div>
          {isCompVisible && (
            <div className="grid gap-12">
              {activeMaps.map(map => (
                <MapCompRow key={map.uuid} map={map} allPlayers={allPlayers} allAgents={agents} comp={mapComps.find(c => c.mapId === map.uuid)?.slots || []} onUpdateSlot={updateMapSlot} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pt-12 border-t border-gray-800 scroll-mt-12">
        <FinalRosterOverview activeMaps={activeMaps} mapComps={mapComps} allPlayers={allPlayers} allAgents={agents} />
      </section>

      <footer className="text-center py-12 text-gray-500 text-sm font-black uppercase italic border-t border-gray-800 mt-24 tracking-[0.3em]">
        Premier Agent Pool Visualizer Tool // Episode 2026 Act I
      </footer>
    </div>
  );
};

export default App;