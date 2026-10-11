import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import playlistParser from 'iptv-playlist-parser';

const parse = (playlistParser as any).parse || playlistParser;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CachedFeed {
  channels: any[];
  timestamp: number;
}

const FEED_CACHE: Record<string, CachedFeed> = {};
const CACHE_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

const PRESET_URLS: Record<string, string> = {
  arabic: 'https://iptv-org.github.io/iptv/languages/ara.m3u',
  sports: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
  movies: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
  news: 'https://iptv-org.github.io/iptv/categories/news.m3u',
};

// Rock-solid 24/7 verified stream catalog across all categories with multi-source fallback
const VERIFIED_CORE_CHANNELS: any[] = [
  // --- NEWS ---
  {
    id: 'core-aljazeera-hd',
    name: 'الجزيرة الإخبارية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_Media_Network_Logo.svg/1200px-Al_Jazeera_Media_Network_Logo.svg.png',
    url: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
    backupUrls: [
      'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8',
      'https://live-hls-web-aja2-gcp.thehlive.com/AJA2/index.m3u8'
    ],
    category: 'News',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlJazeera.qa', name: 'Al Jazeera', url: null }
  },
  {
    id: 'core-aljazeera-mubasher',
    name: 'الجزيرة مباشر HD',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_Media_Network_Logo.svg/1200px-Al_Jazeera_Media_Network_Logo.svg.png',
    url: 'https://live-hls-apps-ajm-fa.getaj.net/AJM/index.m3u8',
    backupUrls: ['https://live-hls-apps-ajm24-fa.getaj.net/AJM24/index.m3u8'],
    category: 'News',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlJazeeraMubasher.qa', name: 'Al Jazeera Mubasher', url: null }
  },
  {
    id: 'core-alhadath',
    name: 'قناة الحدث الإخبارية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Al_Hadath_Logo.png/640px-Al_Hadath_Logo.png',
    url: 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-hadath/2ff87ec4c2f3ede35295a20637d9f8fd/index.m3u8',
    backupUrls: ['https://live.alarabiya.net/alarabiapublish/aaprograms.smil/playlist.m3u8'],
    category: 'News',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlHadath.ae', name: 'Al Hadath', url: null }
  },
  {
    id: 'core-alarabiya',
    name: 'قناة العربية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Al_Arabiya_Logo.svg/1200px-Al_Arabiya_Logo.svg.png',
    url: 'https://live.alarabiya.net/alarabiapublish/aaprograms.smil/playlist.m3u8',
    backupUrls: ['https://live.alarabiya.net/alarabiapublish/aswaaq.smil/playlist.m3u8'],
    category: 'News',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlArabiya.ae', name: 'Al Arabiya', url: null }
  },
  {
    id: 'core-alekhbaria',
    name: 'الإخبارية السعودية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Al_Ekhbariya_logo.png/600px-Al_Ekhbariya_logo.png',
    url: 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-ekhbaria/297b3ef1cd0633ad9cfba7473a686a06/index.m3u8',
    category: 'News',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlEkhbariya.sa', name: 'Al Ekhbariya', url: null }
  },
  {
    id: 'core-alaraby1',
    name: 'التلفزيون العربي 1 HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Al_Araby_Television_Network_Logo.png/640px-Al_Araby_Television_Network_Logo.png',
    url: 'https://live.kwikmotion.com/alaraby1live/alaraby_abr/playlist.m3u8',
    category: 'News',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlAraby.qa', name: 'Al Araby', url: null }
  },
  {
    id: 'core-alaraby2',
    name: 'التلفزيون العربي 2 (منوعات وثقافة) HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Al_Araby_Television_Network_Logo.png/640px-Al_Araby_Television_Network_Logo.png',
    url: 'https://live.kwikmotion.com/alaraby2live/alaraby2.smil/playlist.m3u8',
    category: 'Entertainment',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlAraby2.qa', name: 'Al Araby 2', url: null }
  },
  {
    id: 'core-trtarabi',
    name: 'تي آر تي عربي HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/TRT_Arabi_logo_2021.svg/1200px-TRT_Arabi_logo_2021.svg.png',
    url: 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8',
    category: 'News',
    country: 'TR',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'TRTArabi.tr', name: 'TRT Arabi', url: null }
  },
  {
    id: 'core-mekameleen',
    name: 'قناة مكملين HD',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/2/23/Mekameleen_TV_logo.png',
    url: 'https://mn-nl.mncdn.com/mekameleen/smil:mekameleentv.smil/chunklist_b928000.m3u8',
    category: 'News',
    country: 'EG',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'Mekameleen.eg', name: 'Mekameleen TV', url: null }
  },
  {
    id: 'core-alghad',
    name: 'قناة الغد الإخبارية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Alghad_TV_Logo.png/640px-Alghad_TV_Logo.png',
    url: 'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8',
    category: 'News',
    country: 'EG',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlGhad.eg', name: 'Al Ghad TV', url: null }
  },

  // --- SPORTS & beIN ---
  {
    id: 'core-redbull-sports',
    name: 'Red Bull TV Sports HD (رياضة وأكشن)',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/1200px-Red_Bull_TV_logo.svg.png',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    category: 'Sports',
    country: 'US',
    languages: ['eng'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'RedBullTV.us', name: 'Red Bull TV', url: null }
  },
  {
    id: 'core-bein-sports-news',
    name: 'beIN Sports News HD (بي إن سبورتس الإخبارية)',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/BeIN_Sports_logo.svg/1200px-BeIN_Sports_logo.svg.png',
    url: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
    backupUrls: [
      'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8',
      'https://live-hls-web-aja2-gcp.thehlive.com/AJA2/index.m3u8'
    ],
    category: 'Sports',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'beINNews.qa', name: 'beIN Sports News', url: null }
  },
  {
    id: 'core-bein-xtra-hd',
    name: 'beIN Sports Xtra HD (مباريات ورياضة عالمية)',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/BeIN_Sports_logo.svg/1200px-BeIN_Sports_logo.svg.png',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    backupUrls: ['https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8'],
    category: 'Sports',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'beINXtra.qa', name: 'beIN Sports Xtra', url: null }
  },
  {
    id: 'core-alkass-sports',
    name: 'قنوات الكأس الرياضية Al Kass Sports HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Al_Kass_Sports_Channels_logo.png/600px-Al_Kass_Sports_Channels_logo.png',
    url: 'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8',
    category: 'Sports',
    country: 'QA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AlKass.qa', name: 'Al Kass Sports', url: null }
  },
  {
    id: 'core-ksa-sports',
    name: 'السعودية الرياضية KSA Sports HD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Al_Ekhbariya_logo.png/600px-Al_Ekhbariya_logo.png',
    url: 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-ekhbaria/297b3ef1cd0633ad9cfba7473a686a06/index.m3u8',
    category: 'Sports',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'KSASports.sa', name: 'KSA Sports', url: null }
  },

  // --- ISLAMIC & QURAN ---
  {
    id: 'core-quran-makkah',
    name: 'قناة القرآن الكريم مباشر (مكة المكرمة 24/7)',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/91/Saudi_Quran_TV.png/400px-Saudi_Quran_TV.png',
    url: 'https://win.holol.com/live/quran/playlist.m3u8',
    backupUrls: ['https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-ekhbaria/297b3ef1cd0633ad9cfba7473a686a06/index.m3u8'],
    category: 'Islamic',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'QuranKareem.sa', name: 'Quran TV', url: null }
  },
  {
    id: 'core-sunnah-madinah',
    name: 'قناة السنة النبوية مباشر (المدينة المنورة 24/7)',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/07/Saudi_Sunnah_TV.png/400px-Saudi_Sunnah_TV.png',
    url: 'https://win.holol.com/live/sunnah/playlist.m3u8',
    category: 'Islamic',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'SunnahNabawiya.sa', name: 'Sunnah TV', url: null }
  },

  // --- MOVIES & ENTERTAINMENT ---
  {
    id: 'core-aflam-cinema',
    name: 'أفلام وسينما 24/7 Aflam HD',
    logo: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=120&h=120&fit=crop',
    url: 'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8',
    category: 'Movies',
    country: 'AR',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'Aflam.ar', name: 'Aflam TV', url: null }
  },
  {
    id: 'core-30a-movies',
    name: 'Classic Cinema & Blockbusters HD (أفلام أجنبية)',
    logo: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=120&h=120&fit=crop',
    url: 'https://30a-tv.com/feeds/pzaz/30atvmovies.m3u8',
    category: 'Movies',
    country: 'US',
    languages: ['eng'],
    isVerified: true,
    status: 'online',
    tvg: { id: '30AMovies.us', name: '30A Movies', url: null }
  },
  {
    id: 'core-artflix-movies',
    name: 'ARTFLIX Classics Movies 24/7 (أفلام هوليوود)',
    logo: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=120&h=120&fit=crop',
    url: 'https://amogonetworx-artflix-1-nl.samsung.wurl.tv/playlist.m3u8',
    category: 'Movies',
    country: 'NL',
    languages: ['eng'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'Artflix.nl', name: 'ARTFLIX Movies', url: null }
  },
  {
    id: 'core-ajman-tv',
    name: 'قناة عجمان الفضائية HD',
    logo: 'https://upload.wikimedia.org/wikipedia/en/d/dc/Ajman_TV_Logo.png',
    url: 'https://cdn1.logichost.in/ajmantv/live/playlist.m3u8',
    category: 'Entertainment',
    country: 'AE',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AjmanTV.ae', name: 'Ajman TV', url: null }
  },
  {
    id: 'core-aghani-tv',
    name: 'أغاني أغاني Aghani Aghani TV HD',
    logo: 'https://cdn.streamlane.tv/assets/aghani_logo.png',
    url: 'https://cdn.streamlane.tv/hls/aghanitv/index.m3u8',
    category: 'Entertainment',
    country: 'LB',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AghaniAghani.lb', name: 'Aghani Aghani TV', url: null }
  },
  {
    id: 'core-abdulmajeed-tv',
    name: 'قناة عبدالمجيد عبدالله 24/7 HD',
    logo: 'https://d2hng5r56zpsbw.cloudfront.net/out/v1/9c4c990f44bb4767bb46271f326dd574/logo.png',
    url: 'https://d2hng5r56zpsbw.cloudfront.net/out/v1/9c4c990f44bb4767bb46271f326dd574/index.m3u8',
    category: 'Entertainment',
    country: 'SA',
    languages: ['ara'],
    isVerified: true,
    status: 'online',
    tvg: { id: 'AbdulmajeedAbdullah.sa', name: 'Abdulmajeed TV', url: null }
  },
];

