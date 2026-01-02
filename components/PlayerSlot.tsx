import React, { useState, useMemo } from 'react';
import { Player, Agent } from '../types';

interface PlayerSlotProps {
  player: Player;
  onUpdateName: (id: string, name: string) => void;
  onToggleAgent: (playerId: string, agentId: string) => void;
  allAgents: Agent[];
  onRemove?: (id: string) => void;
}

const ROLES_ORDER = ['Duelist', 'Initiator', 'Controller', 'Sentinel'];

export const ROLE_COLORS: Record<string, string> = {
  'Duelist': '#FFB08E',
  'Initiator': '#B2FF9E',
  'Controller': '#C3B1FF',
  'Sentinel': '#91E9FF'
};

const PlayerSlot: React.FC<PlayerSlotProps> = ({ player, onUpdateName, onToggleAgent, allAgents, onRemove }) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Sorting logic: Role Order then Alphabetical
  const sortAgents = (list: Agent[]) => {
    return [...list].sort((a, b) => {
      const roleA = ROLES_ORDER.indexOf(a.role?.displayName || '');
      const roleB = ROLES_ORDER.indexOf(b.role?.displayName || '');
      if (roleA !== roleB) return roleA - roleB;
      return a.displayName.localeCompare(b.displayName);
    });
  };

  const sortedAllAgents = useMemo(() => sortAgents(allAgents), [allAgents]);
  
  const sortedSelectedAgents = useMemo(() => {
    const selected = allAgents.filter(a => player.agentPool.includes(a.uuid));
    return sortAgents(selected);
  }, [player.agentPool, allAgents]);

  return (
    <div className={`relative bg-[#1f2933] border-l-4 transition-all duration-300 rounded-r shadow-lg flex flex-col ${isSelectorOpen ? 'border-[#ff4655] ring-1 ring-[#ff4655]/30' : 'border-gray-600'}`}>
      {!player.isMain && onRemove && (
        <button
          onClick={() => onRemove(player.id)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center font-black text-xs hover:bg-red-500 transition-colors shadow-lg z-10"
        >
          ×
        </button>
      )}

      <div className="p-4 space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Player Name</label>
          <input
            type="text"
            value={player.name}
            onChange={(e) => onUpdateName(player.id, e.target.value)}
            placeholder="Enter Name..."
            className="bg-[#0f1923] text-white text-sm border border-gray-700 px-2 py-1.5 rounded focus:outline-none focus:border-[#ff4655] transition-colors"
          />
        </div>

        <div className="flex justify-between items-center">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent Pool</label>
          <button
            onClick={() => setIsSelectorOpen(!isSelectorOpen)}
            className={`text-[10px] px-2 py-1 rounded transition-all uppercase font-bold border ${
              isSelectorOpen 
                ? 'bg-[#ff4655] text-white border-[#ff4655]' 
                : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'
            }`}
          >
            {isSelectorOpen ? 'Close' : 'Manage'}
          </button>
        </div>

        {isSelectorOpen && (
          <div className="bg-[#0f1923] p-2 rounded border border-gray-800 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-5 gap-1">
              {sortedAllAgents.map(agent => {
                const isSelected = player.agentPool.includes(agent.uuid);
                const roleColor = ROLE_COLORS[agent.role?.displayName || ''] || '#666';
                return (
                  <button
                    key={agent.uuid}
                    onClick={() => onToggleAgent(player.id, agent.uuid)}
                    style={{ borderColor: isSelected ? '#ff4655' : roleColor }}
                    className={`relative aspect-square rounded overflow-hidden border transition-all ${
                      isSelected ? 'bg-[#ff4655]/20 scale-95' : 'bg-[#1a252e] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={agent.displayIcon} alt={agent.displayName} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!isSelectorOpen && (
          <div className="flex flex-wrap gap-1 min-h-[36px] items-center p-1.5 bg-[#0f1923] rounded border border-gray-800/50">
            {sortedSelectedAgents.length > 0 ? (
              sortedSelectedAgents.map(agent => {
                const roleColor = ROLE_COLORS[agent.role?.displayName || ''] || '#666';
                return (
                  <img
                    key={agent.uuid}
                    src={agent.displayIcon}
                    alt={agent.displayName}
                    title={agent.displayName}
                    style={{ borderColor: roleColor }}
                    className="w-7 h-7 object-contain bg-[#1a252e] rounded p-0.5 border"
                  />
                );
              })
            ) : (
              <span className="text-[10px] text-gray-600 italic px-1">Pool is empty</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerSlot;