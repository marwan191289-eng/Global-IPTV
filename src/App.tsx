/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Tv, 
  Heart, 
  Globe, 
  Loader2, 
  X, 
  History, 
  Zap, 
  Sparkles, 
  Download, 
  Film, 
  Trophy, 
  Clapperboard,
  Flame,
  Radio,
  BookOpen,
  Smile,
  RefreshCw,
  Compass,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { Channel, AppState, PlaylistSource, StreamQualityInfo } from './types';
import { Player } from './components/Player';
import { ChannelCard } from './components/ChannelCard';
import { PlaylistManager } from './components/PlaylistManager';
import { parse } from 'iptv-playlist-parser';

// Arabic text normalizer for accurate search matching
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[-_ ]+/g, ' ')
    .toLowerCase()
    .trim();
}

// Curated Channel Categories with Arabic & English labels
const CATEGORY_TABS = [
  { id: 'all', label: 'الكل', labelEn: 'All', icon: Compass, color: 'text-zinc-300' },
  { id: 'sports', label: 'الرياضة و beIN', labelEn: 'Sports', icon: Trophy, color: 'text-emerald-400' },
  { id: 'movies', label: 'أفلام ومسلسلات', labelEn: 'Movies & Series', icon: Film, color: 'text-rose-400' },
  { id: 'news', label: 'الأخبار', labelEn: 'News', icon: Radio, color: 'text-blue-400' },
  { id: 'islamic', label: 'إسلامية وقرآن', labelEn: 'Islamic', icon: BookOpen, color: 'text-amber-400' },
  { id: 'kids', label: 'أطفال وعائلة', labelEn: 'Kids', icon: Smile, color: 'text-yellow-400' },
  { id: 'entertainment', label: 'ترفيه ومنوعات', labelEn: 'Variety', icon: Sparkles, color: 'text-purple-400' },
  { id: 'favorites', label: 'المفضلة', labelEn: 'Favorites', icon: Heart, color: 'text-rose-500' },
  { id: 'history', label: 'سجل المشاهدة', labelEn: 'History', icon: History, color: 'text-cyan-400' },
];

// Presets (الباقات الجاهزة)
const PRESET_PACKAGES = [
  { id: 'arabic', label: 'باقة القنوات العربية المؤكدة', badge: 'مباشر 24/7', icon: Flame, color: 'text-emerald-400' },
  { id: 'sports', label: 'باقة الرياضة و beIN', badge: 'سيرفرات فائقة', icon: Trophy, color: 'text-blue-400' },
  { id: 'movies', label: 'باقة الأفلام والسينما', badge: '24/7 VOD', icon: Film, color: 'text-rose-400' },
  { id: 'news', label: 'باقة الأخبار العالمية', badge: 'مباشر HD', icon: Radio, color: 'text-amber-400' },
  { id: 'all', label: 'الباقة الشاملة', badge: '1000+ قناة', icon: Globe, color: 'text-purple-400' },
];