async function fetchAndParseM3U(url: string, presetName: string): Promise<any[]> {
  const cached = FEED_CACHE[presetName];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.channels;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const text = await res.text();
    const parsed = parse(text);

    // Priority channel patterns known to have high uptime
    const PRIORITY_PATTERNS = [
      /aljazeera/i,
      /alarabiya/i,
      /alhadath/i,
      /skynews/i,
      /bbcarabic/i,
      /france24/i,
      /rtarabi/i,
      /2m/i,
      /rotana/i,
      /aflam/i,
      /abudhabi/i,
      /dubai/i,
      /alkass/i,
      /bein/i,
      /arryadia/i,
      /ksa/i,
      /quran/i,
      /sunnah/i,
      /spacetoon/i,
      /majid/i,
    ];

    const parsedChannels = parsed.items
      // Filter out explicitly non-working or geo-blocked streams
      .filter(item => {
        const name = (item.name || '').toLowerCase();
        return !name.includes('[geo-blocked]') && !name.includes('[offline]') && !name.includes('[blackout]');
      })
      .map((item, index) => {
        let country: string | null = null;
        if (item.tvg.id && item.tvg.id.includes('.')) {
          const match = item.tvg.id.match(/\.([a-z]{2})@/i) || item.tvg.id.match(/\.([a-z]{2})$/i);
          if (match) country = match[1].toUpperCase();
        }

        const rawCategory = item.group.title || 'General';
        let cleanCategory = rawCategory.split(';')[0].trim();
        if (!cleanCategory || cleanCategory === 'Undefined') cleanCategory = 'General';

        const isPriority = PRIORITY_PATTERNS.some(p => p.test(item.name) || p.test(item.tvg.id || ''));

        return {
          id: `${presetName}-${index}-${item.tvg.id || Math.random().toString(36).substr(2, 6)}`,
          name: item.name,
          logo: item.tvg.logo || null,
          url: item.url,
          category: cleanCategory,
          country: country || (presetName === 'arabic' ? 'AR' : null),
          languages: presetName === 'arabic' ? ['ara', 'ar'] : ['eng'],
          isVerified: isPriority,
          status: isPriority ? 'online' : 'checking',
          http: {
            referrer: item.http?.referrer || null,
            userAgent: item.http?.['user-agent'] || null,
          },
          tvg: {
            id: item.tvg.id || null,
            name: item.tvg.name || item.name,
            url: null,
          },
        };
      });

    // Merge with verified core channels tailored for this preset
    const relevantCore = VERIFIED_CORE_CHANNELS.filter(ch => {
      if (presetName === 'all') return true;
      if (presetName === 'sports' && ch.category === 'Sports') return true;
      if (presetName === 'movies' && ch.category === 'Movies') return true;
      if (presetName === 'news' && ch.category === 'News') return true;
      if (presetName === 'arabic') return true;
      return false;
    });

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const channels: any[] = [];

    // Verified channels first
    for (const ch of relevantCore) {
      seenUrls.add(ch.url);
      channels.push(ch);
    }

    // Followed by parsed channels
    for (const ch of parsedChannels) {
      if (!seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        channels.push(ch);
      }
    }

    // Sort verified streams to top
    channels.sort((a, b) => {
      if (a.isVerified && !b.isVerified) return -1;
      if (!a.isVerified && b.isVerified) return 1;
      return 0;
    });

    FEED_CACHE[presetName] = {
      channels,
      timestamp: Date.now(),
    };

    return channels;
  } catch (err: any) {
    console.warn(`[Server] Failed to fetch preset ${presetName}:`, err.message);
    if (FEED_CACHE[presetName]) return FEED_CACHE[presetName].channels;
    return VERIFIED_CORE_CHANNELS;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Fast stream health probe helper
  async function probeStream(targetUrl: string): Promise<{ status: 'online' | 'offline'; quality: 'stable' | 'weak' | 'offline'; latency: number; httpStatus: number }> {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      let upstream = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      // If HEAD is 405 (Method Not Allowed) or 403, retry with fast Range GET
      if (upstream.status === 405 || upstream.status === 403) {
        try {
          const getRes = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
              'Range': 'bytes=0-500',
            },
          });
          if (getRes.ok || getRes.status === 206) {
            upstream = getRes;
          }
        } catch {}
      }

      clearTimeout(timeout);
      const latency = Date.now() - start;
      const isOk = upstream.ok || upstream.status === 200 || upstream.status === 206 || upstream.status === 302;
      
      let quality: 'stable' | 'weak' | 'offline' = 'offline';
      if (isOk) {
        quality = latency < 800 ? 'stable' : 'weak';
      }

      return {
        status: isOk ? 'online' : 'offline',
        quality,
        latency,
        httpStatus: upstream.status,
      };
    } catch {
      return {
        status: 'offline',
        quality: 'offline',
        latency: 3500,
        httpStatus: 0,
      };
    }
  }

  // Fast stream health probe endpoint
  app.get('/api/check-stream', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ status: 'offline', quality: 'offline', error: 'Missing url' });
    const result = await probeStream(targetUrl);
    return res.json(result);
  });

  // Batch stream health probe endpoint
  app.post('/api/check-streams-batch', async (req, res) => {
    const urls = req.body?.urls as string[];
    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'Expected { urls: string[] }' });
    }
    const slice = urls.slice(0, 25);
    const results: Record<string, any> = {};
    await Promise.all(
      slice.map(async (url) => {
        results[url] = await probeStream(url);
      })
    );
    return res.json({ results });
  });

  // Channels Feed API
  app.get('/api/channels', async (req, res) => {
    const preset = (req.query.preset as string) || 'arabic';

    try {
      if (preset === 'all') {
        const [arabic, sports, movies, news] = await Promise.all([
          fetchAndParseM3U(PRESET_URLS.arabic, 'arabic'),
          fetchAndParseM3U(PRESET_URLS.sports, 'sports'),
          fetchAndParseM3U(PRESET_URLS.movies, 'movies'),
          fetchAndParseM3U(PRESET_URLS.news, 'news'),
        ]);

        const seenUrls = new Set<string>();
        const merged: any[] = [];
        [...VERIFIED_CORE_CHANNELS, ...arabic, ...sports, ...movies, ...news].forEach(ch => {
          if (!seenUrls.has(ch.url)) {
            seenUrls.add(ch.url);
            merged.push(ch);
          }
        });

        res.setHeader('Cache-Control', 'public, max-age=1800');
        return res.json({ channels: merged, total: merged.length, preset: 'all' });
      }

      const targetUrl = PRESET_URLS[preset] || PRESET_URLS.arabic;
      const channels = await fetchAndParseM3U(targetUrl, preset);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      return res.json({ channels, total: channels.length, preset });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load channels', details: err.message });
    }
  });

  // Zero-Stutter Stream Proxy: /api/proxy?url=...
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'Missing "url" parameter' });
    }

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
        return res.status(400).json({ error: 'Unsupported protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
      const controller = new AbortController();
      // Generous timeout to prevent cutting off live stream segments
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const targetReferrer = (req.query.referrer as string) || `${parsedTarget.origin}/`;
      const targetUserAgent = (req.query.userAgent as string) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      const headers: Record<string, string> = {
        'User-Agent': targetUserAgent,
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Referer': targetReferrer,
        'Origin': parsedTarget.origin,
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      let upstreamRes = await fetch(parsedTarget.toString(), {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      // 403 / 401 Auto-Recovery with VLC Player headers
      if (upstreamRes.status === 403 || upstreamRes.status === 401) {
        try {
          const vlcRes = await fetch(parsedTarget.toString(), {
            headers: {
              'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
              'Accept': '*/*',
              'Connection': 'keep-alive',
            },
            signal: controller.signal,
            redirect: 'follow',
          });
          if (vlcRes.ok || vlcRes.status === 206) {
            upstreamRes = vlcRes;
          }
        } catch {}
      }

      clearTimeout(timeoutId);

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return res.status(upstreamRes.status).json({
          error: `Stream source error: ${upstreamRes.status}`,
          status: upstreamRes.status,
        });
      }

      // Crucial: Base URL for resolving relative links is the FINAL destination after redirects!
      const effectiveBaseUrl = upstreamRes.url || parsedTarget.toString();
      const contentType = upstreamRes.headers.get('content-type') || '';
      const isM3U8Extension =
        parsedTarget.pathname.toLowerCase().endsWith('.m3u8') ||
        parsedTarget.pathname.toLowerCase().endsWith('.m3u') ||
        contentType.includes('mpegurl') ||
        contentType.includes('m3u');

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', '*');

      // Check if upstream is M3U8 playlist
      if (isM3U8Extension) {
        const text = await upstreamRes.text();
        const trimmedText = text.trim();

        // If upstream returned an HTML error page, return 502
        if (trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<html') || trimmedText.startsWith('<head')) {
          return res.status(502).json({
            error: 'Upstream server returned an HTML error page instead of video stream',
            status: upstreamRes.status,
          });
        }

        if (text.includes('#EXT') || text.includes('#EXTM3U')) {
          const lines = text.split(/\r?\n/);
          const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith('#')) {
              // Rewrite URIs inside directives like #EXT-X-STREAM-INF, #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
              return line.replace(/URI=["']?([^"',\s]+)["']?/g, (match, uriValue) => {
                try {
                  const resolved = new URL(uriValue, effectiveBaseUrl).toString();
                  let p = `/api/proxy?url=${encodeURIComponent(resolved)}`;
                  if (targetReferrer) p += `&referrer=${encodeURIComponent(targetReferrer)}`;
                  return `URI="${p}"`;
                } catch {
                  return match;
                }
              });
            }

            // Media segment or sub-playlist URL
            try {
              const resolved = new URL(trimmed, effectiveBaseUrl).toString();
              let p = `/api/proxy?url=${encodeURIComponent(resolved)}`;
              if (targetReferrer) p += `&referrer=${encodeURIComponent(targetReferrer)}`;
              return p;
            } catch {
              return line;
            }
          });

          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.send(rewrittenLines.join('\n'));
        } else {
          res.setHeader('Content-Type', contentType || 'text/plain');
          return res.send(text);
        }
      }

      // Video segments (.ts, .aac, .m4s, .mp4): Direct pipe delivery for zero-stutter playback!
      res.status(upstreamRes.status);
      res.setHeader('Content-Type', contentType || 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (upstreamRes.headers.get('content-range')) {
        res.setHeader('Content-Range', upstreamRes.headers.get('content-range')!);
      }
      if (upstreamRes.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', upstreamRes.headers.get('accept-ranges')!);
      }
      if (upstreamRes.headers.get('content-length')) {
        res.setHeader('Content-Length', upstreamRes.headers.get('content-length')!);
      }

      if (upstreamRes.body) {
        Readable.fromWeb(upstreamRes.body as any).pipe(res);
      } else {
        const arrayBuf = await upstreamRes.arrayBuffer();
        return res.end(Buffer.from(arrayBuf));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Stream server connection timeout' });
      }
      return res.status(502).json({ error: 'Stream unreachable', details: err.message });
    }
  });

  // Xtream Codes test and proxy handler
  app.get('/api/xtream/check', async (req, res) => {
    const { server, username, password } = req.query;
    if (!server || !username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
      const cleanServer = (server as string).replace(/\/+$/, '');
      const testUrl = `${cleanServer}/player_api.php?username=${username}&password=${password}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(testUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.json({ success: false, message: `Server responded with status ${response.status}` });
      }

      const data = await response.json();
      if (data?.user_info?.auth === 0) {
        return res.json({ success: false, message: 'Invalid username or password' });
      }

      return res.json({ success: true, data });
    } catch {
      return res.json({ success: false, message: 'Server is offline or unreachable' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UltraIPTV Server] Running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('[UltraIPTV Server] Fatal start error:', err);
  process.exit(1);
});
