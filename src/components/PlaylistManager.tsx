import React, { useRef, useState } from 'react';
import { FileUp, Link2, ListVideo, Plus, Server, Trash2, X } from 'lucide-react';
import { PlaylistSource } from '../types';

interface PlaylistManagerProps {
  playlists: PlaylistSource[];
  activePlaylistId: string;
  onAddPlaylist: (playlist: PlaylistSource) => void;
  onSelectPlaylist: (id: string) => void;
  onRemovePlaylist: (id: string) => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  playlists, activePlaylistId, onAddPlaylist, onSelectPlaylist, onRemovePlaylist,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'url' | 'file' | 'xtream' | null>(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setMode(null);
    setUrl('');
    setName('');
    setUsername('');
    setPassword('');
    setFormError('');
  };

  const addUrl = () => {
    if (!name.trim() || !url.trim()) {
      setFormError('أدخل اسماً ورابطاً صالحاً للقائمة.');
      return;
    }
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      setFormError('تحقق من صيغة الرابط؛ يجب أن يبدأ بـ http أو https.');
      return;
    }
    const playlist: PlaylistSource = { id: `url-${Date.now().toString(36)}`, name: name.trim(), url: url.trim(), type: 'url', lastUpdated: Date.now() };
    onAddPlaylist(playlist);
    resetForm();
  };

  const addXtream = () => {
    if (!name.trim() || !url.trim() || !username.trim() || !password) {
      setFormError('أكمل جميع بيانات الاتصال.');
      return;
    }
    try {
      const base = new URL(url.trim());
      const playlistUrl = new URL('/get.php', base);
      playlistUrl.search = new URLSearchParams({ username: username.trim(), password, type: 'm3u_plus', output: 'ts' }).toString();
      onAddPlaylist({ id: `xtream-${Date.now().toString(36)}`, name: name.trim(), url: playlistUrl.toString(), type: 'url', lastUpdated: Date.now() });
      resetForm();
    } catch {
      setFormError('أدخل عنوان خادم صالحاً.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReadingFile(true);
    setFormError('');
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content.trim()) {
        setFormError('الملف فارغ أو تعذرت قراءته.');
        setReadingFile(false);
        return;
      }
      const title = file.name.replace(/\.(m3u8?|txt)$/i, '');
      onAddPlaylist({ id: `file-${Date.now().toString(36)}`, name: title || 'قائمة من ملف', type: 'file', content, lastUpdated: Date.now() });
      setReadingFile(false);
      resetForm();
    };
    reader.onerror = () => {
      setFormError('تعذرت قراءة الملف. حاول اختيار ملف آخر.');
      setReadingFile(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-raised))] px-3 text-xs font-semibold text-[hsl(var(--paper))] transition hover:border-[hsl(var(--accent)/.45)]"
      >
        <ListVideo size={16} className="text-[hsl(var(--accent))]" />
        <span className="hidden sm:inline">قوائمي</span>
        <span className="rounded-full bg-[hsl(var(--ink)/.7)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted))]">{playlists.length}</span>
      </button>

      {isOpen && (
        <div dir="rtl" className="absolute left-0 top-[calc(100%+10px)] z-[100] w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-[hsl(var(--line))] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">مصادر المشاهدة</h2>
              <p className="mt-0.5 text-[10px] text-[hsl(var(--muted))]">اختر قائمة أو أضف مصدراً خاصاً</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="إغلاق" className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted))] hover:bg-[hsl(var(--paper)/.06)] hover:text-[hsl(var(--paper))]"><X size={16} /></button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto p-2">
            {playlists.map(playlist => (
              <div key={playlist.id} className={`flex items-center gap-2 rounded-xl p-2 ${playlist.id === activePlaylistId ? 'bg-[hsl(var(--accent)/.1)]' : 'hover:bg-[hsl(var(--paper)/.04)]'}`}>
                <button type="button" onClick={() => onSelectPlaylist(playlist.id)} aria-current={playlist.id === activePlaylistId ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-right">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${playlist.id === activePlaylistId ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--line))]'}`} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{playlist.name}</span>
                  <span className="text-[9px] text-[hsl(var(--muted))]">{playlist.type === 'default' ? 'مضمّنة' : playlist.type === 'file' ? 'ملف' : 'رابط'}</span>
                </button>
                {playlist.type !== 'default' && (
                  <button type="button" onClick={() => {
                    if (window.confirm(`حذف قائمة «${playlist.name}»؟`)) onRemovePlaylist(playlist.id);
                  }} aria-label={`حذف قائمة ${playlist.name}`} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-[hsl(var(--muted))] hover:bg-rose-400/10 hover:text-rose-300">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-[hsl(var(--line))] bg-[hsl(var(--ink)/.25)] p-3">
            {!mode ? (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setMode('url')} className="flex flex-col items-center gap-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-raised))] p-3 text-[10px] font-semibold hover:border-[hsl(var(--accent)/.4)]">
                  <Link2 size={17} className="text-[hsl(var(--accent))]" />رابط M3U
                </button>
                <button type="button" onClick={() => setMode('xtream')} className="flex flex-col items-center gap-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-raised))] p-3 text-[10px] font-semibold hover:border-[hsl(var(--accent)/.4)]">
                  <Server size={17} className="text-[hsl(var(--teal))]" />Xtream
                </button>
                <button type="button" onClick={() => { setMode('file'); fileInput.current?.click(); }} className="flex flex-col items-center gap-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel-raised))] p-3 text-[10px] font-semibold hover:border-[hsl(var(--accent)/.4)]">
                  <FileUp size={17} className="text-[hsl(var(--teal))]" />ملف قائمة
                </button>
              </div>
            ) : mode === 'file' ? (
              <div className="text-center">
                <input ref={fileInput} type="file" accept=".m3u,.m3u8,.txt" className="sr-only" onChange={handleFileUpload} />
                <button type="button" onClick={() => fileInput.current?.click()} className="w-full rounded-xl border border-dashed border-[hsl(var(--line))] p-4 text-xs text-[hsl(var(--muted))] hover:border-[hsl(var(--accent)/.5)]">
                  {readingFile ? 'جارٍ قراءة الملف…' : 'اختر ملف M3U من جهازك'}
                </button>
                <button type="button" onClick={() => { resetForm(); }} className="mt-2 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--paper))]">إلغاء</button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="sr-only" htmlFor="playlist-name">اسم القائمة</label>
                <input id="playlist-name" value={name} onChange={event => setName(event.target.value)} placeholder="اسم القائمة" className="w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--ink))] px-3 py-2.5 text-xs outline-none focus:border-[hsl(var(--accent))]" />
                <label className="sr-only" htmlFor="playlist-url">{mode === 'xtream' ? 'عنوان الخادم' : 'رابط M3U'}</label>
                <input id="playlist-url" dir="ltr" value={url} onChange={event => setUrl(event.target.value)} placeholder={mode === 'xtream' ? 'https://server:port' : 'https://example.com/playlist.m3u'} className="w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--ink))] px-3 py-2.5 text-left text-xs outline-none focus:border-[hsl(var(--accent))]" />
                {mode === 'xtream' && <>
                  <input aria-label="اسم المستخدم" value={username} onChange={event => setUsername(event.target.value)} placeholder="اسم المستخدم" className="w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--ink))] px-3 py-2.5 text-xs outline-none focus:border-[hsl(var(--accent))]" />
                  <input aria-label="كلمة المرور" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="كلمة المرور" className="w-full rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--ink))] px-3 py-2.5 text-xs outline-none focus:border-[hsl(var(--accent))]" />
                </>}
                {formError && <p role="alert" className="text-[11px] text-rose-300">{formError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => resetForm()} className="flex-1 rounded-xl bg-[hsl(var(--panel-raised))] py-2 text-xs font-semibold text-[hsl(var(--muted))] hover:text-[hsl(var(--paper))]">إلغاء</button>
                  <button type="button" onClick={mode === 'url' ? addUrl : addXtream} className="flex-1 rounded-xl bg-[hsl(var(--accent))] py-2 text-xs font-bold text-[hsl(var(--ink))] hover:brightness-110"><Plus className="ml-1 inline" size={14} />إضافة وتحميل</button>
                </div>
              </div>
            )}
            {mode === 'file' && formError && <p role="alert" className="mt-2 text-[11px] text-rose-300">{formError}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
