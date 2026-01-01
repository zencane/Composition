
import React from 'react';
import { MapData, Player, Agent, MapComposition } from '../types';
import { ROLE_COLORS } from './PlayerSlot';

interface FinalRosterOverviewProps {
  activeMaps: MapData[];
  mapComps: MapComposition[];
  allPlayers: Player[];
  allAgents: Agent[];
}

const FinalRosterOverview: React.FC<FinalRosterOverviewProps> = ({ activeMaps, mapComps, allPlayers, allAgents }) => {
  if (activeMaps.length === 0) return null;

  return (
    <div className="bg-[#0f1923] p-8 rounded-2xl border-2 border-[#ff4655]/10 shadow-2xl space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black italic uppercase tracking-widest text-[#ff4655]">Visual Pick Board</h2>
        <p className="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">Finalized Pick Selections per Map</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {activeMaps.map(map => {
          const comp = mapComps.find(c => c.mapId === map.uuid)?.slots || [];
          
          // Count frequencies of each role in this specific map's comp
          const roleCounts: Record<string, number> = {};
          comp.forEach(slot => {
            const agent = allAgents.find(a => a.uuid === slot.agentId);
            if (agent?.role) {
              const role = agent.role.displayName;
              roleCounts[role] = (roleCounts[role] || 0) + 1;
            }
          });

          return (
            <div key={map.uuid} className="bg-[#16202a] border border-gray-800 rounded-lg overflow-hidden flex flex-col transition-all hover:border-gray-600 hover:shadow-2xl">
              {/* Card Header */}
              <div className="h-24 relative flex items-center px-4 overflow-hidden group">
                {/* Opacity boosted to 70% and no grayscale for extremely clear map visuals */}
                <img src={map.splash} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70 transition-transform duration-1000 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#16202a] via-[#16202a]/30 to-transparent"></div>
                {/* Map name: whitespace-nowrap and pr-8 to prevent clipping of italic characters like 'T' */}
                <h3 className="relative text-3xl font-black uppercase italic text-white z-10 pr-8 whitespace-nowrap tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
                  {map.displayName}
                </h3>
              </div>

              {/* Composition List */}
              <div className="p-3 space-y-2 bg-gradient-to-b from-transparent to-[#0d141b]">
                {comp.map((slot, i) => {
                  const player = allPlayers.find(p => p.id === slot.playerId);
                  const agent = allAgents.find(a => a.uuid === slot.agentId);
                  const roleName = agent?.role?.displayName || '';
                  const roleCount = roleCounts[roleName] || 0;
                  const isStacked = roleCount > 1;
                  const roleColor = ROLE_COLORS[roleName] || '#666';
                  
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 bg-[#0f1923]/70 backdrop-blur-sm rounded-md border border-gray-800/80 hover:bg-[#1a252e] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Agent Icon */}
                        <div 
                          className="w-10 h-10 rounded bg-[#1a252e] flex items-center justify-center border border-gray-800 overflow-hidden shrink-0"
                        >
                          {agent ? (
                            <img src={agent.displayIcon} alt={agent.displayName} className="w-full h-full object-cover scale-110" />
                          ) : (
                            <div className="w-full h-full bg-gray-900/50 flex items-center justify-center">
                               <span className="text-[10px] text-gray-700 font-black">?</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Names */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase text-gray-400 leading-none truncate mb-1">
                            {player ? player.name : 'VACANT'}
                          </span>
                          <span className="text-2xl font-black uppercase text-white tracking-wide truncate leading-tight">
                            {agent ? agent.displayName : '...'}
                          </span>
                        </div>
                      </div>

                      {/* Role Indicator */}
                      {agent?.role && (
                        <div className="relative shrink-0 flex items-center pr-1">
                          <div 
                            className={`p-1.5 rounded-md transition-all duration-300 ${isStacked ? 'bg-black/60 shadow-[0_0_10px_rgba(255,255,255,0.05)]' : ''}`}
                            style={{ 
                              boxShadow: isStacked 
                                ? `inset 0 0 0 1.5px ${roleColor}99, 0 0 15px ${roleColor}44` 
                                : `inset 0 0 0 1px ${roleColor}44`
                            }}
                          >
                            <img 
                              src={agent.role.displayIcon} 
                              alt={roleName} 
                              className="w-7 h-7 transition-all" 
                              style={{ 
                                filter: isStacked ? `drop-shadow(0 0 5px ${roleColor}) brightness(1.8)` : 'brightness(1.5)'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinalRosterOverview;