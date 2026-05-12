import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, ExternalLink } from 'lucide-react';
import { youtube } from '@/services/youtube.service';

function YtIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.8 8.001a2.75 2.75 0 0 0-1.937-1.948C18.2 5.6 12 5.6 12 5.6s-6.2 0-7.863.453A2.75 2.75 0 0 0 2.2 8.001 28.8 28.8 0 0 0 1.75 12a28.8 28.8 0 0 0 .45 3.999 2.75 2.75 0 0 0 1.937 1.948C5.8 18.4 12 18.4 12 18.4s6.2 0 7.863-.453a2.75 2.75 0 0 0 1.937-1.948A28.8 28.8 0 0 0 22.25 12a28.8 28.8 0 0 0-.45-3.999ZM9.75 15V9l5.25 3-5.25 3Z" />
    </svg>
  );
}


function isYouTubeUrl(str) {
  return /(?:youtube\.com\/watch\?|youtu\.be\/)/.test(str);
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

export default function YoutubeSearchPanel({ onSelect, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      // if it's a URL, extract video ID and create a synthetic result
      if (isYouTubeUrl(term)) {
        const videoId = extractVideoId(term);
        if (videoId) {
          onSelect({ videoId, url: term, title: term });
          return;
        }
      }
      const { results: items } = await youtube.search(term);
      setResults(items || []);
    } catch (err) {
      setError(err?.response?.data?.error || t('home.ytSearchFailed'));
    } finally {
      setLoading(false);
    }
  }, [onSelect]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') runSearch(query);
  };

  const handleSelect = (item) => {
    onSelect({
      videoId: item.videoId,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      title: item.title,
      thumbnail: item.thumbnail,
      channelTitle: item.channelTitle,
    });
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Search Input */}
      <div className="flex items-center gap-2 p-4 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2 flex-1 bg-zinc-900 border border-zinc-700/60 rounded-xl px-3 py-2 focus-within:border-red-500/50 focus-within:ring-1 focus-within:ring-red-500/30 transition-all">
          <YtIcon className="w-4 h-4 text-red-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('home.searchYoutubePlaceholder')}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => runSearch(query)}
          disabled={!query.trim() || loading}
          className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
        {onClose && (
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {error && (
          <div className="text-sm text-red-400 text-center py-8">{error}</div>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div className="text-sm text-zinc-500 text-center py-8">{t('home.ytNoResults')}</div>
        )}

        {!searched && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
            <YtIcon className="w-10 h-10 text-red-500/30" />
            <p className="text-sm">{t('home.ytSearchPrompt')}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-32 h-[72px] rounded-lg bg-zinc-800 shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((item) => (
              <button
                key={item.videoId}
                onClick={() => handleSelect(item)}
                className="group flex gap-3 p-2 rounded-xl hover:bg-zinc-800/60 transition-all text-left w-full cursor-pointer"
              >
                <div className="relative w-32 h-[72px] shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <p className="text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-white transition-colors leading-snug">
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{item.channelTitle}</p>
                </div>

                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-1">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
