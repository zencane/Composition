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

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompVisible, setIsCompVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isFromShare, setIsFromShare] = useState(false);
  
  const [teamName, setTeamName] = useState(() => localStorage.getItem('valorant_team_name') || 'MY TEAM');
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);
  const teamInputRef = useRef<HTMLInputElement>(null);

  const [mainRoster, setMainRoster] = useState<Player[]>([]);
  const [subRoster, setSubRoster] = useState<Player[]>([]);
  const [mapComps, setMapComps] = useState<MapComposition[]>([]);
  const [activeMapIds, setActiveMapIds] = useState<string[]>([]);

  // Key mapping to shorten the "jibberish" URL
  // n: teamName, m: mainRoster, s: subRoster, c: mapComps, a: activeMapIds
  const getShareableLink = () => {
    const minifiedState = {
      n: teamName,
      m: mainRoster,
      s: subRoster,
      c: mapComps,
      a: activeMapIds
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(minifiedState))));
    // Use origin + pathname to ensure we get a clean URL (not a blob URL)
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#share=${encoded}`;
  };

  const handleShare = () => {
    const link = getShareableLink();
    navigator.clipboard.writeText(link);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const saveSharedToLocal = () => {
    localStorage.setItem('valorant_team_name', teamName);
    localStorage.setItem('valorant_roster_main', JSON.stringify(mainRoster));
    localStorage.setItem('valorant_roster_subs', JSON.stringify(subRoster));
    localStorage.setItem('valorant_map_comps', JSON.stringify(mapComps));
    localStorage.setItem('valorant_active_maps', JSON.stringify(activeMapIds));
    window.location.hash = '';
    setIsFromShare(false);
    window.location.reload();
  };

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

        const hash = window.location.hash;
        let restoredState = null;
        if (hash.startsWith('#share=')) {
          try {
            const encoded = hash.split('#share=')[1];
            const raw = JSON.parse(decodeURIComponent(escape(atob(encoded))));
            // Map back from short keys
            restoredState = {
              teamName: raw.n,
              mainRoster: raw.m,
              subRoster: raw.s,
              mapComps: raw.c,
              activeMapIds: raw.a
            };
            setIsFromShare(true);
          } catch (e) {
            console.error("Failed to restore shared state", e);
          }
        }

        if (restoredState) {
          setTeamName(restoredState.teamName);
          setMainRoster(restoredState.mainRoster);
          setSubRoster(restoredState.subRoster);
          setMapComps(restoredState.mapComps);
          setActiveMapIds(restoredState.activeMapIds);
        } else {
          const savedMain = localStorage.getItem('valorant_roster_main');
          setMainRoster(savedMain ? JSON.parse(savedMain) : Array.from({ length: 5 }, (_, i) => ({
            id: `main-${i}`,
            name: `Player ${i + 1}`,
            agentPool: [],
            isMain: true
          })));

          const savedSub = localStorage.getItem('valorant_roster_subs');
          setSubRoster(savedSub ? JSON.parse(savedSub) : [
            { id: `sub-${Date.now()}-0`, name: '', agentPool: [], isMain: false },
            { id: `sub-${Date.now()}-1`, name: '', agentPool: [], isMain: false }
          ]);

          const savedActive = localStorage.getItem('valorant_active_maps');
          if (savedActive) {
            setActiveMapIds(JSON.parse(savedActive));
          } else {
            const scheduledNames = PREMIER_SCHEDULE.map(s => s.name.toLowerCase());
            setActiveMapIds(sortedMaps.filter(m => scheduledNames.includes(m.displayName.toLowerCase())).map(m => m.uuid));
          }

          const savedCompsRaw = localStorage.getItem('valorant_map_comps');
          const currentComps = savedCompsRaw ? JSON.parse(savedCompsRaw) : [];
          setMapComps(sortedMaps.map(map => {
            const existing = currentComps.find((c: any) => c.mapId === map.uuid);
            return existing || { mapId: map.uuid, slots: Array.from({ length: 5 }, (_, i) => ({ playerId: `main-${i}`, agentId: '' })) };
          }));
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
    if (loading || isFromShare) return;
    localStorage.setItem('valorant_team_name', teamName);
    localStorage.setItem('valorant_roster_main', JSON.stringify(mainRoster));
    localStorage.setItem('valorant_roster_subs', JSON.stringify(subRoster));
    localStorage.setItem('valorant_map_comps', JSON.stringify(mapComps));
    localStorage.setItem('valorant_active_maps', JSON.stringify(activeMapIds));
  }, [teamName, mainRoster, subRoster, mapComps, activeMapIds, loading, isFromShare]);

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

  const allPlayers = useMemo(() => [...mainRoster, ...subRoster], [mainRoster, subRoster]);
  const activeMaps = useMemo(() => maps.filter(m => activeMapIds.includes(m.uuid)), [maps, activeMapIds]);

  if (loading) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1800px] mx-auto space-y-12 pb-24">
      {/* Shared State Banner */}
      {isFromShare && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-[#ff4655] text-white py-3 px-6 flex justify-between items-center shadow-2xl border-b border-white/20">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-1.5 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="font-black uppercase tracking-widest text-xs leading-none">Shared View Only</span>
              <span className="text-[10px] opacity-80 uppercase font-bold tracking-tighter">Changes won't save unless you import.</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={saveSharedToLocal}
              className="bg-white text-[#ff4655] px-4 py-1.5 rounded-sm text-[11px] font-black uppercase tracking-[0.1em] hover:bg-gray-100 transition-all shadow-lg active:scale-95"
            >
              Import to My Browser
            </button>
            <button 
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              className="bg-black/40 text-white px-4 py-1.5 rounded-sm text-[11px] font-black uppercase tracking-[0.1em] hover:bg-black/60 transition-all border border-white/20"
            >
              Discard & Close
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-gray-800 pb-8">
        <div className="flex flex-col max-w-3xl">
          <span className="text-[#ff4655] text-xs font-black tracking-[0.4em] uppercase mb-2">Team Composition Visualiser</span>
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-md leading-none">
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
            {!isFromShare && (
              <button 
                onClick={handleShare}
                className={`px-6 py-2.5 rounded-sm border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${copyFeedback ? 'bg-green-600 border-green-600 text-white' : 'bg-[#ff4655]/10 border-[#ff4655]/30 text-[#ff4655] hover:bg-[#ff4655] hover:text-white shadow-[0_0_15px_rgba(255,70,85,0.1)] hover:shadow-[0_0_20px_rgba(255,70,85,0.3)]'}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                {copyFeedback ? 'Link Copied!' : 'Copy Share Link'}
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <img 
            src="https://raw.githubusercontent.com/zencane/Composition/refs/heads/main/media/premierlogo2.png" 
            alt="Premier Logo"
            className="h-24 md:h-32 w-auto drop-shadow-[0_0_20px_rgba(255,70,85,0.4)]" 
            onError={(e) => (e.target as HTMLImageElement).src = "https://placehold.co/200x200/0f1923/ff4655?text=PREMIER"}
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
            {!isFromShare && (
              <button onClick={() => setSubRoster(prev => [...prev, { id: `sub-${Date.now()}`, name: '', agentPool: [], isMain: false }])} className="px-4 py-2 rounded bg-[#ff4655]/10 border border-[#ff4655]/30 text-[#ff4655] text-[10px] font-black uppercase hover:bg-[#ff4655] hover:text-white transition-all">+ Add Sub</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {subRoster.map(player => (
              <PlayerSlot key={player.id} player={player} allAgents={agents} onUpdateName={updatePlayerName} onToggleAgent={toggleAgentInPool} onRemove={(id) => setSubRoster(prev => prev.filter(p => p.id !== id))} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-8 pt-12 border-t border-gray-800">
        <div className="flex flex-col gap-8">
          <div className="text-center space-y-2">
            <h2 className="text-6xl md:text-7xl font-black uppercase tracking-widest italic text-white leading-none">EPISODE 2026 ACT I</h2>
            <p className="text-lg font-bold text-[#ff4655] tracking-[0.5em] uppercase">Premier Schedule Selection</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 w-full px-4 md:px-0">
            {maps.map(map => {
              const isActive = activeMapIds.includes(map.uuid);
              const scheduleInfo = PREMIER_SCHEDULE.find(s => s.name.toLowerCase() === map.displayName.toLowerCase());
              const isScheduled = !!scheduleInfo;
              const accentColor = scheduleInfo?.color || '#555';

              return (
                <button
                  key={map.uuid}
                  disabled={isFromShare}
                  onClick={() => toggleMapActive(map.uuid)}
                  className={`group relative flex h-72 flex-col rounded-sm overflow-hidden border-2 transition-all duration-500 ${
                    isActive 
                      ? 'border-white scale-[1.04] shadow-[0_25px_60px_rgba(255,70,85,0.4)] z-20' 
                      : 'border-white/10 hover:border-white/30'
                  } bg-[#1a252e] ${isFromShare ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="absolute inset-0 z-0">
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
                  
                  <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isActive ? 'bg-gradient-to-tr from-black via-black/40 to-transparent opacity-100' : 'bg-gradient-to-t from-black via-black/40 to-transparent opacity-60'}`}></div>
                  
                  <div className="h-2.5 w-full z-20 shrink-0" style={{ backgroundColor: accentColor }}></div>
                  
                  <div className="relative z-20 flex-1 flex flex-col justify-end p-5 text-left">
                    <div className="mb-2">
                      <span className={`text-[10px] md:text-xs font-black tracking-[0.2em] uppercase transition-all drop-shadow-lg ${isActive ? 'text-[#ff4655]' : 'text-white/80'}`}>
                        {isScheduled ? `WEEK ${scheduleInfo.week}` : 'OFF POOL'}
                      </span>
                    </div>
                    <h3 className={`text-xl md:text-2xl lg:text-3xl font-black uppercase italic tracking-tighter leading-none transition-all drop-shadow-[0_4px_12px_rgba(0,0,0,1)] ${isActive ? 'text-white scale-105 origin-left' : 'text-white/90'}`}>
                      {map.displayName}
                    </h3>
                    <div className="mt-3">
                       <span className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-all drop-shadow-md ${isActive ? 'text-white border-b-2 border-[#ff4655] pb-1' : 'text-white/90'}`}>
                        {scheduleInfo?.dates || 'NOT IN SCHEDULE'}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="absolute top-6 right-6 bg-[#ff4655] px-2.5 py-1 rounded-sm shadow-xl z-20">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-12 pt-12">
          <div className="flex flex-col items-center gap-6">
             <div className="h-px w-1/3 bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
             <button onClick={() => setIsCompVisible(!isCompVisible)} className={`w-full max-w-2xl py-6 rounded-sm border transition-all duration-500 group flex flex-col items-center gap-1.5 ${isCompVisible ? 'bg-[#1a252e] border-[#ff4655]/60 text-[#ff4655] shadow-[0_0_20px_rgba(255,70,85,0.05)]' : 'bg-[#1a252e]/40 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-white'}`}>
                <span className="text-base font-black uppercase tracking-[0.5em] italic">{isCompVisible ? 'Close Composition Picker' : 'Open Composition Picker'}</span>
                <div className={`h-[2px] bg-[#ff4655] transition-all duration-700 ease-out ${isCompVisible ? 'w-48 opacity-100' : 'w-8 opacity-20 group-hover:w-24 group-hover:opacity-100'}`}></div>
              </button>
          </div>
          {isCompVisible && (
            <div className="grid gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
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