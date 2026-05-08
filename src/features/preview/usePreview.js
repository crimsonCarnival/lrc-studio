import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/useSettings';
import { downloadLRC } from '@/utils/lrc';
import { lyrics } from '@/api';
import { matchKey } from '@/utils/keyboard';

export function usePreview({ lines, setLines, playbackPosition, playerRef, duration, mediaTitle, editorMode }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const containerRef = useRef(null);
  const activeRef = useRef(null);

  const [showMenu, setShowMenu] = useState(false);
  const [pastingType, setPastingType] = useState(null);
  const [pasteText, setPasteText] = useState('');

  const [exportFilename, setExportFilename] = useState(() =>
    settings.export?.defaultFilenamePattern === 'media' && mediaTitle ? mediaTitle : 'lyrics'
  );
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [includeTranslations, setIncludeTranslations] = useState(false);
  const [includeSecondary, setIncludeSecondary] = useState(true);
  const [includeWordTimestamps, setIncludeWordTimestamps] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [showTranslationsInPreview, setShowTranslationsInPreview] = useState(true);
  const [showFuriganaInPreview, setShowFuriganaInPreview] = useState(true);
  const [wasCopied, setWasCopied] = useState(false);
  const [metadata, setMetadata] = useState({ 
    ti: '', // Title
    ar: '', // Artist
    al: '', // Album
    au: '', // Author/Composer
    by: '', // LRC Creator
    lg: '', // Language
    re: '', // Resource/Player
    ve: ''  // Version
  });

  useEffect(() => {
    if (settings.export?.defaultFilenamePattern === 'media' && mediaTitle) {
      setExportFilename(mediaTitle);
    } else if (settings.export?.defaultFilenamePattern === 'fixed') {
      setExportFilename('lyrics');
    }
  }, [settings.export?.defaultFilenamePattern, mediaTitle]);

  const sizeOption = settings.interface?.fontSize || 'normal';
  const spacingOption = settings.interface?.spacing || 'normal';

  const activeFontSizes = {
    small: 'text-lg sm:text-xl',
    normal: 'text-2xl sm:text-3xl',
    large: 'text-3xl sm:text-4xl',
    xlarge: 'text-4xl sm:text-5xl'
  };
  const inactiveFontSizes = {
    small: 'text-sm sm:text-base',
    normal: 'text-base sm:text-xl',
    large: 'text-lg sm:text-2xl',
    xlarge: 'text-xl sm:text-3xl'
  };
  const activeSecondarySizes = {
    small: 'text-[10px] sm:text-xs',
    normal: 'text-xs sm:text-sm',
    large: 'text-sm sm:text-base',
    xlarge: 'text-base sm:text-lg'
  };
  const inactiveSecondarySizes = {
    small: 'text-[9px] sm:text-[10px]',
    normal: 'text-xs',
    large: 'text-sm',
    xlarge: 'text-sm sm:text-base'
  };
  const wrapperSpacing = {
    compact: 'space-y-0',
    normal: 'space-y-1',
    relaxed: 'space-y-3'
  };
  const activeMargin = {
    compact: 'my-0.5 sm:my-1',
    normal: 'my-1 sm:my-2',
    relaxed: 'my-2 sm:my-4'
  };

  const syncedIndices = useMemo(() => {
    const indices = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timestamp != null) {
        indices.push(i);
      }
    }
    return indices;
  }, [lines]);

  const currentIndex = useMemo(() => {
    if (editorMode === 'srt' && !playbackPosition && !duration) return -1;

    let bestIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.timestamp == null) continue;

      if (line.timestamp <= playbackPosition) {
        if (editorMode === 'srt') {
          if (line.endTime != null && playbackPosition >= line.endTime) continue;
        }
        bestIdx = i;
      } else {
        break;
      }
    }
    return bestIdx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, playbackPosition, editorMode]);

  // Scroll-to-active is now handled by PreviewViewport's virtualizer (scrollToIndex).
  // The ref-based fallback below is kept only for dual-line mode where the
  // virtualizer is inactive and activeRef still applies.
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    if (settings.editor?.scroll?.alignment === 'none') return;
    const container = containerRef.current;
    const element = activeRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    if (elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom) return;
    const elementTop = elementRect.top - containerRect.top + container.scrollTop;
    container.scrollTo({
      top: elementTop - containerRect.height / 2 + elementRect.height / 2,
      behavior: settings.editor?.scroll?.mode || 'smooth',
    });
  }, [settings.editor?.scroll?.mode, settings.editor?.scroll?.alignment]);

  const hasSyncedLines = syncedIndices.length > 0;
  const hasTranslations = lines.some(l => l.translation);
  const hasSecondary = lines.some(l => l.secondary);
  const hasWords = lines.some(l => l.words?.length);
  const hasFurigana = lines.some(l => l.furigana || l.words?.some(w => w.reading));

  // ——— Preview keyboard shortcuts ———
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (pastingType) return; // paste panel open — don't intercept
      if (matchKey(e, settings.shortcuts?.toggleTranslation?.[0] || 't')) {
        e.preventDefault();
        setShowTranslationsInPreview((prev) => !prev);
      } else if (matchKey(e, settings.shortcuts?.addSecondary?.[0] || 'Shift+H')) {
        e.preventDefault();
        setPastingType('secondary');
        setPasteText(lines.map((l) => l.secondary || '').join('\n'));
      } else if (matchKey(e, settings.shortcuts?.addTranslation?.[0] || 'Shift+T')) {
        e.preventDefault();
        setPastingType('translation');
        setPasteText(lines.map((l) => l.translation || '').join('\n'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.shortcuts, lines, pastingType]);

  const handleSavePaste = () => {
    if (!pastingType) return;
    const newTexts = pasteText.split('\n');
    setLines((prev) =>
      prev.map((l, i) => ({
        ...l,
        [pastingType]: newTexts[i] !== undefined ? newTexts[i].trim() : l[pastingType],
      }))
    );
    setPastingType(null);
    setPasteText('');
    setShowMenu(false);
  };

  const handleLineClick = (line) => {
    if (line.timestamp != null && playerRef?.current?.seek) {
      playerRef.current.seek(line.timestamp);
      playerRef.current.play();
    }
  };

  const prepareExportLines = (inputLines) => {
    let result = inputLines;
    if (settings.export?.stripEmptyLines) {
      result = result.filter(l => l.text.trim() !== '');
    }
    if (settings.export?.normalizeTimestamps) {
      result = [...result].sort((a, b) => {
        if (a.timestamp == null && b.timestamp == null) return 0;
        if (a.timestamp == null) return 1;
        if (b.timestamp == null) return -1;
        return a.timestamp - b.timestamp;
      });
    }
    return result;
  };

  const applyIncludeFlags = (inputLines) => {
    return inputLines.map(l => {
      const newLine = { ...l };
      if (!includeWordTimestamps && newLine.words) {
        // If we don't want word timestamps, but we HAVE words,
        // we must keep the words if they have readings (for furigana export).
        // We just nullify the times so they don't show up as <mm:ss.xx>
        newLine.words = newLine.words.map(w => ({ ...w, time: null }));
      }
      return newLine;
    });
  };

  const handleExport = useCallback(async () => {
    const name = (exportFilename || 'lyrics').trim();
    const exportLines = applyIncludeFlags(prepareExportLines(lines));

    try {
      let content = '';
      if (settings.export?.downloadFormat === 'srt') {
        const result = await lyrics.compileSrt({
          lines: exportLines,
          duration,
          includeTranslations,
          lineEndings: settings.export?.lineEndings,
          srtConfig: settings.editor?.srt,
          includeSecondary,
        });
        content = result.output;
        downloadLRC(content, `${name}.srt`);
      } else {
        const filteredMetadata = includeMetadata
          ? Object.fromEntries(
            Object.entries(metadata).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
          )
          : {};
        const result = await lyrics.compileLrc({
          lines: exportLines,
          includeTranslations,
          precision: settings.export?.timestampPrecision,
          metadata: filteredMetadata,
          lineEndings: settings.export?.lineEndings,
          includeSecondary,
          wordPrecision: settings.export?.wordTimestampPrecision,
        });
        content = result.output;
        downloadLRC(content, `${name}.lrc`);
      }

      setShowExportPanel(false);
      toast.success(t('export.success') || 'File downloaded');
    } catch (err) {
      console.error('Export failed', err);
      toast.error(t('export.failed') || 'Export failed');
    }
  }, [
    exportFilename, lines, settings, duration, includeTranslations,
    includeSecondary, includeMetadata, metadata, t, setShowExportPanel
  ]);

  const handleCopy = useCallback(async () => {
    const exportLines = applyIncludeFlags(prepareExportLines(lines));

    try {
      let content = '';
      if (settings.export?.copyFormat === 'srt') {
        const result = await lyrics.compileSrt({
          lines: exportLines,
          duration,
          includeTranslations,
          lineEndings: settings.export?.lineEndings,
          srtConfig: settings.editor?.srt,
          includeSecondary,
        });
        content = result.output;
      } else {
        const filteredMetadata = includeMetadata
          ? Object.fromEntries(
            Object.entries(metadata).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
          )
          : {};
        const result = await lyrics.compileLrc({
          lines: exportLines,
          includeTranslations,
          precision: settings.export?.timestampPrecision,
          metadata: filteredMetadata,
          lineEndings: settings.export?.lineEndings,
          includeSecondary,
          wordPrecision: settings.export?.wordTimestampPrecision,
        });
        content = result.output;
      }

      await navigator.clipboard.writeText(content);
      setWasCopied(true);
      setTimeout(() => setWasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast.error(t('export.copyFailed') || 'Failed to copy to clipboard');
    }
  }, [
    lines, settings, duration, includeTranslations,
    includeSecondary, includeMetadata, metadata, t
  ]);

  return {
    t,
    settings,
    containerRef,
    activeRef,
    showMenu,
    setShowMenu,
    pastingType,
    setPastingType,
    pasteText,
    setPasteText,
    exportFilename,
    setExportFilename,
    showExportPanel,
    setShowExportPanel,
    includeTranslations,
    setIncludeTranslations,
    includeSecondary,
    setIncludeSecondary,
    includeWordTimestamps,
    setIncludeWordTimestamps,
    includeMetadata,
    setIncludeMetadata,
    showTranslationsInPreview,
    setShowTranslationsInPreview,
    showFuriganaInPreview,
    setShowFuriganaInPreview,
    wasCopied,
    metadata,
    setMetadata,
    sizeOption,
    spacingOption,
    activeFontSizes,
    inactiveFontSizes,
    activeSecondarySizes,
    inactiveSecondarySizes,
    wrapperSpacing,
    activeMargin,
    currentIndex,
    hasSyncedLines,
    hasTranslations,
    hasSecondary,
    hasWords,
    hasFurigana,
    handleSavePaste,
    handleLineClick,
    handleExport,
    handleCopy,
  };
}
