import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { ChannelEPG, StreamQualityInfo } from '../types';
import { 
  Maximize, 
  Minimize, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Volume1,
  MonitorPlay,
  Settings,
  Info,
  Zap,
  Loader2,
  Calendar,
  Clock,
  SkipForward,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft
} from 'lucide-react';

interface PlayerProps {
  url: string;
  title: string;
  backupUrls?: string[];
  onEnded?: () => void;
  epg?: ChannelEPG | null;
  isEPGLoading?: boolean;
  onNextChannel?: () => void;
  onQualityReport?: (url: string, quality: StreamQualityInfo) => void;
}

export const Player: React.FC<PlayerProps> = ({ 
  url, 
  title, 
  backupUrls = [], 
  onEnded, 
  epg, 
  isEPGLoading, 
  onNextChannel,
  onQualityReport
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Candidate URLs: primary URL + any backupUrls provided
  const candidateUrls = [url, ...backupUrls].filter(Boolean);
  const [activeUrlIndex, setActiveUrlIndex] = useState(0);
  const currentStreamUrl = candidateUrls[activeUrlIndex] || url;

  // Status & failover notice banner
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [autoSkipCountdown, setAutoSkipCountdown] = useState<number | null>(null);
  const [autoSkipEnabled, setAutoSkipEnabled] = useState(true);

  // Auto-enable proxy if webpage is HTTPS and stream URL is HTTP (to prevent Mixed Content block)
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.protocol === 'https:' && currentStreamUrl.startsWith('http://');
  });

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(0);
  const loadStartTimeRef = useRef<number>(Date.now());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noticeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset fallback index when the main channel URL prop changes
  useEffect(() => {
    setActiveUrlIndex(0);
    setError(null);
    setStatusNotice(null);
    setAutoSkipCountdown(null);
    loadStartTimeRef.current = Date.now();
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
      setUseProxy(true);
    }
  }, [url]);

  // Main video initialization and automatic failover handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    loadStartTimeRef.current = Date.now();

    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpUrl = currentStreamUrl.startsWith('http://');
    const shouldProxy = useProxy || (isHttpsPage && isHttpUrl);
    const activePlaybackUrl = shouldProxy 
      ? `/api/proxy?url=${encodeURIComponent(currentStreamUrl)}` 
      : currentStreamUrl;

    // Helper: switch to the next backup URL in candidateUrls
    const failoverToNextBackup = (reason: string, httpCode?: number) => {
      // Report offline quality for the failed URL
      onQualityReport?.(currentStreamUrl, {
        status: 'offline',
        httpStatus: httpCode || 0,
        lastChecked: Date.now(),
      });

      if (activeUrlIndex + 1 < candidateUrls.length) {
        const nextIndex = activeUrlIndex + 1;
        console.warn(`[Player] ${reason}. Auto-switching to backup link ${nextIndex + 1}/${candidateUrls.length}:`, candidateUrls[nextIndex]);
        
        setStatusNotice(`تعذر البث (${reason}) - جاري التبديل التلقائي إلى السيرفر البديل (${nextIndex + 1}/${candidateUrls.length})...`);
        if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = setTimeout(() => setStatusNotice(null), 5000);

        setActiveUrlIndex(nextIndex);
        setRetryKey(k => k + 1);
        hls?.destroy();
        return true;
      }

      // If no more backup links are left, check if we can try proxy
      if (!shouldProxy) {
        console.info('[Player] All direct links failed, attempting Stream Proxy...');
        setStatusNotice('محاولة تشغيل البث عبر سيرفر البروكسي لتجاوز الحظر...');
        setUseProxy(true);
        setRetryKey(k => k + 1);
        return true;
      }

      return false;
    };

    const initPlayer = () => {
      setError(null);
      setIsBuffering(true);

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 15,
          maxLiveSyncPlaybackRate: 1.0,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1024 * 1024,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          manifestLoadingTimeOut: 12000,
          manifestLoadingMaxRetry: 3,
          manifestLoadingRetryDelay: 800,
          levelLoadingTimeOut: 12000,
          levelLoadingMaxRetry: 3,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 4,
          startLevel: -1,
          abrEwmaDefaultEstimate: 800000,
        });

        hls.loadSource(activePlaybackUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          setError(null);
          const latency = Math.max(60, Date.now() - loadStartTimeRef.current);
          const quality = latency < 800 ? 'stable' : 'weak';

          onQualityReport?.(currentStreamUrl, {
            status: quality,
            latency,
            httpStatus: 200,
            lastChecked: Date.now(),
          });

          if (activeUrlIndex > 0) {
            setStatusNotice(`تم تشغيل السيرفر البديل بنجاح (${activeUrlIndex + 1}/${candidateUrls.length})`);
            if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
            noticeTimeoutRef.current = setTimeout(() => setStatusNotice(null), 3500);
          }

          video.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          setIsBuffering(false);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          const httpCode = data.response?.code;
          const is403OrBlocked = httpCode === 403 || httpCode === 401 || httpCode === 404;
          const isNetworkError = data.type === Hls.ErrorTypes.NETWORK_ERROR;

          console.warn('[Player] HLS event notice:', data.type, data.details, httpCode);

          // Fast auto-failover on 403/Forbidden, 404/Not Found, or Network Error
          if (is403OrBlocked || (data.fatal && isNetworkError)) {
            const reason = httpCode === 403 
              ? 'خطأ 403 (محظور)' 
              : httpCode === 404 
              ? 'خطأ 404 (الرابط غير متاح)' 
              : 'خطأ شبكة Network Error';

            const switched = failoverToNextBackup(reason, httpCode);
            if (switched) return;
          }

          // If error is fatal and could not be switched to backup
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              console.info('[Player] Recovering media error...');
              hls?.recoverMediaError();
              return;
            }

            // Attempt failover one more time for any fatal error
            const switched = failoverToNextBackup('انقطاع البث', httpCode);
            if (switched) return;

            let message = 'البث غير متوفر حالياً: السيرفر متوقف أو لا يستجيب.';
            if (httpCode === 403) {
              message = 'تم حظر الرابط من مزود البث (403 Forbidden). تم تجربة كافة السيرفرات البديلة.';
            } else if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
              message = shouldProxy 
                ? 'تعذر الوصول إلى مزود البث بعد فحص الروابط البديلة.' 
                : 'تم حظر الرابط من المتصفح (CORS/Network Error). يمكنك تجربة وضع البروكسي.';
            }

            setError(message);
            setIsBuffering(false);
            hls?.destroy();

            // Auto-skip countdown if user has onNextChannel
            if (autoSkipEnabled && onNextChannel) {
              setAutoSkipCountdown(4);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activePlaybackUrl;
        video.onerror = () => {
          const switched = failoverToNextBackup('خطأ في تشغيل البث');
          if (!switched) {
            setError('تعذر تشغيل البث عبر متصفحك.');
            setIsBuffering(false);
            if (autoSkipEnabled && onNextChannel) setAutoSkipCountdown(4);
          }
        };
      }
    };

    initPlayer();

    const handlePiPChange = () => {
      setIsPiPActive(document.pictureInPictureElement === video);
    };

    video.addEventListener('enterpictureinpicture', handlePiPChange);
    video.addEventListener('leavepictureinpicture', handlePiPChange);

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener('enterpictureinpicture', handlePiPChange);
      video.removeEventListener('leavepictureinpicture', handlePiPChange);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, [url, currentStreamUrl, activeUrlIndex, retryKey, useProxy, autoSkipEnabled, onNextChannel]);

  // Auto-skip countdown timer logic
  useEffect(() => {
    if (autoSkipCountdown === null) return;
    if (autoSkipCountdown <= 0) {
      setAutoSkipCountdown(null);
      if (onNextChannel) onNextChannel();
      return;
    }

    countdownIntervalRef.current = setTimeout(() => {
      setAutoSkipCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearTimeout(countdownIntervalRef.current);
    };
  }, [autoSkipCountdown, onNextChannel]);

  // Anti-Endless Buffering Watchdog
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      if (cur !== lastTimeRef.current) {
        lastTimeRef.current = cur;
        if (isBuffering) setIsBuffering(false);
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) setVolume(0);
      else {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen();
  };

  const syncToLive = () => {
    if (videoRef.current) {
      const seekable = videoRef.current.seekable;
      if (seekable.length > 0) {
        videoRef.current.currentTime = seekable.end(seekable.length - 1);
      }
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture();
    } catch (err) {
      console.error('PiP failed', err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 'n':
          if (onNextChannel) {
            e.preventDefault();
            onNextChannel();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, isPiPActive, onNextChannel]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const getCurrentProgram = () => {
    if (!epg) return null;
    const now = new Date();
    return epg.programs.find(p => {
      const start = new Date(p.start);
      const stop = new Date(p.stop);
      return now >= start && now <= stop;
    });
  };

  const getUpcomingPrograms = () => {
    if (!epg) return [];
    const now = new Date();
    return epg.programs
      .filter(p => new Date(p.start) > now)
      .slice(0, 5);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentProgram = getCurrentProgram();
  const upcomingPrograms = getUpcomingPrograms();

  return (
    <div className="space-y-6">
      <div 
        ref={containerRef}
        className="relative group bg-black rounded-2xl overflow-hidden shadow-2xl video-aspect border border-white/5"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onPlay={() => {
            setIsPlaying(true);
            setError(null);
            setIsBuffering(false);
          }}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onLoadStart={() => setIsBuffering(true)}
          onCanPlay={() => setIsBuffering(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
        />

        {/* Failover / Backup switch notice banner */}
        {statusNotice && !error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-zinc-900/95 border border-emerald-500/40 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold text-emerald-300 backdrop-blur-md animate-fade-in" dir="rtl">
            <ArrowRightLeft size={13} className="text-emerald-400 animate-pulse" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Smooth buffering loader */}
        {isBuffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="relative bg-black/50 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Error overlay with candidate backup selector, proxy switch, and next channel */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md z-20 p-6 text-center" dir="rtl">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500">
              <AlertTriangle size={32} />
            </div>
            <h4 className="text-white font-black text-xl mb-2 tracking-tight">البث غير متاح مؤقتاً</h4>
            <p className="text-zinc-400 text-sm max-w-sm mb-4 leading-relaxed">{error}</p>

            {/* Auto-skip timer notice */}
            {autoSkipCountdown !== null && (
              <div className="mb-5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                <SkipForward size={14} className="animate-pulse" />
                <span>جاري الانتقال للقناة التالية خلال {autoSkipCountdown} ثوانٍ...</span>
                <button 
                  onClick={() => setAutoSkipCountdown(null)} 
                  className="mr-2 underline hover:text-white"
                >
                  إلغاء
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => {
                  setError(null);
                  setAutoSkipCountdown(null);
                  setRetryKey(prev => prev + 1);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all text-xs shadow-lg"
              >
                <RefreshCw size={14} />
                إعادة المحاولة
              </button>

              {candidateUrls.length > 1 && (
                <button 
                  onClick={() => {
                    const nextIdx = (activeUrlIndex + 1) % candidateUrls.length;
                    setActiveUrlIndex(nextIdx);
                    setError(null);
                    setAutoSkipCountdown(null);
                    setRetryKey(k => k + 1);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all text-xs shadow-lg"
                >
                  <ArrowRightLeft size={14} />
                  سيرفر بديل ({activeUrlIndex + 1}/{candidateUrls.length})
                </button>
              )}

              <button 
                onClick={() => {
                  setUseProxy(prev => !prev);
                  setError(null);
                  setAutoSkipCountdown(null);
                  setRetryKey(prev => prev + 1);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all text-xs border border-white/10"
                title="تغيير وضع الاتصال بين المباشر والبروكسي لتجاوز الحظر"
              >
                <ShieldCheck size={14} className={useProxy ? 'text-blue-400' : 'text-zinc-500'} />
                {useProxy ? 'وضع البروكسي (نشط)' : 'تفعيل البروكسي'}
              </button>

              {onNextChannel && (
                <button 
                  onClick={onNextChannel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs shadow-lg shadow-emerald-600/20"
                >
                  <SkipForward size={14} />
                  القناة التالية
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-zinc-500">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoSkipEnabled} 
                  onChange={e => setAutoSkipEnabled(e.target.checked)}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-900" 
                />
                <span>تخطي القنوات المعطلة تلقائياً</span>
              </label>
            </div>
          </div>
        )}

        {/* Overlay Controls */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <button 
                onClick={syncToLive}
                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-[10px] font-bold text-white rounded uppercase tracking-widest animate-pulse transition-colors flex items-center gap-1"
                title="مباشر - مزامنة مع البث الحي"
              >
                <Zap size={10} fill="currentColor" />
                Live
              </button>

              {candidateUrls.length > 1 && (
                <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ArrowRightLeft size={10} />
                  سيرفر {activeUrlIndex + 1}/{candidateUrls.length}
                </span>
              )}

              <button
                onClick={() => {
                  setUseProxy(prev => !prev);
                  setRetryKey(prev => prev + 1);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded transition-colors uppercase tracking-wider ${
                  useProxy 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-zinc-800/80 text-zinc-400 border border-white/10 hover:text-white'
                }`}
                title="البروكسي يتجاوز قيود CORS والحظر"
              >
                <ShieldCheck size={11} />
                {useProxy ? 'Proxy' : 'Direct'}
              </button>
              <h3 className="text-white font-semibold text-lg drop-shadow-lg truncate max-w-md">{title}</h3>
            </div>
            <div className="flex gap-2">
              {onNextChannel && (
                <button 
                  onClick={onNextChannel}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-all flex items-center gap-1 text-xs px-3 font-semibold"
                  title="تشغيل القناة التالية (اضغط N)"
                >
                  <SkipForward size={14} />
                  <span className="hidden sm:inline">التالي</span>
                </button>
              )}
              <button className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all">
                <Info size={18} />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all">
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button onClick={togglePlay} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white backdrop-blur-md border border-white/10">
                  {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
                
                <div className="flex items-center gap-3 group/volume">
                  <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={22} /> : volume < 0.5 ? <Volume1 size={22} /> : <Volume2 size={22} />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={volume} 
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500 group-hover/volume:w-32 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button onClick={togglePiP} className={`p-2 rounded-xl transition-all ${isPiPActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                  <MonitorPlay size={22} />
                </button>
                <button onClick={toggleFullscreen} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                  {document.fullscreenElement ? <Minimize size={22} /> : <Maximize size={22} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EPG Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Program */}
        <div className="md:col-span-2 bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md" dir="rtl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Play size={16} className="text-emerald-500" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">يعرض الآن (Live Guide)</h3>
          </div>
          
          {isEPGLoading ? (
            <div className="flex items-center gap-3 text-zinc-500 py-4">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-medium">جاري جلب معلومات البرنامج...</span>
            </div>
          ) : currentProgram ? (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white leading-tight">{currentProgram.title}</h2>
              <div className="flex items-center gap-4 text-zinc-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {formatTime(currentProgram.start)} - {formatTime(currentProgram.stop)}
                </span>
                {currentProgram.category && (
                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] uppercase tracking-widest font-bold">
                    {currentProgram.category}
                  </span>
                )}
              </div>
              {currentProgram.desc && (
                <p className="text-zinc-500 text-sm leading-relaxed line-clamp-3">
                  {currentProgram.desc}
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <p className="text-zinc-600 text-sm font-medium">بث مباشر 24/7 دون انقطاع</p>
            </div>
          )}
        </div>

        {/* Upcoming Programs */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md" dir="rtl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Calendar size={16} className="text-blue-500" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">البرامج التالية</h3>
          </div>

          <div className="space-y-4">
            {isEPGLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-12 h-4 bg-zinc-800 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="w-full h-4 bg-zinc-800 rounded" />
                    <div className="w-2/3 h-3 bg-zinc-800/50 rounded" />
                  </div>
                </div>
              ))
            ) : upcomingPrograms.length > 0 ? (
              upcomingPrograms.map((p, i) => (
                <div key={i} className="group flex gap-4 items-start">
                  <span className="text-[10px] font-black text-zinc-600 mt-1 tabular-nums">
                    {formatTime(p.start)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-zinc-300 truncate group-hover:text-white transition-colors">
                      {p.title}
                    </h4>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {p.category || 'عام'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">تغطية مباشرة متواصلة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
