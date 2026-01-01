
import React, { useMemo } from 'react';
import { MapData, Player, Agent } from '../types';
import { ROLE_COLORS } from './PlayerSlot';

interface MapCompRowProps {
  map: MapData;
  allPlayers: Player[];
  allAgents: Agent[];
  comp: { playerId: string; agentId: string }[];
  onUpdateSlot: (mapId: string, index: number, playerId: string, agentId: string) => void;
}

const MapCompRow: React.FC<MapCompRowProps> = ({ map, allPlayers, allAgents, comp, onUpdateSlot }) => {
  return (
    <div className="bg-[#1a252e] rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">
      {/* Map Header */}
      <div className="relative h-32 overflow-hidden">
        <img 
          src={map.splash} 
          alt={map.displayName} 
          className="w-full h-full object-cover opacity-60 absolute inset-0" 
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a252e] via-[#1a252e]/40 to-transparent flex items-center p-8">
          <div className="flex flex-col">
            <h3 className="text-5xl font-black uppercase tracking-tighter italic text-white drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">
              {map.displayName}
            </h3>
            <div className="h-1.5 w-16 bg-[#ff4655] mt-1"></div>
          </div>
        </div>
      </div>

      {/* Composition Slots */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((index) => {
          const currentSlot = comp[index] || { playerId: '', agentId: '' };
          const currentPlayer = allPlayers.find(p => p.id === currentSlot.playerId);
          
          const availablePlayers = allPlayers.filter(p => 
            p.id === currentSlot.playerId || !comp.some((s, idx) => idx !== index && s.playerId === p.id)
          );

          // Check if this agent is picked twice on the same map
          const isDuplicate = currentSlot.agentId && comp.filter(s => s.agentId === currentSlot.agentId).length > 1;

          // Agent pool sorted by: Selected First, then Alphabetical
          const sortedPool = useMemo<Agent[]>(() => {
            if (!currentPlayer) return [];
            const pool = allAgents.filter(a => currentPlayer.agentPool.includes(a.uuid));
            
            // Sort remaining alphabetically
            const sorted = [...pool].sort((a, b) => a.displayName.localeCompare(b.displayName));

            // Move the currently selected agent to the front
            if (currentSlot.agentId) {
              const selectedIdx = sorted.findIndex(a => a.uuid === currentSlot.agentId);
              if (selectedIdx > -1) {
                const [agent] = sorted.splice(selectedIdx, 1);
                sorted.unshift(agent);
              }
            }

            return sorted;
          }, [currentPlayer, allAgents, currentSlot.agentId]);

          return (
            <div key={index} className={`flex flex-col gap-3 bg-[#25323d] p-4 rounded-lg border transition-all shadow-inner min-h-[350px] ${
              isDuplicate ? 'border-red-500 ring-2 ring-red-500/30' : 'border-gray-700 hover:border-gray-600'
            }`}>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center h-6">
                  {isDuplicate && (
                    <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase animate-pulse">Duplicate Agent</span>
                  )}
                </div>
                <select
                  value={currentSlot.playerId}
                  onChange={(e) => {
                    const newPlayerId = e.target.value;
                    onUpdateSlot(map.uuid, index, newPlayerId, '');
                  }}
                  className="bg-[#0f1923] text-white text-sm font-bold border border-gray-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#ff4655] cursor-pointer"
                >
                  <option value="">Vacant Slot</option>
                  {availablePlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name || `Unnamed Sub (${p.id.split('-')[1]})`}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-grow pr-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Agent</span>
                <div className="bg-[#0f1923] p-2 rounded border border-gray-800">
                  {currentPlayer ? (
                    sortedPool.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {sortedPool.map((agent) => {
                          const isSelected = agent.uuid === currentSlot.agentId;
                          const roleColor = ROLE_COLORS[agent.role?.displayName || ''] || '#666';
                          return (
                            <button
                              key={agent.uuid}
                              onClick={() => {
                                // Toggle behavior: if already selected, clear it
                                const nextAgentId = isSelected ? '' : agent.uuid;
                                onUpdateSlot(map.uuid, index, currentSlot.playerId, nextAgentId);
                              }}
                              style={{ borderColor: isSelected ? '#ff4655' : roleColor }}
                              className={`group relative aspect-square rounded overflow-hidden transition-all transform hover:scale-110 active:scale-95 border ${
                                isSelected ? 'z-10 shadow-[0_0_10px_rgba(255,70,85,0.4)] border-2' : 'grayscale opacity-40 hover:opacity-100 hover:grayscale-0'
                              }`}
                              title={`${agent.role?.displayName}: ${agent.displayName}`}
                            >
                              <img 
                                src={agent.displayIcon} 
                                alt={agent.displayName} 
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute top-0 right-0 p-0.5 bg-[#ff4655] rounded-bl">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-20">
                        <span className="text-[9px] text-gray-600 uppercase font-bold text-center">Empty Pool</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-20 opacity-20">
                      <span className="text-[9px] text-gray-400 uppercase font-bold text-center italic">No Player</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Display role and name for the selected agent - Reduced padding/margin to pull closer to selector */}
              {currentSlot.agentId && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  {allAgents.find(a => a.uuid === currentSlot.agentId)?.role && (
                    <img 
                      src={allAgents.find(a => a.uuid === currentSlot.agentId)?.role.displayIcon} 
                      className="w-5 h-5 brightness-200" 
                      alt="role"
                    />
                  )}
                  <span className="text-sm font-black uppercase text-white truncate drop-shadow-md">
                    {allAgents.find(a => a.uuid === currentSlot.agentId)?.displayName}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapCompRow;
