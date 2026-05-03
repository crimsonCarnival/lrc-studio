import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { projects } from '../../api';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePreview } from './usePreview';
import ExportPanel from './ExportPanel';
import PreviewPasteArea from './PreviewPasteArea';
import PreviewLine from './PreviewLine';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tip } from '@/components/ui/tip';
import { SharePanel } from '../shared/ShareModal';
import { Eye, Share2, X, Lock, LockOpen, BookOpen, Plus } from 'lucide-react';

export default function Preview(props) {
  // Accept activeProjectId and project as props
  const { activeProjectId, project, projectMetadata } = props;
  const coverUrl = projectMetadata?.coverUrl || project?.metadata?.coverUrl;
  // Privacy state for sharing (default public)
  const [isPublic, setIsPublic] = useState(project?.public ?? true);
  // Sync privacy state with project prop
  useEffect(() => {
    if (project && typeof project.public === 'boolean') {
      setIsPublic(project.public);
    }
  }, [project]);

  // Handler for privacy toggle in SharePanel
  const handlePrivacyChange = async (newPrivacy) => {
    const newIsPublic = newPrivacy === 'public';
    setIsPublic(newIsPublic);
    // Persist to server if projectId present
    if (activeProjectId) {
      try {
        await projects.patch(activeProjectId, { public: newIsPublic });
      } catch (err) {
        // Optionally show error/toast
      }
    }
  };
  const {
    t,
    settings,
    containerRef,
    activeRef,
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
  } = usePreview(props);

  const { lines, playbackPosition, exportToUrl, isSharedProject, sharedReadOnly, setSharedReadOnly, editorMode, shareModal, setShareModal, hasMedia, viewerMode } = props;

  const shareTriggerRef = useRef(null);
  const sharePanelRef = useRef(null);
  const [shareAnchor, setShareAnchor] = useState(null);

  // Close panel on outside click
  useEffect(() => {
    if (!shareModal) return;
    const handler = (e) => {
      if (shareTriggerRef.current?.contains(e.target)) return;
      if (sharePanelRef.current?.contains(e.target)) return;
      setShareModal(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareModal, setShareModal]);

  const handleShareToggle = useCallback(() => {
    if (shareModal) {
      setShareModal(null);
      setShareAnchor(null);
      return;
    }
    if (shareTriggerRef.current) {
      const rect = shareTriggerRef.current.getBoundingClientRect();
      setShareAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    exportToUrl();
  }, [shareModal, setShareModal, exportToUrl]);

  return (
    <>
      <div className="glass relative rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 sm:mb-4 gap-2 sm:gap-4 relative z-raised">
          <h2 className="text-xs sm:text-sm font-semibold tracking-widest text-zinc-400 flex items-center gap-2 overflow-hidden flex-1 pb-1">
            <span className="uppercase shrink-0 text-xs sm:text-sm flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {t('preview.title')}
            </span>
          </h2>
          {hasSyncedLines && (
            <div className="relative flex items-center gap-1 text-zinc-300">
              {hasFurigana && (
                <Tip content={t('preview.furigana', 'Furigana')}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowFuriganaInPreview((v) => !v)}
                    className={`flex-shrink-0 transition-colors ${showFuriganaInPreview ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  >
                    <BookOpen className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.8} />
                  </Button>
                </Tip>
              )}
              {/* Share button */}
              <Tip content={shareModal ? t('share.close') : (isSharedProject ? t('share.viewingShared') : t('app.shareProject'))}>
                {viewerMode ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg text-primary bg-primary/10">
                    <Share2 className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.8} />
                  </div>
                ) : (
                  <Button
                    ref={shareTriggerRef}
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleShareToggle}
                    className={`flex-shrink-0 transition-colors ${isSharedProject
                      ? 'text-primary bg-primary/10 hover:bg-primary/20'
                      : shareModal
                        ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                  >
                    {shareModal
                      ? <X className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={2} />
                      : <Share2 className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.8} />
                    }
                  </Button>
                )}
              </Tip>
              {/* Lock/unlock toggle for shared projects */}
              {isSharedProject && !viewerMode && (
                <Tip content={sharedReadOnly ? t('share.readOnlyTitle') : t('share.editingTitle')}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSharedReadOnly?.(!sharedReadOnly)}
                    className={`flex-shrink-0 ${sharedReadOnly ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20' : 'text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20'}`}
                  >
                    {sharedReadOnly
                      ? <Lock className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.8} />
                      : <LockOpen className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.8} />
                    }
                  </Button>
                </Tip>
              )}
              {lines.some(l => l.translation) && (
                <Tip content={t('preview.toggleTranslations') || 'Toggle Translations'}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowTranslationsInPreview(!showTranslationsInPreview)}
                    className={`flex-shrink-0 ${showTranslationsInPreview ? 'text-primary hover:text-primary-dim bg-zinc-800/50 hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  >
                    <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  </Button>
                </Tip>
              )}
              <div className="relative">
                <Tip content={t('export.title') || 'Export File'}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-export-toggle
                    onClick={() => setShowExportPanel(!showExportPanel)}
                    className={`flex-shrink-0 ${showExportPanel ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  >
                    {showExportPanel ? (
                      <X className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={2} />
                    ) : (
                      <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                  </Button>
                </Tip>
              </div>

              {/* Menu */}
              {!viewerMode && !sharedReadOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex-shrink-0"
                    >
                      <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 sm:w-48" align="end">
                    <PopoverItem
                      onClick={() => { setPastingType('secondary'); setPasteText(lines.map(l => l.secondary || '').join('\n')); }}
                      className="sm:text-sm"
                    >
                      {t('preview.secondaryLyrics')}
                    </PopoverItem>
                    <PopoverItem
                      onClick={() => { setPastingType('translation'); setPasteText(lines.map(l => l.translation || '').join('\n')); }}
                      className="sm:text-sm"
                    >
                      {t('preview.translation')}
                    </PopoverItem>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        {/* Viewport */}
        {showExportPanel ? (
          <ExportPanel
            showExportPanel={showExportPanel}
            setShowExportPanel={setShowExportPanel}
            exportFilename={exportFilename}
            setExportFilename={setExportFilename}
            metadata={metadata}
            setMetadata={setMetadata}
            includeTranslations={includeTranslations}
            setIncludeTranslations={setIncludeTranslations}
            includeSecondary={includeSecondary}
            setIncludeSecondary={setIncludeSecondary}
            includeWordTimestamps={includeWordTimestamps}
            setIncludeWordTimestamps={setIncludeWordTimestamps}
            includeMetadata={includeMetadata}
            setIncludeMetadata={setIncludeMetadata}
            hasTranslations={hasTranslations}
            hasSecondary={hasSecondary}
            hasWords={hasWords}
            hasFurigana={hasFurigana}
            wasCopied={wasCopied}
            handleExport={handleExport}
            handleCopy={handleCopy}
          />
        ) : pastingType ? (
          <PreviewPasteArea
            pastingType={pastingType}
            setPastingType={setPastingType}
            pasteText={pasteText}
            setPasteText={setPasteText}
            handleSavePaste={handleSavePaste}
          />
        ) : (
          <PreviewViewport
            containerRef={containerRef}
            lines={lines}
            currentIndex={currentIndex}
            hasSyncedLines={hasSyncedLines}
            playbackPosition={playbackPosition}
            activeRef={activeRef}
            handleLineClick={handleLineClick}
            showTranslationsInPreview={showTranslationsInPreview}
            showFuriganaInPreview={showFuriganaInPreview}
            sizeOption={sizeOption}
            spacingOption={spacingOption}
            activeSecondarySizes={activeSecondarySizes}
            inactiveSecondarySizes={inactiveSecondarySizes}
            activeFontSizes={activeFontSizes}
            inactiveFontSizes={inactiveFontSizes}
            activeMargin={activeMargin}
            wrapperSpacing={wrapperSpacing}
            settings={settings}
            editorMode={editorMode}
            t={t}
            hasMedia={hasMedia}
          />
        )}
      </div>
      {shareModal && shareAnchor && createPortal(
        <div
          ref={sharePanelRef}
          style={{ position: 'fixed', top: shareAnchor.top, right: shareAnchor.right }}
          className="z-overlay w-80 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-elevated animate-fade-in"
        >
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center flex-shrink-0">
              <Share2 className="w-3 h-3 text-white" strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-zinc-100">{t('share.title', 'Share Project')}</span>
          </div>
          <SharePanel
            {...shareModal}
            isPublic={isPublic}
            onPrivacyChange={handlePrivacyChange}
            playbackPosition={playbackPosition}
          />
        </div>,
        document.body
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────
// Virtualized preview viewport — handles both normal and dual-line modes
// ────────────────────────────────────────────────────────
function PreviewViewport({
  containerRef,
  lines,
  currentIndex,
  hasSyncedLines,
  playbackPosition,
  activeRef,
  handleLineClick,
  showTranslationsInPreview,
  showFuriganaInPreview,
  sizeOption,
  spacingOption,
  activeSecondarySizes,
  inactiveSecondarySizes,
  activeFontSizes,
  inactiveFontSizes,
  activeMargin,
  wrapperSpacing,
  settings,
  editorMode,
  t,
  hasMedia,
}) {
  const isDualLine = settings.editor?.display?.dualLine;
  const showNextLine = settings.editor?.display?.showNextLine !== false;
  const scrollAlignment = settings.editor?.scroll?.alignment || 'center';
  const scrollMode = settings.editor?.scroll?.mode || 'smooth';

  // Pre-compute nextTimestamp for karaoke fill
  const nextTimestamps = useMemo(() => {
    const result = {};
    for (let idx = 0; idx < lines.length; idx++) {
      for (let j = idx + 1; j < lines.length; j++) {
        if (lines[j].timestamp != null) {
          result[idx] = lines[j].timestamp;
          break;
        }
      }
    }
    return result;
  }, [lines]);

  // Compute display lines for dual-line mode
  const dualDisplayLines = useMemo(() => {
    if (!isDualLine) return null;
    let result;
    if (currentIndex === -1) {
      const firstSynced = lines.findIndex((l) => l.timestamp != null);
      result = firstSynced !== -1
        ? [{ line: lines[firstSynced], originalIndex: firstSynced }]
        : [{ line: lines[0], originalIndex: 0 }];
      if (showNextLine && result[0].originalIndex + 1 < lines.length) {
        const idx = result[0].originalIndex + 1;
        result.push({ line: lines[idx], originalIndex: idx });
      }
    } else {
      result = [{ line: lines[currentIndex], originalIndex: currentIndex }];
      if (showNextLine) {
        let nextIdx = currentIndex + 1;
        while (nextIdx < lines.length && lines[nextIdx].timestamp == null) nextIdx++;
        if (nextIdx < lines.length) result.push({ line: lines[nextIdx], originalIndex: nextIdx });
      }
    }
    return result;
  }, [isDualLine, lines, currentIndex, showNextLine]);

  const virtualizer = useVirtualizer({
    count: isDualLine ? 0 : lines.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 5,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 52,
  });

  // Auto-scroll to active line (virtual)
  useEffect(() => {
    if (isDualLine || scrollAlignment === 'none' || currentIndex < 0) return;
    virtualizer.scrollToIndex(currentIndex, {
      align: scrollAlignment === 'start' ? 'start' : scrollAlignment === 'end' ? 'end' : 'center',
      behavior: scrollMode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isDualLine, scrollAlignment, scrollMode]);

  if (!lines.length) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 mask-edges rounded-lg flex items-center justify-center"
      >
        <p className="text-zinc-600 text-xs sm:text-sm italic text-center px-4">
          {t('editor.pastePlaceholder')}
        </p>
      </div>
    );
  }

  if (!hasSyncedLines) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 mask-edges rounded-lg flex items-center justify-center"
      >
        <p className="text-zinc-600 text-xs sm:text-sm italic text-center px-4">
          {t('preview.placeholder')}
        </p>
      </div>
    );
  }

  if (isDualLine) {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth mask-edges rounded-lg"
      >
        <div className="h-full flex flex-col justify-center items-center gap-4 sm:gap-8 overflow-x-hidden px-1 sm:px-0">
          {dualDisplayLines.map(({ line, originalIndex: i }) => (
            <PreviewLine
              key={i}
              line={{ ...line, nextTimestamp: nextTimestamps[i] ?? null }}
              originalIndex={i}
              displayedActiveIndex={currentIndex}
              lockedLineIndex={null}
              isDualLine
              displayLines={dualDisplayLines}
              playbackPosition={playbackPosition}
              activeRef={activeRef}
              handleLineClick={handleLineClick}
              handleLineHover={() => { }}
              handleLineHoverEnd={() => { }}
              showTranslationsInPreview={showTranslationsInPreview}
              showFuriganaInPreview={showFuriganaInPreview}
              sizeOption={sizeOption}
              spacingOption={spacingOption}
              activeSecondarySizes={activeSecondarySizes}
              inactiveSecondarySizes={inactiveSecondarySizes}
              activeFontSizes={activeFontSizes}
              inactiveFontSizes={inactiveFontSizes}
              activeMargin={activeMargin}
              distanceFromActive={currentIndex >= 0 ? Math.abs(i - currentIndex) : null}
              totalLines={lines.length}
              editorMode={editorMode}
              hasMedia={hasMedia}
            />
          ))}
        </div>
      </div>
    );
  }

  // Normal mode — virtualized
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 mask-edges rounded-lg"
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        className={`overflow-x-hidden px-1 sm:px-0`}
      >
        {virtualizer.getVirtualItems().map((vRow) => {
          const i = vRow.index;
          const line = lines[i];
          return (
            <div
              key={i}
              data-index={i}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <PreviewLine
                line={{ ...line, nextTimestamp: nextTimestamps[i] ?? null }}
                originalIndex={i}
                displayedActiveIndex={currentIndex}
                lockedLineIndex={null}
                isDualLine={false}
                displayLines={null}
                playbackPosition={i === currentIndex ? playbackPosition : null}
                activeRef={i === currentIndex ? activeRef : null}
                handleLineClick={handleLineClick}
                handleLineHover={() => { }}
                handleLineHoverEnd={() => { }}
                showTranslationsInPreview={showTranslationsInPreview}
                showFuriganaInPreview={showFuriganaInPreview}
                sizeOption={sizeOption}
                spacingOption={spacingOption}
                activeSecondarySizes={activeSecondarySizes}
                inactiveSecondarySizes={inactiveSecondarySizes}
                activeFontSizes={activeFontSizes}
                inactiveFontSizes={inactiveFontSizes}
                activeMargin={activeMargin}
                distanceFromActive={currentIndex >= 0 ? Math.abs(i - currentIndex) : null}
                totalLines={lines.length}
                editorMode={editorMode}
                hasMedia={hasMedia}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
