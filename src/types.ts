export type StreamQualityStatus = 'stable' | 'weak' | 'offline' | 'checking';

export interface StreamQualityInfo {
  status: StreamQualityStatus;
  latency?: number; // latency in ms
  httpStatus?: number;
  lastChecked?: number;
}

export interface Channel {
  id?: string;
  name: string;
  logo: string | null;
  url: string;
  backupUrls?: string[];
  isVerified?: boolean;
  status?: 'online' | 'offline' | 'checking';
  quality?: StreamQualityInfo;
  category?: string | null;
  categories?: string[];
  languages?: string[];
  country?: string | null;
  countries?: string[];
  http?: {
    referrer?: string | null;
    userAgent?: string | null;
  };
  tvg: {
    id: string | null;
    name: string | null;
    url: string | null;
  };
}

export interface PlaylistSource {
  id: string;
  name: string;
  url?: string;
  type: 'url' | 'file' | 'default';
  lastUpdated: number;
}

export type FilterType = 'all' | 'category' | 'country' | 'language' | 'favorites' | 'history';

export interface Country {
  name: string;
  code: string;
  languages: string[];
  flag: string;
}

export interface Language {
  name: string;
  code: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Logo {
  channel: string;
  url: string;
}

export interface Guide {
  channel: string;
  site: string;
  site_id: string;
  site_name: string;
  lang: string;
  url: string;
}

export interface Program {
  start: string;
  stop: string;
  title: string;
  desc?: string;
  category?: string;
}

export interface ChannelEPG {
  channelId: string;
  programs: Program[];
  lastUpdated: number;
}

export interface AppState {
  channels: Channel[];
  filteredChannels: Channel[];
  selectedChannel: Channel | null;
  selectedChannelEPG: ChannelEPG | null;
  favorites: string[]; 
  history: string[]; // URLs of recently played channels
  searchQuery: string;
  activeFilter: FilterType;
  filterValue: string;
  isLoading: boolean;
  isEPGLoading: boolean;
  error: string | null;
  playlists: PlaylistSource[];
  activePlaylistId: string;
  metadata: {
    countries: Country[];
    languages: Language[];
    categories: Category[];
    logos: Logo[];
    guides: Guide[];
  };
}
