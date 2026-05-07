import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { spotify as spotifyApi, getAccessToken } from '@/api';
import { formatTime } from '@/utils/formatTime';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Tip } from '@ui/tip';
import toast from 'react-hot-toast';
import {
  Search, Clock, TrendingUp, Heart, ListMusic, Music2,
  Loader2, ChevronRight, ChevronLeft, Monitor, Smartphone, Speaker,
  Plus, Check, SkipForward, Download,
} from 'lucide-react';
import SpotifyIcon from '@shared/SpotifyIcon';
import { LRUCache } from '@crimson-carnival/ds-js';

const searchCache = new LRUCache(30);
const TABS = ['search', 'recent', 'top', 'saved', 'playlists', 'devices'];

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${active
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function TrackRow({ track, onSelect, onQueue, onSaveToggle, isSaved }) {
  const { t } = useTranslation();
  return (
    <div
      className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
      onDoubleClick={() => onSelect(track)}
    >
      {track.albumArt ? (
        <img src={track.albumArt} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <Music2 className="w-4 h-4 text-zinc-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">{track.name}</p>
        <p className="text-[10px] text-zinc-500 truncate">{track.artist}{track.album ? ` · ${track.album}` : ''}</p>
      </div>
      {track.duration > 0 && (
        <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 hidden sm:block">{formatTime(track.duration / 1000)}</span>
      )}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSaveToggle && (
          <Tip content={isSaved ? t('spotify.removeFromLibrary') : t('spotify.saveToLibrary')}>
            <button
              onClick={(e) => { e.stopPropagation(); onSaveToggle(track); }}
              className={`p-1 rounded transition-colors ${isSaved ? 'text-green-400 hover:text-green-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Heart className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </Tip>
        )}
        {onQueue && (
          <Tip content={t('spotify.addToQueue')}>
            <button
              onClick={(e) => { e.stopPropagation(); onQueue(track); }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </Tip>
        )}
        <Tip content={t('spotify.useTrack')}>
          <button
            onClick={() => onSelect(track)}
            className="p-1 rounded text-green-500 hover:text-green-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </Tip>
      </div>
    </div>
  );
}

function DeviceRow({ device, onTransfer, isActive }) {
  const { t } = useTranslation();
  const Icon = device.type === 'Smartphone' ? Smartphone : device.type === 'Speaker' ? Speaker : Monitor;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-green-500/10 border border-green-500/20' : 'hover:bg-zinc-800/60'}`}>
      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-green-400' : 'text-zinc-500'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-green-400' : 'text-zinc-200'}`}>{device.name}</p>
        <p className="text-[10px] text-zinc-500">{device.type}{device.volumePercent != null ? ` · ${device.volumePercent}%` : ''}</p>
      </div>
      {isActive ? (
        <span className="text-[10px] font-bold text-green-400 uppercase">{t('spotify.activeDevice')}</span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTransfer(device.id)}
          className="text-xs text-zinc-400 hover:text-zinc-200 h-7"
        >
          {t('spotify.transfer')}
        </Button>
      )}
    </div>
  );
}

function PlaylistRow({ playlist, onClick }) {
  return (
    <button
      onClick={() => onClick(playlist)}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors text-left"
    >
      {playlist.imageUrl ? (
        <img src={playlist.imageUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <ListMusic className="w-5 h-5 text-zinc-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate">{playlist.name}</p>
        <p className="text-[10px] text-zinc-500 truncate">{playlist.owner} · {playlist.trackCount} tracks</p>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
    </button>
  );
}

export default function SpotifyBrowser({ onSelectTrack }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('search');
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedStates, setSavedStates] = useState({});
  const [timeRange, setTimeRange] = useState('medium_term');

  // Playlists
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Devices
  const [devices, setDevices] = useState([]);

  // Create playlist
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const searchTimerRef = useRef(null);
  const lastQueryRef = useRef('');

  const isSpotifyConnected = !!getAccessToken();
  const [scopeError, setScopeError] = useState(false);

  // Helper to detect scope errors from API responses
  const handleApiError = useCallback((err) => {
    if (err?.message === 'spotify_scope_error' || err?.body?.error === 'spotify_scope_error' || err?.status === 403) {
      setScopeError(true);
    }
  }, []);

  // ——— Loaders ———

  const loadSearch = useCallback(async (query, newOffset = 0) => {
    if (!query?.trim()) { setTracks([]); setTotal(0); return; }

    const cacheKey = `${query.trim()}:${newOffset}`;
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      setTracks(cached.tracks);
      setTotal(cached.total);
      setOffset(newOffset);
      return;
    }

    setLoading(true);
    try {
      const data = await spotifyApi.search(query, { limit: 10, offset: newOffset });
      const newTracks = data.tracks || [];
      const newTotal = data.total || 0;

      searchCache.put(cacheKey, { tracks: newTracks, total: newTotal });

      setTracks(newTracks);
      setTotal(newTotal);
      setOffset(newOffset);
    } catch (err) { handleApiError(err); setTracks([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadSavedTracks = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const data = await spotifyApi.getSavedTracks({ limit: 20, offset: newOffset });
      setTracks(data.tracks || []);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch (err) { handleApiError(err); setTracks([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadRecentlyPlayed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spotifyApi.getRecentlyPlayed({ limit: 20 });
      setTracks(data.tracks || []);
      setTotal(0); // no pagination for recently played
      setOffset(0);
    } catch (err) { handleApiError(err); setTracks([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadTopTracks = useCallback(async (range, newOffset = 0) => {
    setLoading(true);
    try {
      const data = await spotifyApi.getTopTracks({ timeRange: range, limit: 20, offset: newOffset });
      setTracks(data.tracks || []);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch (err) { handleApiError(err); setTracks([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadPlaylists = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const data = await spotifyApi.getPlaylists({ limit: 20, offset: newOffset });
      setPlaylists(data.playlists || []);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch (err) { handleApiError(err); setPlaylists([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadPlaylistTracks = useCallback(async (playlist, newOffset = 0) => {
    setLoading(true);
    try {
      const data = await spotifyApi.getPlaylistTracks(playlist.id, { limit: 20, offset: newOffset });
      setTracks(data.tracks || []);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch (err) { handleApiError(err); setTracks([]); }
    setLoading(false);
  }, [handleApiError]);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spotifyApi.getDevices();
      setDevices(data.devices || []);
    } catch (err) { handleApiError(err); setDevices([]); }
    setLoading(false);
  }, [handleApiError]);

  // ——— Tab change handler ———
  const handleTabChange = useCallback((newTab) => {
    setTab(newTab);
    setTracks([]);
    setPlaylists([]);
    setDevices([]);
    setSelectedPlaylist(null);
    setOffset(0);
    setTotal(0);

    if (newTab === 'search' && searchQuery.trim()) loadSearch(searchQuery);
    else if (newTab === 'recent') loadRecentlyPlayed();
    else if (newTab === 'top') loadTopTracks(timeRange);
    else if (newTab === 'saved') loadSavedTracks();
    else if (newTab === 'playlists') loadPlaylists();
    else if (newTab === 'devices') loadDevices();
  }, [searchQuery, timeRange, loadSearch, loadRecentlyPlayed, loadTopTracks, loadSavedTracks, loadPlaylists, loadDevices]);

  // Auto-load on first render
  useEffect(() => {
    // Don't auto-load search — wait for user input
  }, []);

  // ——— Search debounce ———
  const handleSearchInput = useCallback((value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) { setTracks([]); setTotal(0); return; }
    searchTimerRef.current = setTimeout(() => {
      if (value !== lastQueryRef.current) {
        lastQueryRef.current = value;
        loadSearch(value);
      }
    }, 350);
  }, [loadSearch]);

  // ——— Track selection ———
  const handleSelectTrack = useCallback(async (track) => {
    // Create upload record and trigger playback
    try {
      const result = await spotifyApi.createUpload(`spotify:track:${track.trackId}`);
      onSelectTrack({
        ...result,
        trackId: track.trackId, // Preserve the original Spotify track ID
        title: track.name,
        artist: track.artist,
      });
    } catch {
      // Still pass the track info even if upload creation fails
      onSelectTrack({ trackId: track.trackId, title: track.name, artist: track.artist });
    }
  }, [onSelectTrack]);

  // ——— Library save/remove ———
  const handleSaveToggle = useCallback(async (track) => {
    const uri = track.uri || `spotify:track:${track.trackId}`;
    const isSaved = savedStates[uri];
    try {
      if (isSaved) {
        await spotifyApi.removeFromLibrary([uri]);
        setSavedStates((prev) => ({ ...prev, [uri]: false }));
      } else {
        await spotifyApi.saveToLibrary([uri]);
        setSavedStates((prev) => ({ ...prev, [uri]: true }));
      }
    } catch { /* ignore */ }
  }, [savedStates]);

  // ——— Queue ———
  const handleAddToQueue = useCallback(async (track) => {
    const uri = track.uri || `spotify:track:${track.trackId}`;
    try {
      await spotifyApi.addToQueue(uri);
    } catch { /* ignore */ }
  }, []);

  // ——— Device transfer ———
  const handleTransfer = useCallback(async (deviceId) => {
    try {
      await spotifyApi.transferPlayback(deviceId, true);
      loadDevices(); // refresh
    } catch { /* ignore */ }
  }, [loadDevices]);

  // ——— Create playlist ———
  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      await spotifyApi.createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
      loadPlaylists();
    } catch { /* ignore */ }
    setCreatingPlaylist(false);
  }, [newPlaylistName, loadPlaylists]);

  // ——— Bulk import all tracks from a playlist ———
  const [bulkImporting, setBulkImporting] = useState(false);
  const handleBulkImport = useCallback(async () => {
    if (!selectedPlaylist || tracks.length === 0) return;
    setBulkImporting(true);
    let imported = 0;
    for (const track of tracks) {
      try {
        await spotifyApi.createUpload(`spotify:track:${track.trackId}`);
        imported++;
      } catch { /* skip failures */ }
    }
    setBulkImporting(false);
    if (imported > 0) {
      toast.success(t('spotify.bulkImported', { count: imported }));
    }
  }, [selectedPlaylist, tracks, t]);

  // Check saved states for displayed tracks
  useEffect(() => {
    if (tracks.length === 0) return;
    const uris = tracks.map((t) => t.uri || `spotify:track:${t.trackId}`).filter(Boolean);
    if (uris.length === 0) return;
    spotifyApi.checkLibrary(uris).then((data) => {
      if (data.results) setSavedStates((prev) => ({ ...prev, ...data.results }));
    }).catch(() => { });
  }, [tracks]);

  // Pagination
  const pageSize = tab === 'search' ? 10 : 20;
  const hasNext = total > 0 && offset + pageSize < total;
  const hasPrev = offset > 0;

  const handleNext = () => {
    const newOffset = offset + pageSize;
    if (tab === 'search') loadSearch(searchQuery, newOffset);
    else if (tab === 'saved') loadSavedTracks(newOffset);
    else if (tab === 'top') loadTopTracks(timeRange, newOffset);
    else if (tab === 'playlists' && selectedPlaylist) loadPlaylistTracks(selectedPlaylist, newOffset);
    else if (tab === 'playlists') loadPlaylists(newOffset);
  };

  const handlePrev = () => {
    const newOffset = Math.max(0, offset - pageSize);
    if (tab === 'search') loadSearch(searchQuery, newOffset);
    else if (tab === 'saved') loadSavedTracks(newOffset);
    else if (tab === 'top') loadTopTracks(timeRange, newOffset);
    else if (tab === 'playlists' && selectedPlaylist) loadPlaylistTracks(selectedPlaylist, newOffset);
    else if (tab === 'playlists') loadPlaylists(newOffset);
  };

  if (!isSpotifyConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 text-center px-4">
        <SpotifyIcon className="w-8 h-8 text-green-500/50" />
        <p className="text-sm text-zinc-400">{t('spotify.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      {/* Scope error banner */}
      {scopeError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs animate-fade-in">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="flex-1">{t('spotify.scopeError')}</span>
        </div>
      )}
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 settings-scroll">
        <TabButton active={tab === 'search'} onClick={() => handleTabChange('search')} icon={Search} label={t('spotify.search')} />
        <TabButton active={tab === 'recent'} onClick={() => handleTabChange('recent')} icon={Clock} label={t('spotify.recentlyPlayed')} />
        <TabButton active={tab === 'top'} onClick={() => handleTabChange('top')} icon={TrendingUp} label={t('spotify.topTracks')} />
        <TabButton active={tab === 'saved'} onClick={() => handleTabChange('saved')} icon={Heart} label={t('spotify.savedTracks')} />
        <TabButton active={tab === 'playlists'} onClick={() => handleTabChange('playlists')} icon={ListMusic} label={t('spotify.playlists')} />
        <TabButton active={tab === 'devices'} onClick={() => handleTabChange('devices')} icon={Monitor} label={t('spotify.devices')} />
      </div>

      {/* Search input */}
      {tab === 'search' && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadSearch(searchQuery); }}
            placeholder={t('spotify.searchPlaceholder')}
            className="pl-8 h-8 bg-zinc-800/60 border-zinc-700 text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Top tracks time range */}
      {tab === 'top' && (
        <div className="flex gap-1">
          {[
            { value: 'short_term', label: t('spotify.lastMonth') },
            { value: 'medium_term', label: t('spotify.last6Months') },
            { value: 'long_term', label: t('spotify.allTime') },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setTimeRange(value); loadTopTracks(value); }}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${timeRange === value ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Playlist header with back button */}
      {tab === 'playlists' && selectedPlaylist && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedPlaylist(null); loadPlaylists(); }}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-zinc-200 truncate flex-1">{selectedPlaylist.name}</span>
          {tracks.length > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={bulkImporting}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 rounded hover:bg-zinc-800/60 disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              {bulkImporting ? '…' : t('spotify.importAll')}
            </button>
          )}
        </div>
      )}

      {/* Playlists: create button */}
      {tab === 'playlists' && !selectedPlaylist && (
        <div>
          {showCreatePlaylist ? (
            <div className="flex gap-2 items-center">
              <Input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); if (e.key === 'Escape') setShowCreatePlaylist(false); }}
                placeholder={t('spotify.playlistName')}
                className="h-7 text-xs bg-zinc-800/60 border-zinc-700 flex-1"
                autoFocus
                disabled={creatingPlaylist}
              />
              <Button size="sm" onClick={handleCreatePlaylist} disabled={creatingPlaylist} className="h-7 px-2 text-xs bg-green-600 hover:bg-green-500 text-white">
                {creatingPlaylist ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreatePlaylist(true)}
              className="flex items-center gap-1.5 text-[10px] text-green-400 hover:text-green-300 font-medium"
            >
              <Plus className="w-3 h-3" />
              {t('spotify.createPlaylist')}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 settings-scroll">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
            <span className="text-xs text-zinc-500">{t('player.loading')}</span>
          </div>
        ) : tab === 'devices' ? (
          devices.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">{t('spotify.noDevices')}</p>
          ) : (
            devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                isActive={device.isActive}
                onTransfer={handleTransfer}
              />
            ))
          )
        ) : tab === 'playlists' && !selectedPlaylist ? (
          playlists.length === 0 && !loading ? (
            <p className="text-xs text-zinc-500 text-center py-6">{t('spotify.noPlaylists')}</p>
          ) : (
            playlists.map((pl) => (
              <PlaylistRow
                key={pl.id}
                playlist={pl}
                onClick={(p) => { setSelectedPlaylist(p); loadPlaylistTracks(p); }}
              />
            ))
          )
        ) : tracks.length === 0 && !loading ? (
          <p className="text-xs text-zinc-500 text-center py-6">
            {tab === 'search' ? t('spotify.searchHint') : t('spotify.noTracks')}
          </p>
        ) : (
          tracks.map((track, i) => (
            <TrackRow
              key={`${track.trackId}-${i}`}
              track={track}
              onSelect={handleSelectTrack}
              onQueue={handleAddToQueue}
              onSaveToggle={handleSaveToggle}
              isSaved={savedStates[track.uri || `spotify:track:${track.trackId}`]}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {(hasNext || hasPrev) && tab !== 'devices' && (
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={!hasPrev}
            className="text-[10px] text-zinc-400 h-6 px-2"
          >
            <ChevronLeft className="w-3 h-3 mr-0.5" />
            {t('spotify.prev')}
          </Button>
          {total > 0 && (
            <span className="text-[10px] text-zinc-600">
              {offset + 1}–{Math.min(offset + pageSize, total)} / {total}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            disabled={!hasNext}
            className="text-[10px] text-zinc-400 h-6 px-2"
          >
            {t('spotify.next')}
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
