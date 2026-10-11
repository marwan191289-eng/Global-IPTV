import React, { useState } from 'react';
import { Activity, Heart, Play, Radio, ShieldCheck } from 'lucide-react';
import { Channel, StreamQualityInfo } from '../types';

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
  channel, isSelected, isFavorite, onSelect, onToggleFavorite, countryFlag, quality,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const qualityTone = quality?.status === 'stable'
    ? 'bg-[hsl(var(--teal)/.12)] text-[hsl(var(--teal))]'
    : quality?.status === 'weak'
      ? 'bg-amber-400/10 text-amber-300'
      : quality?.status === 'offline'
        ? 'bg-rose-400/10 text-rose-300'
        : 'bg-[hsl(var(--paper)/.06)] text-[hsl(var(--muted))]';

  return (
    <article className={`group flex items-center gap-3 rounded-2xl p-2 transition-colors duration-200 ${
      isSelected ? 'bg-[hsl(var(--accent)/.12)] ring-1 ring-[hsl(var(--accent)/.48)]' : 'hover:bg-[hsl(var(--paper)/.045)]'
    }`}>
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-label={`تشغيل ${channel.name}`}
        aria-current={isSelected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-right focus-visible:rounded-xl"
      >
        <span className={`relative grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-xl border ${
          isSelected ? 'border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.12)]' : 'border-[hsl(var(--line))] bg-[hsl(var(--ink)/.55)]'
        }`}>
          {channel.logo && !imageFailed ? (
            <img
              src={channel.logo}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain p-2"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="text-sm font-bold text-[hsl(var(--accent))]">{channel.name.trim().slice(0, 2)}</span>
          )}
          {isSelected && <span className="absolute inset-0 grid place-items-center bg-[hsl(var(--ink)/.3)]"><Play size={15} fill="currentColor" className="text-[hsl(var(--accent))]" /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[13px] font-semibold ${isSelected ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--paper))]'}`}>{channel.name}</span>
            {channel.isVerified && <span title="مصدر ضمن قائمة منسقة" aria-label="مصدر ضمن قائمة منسقة" className="text-[hsl(var(--teal))]"><ShieldCheck size={13} /></span>}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-2">
            <span className="truncate text-[10px] text-[hsl(var(--muted))]">{channel.category || countryFlag || channel.country || 'قناة مباشرة'}</span>
            {quality && (
              <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${qualityTone}`} title="فحص استجابة المصدر فقط؛ لا يضمن تشغيل الفيديو">
                {quality.status === 'checking' ? <Activity size={10} /> : <Radio size={9} />}
                {quality.status === 'stable' ? 'استجابة جيدة' : quality.status === 'weak' ? 'استجابة بطيئة' : quality.status === 'offline' ? 'لا يستجيب' : 'جارٍ الفحص'}
              </span>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={isFavorite ? `إزالة ${channel.name} من المفضلة` : `إضافة ${channel.name} إلى المفضلة`}
        aria-pressed={isFavorite}
        className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-colors ${
          isFavorite ? 'bg-rose-400/10 text-rose-300' : 'text-[hsl(var(--muted))] hover:bg-[hsl(var(--paper)/.08)] hover:text-rose-300'
        }`}
      >
        <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
};
