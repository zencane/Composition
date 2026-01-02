
import { Agent, MapData } from '../types';

const API_BASE = 'https://valorant-api.com/v1';

export const fetchAgents = async (): Promise<Agent[]> => {
  const response = await fetch(`${API_BASE}/agents?isPlayableCharacter=true`);
  const json = await response.json();
  return json.data;
};

export const fetchMaps = async (): Promise<MapData[]> => {
  const response = await fetch(`${API_BASE}/maps`);
  const json = await response.json();
  return json.data.filter((map: any) => 
    map.displayName !== 'The Range' && 
    map.displayName !== 'Basic Training' &&
    map.coordinates && 
    map.splash 
  );
};
