import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { serializeToRubyMarkup, parseRubyMarkup, isKanji, toHiragana, toKatakana, hasCJK, hasKanji } from '@/utils/furigana';
import { formatTimestamp } from '@/utils/lrc';
import { formatTime } from '@/utils/formatTime';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Checkbox } from '@ui/checkbox';
import { Kbd } from "@shared/Kbd";
import { Pencil, Play, ChevronLeft, ChevronRight, Plus, X, Trash2, Repeat, MoreHorizontal, GripVertical, CopyPlus, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from '@ui/popover';
import { Tip } from '@ui/tip';
import { ReadingInput } from './ReadingInput';
import { InlineTimestampEdit } from './InlineTimestampEdit';
import { TimestampBadge } from './TimestampBadge';
import { StampedWordChip } from './StampedWordChip';

const EditorLineItem = React.memo(({
  line,
  i,
  displayedActiveIndex,
  isActive,
  isLocked,
  isSynced,
  editorMode,
  awaitingEndMark,
  focusedTimestamp,
  setFocusedTimestamp,
  activeLineRef,
  handleLineClick,
  handleLineHover,
  handleLineHoverEnd,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleDrop,
  dragOverIndex,
  dragIndex,
  selectedLines,
  settings,
  editingLineIndex,
  setEditingLineIndex,
  editingText,
  setEditingText,
  editingSecondary,
  setEditingSecondary,
  editingTranslation,
  setEditingTranslation,
  handleSaveLineText,
  playerRef,
  shiftTime,
  handleAddLine,
  handleClearLine,
  handleDeleteLine,
  handleToggleLine,
  handleMark,
  activeWordIndex,
  handleClearWordTimestamp,
  handleSetActiveWordIndex,
  handleSetTimestamp,
  handleSetWordReading,
  stampTarget = 'main',
  handleStampTargetToggle,
  playbackPosition,
  upcomingDepth,
  onWordMenu,
  onLineMenu,
  isModified,
}) => {

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const { t } = useTranslation();
  const [editingTimestamp, setEditingTimestamp] = useState(null); // null | 'start' | 'end'
  const [editingReadingWordIndex, setEditingReadingWordIndex] = useState(null);
  const [selection, setSelection] = useState({ start: null, end: null, range: null }); // { start: ci|null, end: ci|null, range: {s,e}|null }
  const [nudgeIndicator, setNudgeIndicator] = useState(null);
  const [justSynced, setJustSynced] = useState(false);
  const nudgeTimerRef = useRef(null);
  const justSyncedTimerRef = useRef(null);

  const onCharClick = useCallback((ci) => {
    setSelection(prev => {
      if (prev.range) return prev;

      const { plainText } = parseRubyMarkup(line.text || '♪');
      const textChars = [...plainText];
      const ch = textChars[ci];
      if (!ch) return { start: null, end: null, range: null };
      const isCharKanji = isKanji(ch);

      // Initial click: open reading input immediately for contiguous kanji
      if (prev.start === null) {
        if (!isCharKanji) return { start: null, end: null, range: null };

        let s = ci, e = ci;
        while (s > 0 && isKanji(textChars[s - 1])) s--;
        while (e < textChars.length - 1 && isKanji(textChars[e + 1])) e++;
        return { start: null, end: null, range: { s, e } };
      }

      // Subsequent click
      const s = prev.start;
      const eRange = prev.end !== null ? prev.end : s;
      const minS = Math.min(s, eRange);
      const maxE = Math.max(s, eRange);

      if (ci >= minS && ci <= maxE) {
        // Clicked inside -> Confirm
        return { start: null, end: null, range: { s: minS, e: maxE } };
      }

      // Clicked outside -> Replace if Kanji, else Clear
      if (isCharKanji) {
        let ns = ci, ne = ci;
        while (ns > 0 && isKanji(textChars[ns - 1])) ns--;
        while (ne < textChars.length - 1 && isKanji(textChars[ne + 1])) ne++;
        return { start: ns, end: (ns === ne ? null : ne), range: null };
      }
      return { start: null, end: null, range: null };
    });
  }, [line.text]);

  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection({ start: null, end: null, range: null });
    } else {
      activeLineRef?.current?.focus();
    }
  }, [isActive, activeLineRef]);

  const handleReadingCommit = useCallback((val, wi, direction) => {
    handleSetWordReading?.(i, wi, val);
    if (direction !== 0) {
      const words = line.words || [];
      let nextWi = wi + direction;
      while (nextWi >= 0 && nextWi < words.length && !hasKanji(words[nextWi].word)) {
        nextWi += direction;
      }
      if (nextWi >= 0 && nextWi < words.length) {
        setEditingReadingWordIndex(nextWi);
        return;
      }
    }
    setEditingReadingWordIndex(null);
  }, [i, line.words, handleSetWordReading, setEditingReadingWordIndex]);

  // Touch gesture refs
  const touchStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  // Used to distinguish single-click from double-click on word chips/rubies in words mode
  const wordClickTimerRef = useRef(null);

  const showNudge = useCallback((delta) => {
    const sign = delta > 0 ? '+' : '';
    setNudgeIndicator(`${sign}${delta.toFixed(2)}s`);
    clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => setNudgeIndicator(null), 600);
  }, []);

  const handleWordClick = useCallback((e, w, wi, isSecondary = false) => {
    e.stopPropagation();
    if (w.time != null && playerRef?.current?.seek) {
      playerRef.current.seek(w.time);
      if (settings.playback?.seekPlays && playerRef.current.play) playerRef.current.play();
    }
    if (activeWordIndex !== -1) handleSetActiveWordIndex(wi);
    setFocusedTimestamp({ lineIndex: i, type: isSecondary ? 'secondaryWord' : 'word', wordIndex: wi });
  }, [playerRef, settings.playback?.seekPlays, activeWordIndex, handleSetActiveWordIndex, setFocusedTimestamp, i]);

  const handleTimestampWheel = useCallback((e, index) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.01 : -0.01;
    shiftTime(index, delta);
    showNudge(delta);
  }, [shiftTime, showNudge]);

  // ── Touch gesture handlers ──
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    // Long-press → select (500ms)
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      handleToggleLine(i);
      touchStartRef.current = null; // cancel swipe
    }, 500);
  }, [handleToggleLine, i]);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressTimerRef.current);
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Only register horizontal swipe: |dx| > 40px, |dy| < 30px, < 500ms
    if (Math.abs(dx) > 40 && Math.abs(dy) < 30 && elapsed < 500 && isSynced) {
      const nudge = settings.editor?.nudge?.default || 0.1;
      const delta = dx > 0 ? nudge : -nudge;
      shiftTime(i, delta);
      showNudge(delta);
    }
  }, [isSynced, settings.editor?.nudge?.default, shiftTime, showNudge, i]);

  const handleTouchMove = useCallback(() => {
    // Cancel long-press if finger moved
    clearTimeout(longPressTimerRef.current);
  }, []);

  // Cleanup timers
  useEffect(() => () => {
    clearTimeout(nudgeTimerRef.current);
    clearTimeout(longPressTimerRef.current);
    clearTimeout(wordClickTimerRef.current);
  }, []);

  // Just-synced flash: trigger when line transitions from unsynced to synced
  const [prevIsSynced, setPrevIsSynced] = useState(isSynced);
  if (isSynced !== prevIsSynced) {
    setPrevIsSynced(isSynced);
    if (isSynced && !prevIsSynced) {
      setJustSynced(true);
    }
  }

  useEffect(() => {
    if (justSynced) {
      clearTimeout(justSyncedTimerRef.current);
      justSyncedTimerRef.current = setTimeout(() => setJustSynced(false), 600);
    }
    return () => clearTimeout(justSyncedTimerRef.current);
  }, [justSynced]);

  // Segment progress for active synced line
  const segmentEnd = line.endTime ?? line.nextTimestamp;
  const segmentProgress = isActive && isSynced && segmentEnd != null && playbackPosition != null
    ? Math.min(1, Math.max(0, (playbackPosition - line.timestamp) / (segmentEnd - line.timestamp)))
    : null;

  const distanceFromActive = displayedActiveIndex != null ? Math.abs(i - displayedActiveIndex) : 0;
  const staggerDelay = `${Math.min(distanceFromActive * 20, 150)}ms`;

  return (
    <div
      ref={isActive ? activeLineRef : null}
      onClick={(e) => {
        if (!selection.range) {
          setSelection({ start: null, end: null, range: null });
        }
        handleLineClick(i, e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && (selection.start !== null || selection.range !== null)) {
          e.stopPropagation();
          setSelection({ start: null, end: null, range: null });
        }
      }}
      tabIndex={isActive ? 0 : -1}
      onMouseEnter={() => handleLineHover(i)}
      onMouseLeave={handleLineHoverEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      draggable={editingLineIndex !== i}
      onDragStart={(e) => {
        // Only allow dragging if the target is the handle or the container itself (not text/inputs)
        const target = e.target;
        if (target.closest('input, button, rt, [data-no-drag]')) {
          e.preventDefault();
          return;
        }
        handleDragStart(e, i);
      }}
      onDragOver={(e) => handleDragOver(e, i)}
      onDragEnd={handleDragEnd}
      onDrop={(e) => handleDrop(e, i)}
      style={{ animationDelay: staggerDelay }}
      className={`outline-none flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-3 sm:py-2 rounded-xl sm:rounded-lg transition-colors duration-300 ease-out cursor-pointer group relative overflow-hidden animate-preview-line-in ${selectedLines.has(i)
        ? `bg-primary/15 border border-${isModified ? 'warning' : 'primary'}/40 ring-1 ring-${isModified ? 'warning' : 'primary'}/20`
        : isActive
          ? isLocked
            ? `bg-primary/10 border border-${isModified ? 'warning' : 'primary'}/30`
            : `bg-primary/5 border border-${isModified ? 'warning' : 'primary'}/20 border-dashed`
          : dragOverIndex === i
            ? 'bg-accent-blue/10 border border-accent-blue/30'
            : upcomingDepth > 0
              ? `bg-primary/${upcomingDepth === 1 ? '5' : upcomingDepth === 2 ? '3' : '2'} border border-primary/${upcomingDepth === 1 ? '15' : '10'} border-dashed`
              : `hover:bg-zinc-800/40 border border-${isModified ? 'warning/30' : 'transparent'}`
        } ${dragIndex === i ? 'opacity-40' : ''} ${justSynced ? 'ring-2 ring-primary/60 animate-just-synced' : ''}`}
    >
      {/* Lock/unlock indicator */}
      {isActive && (
        <div className={`absolute left-0 inset-y-0 w-1 z-0 rounded-l-xl animate-bar-grow ${isLocked
          ? `${isModified ? 'bg-warning shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'bg-primary shadow-[0_0_12px_rgba(29,185,84,0.6)]'} opacity-90`
          : `${isModified ? 'bg-warning/60' : 'bg-primary/40'} opacity-60`
          }`} />
      )}
      {/* Drag Handle & Line number */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          className="cursor-grab active:cursor-grabbing text-zinc-800 hover:text-zinc-500 transition-colors p-0.5 -ml-1 select-none"
          title={t('editor.dragToReorder', 'Drag to reorder')}
        >
          <GripVertical className="w-3 h-3" />
        </div>
        {(settings.editor?.showLineNumbers ?? true) && (
          <div
            className={`w-5 shrink-0 flex ${editorMode === 'words' ? 'items-start pt-1' : 'items-center'} justify-center select-none`}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedLines.size > 0 ? (
              <Checkbox
                checked={selectedLines.has(i)}
                onCheckedChange={() => handleToggleLine(i)}
                className="w-3.5 h-3.5 border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            ) : (
              <span className="text-[10px] font-mono tabular-nums text-zinc-700/70 select-none text-right">
                {i + 1}
              </span>
            )}
          </div>
        )}
        {isModified && !isActive && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] animate-in fade-in zoom-in duration-300" />
        )}
      </div>

      <span
        className={`text-xs font-mono tabular-nums shrink-0 transition-colors ${editorMode === 'words' ? 'self-start pt-0.5' : ''} ${isSynced
          ? 'text-primary'
          : isActive
            ? 'text-zinc-400 animate-pulse-glow'
            : 'text-zinc-600'
          }`}
        style={{ width: editorMode === 'words' ? '240px' : '92px', flexShrink: 0 }}
      >
        {editorMode === 'words' ? (
          <div className="flex flex-col gap-1">
            {/* Line-level timestamp + layer toggle */}
            <div className="flex items-center gap-1">
              {editingTimestamp === 'start' && isSynced ? (
                <InlineTimestampEdit
                  value={line.timestamp}
                  precision={settings.editor?.timestampPrecision || 'hundredths'}
                  onChange={(val) => { handleSetTimestamp(i, 'start', val); setEditingTimestamp(null); }}
                  onCancel={() => setEditingTimestamp(null)}
                />
              ) : (
                <TimestampBadge
                  value={line.timestamp}
                  isSynced={isSynced}
                  isFocused={focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start'}
                  isActive={isActive}
                  precision={settings.editor?.timestampPrecision || 'hundredths'}
                  onClick={() => setFocusedTimestamp(focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start' ? null : { lineIndex: i, type: 'start' })}
                  onDoubleClick={(e) => { e.stopPropagation(); if (isSynced) setEditingTimestamp('start'); }}
                  onWheel={(e) => { if (isSynced) handleTimestampWheel(e, i, 'start'); }}
                  nudgeIndicator={isSynced ? nudgeIndicator : null}
                />
              )}
              {/* Layer toggle buttons — only for CJK lines with secondary text */}
              {hasCJK(line.text || '') && line.secondary && (
                <div className="flex items-center gap-0.5 bg-zinc-900 rounded-md p-0.5 shrink-0">
                  <Tip content={t('editor.stampLayerMain')}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (stampTarget !== 'main') handleStampTargetToggle?.(); }}
                      className={`inline-flex items-center justify-center text-[9px] px-1.5 py-0.5 rounded leading-none font-bold transition-all ${stampTarget === 'main'
                        ? 'bg-primary text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                    >主</button>
                  </Tip>
                  <Tip content={t('editor.stampLayerSecondary')}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (stampTarget !== 'secondary') handleStampTargetToggle?.(); }}
                      className={`inline-flex items-center justify-center text-[9px] px-1.5 py-0.5 rounded leading-none font-bold transition-all ${stampTarget === 'secondary'
                        ? 'bg-accent-blue text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                    >ロ</button>
                  </Tip>
                </div>
              )}
            </div>
            {/* Word chips */}
            {stampTarget !== 'secondary' && (
              <div className="flex flex-wrap gap-x-1 gap-y-1 w-full pr-2 min-h-[22px] items-end content-start">
                {line.words?.map((w, wi) => {
                  const displayWord = w.word.replace(/^[()'"]+|[,;.!?()'"]+$/g, '');
                  // In Words mode, only show the automatic "next word" cursor if no word is manually focused anywhere
                  const isFocusedWord = focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'word' && focusedTimestamp?.wordIndex === wi;
                  const isActiveWord = wi === activeWordIndex && !focusedTimestamp;
                  return (
                    <div key={wi} className="flex flex-col items-center gap-1">
                      {/* Word chip */}
                      {w.time != null ? (
                        <div className="group/word flex items-center gap-0.5">
                          <Tip content={t('editor.wordChipTitle', { word: w.word, time: formatTime(w.time) })}>
                            <StampedWordChip
                              time={w.time}
                              focusedTimestamp={focusedTimestamp}
                              lineIndex={i}
                              wi={wi}
                              onClick={(e) => handleWordClick(e, w, wi)}
                              className={`text-[11px] px-2.5 py-0.5 rounded-full border leading-none transition-all duration-200 cursor-pointer ${isActiveWord || isFocusedWord
                                ? 'bg-primary text-zinc-950 border-primary ring-2 ring-primary/40 shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)] animate-pulse-glow'
                                : 'bg-zinc-800 border-primary/30 text-primary/70 hover:border-primary hover:bg-primary/20 hover:text-primary'
                                }`}
                            >
                              {displayWord}
                            </StampedWordChip>
                          </Tip>
                          {!isMobile && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleClearWordTimestamp(i, wi); }}
                              className="opacity-0 group-hover/word:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 -ml-0.5"
                            >
                              <X className="size-2.5" />
                            </button>
                          )}
                          {isMobile && isFocusedWord && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onWordMenu?.(i, wi, w, false); }}
                              className="text-primary-dim bg-primary/10 rounded-full p-1 -ml-1 animate-in fade-in zoom-in-50 duration-200"
                            >
                              <MoreHorizontal className="size-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <span
                            onClick={(e) => handleWordClick(e, w, wi)}
                            className={`text-[11px] px-2.5 py-0.5 rounded-full border leading-none transition-all cursor-pointer ${isActiveWord || isFocusedWord
                              ? 'bg-primary text-zinc-950 border-primary ring-2 ring-primary/40 shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)] animate-pulse-glow'
                              : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
                              }`}
                          >
                            {displayWord}
                          </span>
                          {isMobile && isFocusedWord && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onWordMenu?.(i, wi, w, false); }}
                              className="text-primary-dim bg-primary/10 rounded-full p-1 -ml-1 animate-in fade-in zoom-in-50 duration-200"
                            >
                              <MoreHorizontal className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Secondary word chips — shown only when stampTarget is 'secondary' */}
            {stampTarget === 'secondary' && hasCJK(line.text || '') && line.secondary && (
              <div className="flex flex-wrap gap-x-1 gap-y-1 w-full pr-2 min-h-[22px] items-end content-start">
                {(line.secondaryWords?.length
                  ? line.secondaryWords
                  : line.secondary.trim().split(/\s+/).filter(Boolean).map((word) => ({ word, time: null }))
                ).map((w, wi) => {
                  const isFocusedSecondaryWord = focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'secondaryWord' && focusedTimestamp?.wordIndex === wi;
                  const isActiveSecondaryWord = wi === activeWordIndex && !focusedTimestamp;
                  return w.time != null ? (
                    <div key={wi} className="group/sword flex items-center gap-0.5">
                      <Tip content={`${w.word} @ ${formatTime(w.time)}`}>
                        <StampedWordChip
                          time={w.time}
                          focusedTimestamp={focusedTimestamp}
                          lineIndex={i}
                          wi={wi}
                          isSecondary={true}
                          onClick={(e) => handleWordClick(e, w, wi, true)}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border leading-none transition-colors cursor-pointer ${isActiveSecondaryWord || isFocusedSecondaryWord
                            ? 'bg-accent-blue text-zinc-950 border-accent-blue ring-2 ring-accent-blue/40 shadow-[0_0_12px_rgba(var(--accent-blue-rgb),0.5)] animate-pulse-glow'
                            : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue/70 hover:bg-accent-blue/20 hover:text-accent-blue hover:border-accent-blue'
                            }`}
                        >
                          {w.word}
                        </StampedWordChip>
                      </Tip>
                      {!isMobile && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleClearWordTimestamp(i, wi, 'secondaryWords'); }}
                          className="opacity-0 group-hover/sword:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 -ml-0.5"
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                      {isMobile && isFocusedSecondaryWord && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onWordMenu?.(i, wi, w, true); }}
                          className="text-accent-blue bg-accent-blue/10 rounded-full p-1 -ml-1 animate-in fade-in zoom-in-50 duration-200"
                        >
                          <MoreHorizontal className="size-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <span
                        key={wi}
                        onClick={(e) => handleWordClick(e, w, wi, true)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border leading-none transition-all cursor-pointer ${isActiveSecondaryWord || isFocusedSecondaryWord
                          ? 'bg-accent-blue text-zinc-900 border-accent-blue ring-2 ring-accent-blue/40 shadow-[0_0_12px_rgba(var(--accent-blue-rgb),0.5)] animate-pulse-glow'
                          : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400'
                          }`}
                      >
                        {w.word}
                      </span>
                      {isMobile && isFocusedSecondaryWord && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onWordMenu?.(i, wi, w, true); }}
                          className="text-accent-blue bg-accent-blue/10 rounded-full p-1 -ml-1 animate-in fade-in zoom-in-50 duration-200"
                        >
                          <MoreHorizontal className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : editorMode === 'srt' ? (
          <div className="flex flex-col gap-1">
            {/* Start time badge */}
            {editingTimestamp === 'start' && isSynced ? (
              <InlineTimestampEdit
                value={line.timestamp}
                precision={settings.editor?.timestampPrecision || 'hundredths'}
                onChange={(val) => { handleSetTimestamp(i, 'start', val); setEditingTimestamp(null); }}
                onCancel={() => setEditingTimestamp(null)}
              />
            ) : (
              <TimestampBadge
                value={line.timestamp}
                isSynced={isSynced}
                isFocused={focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start'}
                isActive={isActive}
                precision={settings.editor?.timestampPrecision || 'hundredths'}
                onClick={() => setFocusedTimestamp(focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start' ? null : { lineIndex: i, type: 'start' })}
                onDoubleClick={(e) => { e.stopPropagation(); if (isSynced) setEditingTimestamp('start'); }}
                onWheel={(e) => { if (isSynced) handleTimestampWheel(e, i, 'start'); }}
                nudgeIndicator={isSynced ? nudgeIndicator : null}
              />
            )}
            {/* End time badge */}
            {editingTimestamp === 'end' && line.endTime != null ? (
              <InlineTimestampEdit
                value={line.endTime}
                precision={settings.editor?.timestampPrecision || 'hundredths'}
                onChange={(val) => { handleSetTimestamp(i, 'end', val); setEditingTimestamp(null); }}
                onCancel={() => setEditingTimestamp(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setFocusedTimestamp(focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'end' ? null : { lineIndex: i, type: 'end' })}
                onDoubleClick={(e) => { e.stopPropagation(); if (line.endTime != null) setEditingTimestamp('end'); }}
                className={`flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums transition-all w-fit ${focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'end'
                  ? 'bg-primary/25 ring-1 ring-primary/50 font-semibold'
                  : line.endTime != null
                    ? 'bg-zinc-800 border border-zinc-700/50 hover:border-accent-blue/40 hover:bg-zinc-700/60'
                    : 'text-zinc-600 hover:bg-zinc-800/50 border border-transparent'
                  }`}
              >
                {line.endTime != null
                  ? (() => {
                    const colorClass = 'text-accent-blue';
                    return <span className={awaitingEndMark === i ? 'animate-pulse-glow text-primary' : colorClass}>{formatTimestamp(line.endTime, settings.editor?.timestampPrecision || 'hundredths')}</span>;
                  })()
                  : <span className={awaitingEndMark === i ? 'animate-pulse-glow text-zinc-400' : ''}>--:--.--</span>
                }
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* Primary timestamp + add-repeat on one line */}
            <div className="flex items-center gap-1">
              {editingTimestamp === 'start' && isSynced ? (
                <InlineTimestampEdit
                  value={line.timestamp}
                  precision={settings.editor?.timestampPrecision || 'hundredths'}
                  onChange={(val) => { handleSetTimestamp(i, 'start', val); setEditingTimestamp(null); }}
                  onCancel={() => setEditingTimestamp(null)}
                />
              ) : (
                <TimestampBadge
                  value={line.timestamp}
                  isSynced={isSynced}
                  isFocused={focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start'}
                  isActive={isActive}
                  precision={settings.editor?.timestampPrecision || 'hundredths'}
                  onClick={() => setFocusedTimestamp(focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'start' ? null : { lineIndex: i, type: 'start' })}
                  onDoubleClick={(e) => { e.stopPropagation(); if (isSynced) setEditingTimestamp('start'); }}
                  onWheel={(e) => { if (isSynced) handleTimestampWheel(e, i, 'start'); }}
                  nudgeIndicator={isSynced ? nudgeIndicator : null}
                />
              )}
            </div>
          </div>
        )}
      </span>

      {/* Lyrics text container */}
      <div
        className="flex-1 min-w-0 flex items-start gap-2 overflow-x-hidden pb-0.5 mt-0.5 select-text"
        data-no-drag
        onDoubleClick={() => {
          setEditingLineIndex(i);
          setEditingText(serializeToRubyMarkup(line.words) || line.text);
          setEditingSecondary(line.secondary || '');
          setEditingTranslation(line.translation || '');
        }}>
        {editingLineIndex === i ? (
          <div
            className="flex flex-col gap-1 w-full"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                handleSaveLineText(i, editingText, editingSecondary, editingTranslation);
                setEditingLineIndex(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveLineText(i, editingText, editingSecondary, editingTranslation);
                setEditingLineIndex(null);
              } else if (e.key === 'Escape') {
                setEditingLineIndex(null);
              }
            }}
          >
            <Input
              type="text"
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              placeholder={`${t('editor.primaryText')} — {漢字|よみかた}`}
              className="w-full bg-zinc-800 border-primary/50 text-xs text-zinc-100 h-7"
            />
            <Input
              type="text"
              value={editingSecondary}
              onChange={(e) => setEditingSecondary(e.target.value)}
              placeholder={t('editor.secondaryText')}
              className="w-full bg-zinc-800 border-zinc-600/50 text-xs text-zinc-400 h-6"
            />
            <Input
              type="text"
              value={editingTranslation}
              onChange={(e) => setEditingTranslation(e.target.value)}
              placeholder={t('editor.translationText')}
              className="w-full bg-zinc-800 border-zinc-600/50 text-xs text-zinc-500 h-6 italic"
            />
          </div>
        ) : (
          <div className={`flex flex-col gap-1 group/text min-w-0 w-full ${editorMode === 'words' ? 'pt-0.5' : ''}`}>
            <div className="flex items-center gap-2">
              <p
                className={`text-[13px] lg:text-xs transition-all duration-300 ease-out ${(line.words?.some(w => w.reading) || (editorMode !== 'words' && (editingReadingWordIndex != null || selection.start != null || selection.range != null))) ? 'overflow-hidden' : 'break-words whitespace-pre-wrap'} ${isActive
                  ? 'text-zinc-100 font-medium'
                  : isSynced
                    ? line.words?.some(w => w.time != null) ? 'text-zinc-300' : 'text-zinc-100'
                    : 'text-zinc-500'
                  }`}
                style={(line.words?.some(w => w.reading) || (editorMode !== 'words' && (editingReadingWordIndex != null || selection.start != null || selection.range != null)))
                  ? { lineHeight: '2.4' }
                  : { lineHeight: '1.6' }}
              >
                {line.words?.length > 0
                  ? line.words.map((w, wi) => {
                    // Strictly hide the automatic cursor if any word is focused to prevent multiple highlights
                    const isActiveWord = editorMode === 'words' && isActive && wi === activeWordIndex && !focusedTimestamp;
                    const isFocusedWord = (focusedTimestamp?.lineIndex === i && (focusedTimestamp?.type === 'word' || focusedTimestamp?.type === 'secondaryWord') && focusedTimestamp?.wordIndex === wi);
                    const canHaveReading = hasKanji(w.word || '');
                    const isEditing = editingReadingWordIndex === wi;
                    const rubyFmt = settings?.editor?.display?.readingFormat || 'hiragana';
                    const fmtR = (r) => r ? (rubyFmt === 'katakana' ? toKatakana(r) : toHiragana(r)) : r;
                    const trailingSpace = /[a-zA-Z0-9]/.test(w.word) ? ' ' : null;

                    const spanClass = editorMode === 'words'
                      ? `transition-all px-0.5 rounded ${isActiveWord || isFocusedWord
                        ? 'bg-primary/20 text-primary [text-shadow:0_0_0.8px_currentColor] underline decoration-dotted underline-offset-2'
                        : w.time != null
                          ? 'text-primary/70 hover:bg-zinc-800'
                          : isActive || isSynced ? 'text-zinc-100 hover:bg-zinc-800' : 'hover:bg-zinc-800'
                      }`
                      : `transition-colors px-0.5 rounded ${isFocusedWord && canHaveReading ? 'text-zinc-100 underline decoration-zinc-500 underline-offset-4' : (canHaveReading ? 'hover:bg-white/5' : '')}`;

                    const content = (
                      <span className={spanClass}>
                        {w.word}
                      </span>
                    );

                    if (isEditing) {
                      return (
                        <React.Fragment key={wi}>
                          <ruby>
                            {content}
                            <rt>
                              <ReadingInput
                                defaultValue={fmtR(w.reading) || ''}
                                onCommit={(val, direction) => handleReadingCommit(val, wi, direction)}
                                onCancel={() => setEditingReadingWordIndex(null)}
                                readingFormat={rubyFmt}
                                className="text-[9px] font-mono text-center bg-transparent border-b border-primary outline-none text-primary px-0 py-0.5"
                                style={{ width: `${Math.max(30, (w.reading || w.word).length * 10)}px` }}
                              />
                            </rt>
                          </ruby>
                          {trailingSpace}
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={wi}>
                        <ruby
                          className={`group/ruby ${editorMode === 'words' || canHaveReading ? 'cursor-pointer' : 'cursor-default'} ${canHaveReading ? 'hover:text-primary' : ''}`}
                          onClick={(e) => {
                            if (editorMode !== 'words' && !canHaveReading) return;
                            e.stopPropagation();
                            if (editorMode === 'words') {
                              handleWordClick(e, w, wi);
                            } else if (canHaveReading) {
                              setEditingReadingWordIndex(wi);
                            }
                          }}
                          onDoubleClick={(e) => {
                            if (canHaveReading) {
                              e.stopPropagation();
                              e.preventDefault();
                              clearTimeout(wordClickTimerRef.current);
                              setEditingReadingWordIndex(wi);
                            }
                          }}
                        >
                          {content}
                          {canHaveReading && (editorMode !== 'words' || w.reading) && (
                            <rt
                              className={`select-none transition-colors ${w.reading ? 'text-[10px] font-mono text-zinc-400 group-hover/ruby:text-primary' : 'border-b-2 border-zinc-700/30 border-dashed min-h-[4px] group-hover/ruby:border-primary/40'}`}
                              onClick={editorMode !== 'words' ? (e) => {
                                e.stopPropagation();
                                setEditingReadingWordIndex(wi);
                              } : undefined}
                            >
                              {w.reading ? fmtR(w.reading) : '　'}
                            </rt>
                          )}
                        </ruby>
                        {trailingSpace}
                      </React.Fragment>
                    );
                  })
                  : (() => {
                    const { plainText, segments } = parseRubyMarkup(line.text || '♪');
                    const textChars = [...plainText];
                    const rubyFmt = settings?.editor?.display?.readingFormat || 'hiragana';

                    let currentCi = 0;
                    return segments.map((seg, si) => {
                      const segmentChars = [...seg.text];
                      const startCi = currentCi;
                      currentCi += segmentChars.length;

                      if (seg.reading) {
                        return (
                          <ruby
                            key={`seg-${si}`}
                            className="text-primary font-medium cursor-pointer group/ruby relative"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCharClick(startCi);
                            }}
                          >
                            {seg.text}
                            <rt className="text-[10px] font-mono text-zinc-400 select-none group-hover/ruby:text-primary transition-colors">
                              {rubyFmt === 'katakana' ? toKatakana(seg.reading) : toHiragana(seg.reading)}
                            </rt>
                          </ruby>
                        );
                      }

                      return segmentChars.map((ch, ci_off) => {
                        const ci = startCi + ci_off;
                        const isNonCJK = !hasCJK(ch);

                        const handleCharClick = (e) => {
                          e.stopPropagation();
                          onCharClick(ci);
                        };

                        if (isNonCJK) return <span key={ci} onClick={handleCharClick} className="text-zinc-300/90">{ch}</span>;

                        if (selection.range) {
                          const { s, e } = selection.range;
                          if (ci === s) {
                            const selectedText = textChars.slice(s, e + 1).join('');
                            return (
                              <ruby key={ci} className="text-primary font-medium">
                                {selectedText}
                                <rt>
                                  <ReadingInput
                                    defaultValue=""
                                    onCommit={(val) => {
                                      // Rebuild character array with current readings
                                      const charReadings = [];
                                      segments.forEach(s2 => {
                                        const chars = [...s2.text];
                                        chars.forEach(c => charReadings.push({ char: c, reading: s2.reading }));
                                      });

                                      // Update readings for selected range [s, e]
                                      for (let k = s; k <= e; k++) {
                                        charReadings[k].reading = val || null;
                                      }

                                      // Serialize back to markup
                                      let resultText = "";
                                      let j = 0;
                                      while (j < charReadings.length) {
                                        const start = j;
                                        const r = charReadings[j].reading;
                                        j++;
                                        if (r) {
                                          while (j < charReadings.length && charReadings[j].reading === r) {
                                            j++;
                                          }
                                          const groupText = charReadings.slice(start, j).map(x => x.char).join('');
                                          resultText += `{${groupText}|${r}}`;
                                        } else {
                                          resultText += charReadings[start].char;
                                        }
                                      }

                                      handleSaveLineText?.(i, resultText, line.secondary, line.translation);
                                      setSelection({ start: null, end: null, range: null });
                                    }}
                                    onCancel={() => setSelection({ start: null, end: null, range: null })}
                                    readingFormat={rubyFmt}
                                    className="text-[9px] font-mono text-center bg-transparent border-b border-primary outline-none text-primary px-0 py-0.5"
                                    style={{ width: `${Math.max(30, selectedText.length * 12)}px` }}
                                  />
                                </rt>
                              </ruby>
                            );
                          }
                          if (ci > s && ci <= e) return null;
                        }

                        const sIdx = selection.start;
                        const eIdx = selection.end !== null ? selection.end : sIdx;
                        const inSelection = sIdx !== null && ci >= Math.min(sIdx, eIdx) && ci <= Math.max(sIdx, eIdx);

                        const isCharKanji = isKanji(ch);

                        if (isNonCJK || !isCharKanji) {
                          return (
                            <span
                              key={ci}
                              className={`transition-colors px-0.5 ${inSelection ? 'bg-primary/20 text-primary rounded-sm' : 'text-zinc-400/80'}`}
                            >
                              {ch}
                            </span>
                          );
                        }

                        return (
                          <ruby
                            key={ci}
                            onClick={handleCharClick}
                            className={`cursor-pointer transition-all duration-200 group/ruby ${inSelection ? 'bg-primary/20 text-primary rounded-sm shadow-[0_1px_0_0_rgba(var(--primary-rgb),0.2)]' : 'hover:text-primary'
                              }`}
                          >
                            {ch}
                            <rt className={`min-h-[4px] text-[8px] ${inSelection
                                ? 'border-b-2 border-primary/40 border-dashed'
                                : 'border-b-2 border-zinc-700/30 border-dashed group-hover/ruby:border-primary/40'
                              }`}>
                              {'　'}
                            </rt>
                          </ruby>
                        );
                      });
                    });
                  })()
                }
              </p>
              {editorMode !== 'words' && line.words?.some((w) => w.time != null) && (
                <Tip content={t('editor.wordBadgeHint', { count: line.words.filter(w => w.time != null).length })}>
                  <span
                    className="flex-shrink-0 text-[9px] font-mono text-accent-blue/60 px-1 py-0.5 bg-accent-blue/10 rounded border border-accent-blue/20 leading-none cursor-pointer hover:bg-accent-blue/20 hover:text-accent-blue transition-colors"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    W
                  </span>
                </Tip>
              )}
            </div>
            {line.secondary && (
              <p className="text-[10px] text-zinc-500 leading-tight pl-0.5 truncate">{line.secondary}</p>
            )}
            {line.translation && (
              <p className="text-[10px] text-zinc-500/70 italic leading-tight pl-0.5 truncate">{line.translation}</p>
            )}
          </div>
        )}
      </div>
      {/* Action Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {/* Mark button — always visible on the active unsaved line */}
        {isActive && editingLineIndex !== i && (
          <Tip content={
            editorMode === 'words' && line.timestamp != null
              ? stampTarget === 'secondary'
                ? `Stamp "${(line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean).map(w => ({ word: w })))?.[Math.max(0, Math.min(activeWordIndex, (line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean).map(w => ({ word: w })) ?? [])?.length - 1))]?.word || 'word'}" (${Math.max(0, activeWordIndex)}/${(line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean))?.length ?? 0})`
                : `Stamp "${line.words?.[Math.max(0, Math.min(activeWordIndex, (line.words?.length ?? 1) - 1))]?.word || 'word'}" (${Math.max(0, activeWordIndex)}/${line.words?.length ?? 0})`
              : t('editor.mark')
          }>
            <Button
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); handleMark(); }}
              className={`justify-center border font-semibold rounded-lg flex-shrink-0 text-xs shadow-md animate-in fade-in zoom-in-90 duration-200 ${editorMode === 'words' && line.timestamp != null
                ? stampTarget === 'secondary'
                  ? 'bg-accent-blue/15 hover:bg-accent-blue/25 border-accent-blue/40 text-accent-blue'
                  : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-400'
                : 'bg-primary/20 hover:bg-primary/30 border-primary/40 text-primary'
                }`}
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Button>
          </Tip>
        )}

        <div className="flex items-center gap-0 px-0.5 py-0.5 rounded-full bg-zinc-800/40 backdrop-blur-md border border-zinc-700/50 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-sm">
          {isSynced && (
            <>
              <Tip content={t('editor.jumpSync')}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (playerRef?.current?.seek) {
                      playerRef.current.seek(line.timestamp);
                      if (playerRef.current.play) playerRef.current.play();
                    }
                  }}
                  className="text-zinc-500 hover:bg-primary/20 hover:text-primary"
                >
                  <Play className="size-3" fill="currentColor" />
                </Button>
              </Tip>

              {selectedLines.size === 0 && (
                <>
                  <Tip content={(() => {
                    const nudgeVal = settings.editor?.nudge?.default || 0.1;
                    if (focusedTimestamp?.lineIndex === i) {
                      if (editorMode === 'words' && (focusedTimestamp.type === 'word' || focusedTimestamp.type === 'secondaryWord')) return `Nudge Word (-${nudgeVal}s)`;
                      if ((editorMode === 'srt' || editorMode === 'words') && focusedTimestamp.type === 'end') return `Nudge End Time (-${nudgeVal}s)`;
                    }
                    return `Nudge Line (-${nudgeVal}s)`;
                  })()}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); shiftTime(i, -(settings.editor?.nudge?.default || 0.1)); }}
                      className={`transition-colors ${focusedTimestamp?.lineIndex === i ? 'text-primary hover:text-primary-dim hover:bg-primary/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60'}`}
                    >
                      <ChevronLeft className="size-3" />
                    </Button>
                  </Tip>
                  <Tip content={(() => {
                    const nudgeVal = settings.editor?.nudge?.default || 0.1;
                    if (focusedTimestamp?.lineIndex === i) {
                      if (editorMode === 'words' && (focusedTimestamp.type === 'word' || focusedTimestamp.type === 'secondaryWord')) return `Nudge Word (+${nudgeVal}s)`;
                      if ((editorMode === 'srt' || editorMode === 'words') && focusedTimestamp.type === 'end') return `Nudge End Time (+${nudgeVal}s)`;
                    }
                    return `Nudge Line (+${nudgeVal}s)`;
                  })()}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); shiftTime(i, settings.editor?.nudge?.default || 0.1); }}
                      className={`transition-colors ${focusedTimestamp?.lineIndex === i ? 'text-primary hover:text-primary-dim hover:bg-primary/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60'}`}
                    >
                      <ChevronRight className="size-3" />
                    </Button>
                  </Tip>
                  <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />
                  <Tip content={t('editor.addLine')}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); handleAddLine(i); }}
                      className="text-zinc-500 hover:text-green-400 hover:bg-green-500/10"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </Tip>
                  <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />
                  <Tip content={t('editor.editLine')}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLineIndex(i);
                        setEditingText(serializeToRubyMarkup(line.words) || line.text);
                        setEditingSecondary(line.secondary || '');
                        setEditingTranslation(line.translation || '');
                      }}
                      className="text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10"
                    >
                      <Pencil className="size-3" />
                    </Button>
                  </Tip>
                </>
              )}
            </>
          )}
          {!isSynced && selectedLines.size === 0 && (
            <Tip content={t('editor.editLine')}>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingLineIndex(i);
                  setEditingText(serializeToRubyMarkup(line.words) || line.text);
                  setEditingSecondary(line.secondary || '');
                  setEditingTranslation(line.translation || '');
                }}
                className="text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10"
              >
                <Pencil className="size-3" />
              </Button>
            </Tip>
          )}
          {selectedLines.size === 0 && (
            <>
              {!isMobile ? (
                <Popover>
                  <Tip content={t('editor.lineOptions')}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => e.stopPropagation()}
                        className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60"
                      >
                        <MoreHorizontal className="size-3" />
                      </Button>
                    </PopoverTrigger>
                  </Tip>
                  <PopoverContent
                    className="min-w-[180px]"
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PopoverItem
                      onClick={() => handleAddLine(i - 1 >= 0 ? i - 1 : i)}
                      className="hover:bg-sky-500/10 hover:text-sky-400"
                    >
                      <ArrowUpToLine className="size-3.5" />
                      {t('editor.insertLineAbove', 'Insert Above')}
                    </PopoverItem>
                    <PopoverItem
                      onClick={() => handleAddLine(i)}
                      className="hover:bg-green-500/10 hover:text-green-400"
                    >
                      <ArrowDownToLine className="size-3.5" />
                      {t('editor.insertLineBelow', 'Insert Below')}
                    </PopoverItem>
                    <PopoverItem
                      onClick={() => {
                        // Duplicate: insert a copy of this line after it
                        if (handleAddLine) {
                          handleAddLine(i, { ...line, id: crypto.randomUUID() });
                        }
                      }}
                      className="hover:bg-zinc-700/60"
                    >
                      <CopyPlus className="size-3.5" />
                      {t('editor.duplicateLine', 'Duplicate')}
                    </PopoverItem>
                    {line.timestamp != null && (
                      <PopoverItem
                        onClick={() => handleClearLine(i)}
                        className="hover:bg-orange-500/10 hover:text-orange-400"
                      >
                        <X className="size-3.5" />
                        {t('editor.clearTimestamp')}
                      </PopoverItem>
                    )}
                    <PopoverItem
                      onClick={() => handleDeleteLine(i)}
                      className="hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                      {t('editor.removeLine')}
                    </PopoverItem>
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => { e.stopPropagation(); onLineMenu?.(i, line); }}
                  className="text-zinc-500 active:text-zinc-300"
                >
                  <MoreHorizontal className="size-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {/* Progress stripe for active synced line */}
      {segmentProgress != null && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800/50 animate-in fade-in duration-300">
          <div
            className="h-full bg-primary/50 transition-[width] duration-100 ease-linear rounded-full"
            style={{ width: `${segmentProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
});

export default EditorLineItem;