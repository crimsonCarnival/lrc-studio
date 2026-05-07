import { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/useSettings';
import { useAuthContext } from '@/contexts/useAuthContext';
import { spotify as spotifyApi, getAccessToken } from '@/api';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { FloatingInput } from '@ui/floating-input';
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
import SpotifyIcon from '@shared/SpotifyIcon';
import toast from 'react-hot-toast';

export default function ExportPanel({
  showExportPanel,
  setShowExportPanel,
  exportFilename,
  setExportFilename,
  metadata,
  setMetadata,
  includeTranslations,
  setIncludeTranslations,
  includeSecondary,
  setIncludeSecondary,
  includeWordTimestamps,
  setIncludeWordTimestamps,
  includeMetadata,
  setIncludeMetadata,
  hasTranslations,
  hasSecondary,
  hasWords,
  hasFurigana,
  wasCopied,
  handleExport,
  handleCopy
}) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { user } = useAuthContext();
  const exportPanelRef = useRef(null);
  const [playlistName, setPlaylistName] = useState('');
  const [exportingPlaylist, setExportingPlaylist] = useState(false);

  useEffect(() => {
    if (!showExportPanel) return;
    const handler = (e) => {
      if (
        exportPanelRef.current &&
        !exportPanelRef.current.contains(e.target) &&
        !e.target.closest('[data-export-toggle]')
      ) {
        setShowExportPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportPanel, setShowExportPanel]);

  const isSpotifyConnected = !!(getAccessToken() && user?.spotify?.spotifyId);

  const handleExportToPlaylist = useCallback(async () => {
    const name = playlistName.trim() || metadata?.ti || exportFilename || 'LRC Studio';
    setExportingPlaylist(true);
    try {
      const { id: playlistId } = await spotifyApi.createPlaylist(name);
      toast.success(t('spotify.playlistCreated'));
      setPlaylistName('');
      return playlistId;
    } catch {
      toast.error(t('spotify.exportFailed') || 'Failed to create playlist');
    } finally {
      setExportingPlaylist(false);
    }
  }, [playlistName, metadata, exportFilename, t]);

  if (!showExportPanel) return null;

  const isLrc = settings.export?.downloadFormat === 'lrc';

  return (
    <div
      ref={exportPanelRef}
      className="flex-1 min-h-0 flex flex-col animate-fade-in font-sans text-left"
    >
      {/* Scrollable options */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3 sm:p-4 rounded-xl bg-zinc-900 border border-zinc-700">
        {/* Filename */}
        <div className="flex items-center gap-1 mt-1">
          <FloatingInput
            type="text"
            label={t('export.filename')}
            value={exportFilename}
            onChange={(e) => setExportFilename(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExport()}
            className="flex-1 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus-visible:ring-primary/25 focus-visible:border-primary/50 w-0"
          />
          <span className="text-sm text-zinc-500 min-w-8">
            .{settings.export?.downloadFormat}
          </span>
        </div>

        {/* LRC Metadata */}
        {isLrc && (
          <div className="space-y-2 pt-2 border-t border-zinc-700/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">
                {t('export.metadata', 'LRC Metadata')}
              </span>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="include-metadata"
                  checked={includeMetadata}
                  onCheckedChange={setIncludeMetadata}
                  className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="include-metadata" className="text-[10px] text-zinc-500 cursor-pointer">
                  {t('export.includeInExport', 'Include')}
                </Label>
              </div>
            </div>

            {includeMetadata && ['ti', 'ar', 'al', 'lg'].map((key) => {
              const labels = {
                ti: t('export.metaTitle', 'Title'),
                ar: t('export.metaArtist', 'Artist'),
                al: t('export.metaAlbum', 'Album'),
                lg: t('export.metaLanguage', 'Language')
              };

              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-16">
                    {labels[key]}
                  </span>
                  <Input
                    type="text"
                    value={metadata[key]}
                    onChange={(e) =>
                      setMetadata((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={labels[key]}
                    className="flex-1 bg-zinc-900 border-zinc-700 text-xs text-zinc-100 placeholder-zinc-600 h-7 focus-visible:border-primary/50"
                  />
                </div>
              );
            })}

            {/* Secondary & translation checkboxes � LRC-specific */}
            {(hasSecondary || hasFurigana || hasTranslations) && (
              <div className="space-y-1.5 pt-1 border-t border-zinc-700/30">
                {(hasSecondary || hasFurigana) && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-secondary-lrc"
                      checked={includeSecondary}
                      onCheckedChange={setIncludeSecondary}
                      className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="include-secondary-lrc" className="text-xs text-zinc-400 cursor-pointer">
                      {t('export.includeSecondaryLrc', 'Secondary lyrics')}
                      {hasFurigana && (
                        <span className="ml-1 text-[10px] text-zinc-600 font-mono">{'({kanji|furigana})'}</span>
                      )}
                    </Label>
                  </div>
                )}
                {hasTranslations && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-translations-lrc"
                      checked={includeTranslations}
                      onCheckedChange={setIncludeTranslations}
                      className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Label htmlFor="include-translations-lrc" className="text-xs text-zinc-400 cursor-pointer">
                      {t('export.includeTranslationsLrc', 'Translations')}
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Include options */}
        <div className="space-y-2 pt-2 border-t border-zinc-700/50">
          <span className="text-xs text-zinc-400 font-medium">
            {t('export.includeOptions', 'Include in export')}
          </span>

          {!isLrc && (hasSecondary || hasFurigana) && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-secondary"
                checked={includeSecondary}
                onCheckedChange={setIncludeSecondary}
                className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="include-secondary" className="text-xs text-zinc-400 cursor-pointer">
                {t('export.includeSecondary', 'Secondary lyrics')}
                {hasFurigana && (
                  <span className="ml-1 text-[10px] text-zinc-600 font-mono">{'({kanji|furigana})'}</span>
                )}
              </Label>
            </div>
          )}

          {!isLrc && hasTranslations && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-translations"
                checked={includeTranslations}
                onCheckedChange={setIncludeTranslations}
                className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="include-translations" className="text-xs text-zinc-400 cursor-pointer">
                {t('preview.includeTranslations', 'Translations')}
              </Label>
            </div>
          )}

          {hasWords && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-words"
                checked={includeWordTimestamps}
                onCheckedChange={setIncludeWordTimestamps}
                className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="include-words" className="text-xs text-zinc-400 cursor-pointer">
                {t('export.includeWords', 'Word-by-word timestamps')}
              </Label>
            </div>
          )}

          {!hasWords && (isLrc || (!hasSecondary && !hasFurigana && !hasTranslations)) && (
            <p className="text-xs text-zinc-600 italic">
              {t('export.noExtraContent', 'No secondary text, translations, or word timestamps to include.')}
            </p>
          )}
        </div>

        {/* Spotify playlist export */}
        {isSpotifyConnected && (
          <div className="space-y-2 pt-2 border-t border-zinc-700/50">
            <span className="text-xs text-green-400 font-medium flex items-center gap-1.5">
              <SpotifyIcon className="w-3.5 h-3.5" />
              {t('spotify.exportToPlaylist')}
            </span>
            <div className="flex gap-2">
              <Input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder={metadata?.ti || exportFilename || t('spotify.playlistName')}
                className="flex-1 bg-zinc-900 border-zinc-700 text-xs text-zinc-100 placeholder-zinc-600 h-8 focus-visible:border-green-500/50"
              />
              <Button
                onClick={handleExportToPlaylist}
                disabled={exportingPlaylist}
                className="px-3 bg-green-600 hover:bg-green-500 text-white text-xs font-medium h-8 shrink-0 disabled:opacity-50"
              >
                {exportingPlaylist ? '�' : t('spotify.createPlaylist')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky buttons at bottom */}
      <div className="flex gap-2 w-full pt-3 flex-shrink-0">
        <Button
          variant="outline"
          onClick={handleCopy}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700 font-semibold text-sm h-10"
        >
          {wasCopied
            ? `${t('common.copied')} ${settings.export?.copyFormat.toUpperCase()}!`
            : t('preview.copyToClipboard')}
        </Button>

        <Button
          onClick={handleExport}
          className="flex-1 bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm h-10"
        >
          {t('export.download')}
        </Button>
      </div>
    </div>
  );
}