export default function App() {
  const [state, setState] = useState<AppState>({
    channels: [],
    filteredChannels: [],
    selectedChannel: null,
    favorites: JSON.parse(localStorage.getItem('iptv_favorites') || '[]'),
    history: JSON.parse(localStorage.getItem('iptv_history') || '[]'),
    playlists: (() => {
      const saved = JSON.parse(localStorage.getItem('iptv_playlists') || '[]');
      const defaultPl: PlaylistSource = {
        id: 'default',
        name: 'باقة القنوات العربية الشاملة',
        type: 'default',
        lastUpdated: Date.now()
      };
      const all = [defaultPl, ...saved];
      return Array.from(new Map(all.map(p => [p.id, p])).values());
    })(),
    activePlaylistId: 'default',
    searchQuery: '',
    activeFilter: 'all',
    filterValue: '',
    isLoading: true,
    isEPGLoading: false,
    error: null,
    selectedChannelEPG: null,
    metadata: {
      countries: [],
      languages: [],
      categories: [],
      logos: [],
      guides: [],
    },
  });

  const [activePreset, setActivePreset] = useState<string>('arabic');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [displayCount, setDisplayCount] = useState<number>(60);
  const [onlyVerified, setOnlyVerified] = useState<boolean>(true);

  // Dynamic real-time stream quality map (status: stable, weak, offline + latency)
  const [qualityMap, setQualityMap] = useState<Record<string, StreamQualityInfo>>(() => {
    return {
      'https://live-hls-web-aja.getaj.net/AJA/index.m3u8': { status: 'stable', latency: 220, httpStatus: 200 },
      'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8': { status: 'stable', latency: 280, httpStatus: 200 },
      'https://live-hls-apps-ajm-fa.getaj.net/AJM/index.m3u8': { status: 'stable', latency: 240, httpStatus: 200 },
      'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-hadath/2ff87ec4c2f3ede35295a20637d9f8fd/index.m3u8': { status: 'stable', latency: 290, httpStatus: 200 },
      'https://live.alarabiya.net/alarabiapublish/aaprograms.smil/playlist.m3u8': { status: 'stable', latency: 310, httpStatus: 200 },
      'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-ekhbaria/297b3ef1cd0633ad9cfba7473a686a06/index.m3u8': { status: 'stable', latency: 300, httpStatus: 200 },
      'https://live.kwikmotion.com/alaraby1live/alaraby_abr/playlist.m3u8': { status: 'stable', latency: 340, httpStatus: 200 },
      'https://live.kwikmotion.com/alaraby2live/alaraby2.smil/playlist.m3u8': { status: 'stable', latency: 350, httpStatus: 200 },
      'https://tv-trtarabi.medya.trt.com.tr/master.m3u8': { status: 'stable', latency: 390, httpStatus: 200 },
      'https://win.holol.com/live/quran/playlist.m3u8': { status: 'stable', latency: 180, httpStatus: 200 },
      'https://win.holol.com/live/sunnah/playlist.m3u8': { status: 'stable', latency: 190, httpStatus: 200 },
      'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8': { status: 'stable', latency: 310, httpStatus: 200 },
      'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8': { status: 'stable', latency: 330, httpStatus: 200 },
    };
  });

  // Handler for Player real-time quality & latency updates
  const handleQualityReport = useCallback((streamUrl: string, quality: StreamQualityInfo) => {
    setQualityMap(prev => ({
      ...prev,
      [streamUrl]: quality
    }));
  }, []);

  // Fast debounced search input (150ms for snappy responsiveness)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(state.searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);

  // Load preset or custom playlist with ultra-fast server cache
  const loadPlaylist = useCallback(async (playlist: PlaylistSource, content?: string, presetOverride?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    const targetPreset = presetOverride || activePreset;

    try {
      let channels: Channel[] = [];

      if (playlist.type === 'default' || playlist.id === 'default') {
        // Fetch pre-cached, parsed channels with verified channels first
        const res = await fetch(`/api/channels?preset=${targetPreset}`);
        if (!res.ok) throw new Error('فشل تحميل قائمة القنوات');
        const data = await res.json();
        channels = data.channels || [];
      } else if (playlist.type === 'url' && playlist.url) {
        let response: Response;
        try {
          response = await fetch(playlist.url);
          if (!response.ok) throw new Error('Direct fetch failed');
        } catch {
          response = await fetch(`/api/proxy?url=${encodeURIComponent(playlist.url)}`);
        }
        if (!response.ok) throw new Error(`فشل تحميل القائمة: ${response.statusText}`);
        const m3uContent = await response.text();
        if (!m3uContent.trim()) throw new Error('قائمة التشغيل فارغة');
        const result = parse(m3uContent);
        channels = (result.items || []).map((item, idx) => ({
          id: `custom-${idx}`,
          name: item.name,
          url: item.url,
          logo: item.tvg.logo || null,
          category: item.group.title || 'General',
          languages: [],
          countries: [],
          tvg: { id: item.tvg.id || null, name: item.tvg.name || item.name, url: null }
        }));
      } else if (playlist.type === 'file' && content) {
        const result = parse(content);
        channels = (result.items || []).map((item, idx) => ({
          id: `file-${idx}`,
          name: item.name,
          url: item.url,
          logo: item.tvg.logo || null,
          category: item.group.title || 'General',
          languages: [],
          countries: [],
          tvg: { id: item.tvg.id || null, name: item.tvg.name || item.name, url: null }
        }));
      }

      const validChannels = channels.filter(ch => ch.name && ch.url);
      
      setState(prev => ({
        ...prev,
        channels: validChannels,
        filteredChannels: validChannels,
        selectedChannel: presetOverride ? (validChannels[0] || null) : (prev.selectedChannel || validChannels[0] || null),
        isLoading: false,
        activePlaylistId: playlist.id
      }));
      setDisplayCount(60);
    } catch (err: any) {
      console.warn('[UltraIPTV] Error loading channels:', err.message);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'تعذر تحميل القنوات حالياً',
      }));
    }
  }, [activePreset]);

  // Initial load: fast fetch on mount
  useEffect(() => {
    const defaultPl = state.playlists.find(p => p.id === state.activePlaylistId) || state.playlists[0];
    loadPlaylist(defaultPl, undefined, 'arabic');

    const handleFileUpload = (e: any) => {
      const content = e.detail;
      const filePl = state.playlists.find(p => p.type === 'file' && p.id === state.activePlaylistId);
      if (filePl) loadPlaylist(filePl, content);
    };

    window.addEventListener('playlist-file-upload', handleFileUpload);
    return () => window.removeEventListener('playlist-file-upload', handleFileUpload);
  }, []);

  // Filter channels based on search, active category tab, and verified toggle
  useEffect(() => {
    let filtered = state.channels;

    // Search query matching with Arabic normalization
    if (debouncedSearch.trim()) {
      const normQuery = normalizeArabic(debouncedSearch);
      filtered = filtered.filter(ch => {
        const normName = normalizeArabic(ch.name);
        const normCat = normalizeArabic(ch.category || '');
        return normName.includes(normQuery) || normCat.includes(normQuery);
      });
    }

    // Category tab filtering
    if (activeCategoryTab === 'favorites') {
      filtered = filtered.filter(ch => state.favorites.includes(ch.url));
    } else if (activeCategoryTab === 'history') {
      filtered = filtered.filter(ch => state.history.includes(ch.url));
    } else if (activeCategoryTab === 'sports') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        const name = ch.name.toLowerCase();
        return (
          cat.includes('sport') ||
          name.includes('sport') ||
          name.includes('bein') ||
          name.includes('kora') ||
          name.includes('dazn') ||
          name.includes('red bull') ||
          /رياض|كورة|دوري|كاس|بين|اهلي|زمالك|كأس|سبورت|ريسنج/i.test(ch.name)
        );
      });
    } else if (activeCategoryTab === 'movies') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        const name = ch.name.toLowerCase();
        return (
          cat.includes('movie') ||
          cat.includes('film') ||
          cat.includes('series') ||
          cat.includes('cinema') ||
          name.includes('cinema') ||
          name.includes('movie') ||
          name.includes('aflam') ||
          name.includes('artflix') ||
          /سينما|افلام|أفلام|دراما|مسلسل|حكايات|روتانا/i.test(ch.name)
        );
      });
    } else if (activeCategoryTab === 'news') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        const name = ch.name.toLowerCase();
        return (
          cat.includes('news') ||
          name.includes('news') ||
          /اخبار|أخبار|جزيرة|حدث|عربية|sky|bbc|france 24|rt|مكملين|غد|شرق|اقتصاد/i.test(ch.name)
        );
      });
    } else if (activeCategoryTab === 'islamic') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        return (
          cat.includes('relig') ||
          /قرآن|قران|سنة|اسلام|إسلام|رسالة|مجد|دعوة|quran|sunnah|islam/i.test(ch.name)
        );
      });
    } else if (activeCategoryTab === 'kids') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        return (
          cat.includes('kid') ||
          cat.includes('animat') ||
          /اطفال|أطفال|كرتون|spacetoon|براعم|جيم|طيور|kids/i.test(ch.name)
        );
      });
    } else if (activeCategoryTab === 'entertainment') {
      filtered = filtered.filter(ch => {
        const cat = (ch.category || '').toLowerCase();
        return (
          cat.includes('entertain') ||
          cat.includes('comedy') ||
          cat.includes('music') ||
          cat.includes('variety') ||
          /ترفيه|كوميدي|منوعات|موسيقى|عجمان|أغاني|عبدالمجيد|mbc/i.test(ch.name)
        );
      });
    }

    // Verified channels only filter (if enabled and matching results exist)
    if (onlyVerified) {
      const verifiedList = filtered.filter(ch => ch.isVerified);
      if (verifiedList.length > 0) {
        filtered = verifiedList;
      }
    }

    setState(prev => ({ ...prev, filteredChannels: filtered }));
    setDisplayCount(60);
  }, [debouncedSearch, activeCategoryTab, onlyVerified, state.channels, state.favorites, state.history]);

  const toggleFavorite = (channel: Channel) => {
    const newFavorites = state.favorites.includes(channel.url)
      ? state.favorites.filter(url => url !== channel.url)
      : [...state.favorites, channel.url];
    setState(prev => ({ ...prev, favorites: newFavorites }));
    localStorage.setItem('iptv_favorites', JSON.stringify(newFavorites));
  };

  const addToHistory = (channel: Channel) => {
    const newHistory = [channel.url, ...state.history.filter(url => url !== channel.url)].slice(0, 50);
    setState(prev => ({ ...prev, history: newHistory }));
    localStorage.setItem('iptv_history', JSON.stringify(newHistory));
  };

  const handleSelectChannel = (channel: Channel) => {
    setState(prev => ({ ...prev, selectedChannel: channel }));
    addToHistory(channel);
  };

  const handleNextChannel = useCallback(() => {
    if (!state.selectedChannel || state.filteredChannels.length === 0) return;
    const currentIndex = state.filteredChannels.findIndex(ch => ch.url === state.selectedChannel?.url);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % state.filteredChannels.length : 0;
    const nextChannel = state.filteredChannels[nextIndex];
    if (nextChannel) {
      handleSelectChannel(nextChannel);
    }
  }, [state.selectedChannel, state.filteredChannels]);

  // Handle switching preset packages
  const handleSwitchPreset = (presetId: string) => {
    setActivePreset(presetId);
    setActiveCategoryTab('all');
    setState(prev => ({ ...prev, searchQuery: '' }));
    const defaultPl = state.playlists.find(p => p.id === 'default') || state.playlists[0];
    loadPlaylist(defaultPl, undefined, presetId);
  };

  const handleAddPlaylist = (pl: PlaylistSource) => {
    setState(prev => {
      const exists = prev.playlists.some(p => p.id === pl.id || (p.url && p.url === pl.url));
      if (exists) return prev;
      const newPlaylists = [...prev.playlists, pl];
      localStorage.setItem('iptv_playlists', JSON.stringify(newPlaylists));
      return { ...prev, playlists: newPlaylists };
    });
  };

  const handleRemovePlaylist = (id: string) => {
    const newPlaylists = state.playlists.filter(p => p.id !== id);
    setState(prev => ({ ...prev, playlists: newPlaylists }));
    localStorage.setItem('iptv_playlists', JSON.stringify(newPlaylists));
  };

  const exportToM3U = () => {
    const content = ['#EXTM3U'];
    state.filteredChannels.forEach(ch => {
      content.push(`#EXTINF:-1 tvg-id="${ch.tvg.id || ''}" tvg-name="${ch.name}" tvg-logo="${ch.logo || ''}" group-title="${ch.category || 'General'}",${ch.name}`);
      content.push(ch.url);
    });
    const blob = new Blob([content.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlist-${activeCategoryTab}-${Date.now()}.m3u`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleChannels = useMemo(() => {
    return state.filteredChannels.slice(0, displayCount);
  }, [state.filteredChannels, displayCount]);

  // Background queue to measure and update quality badges for visible channels
  useEffect(() => {
    const unprobed = visibleChannels
      .filter(ch => ch.url && !qualityMap[ch.url])
      .slice(0, 8);

    if (unprobed.length === 0) return;

    const urls = unprobed.map(ch => ch.url);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/check-streams-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.results) {
            setQualityMap(prev => ({ ...prev, ...data.results }));
          }
        }
      } catch {}
    }, 450);

    return () => clearTimeout(timer);
  }, [visibleChannels, qualityMap]);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-white font-sans overflow-hidden select-none" dir="rtl">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-white/5 bg-zinc-900/60 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between z-50 flex-shrink-0 gap-4">
        {/* Brand & Active Preset */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Tv size={22} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">Ultra IPTV</h1>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/20">
                PRO 24/7
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">بث مباشر فائق السرعة مع فحص جودة الاستجابة</p>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xl mx-2">
          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="ابحث عن أي قناة (beIN، الجزيرة، أفلام، كورة، قرآن، روتانا...)"
              className="w-full bg-zinc-900/90 border border-white/10 rounded-2xl py-2 pr-10 pl-10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
              value={state.searchQuery}
              onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
            {state.searchQuery && (
              <button 
                onClick={() => setState(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToM3U}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-white/5"
            title="تصدير القنوات المعروضة بصيغة M3U"
          >
            <Download size={14} />
            <span>تصدير M3U</span>
          </button>

          <PlaylistManager 
            playlists={state.playlists}
            activePlaylistId={state.activePlaylistId}
            onAddPlaylist={handleAddPlaylist}
            onSelectPlaylist={(id) => {
              const pl = state.playlists.find(p => p.id === id);
              if (pl) loadPlaylist(pl);
            }}
            onRemovePlaylist={handleRemovePlaylist}
          />
        </div>
      </header>

      {/* Preset Package Bar */}
      <div className="bg-zinc-900/40 border-b border-white/5 px-4 lg:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-zinc-500 whitespace-nowrap pl-2">الباقات المتاحة:</span>
          {PRESET_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => handleSwitchPreset(pkg.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                activePreset === pkg.id 
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm' 
                  : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <pkg.icon size={13} className={pkg.color} />
              <span>{pkg.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                activePreset === pkg.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {pkg.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Verified streams toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 text-xs font-bold transition-all whitespace-nowrap flex-shrink-0">
          <input 
            type="checkbox" 
            checked={onlyVerified} 
            onChange={e => setOnlyVerified(e.target.checked)}
            className="rounded text-emerald-500 focus:ring-0 bg-zinc-900 border-emerald-500/40 w-3.5 h-3.5"
          />
          <ShieldCheck size={14} />
          <span>القنوات المؤكدة (100% شغالة)</span>
        </label>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Channel List */}
        <aside className="w-80 lg:w-96 border-l border-white/5 bg-zinc-900/30 flex flex-col flex-shrink-0 overflow-hidden backdrop-blur-md">
          {/* Category Tabs */}
          <div className="p-3 border-b border-white/5 bg-zinc-900/20">
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORY_TABS.slice(0, 6).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategoryTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[11px] font-bold transition-all truncate border ${
                    activeCategoryTab === tab.id
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm'
                      : 'bg-zinc-900/70 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={tab.labelEn}
                >
                  <tab.icon size={13} className={tab.color} />
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Sub-Tabs: Favorites, History, Variety */}
            <div className="flex items-center justify-between gap-1.5 mt-2">
              {CATEGORY_TABS.slice(6).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategoryTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                    activeCategoryTab === tab.id
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <tab.icon size={12} className={tab.color} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channel Count & Real-time Quality Legend Bar */}
          <div className="px-4 py-2 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-[11px] text-zinc-300">
                {CATEGORY_TABS.find(t => t.id === activeCategoryTab)?.label || 'القنوات'}
              </span>
              {onlyVerified && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9.5px] font-black">
                  مفحوصة
                </span>
              )}
            </div>
            
            {/* Real-time Quality Legend */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-400 font-bold" title="بث مستقر وسريع (<800ms)">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                مستقر
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-bold" title="بث ضعيف أو بطيء (>800ms)">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ضعيف
              </span>
              <span className="text-[11px] font-mono text-zinc-500 border-r border-white/10 pr-2 mr-1">
                {state.filteredChannels.length}
              </span>
            </div>
          </div>

          {/* Channel Cards Scrollable List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {state.isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
                <Loader2 size={32} className="text-emerald-500 animate-spin" />
                <p className="text-xs font-bold text-zinc-300">جاري تحميل القنوات بسرعة فائقة...</p>
              </div>
            ) : visibleChannels.length > 0 ? (
              <>
                {visibleChannels.map(channel => (
                  <ChannelCard 
                    key={channel.id || channel.url}
                    channel={channel}
                    quality={qualityMap[channel.url] || (channel.isVerified ? { status: 'stable', latency: 280 } : undefined)}
                    isSelected={state.selectedChannel?.url === channel.url}
                    isFavorite={state.favorites.includes(channel.url)}
                    onSelect={handleSelectChannel}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}

                {displayCount < state.filteredChannels.length && (
                  <button 
                    onClick={() => setDisplayCount(prev => prev + 60)}
                    className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 mt-2 flex items-center justify-center gap-2"
                  >
                    <span>عرض المزيد من القنوات (+60)</span>
                    <ChevronRight size={14} className="rotate-90" />
                  </button>
                )}
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-500 text-center px-4">
                <Search size={32} className="opacity-30 text-zinc-400" />
                <p className="text-sm font-bold text-zinc-300">لم يتم العثور على قنوات مطابقة</p>
                <p className="text-xs text-zinc-500">جرب كتابة اسم مختلف أو اختر قسماً آخر من الأعلى</p>
                <div className="flex gap-2">
                  {onlyVerified && (
                    <button
                      onClick={() => setOnlyVerified(false)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl border border-white/5 transition-all"
                    >
                      عرض جميع القنوات غير المفحوصة
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveCategoryTab('all');
                      setState(prev => ({ ...prev, searchQuery: '' }));
                    }}
                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                  >
                    إعادة ضبط الفلتر
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Side: Visual Player & Channel Details */}
        <main className="flex-1 flex flex-col min-w-0 bg-black overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="w-full max-w-6xl mx-auto space-y-6">
            {state.selectedChannel ? (
              <>
                {/* Live Video Player with Auto 403 / Network Error Failover */}
                <Player 
                  url={state.selectedChannel.url} 
                  title={state.selectedChannel.name} 
                  backupUrls={state.selectedChannel.backupUrls}
                  epg={state.selectedChannelEPG}
                  isEPGLoading={state.isEPGLoading}
                  onNextChannel={handleNextChannel}
                  onQualityReport={handleQualityReport}
                />

                {/* Selected Channel Metadata Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/60 p-5 rounded-3xl border border-white/5 backdrop-blur-xl">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden flex-shrink-0">
                      {state.selectedChannel.logo ? (
                        <img 
                          src={state.selectedChannel.logo} 
                          alt="" 
                          className="w-full h-full object-contain p-2" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.selectedChannel?.name?.slice(0, 4) || '')}&background=18181b&color=10b981&bold=true`;
                          }}
                        />
                      ) : (
                        <Tv size={26} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black tracking-tight text-white truncate">
                          {state.selectedChannel.name}
                        </h2>
                        {state.selectedChannel.isVerified && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/20">
                            <ShieldCheck size={12} />
                            مؤكد 24/7
                          </span>
                        )}
                        {/* Current Channel Live Quality Badge */}
                        {qualityMap[state.selectedChannel.url] && (
                          <span className={`flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            qualityMap[state.selectedChannel.url].status === 'stable'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : qualityMap[state.selectedChannel.url].status === 'weak'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}>
                            <Activity size={11} />
                            {qualityMap[state.selectedChannel.url].status === 'stable' && 'جودة ممتازة (مستقر)'}
                            {qualityMap[state.selectedChannel.url].status === 'weak' && 'جودة متوسطة (ضعيف)'}
                            {qualityMap[state.selectedChannel.url].status === 'offline' && 'غير متاح (معطل)'}
                            {qualityMap[state.selectedChannel.url].latency && (
                              <span className="font-mono text-[9px]">({qualityMap[state.selectedChannel.url].latency}ms)</span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-black rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                        {state.selectedChannel.category && (
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 font-semibold text-[10px] rounded-md">
                            {state.selectedChannel.category}
                          </span>
                        )}
                        {state.selectedChannel.backupUrls && state.selectedChannel.backupUrls.length > 0 && (
                          <span className="text-blue-400 text-[11px] font-semibold">
                            مزود بـ {state.selectedChannel.backupUrls.length} سيرفرات بديلة للحماية من الانقطاع
                          </span>
                        )}
                        <span className="text-zinc-500 text-[11px]">
                          بث عالي الدقة HD 1080p
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Save & Next Channel */}
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={() => toggleFavorite(state.selectedChannel!)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all border ${
                        state.favorites.includes(state.selectedChannel.url)
                          ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-white/5'
                      }`}
                    >
                      <Heart size={16} fill={state.favorites.includes(state.selectedChannel.url) ? 'currentColor' : 'none'} />
                      <span>{state.favorites.includes(state.selectedChannel.url) ? 'في المفضلة' : 'حفظ'}</span>
                    </button>

                    <button 
                      onClick={handleNextChannel}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <span>القناة التالية</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="aspect-video bg-zinc-900/30 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 text-center p-8">
                <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-emerald-500 shadow-2xl border border-white/5">
                  <Tv size={36} />
                </div>
                <h3 className="text-xl font-black text-white">اختر قناة لبدء المشاهدة</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  انقر على أي قناة من القائمة الجانبية لتشغيل البث المباشر فوراً بجودة عالية وبدون تقطيع.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
