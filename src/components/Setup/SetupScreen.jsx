import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FolderOpen, Music2, FileText, Upload, Check, ArrowRight, Trash2, Video, Cloud } from 'lucide-react';
import { lyrics as lyricsApi, uploads as uploadsApi, spotify as spotifyApi, getAccessToken } from '../../api';
import { formatTime } from '../../utils/formatTime';
import { SkeletonMediaItem } from '@/components/ui/skeleton';
import SpotifyBrowser from '../Player/SpotifyBrowser';
import SpotifyIcon from '../shared/SpotifyIcon';
import { useAuthContext } from '../../contexts/useAuthContext';
import toast from 'react-hot-toast';

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

export default function SetupScreen({ onComplete, playerRef, onShowAllUploads, onOpenSettings }) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const audioInputRef = useRef(null);
  const lyricsInputRef = useRef(null);

  // Audio state
  const [audioReady, setAudioReady] = useState(false);
  const [audioName, setAudioName] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [showSpotifyBrowser, setShowSpotifyBrowser] = useState(false);
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
    if (playerRef.current?.loadLocalAudio) {
      playerRef.current.loadLocalAudio(file);
    }
    setAudioName(file.name);
    setAudioReady(true);
    setAudioSource('local');
    setSelectedUpload(null);
    // Record will be saved after Cloudinary upload completes (via onCloudinaryUpload in Player)
  };

  const handleLoadYt = () => {
    if (!ytUrl.trim()) return;
    setYtLoading(true);
    if (playerRef.current?.loadYouTube) {
      playerRef.current.loadYouTube(ytUrl.trim());
    }
    setAudioName(ytUrl.trim());
    setAudioReady(true);
    setAudioSource('youtube');
    setSelectedUpload(null);
    setYtLoading(false);
    // Save YouTube URL as a media record (title will be auto-fetched by backend)
    saveUploadRecord({
      source: 'youtube',
      youtubeUrl: ytUrl.trim(),
      fileName: '',
    });
  };

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
      // Load cloudinary audio via URL — fetch as blob and load
      fetch(upload.cloudinaryUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], upload.fileName || 'audio.mp3', { type: blob.type || 'audio/mpeg' });
          if (playerRef.current?.loadLocalAudio) {
            playerRef.current.loadLocalAudio(file);
          }
        })
        .catch(() => {
          toast.error('Failed to load audio from cloud');
          setAudioReady(false);
        });
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
      handleLoadYt();
    }
  };

  const handleSpotifyBrowserSelect = useCallback(async (track) => {
    setShowSpotifyBrowser(false);
    if (playerRef.current?.loadSpotify) {
      playerRef.current.loadSpotify(track.trackId, track.title || track.name || '', false);
    } else if (playerRef.current?.playTrack) {
      playerRef.current.playTrack(track.trackId, track.title || track.name || '', false);
    }
    setAudioName(track.title || track.name || 'Spotify track');
    setAudioReady(true);
    setAudioSource('spotify');
    setSelectedUpload(null);

    // Save to uploads library
    if (getAccessToken()) {
      try {
        await spotifyApi.createUpload(`spotify:track:${track.trackId}`);
        // Refresh uploads list
        const { uploads } = await uploadsApi.listMedia();
        setMediaUploads(uploads || []);
      } catch (err) {
        // Silent fail - don't interrupt the user flow
        console.error('Failed to save Spotify track to uploads:', err);
      }
    }
  }, [playerRef]);

  // ── Lyrics handlers ──

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
    // Build lines from either parsed file or raw text
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
    onComplete({ lines: finalLines, editorMode });
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-4 sm:py-6 animate-fade-in overflow-hidden">
      <div className="w-full max-w-3xl mx-auto flex flex-col">
        {/* Title */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-accent-purple shadow-lg shadow-primary/20 mb-3">
            <Music2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">{t('setup.title')}</h2>
        </div>

        {/* Two panels side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-220px)]">
          {/* ── Audio Panel ── */}
          <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 flex-shrink-0">
              <Music2 className="w-4 h-4 text-primary" />
              {t('setup.uploadAudio')}
            </div>

            {audioReady ? (
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
                  size="sm"
                  onClick={() => { setAudioReady(false); setAudioName(''); setYtUrl(''); setSelectedUpload(null); setAudioSource(null); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {t('setup.changeAudio')}
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
                {/* Your media library */}
                {mediaLoading ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t('setup.yourMedia')}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <SkeletonMediaItem />
                      <SkeletonMediaItem />
                    </div>
                  </div>
                ) : mediaUploads.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{t('setup.yourMedia')}</span>
                      {mediaUploads.length > 2 && onShowAllUploads && (
                        <button
                          onClick={onShowAllUploads}
                          className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                        >
                          {t('setup.viewAll')} ({mediaUploads.length})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
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
                            {upload.duration && (
                              <p className="text-[10px] text-zinc-500">{formatTime(upload.duration)}</p>
                            )}
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
                    {/* Divider */}
                    <div className="flex items-center gap-3 px-1">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{t('setup.uploadNew')}</span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                  </div>
                ) : null}

                {/* File upload */}
                <label
                  htmlFor="setup-audio-input"
                  className="flex items-center gap-2.5 px-3 py-3 cursor-pointer group transition-colors rounded-xl border-2 border-dashed border-zinc-700/60 hover:border-primary/40 hover:bg-zinc-800/40"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('audio/')) {
                      handleAudioFile({ target: { files: [file] } });
                    }
                  }}
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center group-hover:border-primary/40 transition-all flex-shrink-0">
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-500 group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{t('setup.uploadAudioDesc')}</p>
                    <p className="text-[11px] text-zinc-500">{t('setup.audioFormats')}</p>
                  </div>
                  <input
                    ref={audioInputRef}
                    id="setup-audio-input"
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioFile}
                    className="hidden"
                  />
                </label>

                {/* Divider */}
                <div className="flex items-center gap-3 px-1">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{t('setup.orPasteUrl')}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* YouTube URL */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500/70 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <Input
                      type="text"
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      onKeyDown={handleYtKeyDown}
                      placeholder={t('player.pasteUrl')}
                      className="pl-8 bg-zinc-800/50 border-zinc-700/60 text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleLoadYt}
                    disabled={!ytUrl.trim() || ytLoading}
                    className="bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl px-4"
                  >
                    {t('player.load')}
                  </Button>
                </div>

                {/* Spotify Browser */}
                <>
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{t('setup.orSpotify') || 'or Spotify'}</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  {user?.spotify?.spotifyId ? (
                    showSpotifyBrowser ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">{t('spotify.browse')}</span>
                          <button onClick={() => setShowSpotifyBrowser(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                            {t('setup.orPasteUrl')}
                          </button>
                        </div>
                        <div className="max-h-[180px] overflow-y-auto rounded-lg border border-zinc-700/40">
                          <SpotifyBrowser
                            onSelectTrack={handleSpotifyBrowserSelect}
                            onClose={() => setShowSpotifyBrowser(false)}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSpotifyBrowser(true)}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl border border-green-500/30 hover:border-green-500/50 hover:bg-green-500/5 transition-all group text-left"
                      >
                        <SpotifyIcon className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm font-medium text-green-400 group-hover:text-green-300 transition-colors">
                          {t('spotify.browseLibrary')}
                        </span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        if (onOpenSettings) {
                          onOpenSettings();
                        }
                      }}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl border border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all group text-left"
                    >
                      <SpotifyIcon className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-primary group-hover:text-primary/80 transition-colors">
                          {t('settings.spotify.connectAccount', 'Connect Spotify Account')}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {t('settings.spotify.connectToAccess', 'Connect Spotify to access your library and playlists')}
                        </span>
                      </div>
                    </button>
                  )}
                </>
              </div>
            )}
          </div>

          {/* ── Lyrics Panel ── */}
          <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 flex-shrink-0">
              <FileText className="w-4 h-4 text-primary" />
              {t('setup.pasteLyrics')}
            </div>

            {parsedLines ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
                <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-medium text-zinc-200">{t('setup.lyricsReady')}</p>
                <p className="text-xs text-zinc-500">{t('setup.linesCount', { count: parsedLines.length })}</p>
                {lyricsFileName && <p className="text-xs text-zinc-500 truncate max-w-full px-2">{lyricsFileName}</p>}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setParsedLines(null); setLyricsFileName(''); setLyricsText(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {t('setup.changeLyrics')}
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2.5 min-h-0">
                <Textarea
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  placeholder={t('setup.pasteLyricsDesc')}
                  className="flex-1 min-h-[120px] max-h-full field-sizing-fixed overflow-y-auto bg-zinc-900/50 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500 resize-none font-mono text-sm leading-relaxed focus:border-primary/50"
                />

                {/* Import file button */}
                <label
                  htmlFor="setup-lyrics-input"
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors rounded-lg hover:bg-zinc-800/40 border border-zinc-700/40 hover:border-primary/30"
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
              className="bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10 sm:h-11 px-6 sm:px-8 gap-2 shadow-lg shadow-primary/20"
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
