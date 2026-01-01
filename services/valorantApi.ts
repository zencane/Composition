
import { Agent, MapData } from '../types';

const API_BASE = 'https://valorant-api.com/v1';

export const fetchAgents = async (): Promise<Agent[]> => {
  const response = await fetch(`${API_BASE}/agents?isPlayableCharacter=true`);
  const json = await response.json();
  // Filter out the 'Sova' duplicate if any (though API usually handles it, sometimes duplicates appear)
  return json.data;
};

export const fetchMaps = async (): Promise<MapData[]> => {
  const response = await fetch(`${API_BASE}/maps`);
  const json = await response.json();
  // Only include tactical maps that have a splash and valid coordinates (standard competitive maps)
  // Non-competitive maps like 'The Range', 'Glitch', or TDM maps usually lack specific metadata
  return json.data.filter((map: any) => 
    map.displayName !== 'The Range' && 
    map.displayName !== 'Basic Training' &&
    map.coordinates && // Standard maps usually have coordinates
    map.splash // Standard maps have splash images
  );
};
