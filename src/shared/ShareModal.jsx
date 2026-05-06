import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Copy, Check, AlertCircle, Clock, Calendar, Cloud } from 'lucide-react';
import { Tip } from '@ui/tip';
import { formatTime } from '@/utils/formatTime';

/**
 * SharePanel component for the sharing popover.
 * Enhanced with a custom time picker for deep linking.
 */
export function SharePanel({ 
  url: baseUrl, 
  ytUrl, 
  cloudinaryAudio,
  spotifyTrackId,
  mediaSource = 'none',
  linesCount, 
  hasSynced, 
  isPublic = true, 
  onPrivacyChange, 
  playbackPosition = 0,
  duration = 0
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Privacy state (public/private)
  const [privacy, setPrivacy] = useState(isPublic ? 'public' : 'private');
  
  // Time toggle state
  const [includeTime, setIncludeTime] = useState(false);
  const [customTime, setCustomTime] = useState(Math.floor(playbackPosition));

  // Sync customTime with playbackPosition initially or when toggled
  useEffect(() => {
    if (includeTime && customTime === 0 && playbackPosition > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomTime(Math.floor(playbackPosition));
    }
  }, [includeTime, playbackPosition, customTime]);

  // Dynamic URL
  const url = includeTime && customTime >= 0 
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}s=${customTime}`
    : baseUrl;

  const handlePrivacyToggle = () => {
    const newPrivacy = privacy === 'public' ? 'private' : 'public';
    setPrivacy(newPrivacy);
    if (onPrivacyChange) onPrivacyChange(newPrivacy);
  };

  useEffect(() => {
    if (!copied) {
      setTimeout(() => { inputRef.current?.select(); }, 80);
    }
  }, [url, copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
    }
  };

  const handleManualTimeChange = (e) => {
    const val = parseInt(e.target.value) || 0;
    setCustomTime(Math.max(0, duration > 0 ? Math.min(duration, val) : val));
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in">
      {/* Privacy/visibility toggle */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
          {t('share.visibility', 'Visibility')}
        </span>
        <Button
          variant={privacy === 'public' ? 'outline' : 'secondary'}
          size="sm"
          className={`h-7 flex items-center gap-1.5 px-3 rounded-full text-[10px] font-bold transition-all duration-300 ${privacy === 'public' 
            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]' 
            : 'text-zinc-400 border-zinc-700 bg-zinc-800 hover:bg-zinc-700'}`}
          onClick={handlePrivacyToggle}
        >
          {privacy === 'public' ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('share.public', 'Anyone with link')}
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              {t('share.private', 'Only me')}
            </>
          )}
        </Button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-2 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${mediaSource !== 'none'
            ? 'border-accent-blue/30 bg-accent-blue/5 text-accent-blue'
            : 'border-zinc-800 bg-zinc-900/50 text-zinc-600'
          }`}>
          {mediaSource === 'youtube' ? (
            <svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          ) : mediaSource === 'spotify' ? (
            <svg className="w-3 h-3 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.49 17.306c-.215.353-.676.465-1.028.249-2.856-1.745-6.452-2.14-10.686-1.173-.404.092-.812-.162-.904-.565-.092-.403.162-.812.565-.904 4.63-1.059 8.608-.606 11.79 1.34.352.215.464.676.249 1.028zm1.467-3.26c-.27.439-.844.582-1.282.311-3.265-2.007-8.243-2.592-12.103-1.42-.494.15-.99-.126-1.14-.62-.15-.494.126-.99.62-1.14 4.412-1.338 9.904-.683 13.614 1.597.44.27.583.844.311 1.282zm.126-3.41c-3.916-2.325-10.374-2.54-14.135-1.398-.6.183-1.236-.16-1.42-.76-.183-.6.16-1.237.76-1.42 4.314-1.31 11.44-1.054 15.962 1.628.54.32.716 1.02.396 1.56-.32.54-1.02.716-1.56.396z" />
            </svg>
          ) : mediaSource === 'cloudinary' ? (
            <Cloud className="w-3 h-3 text-sky-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-zinc-700" />
          )}
          {mediaSource === 'youtube' ? t('share.youtubeIncluded', 'YouTube') : (mediaSource === 'spotify' ? t('share.spotifyIncluded', 'Spotify') : (mediaSource === 'cloudinary' ? t('share.mediaIncluded', 'Cloud Audio') : t('share.noMedia', 'No Media')))}
        </div>

        <div className={`flex items-center gap-2 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${hasSynced
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-zinc-800 bg-zinc-900/50 text-zinc-600'
          }`}>
          <Calendar className="w-3 h-3" />
          {linesCount} {hasSynced ? t('share.syncedLines', 'Synced') : t('share.lines', 'Lines')}
        </div>
      </div>

      {/* Time Toggle & Picker */}
      <div className="space-y-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div 
              onClick={() => setIncludeTime(!includeTime)}
              className={`w-8 h-4 rounded-full p-0.5 transition-all duration-300 ${includeTime ? 'bg-primary' : 'bg-zinc-700'}`}
            >
              <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${includeTime ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className={`text-[11px] font-bold transition-colors ${includeTime ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {t('share.includeTime', 'Start at specific time')}
            </span>
          </label>
          {includeTime && (
            <span className="text-[10px] font-mono text-primary font-bold">
              {formatTime(customTime)}
            </span>
          )}
        </div>

        {includeTime && (
          <div className="space-y-3 pt-1 animate-in slide-in-from-top-2 duration-300">
            {duration > 0 && (
              <div className="relative h-6 flex items-center group">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="1"
                  value={customTime}
                  onChange={(e) => setCustomTime(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary group-hover:h-1.5 transition-all"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <Input
                  type="number"
                  value={customTime}
                  onChange={handleManualTimeChange}
                  className="h-8 pl-8 bg-zinc-950/50 border-zinc-800 text-[11px] font-mono focus:ring-primary/20"
                  placeholder="Seconds..."
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomTime(Math.floor(playbackPosition))}
                className="h-8 px-2 text-[10px] text-zinc-400 hover:text-primary hover:bg-primary/5 font-bold"
              >
                {t('share.useCurrent', 'Current')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-[10px] text-zinc-500 leading-relaxed px-1">
        {privacy === 'public'
          ? t('share.description', 'Anyone with this link can view the lyrics sync and media.')
          : t('share.privateDescription', 'Only you can access this project.')}
      </p>

      {/* URL + copy */}
      <div className="flex gap-2 group mt-1">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            readOnly
            value={url}
            onClick={() => inputRef.current?.select()}
            className="w-full bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700/80 rounded-xl px-3 py-2.5 text-[11px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-text transition-all"
          />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-950/50 to-transparent pointer-events-none rounded-r-xl" />
        </div>
        <Tip content={copied ? t('share.copied', 'Copied!') : t('share.copy', 'Copy link')}>
          <Button
            onClick={handleCopy}
            variant="outline"
            className={`flex-shrink-0 h-[38px] w-[38px] p-0 border transition-all duration-300 rounded-xl ${copied
                ? 'bg-primary/20 border-primary/40 text-primary scale-105'
                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 hover:scale-105 active:scale-95'
              }`}
          >
            {copied ? <Check className="w-4 h-4" strokeWidth={3} /> : <Copy className="w-4 h-4" />}
          </Button>
        </Tip>
      </div>
    </div>
  );
}
