import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { FolderOpen, Music2, FileText, Upload, Check, ArrowRight, Trash2, Video, Cloud, Link2, Search, Loader2 } from 'lucide-react';
import { lyrics as lyricsApi, uploads as uploadsApi, spotify as spotifyApi, getAccessToken } from '@/api';
import { SkeletonMediaItem } from '@ui/skeleton';
import SpotifyBrowser from '@features/player/SpotifyBrowser';
import SpotifyIcon from '@shared/SpotifyIcon';
import { useAuthContext } from '@/contexts/useAuthContext';
import YoutubeSearchPanel from '@features/projects/YoutubeSearchPanel';
import toast from 'react-hot-toast';

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

export default function SetupScreen({ onComplete, playerRef, onShowAllUploads, onOpenSettings }) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const audioInputRef = useRef(null);
  const lyricsInputRef = useRef(null);
  const autoLoadPendingRef = useRef(false);

  // Audio state
  const [audioReady, setAudioReady] = useState(false);
  const [audioName, setAudioName] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [audioPanelView, setAudioPanelView] = useState('default'); // 'default' | 'youtube' | 'spotify'
  const [audioSource, setAudioSource] = useState(null); // 'local' | 'youtube' | 'spotify' | 'cloud'

  // Media library state
  const [mediaUploads, setMediaUploads] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(!!getAccessToken());

  // Lyrics state
  const [lyricsText, setLyricsText] = useState('');
  const [parsedLines, setParsedLines] = useState(null);
  const [lyricsFileName, setLyricsFileName] = useState('');
  const [editorMode, setEditorMode] = useState('lrc');

  const hasLyrics = parsedLines ? parsedLines.length > 0 : lyricsText.trim().length > 0;
  const canProceed = audioReady && hasLyrics;

  // Fetch user's media library on mount
  useEffect(() => {
    if (!getAccessToken()) return;
    uploadsApi.listMedia()
      .then(({ uploads }) => setMediaUploads(uploads || []))
      .catch(() => { })
      .finally(() => setMediaLoading(false));
  }, []);

  // Pre-fill YouTube URL if coming from the YouTube search panel
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingYtUrl');
    if (pending) {
      setYtUrl(pending);
      autoLoadPendingRef.current = true;
      sessionStorage.removeItem('pendingYtUrl');
      sessionStorage.removeItem('pendingYtTitle');
    }
  }, []);

  // Save a new upload record and refresh the list
  const saveUploadRecord = useCallback(async (data) => {
    if (!getAccessToken()) return;
    try {
      await uploadsApi.saveMedia(data);
      const { uploads } = await uploadsApi.listMedia();
      setMediaUploads(uploads || []);
    } catch { /* ignore */ }
  }, []);

  // ── Audio handlers ──

  const handleAudioFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error(t('setup.invalidAudioType') || 'Please select a valid audio file.');
      if (audioInputRef.current) audioInputRef.current.value = '';
      return;
    }

    if (playerRef.current?.loadLocalAudio) {
      playerRef.current.loadLocalAudio(file);
    }
    setAudioName(file.name);
    setAudioReady(true);
    setAudioSource('local');
    setSelectedUpload(null);
  };

  const CDN_PATTERN = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//;
  const AUDIO_URL_PATTERN = /^https?:\/\/.+\.(mp3|mp4|wav|ogg|flac|aac|m4a|webm)(\?.*)?$/i;
  const YT_PATTERN = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?.+&v=)|youtu\.be\/)([^&?/\s]{11})/;

  const detectedUrlType = (() => {
    const v = ytUrl.trim().split(/\s+/)[0];
    if (!v) return 'none';
    if (CDN_PATTERN.test(v)) return 'cdn';
    if (AUDIO_URL_PATTERN.test(v)) return 'cdn';
    if (YT_PATTERN.test(v) || v.length === 11) return 'youtube';
    return 'unknown';
  })();

  const handleLoadUrl = async () => {
    const trimmed = ytUrl.trim().split(/\s+/)[0];
    if (!trimmed) return;

    if (detectedUrlType === 'cdn') {
      const pathOnly = trimmed.split('?')[0].split('#')[0];
      const lastSegment = pathOnly.split('/').pop() || 'audio';
      const dotIdx = lastSegment.lastIndexOf('.');
      const rawName = dotIdx > 0 ? lastSegment.slice(0, dotIdx) : lastSegment;
      const ext = dotIdx > 0 ? lastSegment.slice(dotIdx + 1).toLowerCase() : 'mp4';
      const fileName = `${rawName}.${ext}`;
      const title = rawName.length > 30 ? 'Cloud Audio' : rawName;

      if (playerRef.current?.loadFromUrl) {
        playerRef.current.loadFromUrl(trimmed, title);
      }
      setAudioName(title);
      setAudioReady(true);
      setAudioSource('cloud');
      setSelectedUpload(null);

      saveUploadRecord({
        source: 'cloudinary',
        cloudinaryUrl: trimmed,
        fileName,
        title,
      });
      return;
    }

    const videoId = trimmed.match(YT_PATTERN)?.[1] || (trimmed.length === 11 ? trimmed : null);
    if (!videoId) {
      toast.error(t('player.invalidUrl') || 'Invalid URL format');
      return;
    }

    setYtLoading(true);
    if (playerRef.current?.loadYouTube) {
      playerRef.current.loadYouTube(trimmed);
    }
    setAudioName(t('library.untitled') || 'Untitled');
    setAudioReady(true);
    setAudioSource('youtube');
    setSelectedUpload(null);
    setYtLoading(false);

    saveUploadRecord({
      source: 'youtube',
      youtubeUrl: trimmed,
      fileName: '',
    });
  };

  useEffect(() => {
    if (autoLoadPendingRef.current && ytUrl) {
      autoLoadPendingRef.current = false;
      handleLoadUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytUrl]);

  const handleSelectUpload = (upload) => {
    setSelectedUpload(upload);
    setAudioName(upload.title || upload.fileName || upload.youtubeUrl || 'Media');
    setAudioReady(true);
    setAudioSource(upload.source === 'youtube' ? 'youtube' : upload.source === 'spotify' ? 'spotify' : 'cloud');

    if (upload.source === 'youtube' && upload.youtubeUrl) {
      setYtUrl(upload.youtubeUrl);
      if (playerRef.current?.loadYouTube) {
        playerRef.current.loadYouTube(upload.youtubeUrl);
      }
    } else if (upload.source === 'cloudinary' && upload.cloudinaryUrl) {
      if (playerRef.current?.loadFromUrl) {
        playerRef.current.loadFromUrl(upload.cloudinaryUrl, upload.title || upload.fileName);
      }
    }
  };

  const handleDeleteUpload = async (e, uploadId) => {
    e.stopPropagation();
    try {
      await uploadsApi.deleteMedia(uploadId);
      setMediaUploads((prev) => prev.filter((u) => u.id !== uploadId));
      if (selectedUpload?.id === uploadId) {
        setSelectedUpload(null);
        setAudioReady(false);
        setAudioName('');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleYtKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLoadUrl();
    }
  };

  const handleSpotifyBrowserSelect = useCallback(async (track) => {
    setAudioPanelView('default');
    if (playerRef.current?.loadSpotify) {
      playerRef.current.loadSpotify(track.trackId, track.title || track.name || '', false);
    } else if (playerRef.current?.playTrack) {
      playerRef.current.playTrack(track.trackId, track.title || track.name || '', false);
    }
    setAudioName(track.title || track.name || 'Spotify track');
    setAudioReady(true);
    setAudioSource('spotify');
    setSelectedUpload(null);

    if (getAccessToken()) {
      try {
        await spotifyApi.createUpload(`spotify:track:${track.trackId}`);
        const { uploads } = await uploadsApi.listMedia();
        setMediaUploads(uploads || []);
      } catch (err) {
        console.error('Failed to save Spotify track to uploads:', err);
      }
    }
  }, [playerRef]);

  const handleLyricsFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['lrc', 'srt', 'txt'].includes(ext)) {
      toast.error(t('import.unsupportedFormat') || 'Unsupported file type');
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast.error(t('import.tooLarge') || 'File too large (max 5 MB)');
      return;
    }

    try {
      const text = await file.text();
      const { lines } = await lyricsApi.parse(text, file.name);
      if (lines.length === 0) {
        toast.error(t('import.noLines') || 'No lyrics found in file');
        return;
      }
      setParsedLines(lines);
      setLyricsFileName(file.name);
      setEditorMode(ext === 'srt' ? 'srt' : 'lrc');
      setLyricsText('');
    } catch {
      toast.error(t('import.failed') || 'Failed to parse lyrics file');
    }
  };

  const handleProceed = () => {
    let finalLines = parsedLines;
    if (!finalLines) {
      finalLines = lyricsText
        .split('\n')
        .map((text) => ({
          text: text.trimEnd(),
          timestamp: null,
          endTime: null,
          secondary: '',
          translation: '',
          id: crypto.randomUUID(),
        }));
    }
    onComplete({
      lines: finalLines,
      editorMode,
      audioSource,
      ytUrl,
      audioName: (audioName && !audioName.includes('://')) ? audioName : null,
      selectedUpload
    });
  };

  return (
    <div className="flex-1 flex flex-col px-4 pt-0 pb-4 sm:pb-6 animate-fade-in">
      <div className="w-full max-w-3xl mx-auto flex flex-col">
        {/* Title */}
        <div className="text-center mb-6 sm:mb-8 pt-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">{t('setup.title')}</h2>
          <p className="text-zinc-500 text-sm mt-1">Configure your project assets to begin</p>
        </div>

        {/* Two panels side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* ── Audio Panel ── */}
          <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3 h-[420px] overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                {audioPanelView === 'youtube' ? (
                  <Video className="w-4 h-4 text-red-500" />
                ) : audioPanelView === 'spotify' ? (
                  <SpotifyIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <Music2 className="w-4 h-4 text-primary" />
                )}
                {audioPanelView === 'youtube' ? 'YouTube Search' : audioPanelView === 'spotify' ? 'Spotify Browser' : t('setup.uploadAudio')}
              </div>
              {audioPanelView !== 'default' && (
                <button
                  onClick={() => setAudioPanelView('default')}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 font-medium uppercase tracking-wider"
                >
                  {t('common.back') || 'Back'}
                </button>
              )}
            </div>

            {audioReady && audioPanelView === 'default' ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-medium text-zinc-200">{t('setup.audioReady')}</p>
                <p className="text-xs text-zinc-500 truncate max-w-full px-2">{audioName}</p>
                {audioSource && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${audioSource === 'spotify' ? 'bg-green-500/15 text-green-400'
                    : audioSource === 'youtube' ? 'bg-red-500/15 text-red-400'
                      : 'bg-zinc-700/50 text-zinc-400'
                    }`}>
                    {audioSource === 'spotify' && <SpotifyIcon className="w-3 h-3" />}
                    {audioSource === 'youtube' && <Video className="w-3 h-3" />}
                    {audioSource === 'local' && <FolderOpen className="w-3 h-3" />}
                    {audioSource === 'cloud' && <Cloud className="w-3 h-3" />}
                    {audioSource === 'spotify' ? 'Spotify'
                      : audioSource === 'youtube' ? 'YouTube'
                        : audioSource === 'local' ? t('setup.local') || 'Local'
                          : t('setup.cloud') || 'Cloud'}
                  </span>
                )}
                <Button
                  variant="ghost"
                  onClick={() => { setAudioReady(false); setAudioName(''); setYtUrl(''); setSelectedUpload(null); setAudioSource(null); }}
                  className="h-8 px-3 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                >
                  {t('setup.changeAudio')}
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
                {audioPanelView === 'youtube' ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <YoutubeSearchPanel
                      onSelect={({ url }) => {
                        setYtUrl(url);
                        autoLoadPendingRef.current = true;
                        setAudioPanelView('default');
                      }}
                      onClose={() => setAudioPanelView('default')}
                    />
                  </div>
                ) : audioPanelView === 'spotify' ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="max-h-full overflow-y-auto rounded-lg border border-zinc-700/40 scrollbar-thin">
                      <SpotifyBrowser
                        onSelectTrack={handleSpotifyBrowserSelect}
                        onClose={() => setAudioPanelView('default')}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Primary Search Actions (Large Cards) */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setAudioPanelView('youtube')}
                        className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 transition-all group text-left cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <Video className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-red-400 group-hover:text-red-300 transition-colors">
                            Search YouTube
                          </span>
                          <span className="text-xs text-zinc-500 leading-tight">
                            Find any video or song on YouTube to use as audio
                          </span>
                        </div>
                      </button>

                      {user?.spotify?.spotifyId ? (
                        <button
                          onClick={() => setAudioPanelView('spotify')}
                          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/40 transition-all group text-left cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <SpotifyIcon className="w-5 h-5 text-green-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-green-400 group-hover:text-green-300 transition-colors">
                              Search Spotify
                            </span>
                            <span className="text-xs text-zinc-500 leading-tight">
                              Access your playlists and library directly
                            </span>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenSettings?.('profile')}
                          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all group text-left cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <SpotifyIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-primary group-hover:text-primary/80 transition-colors">
                              {t('settings.spotify.connectAccount', 'Connect Spotify Account')}
                            </span>
                            <span className="text-xs text-zinc-500 leading-tight">
                              {t('settings.spotify.connectToAccess', 'Connect Spotify to access your library')}
                            </span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Unified URL input & Local Upload */}
                    <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/60 focus-within:border-primary/40 transition-all">
                      {/* Upload Local Button */}
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        title={t('setup.uploadAudio')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-primary hover:bg-zinc-700/50 transition-all shrink-0 border border-zinc-700/40 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <input
                          ref={audioInputRef}
                          id="setup-audio-input"
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioFile}
                          className="hidden"
                        />
                      </button>

                      <div className="relative flex-1 flex items-center">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <Input
                          type="text"
                          value={ytUrl}
                          onChange={(e) => setYtUrl(e.target.value)}
                          onKeyDown={handleYtKeyDown}
                          placeholder="Paste YouTube or CDN URL..."
                          className="pl-10 bg-transparent border-none text-sm h-10 focus-visible:ring-0 placeholder:text-zinc-600"
                        />
                      </div>

                      <Button
                        onClick={handleLoadUrl}
                        disabled={!ytUrl.trim() || ytLoading}
                        className={`h-10 px-6 text-zinc-950 font-bold text-sm rounded-xl transition-all ${detectedUrlType === 'cdn' ? 'bg-blue-500 hover:bg-blue-400' : 'bg-primary hover:bg-primary-dim'
                          }`}
                      >
                        {ytLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('player.load')}
                      </Button>
                    </div>

                    {/* Latest uploads */}
                    {!mediaLoading && mediaUploads.length > 0 && (
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t('setup.yourMedia')}</span>
                          {mediaUploads.length > 2 && onShowAllUploads && (
                            <button
                              onClick={onShowAllUploads}
                              className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                            >
                              {t('setup.viewAll')}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {mediaUploads.slice(0, 2).map((upload) => (
                            <div
                              key={upload.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectUpload(upload)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectUpload(upload); } }}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-zinc-700/40 hover:border-primary/40 hover:bg-zinc-800/60 transition-all group text-left w-full cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 group-hover:border-primary/40 transition-colors overflow-hidden">
                                {upload.source === 'youtube' ? (
                                  <Video className="w-3.5 h-3.5 text-red-400" />
                                ) : upload.source === 'spotify' ? (
                                  <SpotifyIcon className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Cloud className="w-3.5 h-3.5 text-zinc-400 group-hover:text-primary transition-colors" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 truncate transition-colors">
                                  {upload.title || upload.fileName || upload.youtubeUrl || 'Untitled'}
                                </p>
                              </div>
                              <button
                                onClick={(e) => handleDeleteUpload(e, upload.id)}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Lyrics Panel ── */}
          <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3 h-[420px] overflow-hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 flex-shrink-0">
              <FileText className="w-4 h-4 text-primary" />
              {t('setup.pasteLyrics')}
            </div>

            {parsedLines ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 overflow-y-auto pr-1 scrollbar-thin">
                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-medium text-zinc-200">{t('setup.lyricsReady')}</p>
                <p className="text-xs text-zinc-500">{t('setup.linesCount', { count: parsedLines.length })}</p>
                {lyricsFileName && <p className="text-xs text-zinc-500 truncate max-w-full px-2">{lyricsFileName}</p>}
                <Button
                  variant="ghost"
                  onClick={() => { setParsedLines(null); setLyricsFileName(''); setLyricsText(''); }}
                  className="h-8 px-3 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                >
                  {t('setup.changeLyrics')}
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-hidden">
                <Textarea
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder={t('setup.pasteLyricsDesc')}
                  className="flex-1 min-h-0 bg-zinc-900/50 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500 resize-none text-sm leading-relaxed focus:border-primary/50 overflow-y-auto scrollbar-thin"
                />

                {/* Import file button */}
                <label
                  htmlFor="setup-lyrics-input"
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors rounded-lg hover:bg-zinc-800/40 border border-zinc-700/40 hover:border-primary/30 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-zinc-500 group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">{t('setup.importFile')}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto">.lrc, .srt, .txt</span>
                  <input
                    ref={lyricsInputRef}
                    id="setup-lyrics-input"
                    type="file"
                    accept=".lrc,.srt,.txt"
                    onChange={handleLyricsFile}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Next button */}
        {canProceed && (
          <div className="flex justify-center mt-4 sm:mt-6 animate-fade-in">
            <Button
              onClick={handleProceed}
              className="h-10 px-5 bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all"
            >
              {t('setup.next')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
