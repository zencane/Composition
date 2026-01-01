
export interface Agent {
  uuid: string;
  displayName: string;
  displayIcon: string;
  role: {
    displayName: string;
    displayIcon: string;
  };
}

export interface MapData {
  uuid: string;
  displayName: string;
  splash: string;
  listViewIcon: string;
}

export interface Player {
  id: string;
  name: string;
  agentPool: string[]; // Array of Agent UUIDs
  isMain: boolean;
}

export interface MapComposition {
  mapId: string;
  slots: {
    playerId: string;
    agentId: string;
  }[];
}

export interface RosterState {
  main: Player[];
  subs: Player[];
}
