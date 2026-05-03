import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tip } from '@/components/ui/tip';

export default function EditorPasteArea({
  rawText,
  setRawText,
  handleConfirmLyrics,
  fileInputRef,
  handleFileUpload,
  handleUrlImport,
  onCancel,
}) {
  const { t } = useTranslation();
  const [urlInput, setUrlInput] = useState('');
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState('');

  const handleUrlSubmit = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || urlFetching) return;
    setUrlFetching(true);
    setUrlError('');
    const result = await handleUrlImport(trimmed);
    setUrlFetching(false);
    if (result.success) {
      setUrlInput('');
    } else {
      setUrlError(result.error);
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-2 sm:gap-3 animate-fade-in min-h-0 px-1">
      <Textarea
        id="lyrics-textarea"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={t('editor.pastePlaceholder')}
        className="flex-1 bg-zinc-800/40 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 resize-none focus:border-primary/50 focus:ring-primary/25 font-mono leading-relaxed min-h-0"
      />
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex gap-2">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 py-2.5 sm:py-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 font-semibold rounded-lg sm:rounded-xl h-auto text-sm"
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
          )}
          <Button
            id="confirm-lyrics-btn"
            onClick={handleConfirmLyrics}
            disabled={!rawText.trim()}
            className={`${onCancel ? 'flex-[2]' : 'w-full'} py-2.5 sm:py-3 bg-primary hover:bg-primary-dim text-zinc-950 font-semibold rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-primary/20 h-auto text-sm`}
          >
            {t('editor.startSyncing')}
          </Button>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <input
            type="file"
            accept=".lrc,.srt,.txt"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Tip content={t('editor.importFile')}>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 sm:py-3 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 font-semibold rounded-lg sm:rounded-xl h-auto text-sm"
            >
            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            </Button>
          </Tip>
        </div>
        {/* URL import */}
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              placeholder={t('import.urlPlaceholder') || 'https://example.com/lyrics.lrc'}
              className="flex-1 bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 text-xs rounded-lg px-2.5 py-2 placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 min-w-0"
              disabled={urlFetching}
            />
            <Tip content={t('import.fromUrl') || 'Import from URL'}>
              <Button
                variant="outline"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim() || urlFetching}
                className="py-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-lg h-auto text-xs px-2.5 flex-shrink-0"
              >
              {urlFetching ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              </Button>
            </Tip>
          </div>
          {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
        </div>
      </div>
    </div>
  );
}
