import React from 'react';
import { Channel, StreamQualityInfo } from '../types';
import { Heart, Play, Tv, ShieldCheck, Zap, Activity } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  countryFlag?: string;
  quality?: StreamQualityInfo;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  countryFlag,
  quality: directQuality,
}) => {
  const quality = directQuality || channel.quality;

  return (
    <div
      className={`group relative flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-150 cursor-pointer ${
        isSelected 
          ? 'bg-emerald-500/15 border border-emerald-500/40 shadow-lg shadow-emerald-500/5' 
          : 'hover:bg-white/5 border border-white/5 hover:border-white/10'
      }`}
      onClick={() => onSelect(channel)}
    >
      <div className="relative w-11 h-11 flex-shrink-0 bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
        {channel.logo ? (
          <img 
            src={channel.logo} 
            alt="" 
            loading="lazy"
            className="w-full h-full object-contain p-1.5"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name.slice(0, 4))}&background=18181b&color=10b981&bold=true`;
            }}
          />
        ) : (
          <Tv size={18} className="text-zinc-500" />
        )}
        
        {isSelected && (
          <div className="absolute inset-0 bg-emerald-500/25 backdrop-blur-[1px] flex items-center justify-center">
            <Play size={16} className="text-emerald-400 fill-emerald-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className={`text-xs font-bold truncate leading-snug ${isSelected ? 'text-emerald-400' : 'text-zinc-200 group-hover:text-white'}`}>
              {channel.name}
            </h4>
            {channel.isVerified && (
              <span 
                className="flex-shrink-0 text-emerald-400" 
                title="قناة مؤكدة ومفحوصة - تعمل 24/7"
              >
                <ShieldCheck size={13} />
              </span>
            )}
          </div>

          {/* Visual Quality Status Badge */}
          {quality && (
            <span
              className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors ${
                quality.status === 'stable'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : quality.status === 'weak'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : quality.status === 'offline'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-white/5'
              }`}
              title={`حالة البث: ${
                quality.status === 'stable' 
                  ? 'مستقر (استجابة فائقة السرعة)' 
                  : quality.status === 'weak' 
                  ? 'ضعيف (استجابة بطيئة أو تذبذب)' 
                  : quality.status === 'offline' 
                  ? 'معطل (السيرفر لا يستجيب / 403)' 
                  : 'جاري الفحص...'
              }${quality.latency ? ` · ${quality.latency}ms` : ''}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  quality.status === 'stable'
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse'
                    : quality.status === 'weak'
                    ? 'bg-amber-400'
                    : quality.status === 'offline'
                    ? 'bg-rose-500'
                    : 'bg-zinc-500 animate-ping'
                }`}
              />
              <span>
                {quality.status === 'stable' && 'مستقر'}
                {quality.status === 'weak' && 'ضعيف'}
                {quality.status === 'offline' && 'معطل'}
                {quality.status === 'checking' && 'فحص...'}
              </span>
              {quality.latency && quality.status !== 'offline' && (
                <span className="text-[8px] font-mono opacity-75 mr-0.5">
                  {quality.latency < 1000 ? `${quality.latency}ms` : `${(quality.latency / 1000).toFixed(1)}s`}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          {channel.isVerified && (
            <span className="flex items-center gap-1 text-[8.5px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              مؤكد 24/7
            </span>
          )}
          {channel.category && (
            <span className="text-[9px] font-semibold px-2 py-0.5 bg-zinc-800/80 text-zinc-400 rounded-md tracking-wider">
              {channel.category}
            </span>
          )}
          {(countryFlag || channel.country) && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-800/60 text-zinc-400 rounded-md">
              {countryFlag || channel.country}
            </span>
          )}
          {channel.backupUrls && channel.backupUrls.length > 0 && (
            <span className="text-[8.5px] font-semibold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md">
              +{channel.backupUrls.length} سيرفر
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(channel);
        }}
        className={`p-2 rounded-xl transition-all ${
          isFavorite 
            ? 'text-rose-500 bg-rose-500/10' 
            : 'text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 hover:bg-white/5'
        }`}
        title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
      >
        <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
};
