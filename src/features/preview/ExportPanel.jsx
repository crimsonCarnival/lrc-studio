import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/useSettings';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { FloatingInput } from '@ui/floating-input';
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
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
  const exportPanelRef = useRef(null);

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
        <div className="flex items-center gap-2 mt-1 w-full">
          <div className="flex-1">
            <FloatingInput
              type="text"
              label={t('export.filename')}
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExport()}
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus-visible:ring-primary/25 focus-visible:border-primary/50"
            />
          </div>
          <span className="text-sm text-zinc-500 font-mono bg-zinc-800 px-2 py-1.5 rounded-lg border border-zinc-700/50">
            .{settings.export?.downloadFormat || 'lrc'}
          </span>
        </div>

        {/* Metadata Section */}
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

          {includeMetadata && ['ti', 'ar', 'al', 'au', 'by', 'lg', 're', 've'].map((key) => {
            const labels = {
              ti: t('export.metaTitle', 'Title'),
              ar: t('export.metaArtist', 'Artist'),
              al: t('export.metaAlbum', 'Album'),
              au: t('export.metaAuthor', 'Author'),
              by: t('export.metaCreator', 'LRC Creator'),
              lg: t('export.metaLanguage', 'Language'),
              re: t('export.metaResource', 'Resource'),
              ve: t('export.metaVersion', 'Version')
            };

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">
                  {labels[key]}
                </span>
                <Input
                  type="text"
                  value={metadata[key] || ''}
                  onChange={(e) =>
                    setMetadata((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={labels[key]}
                  className="flex-1 bg-zinc-900 border-zinc-700 text-xs text-zinc-100 placeholder-zinc-600 h-7 focus-visible:border-primary/50"
                />
              </div>
            );
          })}
        </div>

        {/* Format Specific Options */}
        {(hasSecondary || hasFurigana || hasTranslations) && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-700/30">
            {(hasSecondary || hasFurigana) && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-secondary-opt"
                  checked={includeSecondary}
                  onCheckedChange={setIncludeSecondary}
                  className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="include-secondary-opt" className="text-xs text-zinc-400 cursor-pointer">
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
                  id="include-translations-opt"
                  checked={includeTranslations}
                  onCheckedChange={setIncludeTranslations}
                  className="border-zinc-600 bg-zinc-900 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="include-translations-opt" className="text-xs text-zinc-400 cursor-pointer">
                  {t('export.includeTranslationsLrc', 'Translations')}
                </Label>
              </div>
            )}
          </div>
        )}


        {/* Word Timestamps */}
        {hasWords && (
          <div className="space-y-2 pt-2 border-t border-zinc-700/50">
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
          </div>
        )}

        {!hasWords && (!hasSecondary && !hasFurigana && !hasTranslations) && (
          <p className="text-xs text-zinc-600 italic px-1">
            {t('export.noExtraContent', 'No secondary text, translations, or word timestamps to include.')}
          </p>
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
