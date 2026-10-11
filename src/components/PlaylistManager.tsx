import React, { useState } from 'react';
import { Plus, Link as LinkIcon, FileUp, X, CheckCircle2, Zap } from 'lucide-react';
import { PlaylistSource } from '../types';

interface PlaylistManagerProps {
  playlists: PlaylistSource[];
  activePlaylistId: string;
  onAddPlaylist: (playlist: PlaylistSource) => void;
  onSelectPlaylist: (id: string) => void;
  onRemovePlaylist: (id: string) => void;
}

export const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  playlists,
  activePlaylistId,
  onAddPlaylist,
  onSelectPlaylist,
  onRemovePlaylist
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'url' | 'file' | 'xtream' | null>(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleAddUrl = () => {
    if (!url || !name) return;
    onAddPlaylist({
      id: Math.random().toString(36).substr(2, 9),
      name,
      url,
      type: 'url',
      lastUpdated: Date.now()
    });
    setUrl('');
    setName('');
    setMode(null);
  };

  const handleAddXtream = () => {
    if (!url || !username || !password || !name) return;
    // Construct M3U URL from Xtream credentials
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const xtreamUrl = `${baseUrl}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`;
    
    onAddPlaylist({
      id: Math.random().toString(36).substr(2, 9),
      name,
      url: xtreamUrl,
      type: 'url',
      lastUpdated: Date.now()
    });
    
    setUrl('');
    setName('');
    setUsername('');
    setPassword('');
    setMode(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onAddPlaylist({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace('.m3u', ''),
        type: 'file',
        lastUpdated: Date.now(),
        // In a real app, we'd store the content or a reference
        // For this demo, we'll pass the content through a custom event or state
      });
      // Trigger a custom event with the content
      window.dispatchEvent(new CustomEvent('playlist-file-upload', { detail: content }));
      setMode(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-white/5"
      >
        <Plus size={14} className="text-emerald-400" />
        <span>إدارة الباقات والقوائم</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden" dir="rtl">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-800/50">
            <h4 className="text-xs font-bold text-zinc-300">قوائم التشغيل والباقات</h4>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>

          <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
            {playlists.map(pl => (
              <div 
                key={pl.id}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                  activePlaylistId === pl.id ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'
                }`}
                onClick={() => onSelectPlaylist(pl.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activePlaylistId === pl.id ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`} />
                  <span className={`text-xs truncate ${activePlaylistId === pl.id ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}>
                    {pl.name}
                  </span>
                </div>
                {pl.type !== 'default' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemovePlaylist(pl.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-all"
                    title="حذف"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 bg-zinc-800/30 border-t border-white/5 space-y-2">
            {!mode ? (
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setMode('url')}
                  className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-[11px] font-bold text-zinc-300 transition-all border border-white/5"
                >
                  <LinkIcon size={16} className="text-blue-400" />
                  رابط M3U
                </button>
                <button 
                  onClick={() => setMode('xtream')}
                  className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-[11px] font-bold text-zinc-300 transition-all border border-white/5"
                >
                  <Zap size={16} className="text-amber-400" />
                  Xtream
                </button>
                <button 
                  onClick={() => setMode('file')}
                  className="flex flex-col items-center gap-1.5 p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl text-[11px] font-bold text-zinc-300 transition-all border border-white/5"
                >
                  <FileUp size={16} className="text-emerald-400" />
                  ملف M3U
                </button>
              </div>
            ) : mode === 'url' ? (
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="اسم القائمة (مثلاً: قنواتي المفضلة)" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="رابط البث M3U / M3U8" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => setMode(null)} className="flex-1 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold">إلغاء</button>
                  <button onClick={handleAddUrl} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">إضافة</button>
                </div>
              </div>
            ) : mode === 'xtream' ? (
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="اسم السيرفر" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="رابط السيرفر (مثال: http://host:port)" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="اسم المستخدم (Username)" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="كلمة المرور (Password)" 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => setMode(null)} className="flex-1 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold">إلغاء</button>
                  <button onClick={handleAddXtream} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">تسجيل الدخول</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-white/10 rounded-xl hover:border-emerald-500/50 cursor-pointer transition-all group">
                  <FileUp size={24} className="text-zinc-500 group-hover:text-emerald-500 mb-1.5" />
                  <span className="text-xs text-zinc-400 font-medium">اضغط لاختيار ملف .m3u أو .m3u8</span>
                  <input type="file" accept=".m3u,.m3u8" className="hidden" onChange={handleFileUpload} />
                </label>
                <button onClick={() => setMode(null)} className="w-full py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold">إلغاء</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
