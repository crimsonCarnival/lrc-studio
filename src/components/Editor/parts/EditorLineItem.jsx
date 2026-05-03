import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { serializeToRubyMarkup, isKanji, toHiragana, toKatakana, hasCJK } from '../../../utils/furigana';
import { formatTimestamp } from '../../../utils/lrc';
import { formatTime } from '../../../utils/formatTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Kbd } from '../../shared/Kbd';
import { Pencil, Play, ChevronLeft, ChevronRight, Plus, X, Trash2, Repeat, MoreHorizontal, GripVertical } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tip } from '@/components/ui/tip';

/**
 * Uncontrolled input that binds wanakana romaji→hiragana conversion while mounted.
 * Only activates if the global `window.wanakana` is available (CDN load).
 */
function ReadingInput({ defaultValue, onCommit, onCancel, className, style, placeholder, readingFormat }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const toKana = readingFormat === 'katakana' ? 'toKatakana' : 'toHiragana';
    window.wanakana?.bind(el, { IMEMode: toKana });
    return () => { window.wanakana?.unbind(el); };
  }, [readingFormat]);
  return (
    <input
      ref={ref}
      autoFocus
      type="text"
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(e.target.value);
        if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder ?? '…'}
      className={className}
      style={style}
    />
  );
}

/**
 * Inline timestamp editor — double-click to edit, scroll to adjust, shows nudge indicator.
 */
function InlineTimestampEdit({ value, onChange, onCancel, precision }) {
  const fmt = (s) => {
    if (s == null || isNaN(s) || s < 0) return '00:00.00';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = secs.toFixed(precision === 'thousandths' ? 3 : 2).padStart(precision === 'thousandths' ? 6 : 5, '0');
    return `${mm}:${ss}`;
  };

  const [text, setText] = useState(fmt(value));
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const parseInput = (str) => {
    // Accept mm:ss.xx or mm:ss.xxx
    const m = str.match(/^(\d{1,3}):(\d{1,2})\.(\d{1,3})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / Math.pow(10, m[3].length);
  };

  const commit = () => {
    const parsed = parseInput(text);
    if (parsed != null && parsed >= 0) {
      onChange(parsed);
    } else {
      onCancel();
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.01 : -0.01;
    const parsed = parseInput(text);
    if (parsed != null) {
      const next = Math.max(0, parsed + delta);
      setText(fmt(next));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        e.stopPropagation();
      }}
      onWheel={handleWheel}
      onClick={(e) => e.stopPropagation()}
      className="w-[82px] text-[10px] font-mono tabular-nums bg-zinc-800 border border-primary/50 rounded px-1.5 py-0.5 text-primary outline-none focus:ring-1 focus:ring-primary/50"
    />
  );
}

/**
 * Timestamp badge that supports double-click to edit and shows wheel-nudge indicator.
 */
function TimestampBadge({ value, isSynced, isFocused, isActive, precision, onClick, onDoubleClick, onWheel, nudgeIndicator }) {
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        className={`flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums transition-all w-fit ${
          isFocused
            ? 'bg-primary/25 ring-1 ring-primary/50 text-primary font-semibold'
            : isSynced
              ? 'bg-zinc-800 border border-zinc-700/50 text-primary hover:border-primary/40 hover:bg-zinc-700/60'
              : isActive
                ? 'text-zinc-400 animate-pulse-glow hover:bg-zinc-800/50 border border-transparent'
                : 'text-zinc-600 hover:bg-zinc-800/50 border border-transparent'
        }`}
      >
        {isSynced ? formatTimestamp(value, precision) : '--:--.--'}
      </button>
      {nudgeIndicator && (
        <span className="absolute -right-8 text-[9px] font-mono text-primary/80 animate-fade-in pointer-events-none whitespace-nowrap">
          {nudgeIndicator}
        </span>
      )}
    </div>
  );
}

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
}) => {
  const { t } = useTranslation();
  const [editingTimestamp, setEditingTimestamp] = useState(null); // null | 'start' | 'end'
  const [editingReadingWordIndex, setEditingReadingWordIndex] = useState(null);
  const [inlineEditCharIdx, setInlineEditCharIdx] = useState(null); // char index in line.text for plain-text kanji reading
  const [nudgeIndicator, setNudgeIndicator] = useState(null);
  const [justSynced, setJustSynced] = useState(false);
  const nudgeTimerRef = useRef(null);
  const justSyncedTimerRef = useRef(null);
  // Touch gesture refs
  const touchStartRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const showNudge = useCallback((delta) => {
    const sign = delta > 0 ? '+' : '';
    setNudgeIndicator(`${sign}${delta.toFixed(2)}s`);
    clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => setNudgeIndicator(null), 600);
  }, []);

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
      onClick={(e) => handleLineClick(i, e)}
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
      className={`flex ${editorMode === 'words' ? 'items-start' : 'items-center'} gap-2 sm:gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden animate-preview-line-in ${selectedLines.has(i)
        ? 'bg-primary/15 border border-primary/40 ring-1 ring-primary/20'
        : isActive
          ? isLocked
            ? 'bg-primary/10 border border-primary/30'
            : 'bg-primary/5 border border-primary/20 border-dashed'
          : dragOverIndex === i
            ? 'bg-accent-blue/10 border border-accent-blue/30'
            : upcomingDepth > 0
              ? `bg-primary/${upcomingDepth === 1 ? '5' : upcomingDepth === 2 ? '3' : '2'} border border-primary/${upcomingDepth === 1 ? '15' : '10'} border-dashed`
              : 'hover:bg-zinc-800/40 border border-transparent'
        } ${dragIndex === i ? 'opacity-40' : ''} ${justSynced ? 'ring-2 ring-primary/60 animate-just-synced' : ''}`}
    >
      {/* Lock/unlock indicator */}
      {isActive && (
        <div className={`absolute left-0 inset-y-0 w-1 z-0 rounded-l-xl ${
          isLocked
            ? 'bg-primary shadow-[0_0_12px_rgba(29,185,84,0.6)] opacity-90'
            : 'bg-primary/40 opacity-60'
        }`} />
      )}
      {/* Drag Handle & Line number */}
      <div className="flex items-center gap-1 shrink-0">
        <div 
          className="cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-500 transition-colors p-0.5 -ml-1 select-none"
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
              <span className="text-[10px] font-mono tabular-nums text-zinc-600 select-none text-right">
                {i + 1}
              </span>
            )}
          </div>
        )}
      </div>
      <span
        className={`text-xs font-mono tabular-nums shrink-0 transition-colors ${editorMode === 'words' ? 'self-start pt-0.5' : ''} ${isSynced
          ? 'text-primary'
          : isActive
            ? 'text-zinc-400 animate-pulse-glow'
            : 'text-zinc-600'
          }`}
        style={{ minWidth: '92px' }}
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
                      className={`text-[9px] px-1.5 py-0.5 rounded leading-none font-bold transition-all ${
                        stampTarget === 'main'
                          ? 'bg-primary text-zinc-900 shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-300'
                      }`}
                    >主</button>
                  </Tip>
                  <Tip content={t('editor.stampLayerSecondary')}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (stampTarget !== 'secondary') handleStampTargetToggle?.(); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded leading-none font-bold transition-all ${
                        stampTarget === 'secondary'
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
            <div className="flex flex-wrap gap-x-1 gap-y-1 max-w-[200px] min-h-[22px] items-end content-start">
                {line.words?.map((w, wi) => {
                  const displayWord = w.word.replace(/^[()'"]+|[,;.!?()'"]+$/g, '');
                  const isEditingReading = editingReadingWordIndex === wi;
                  const isFocusedWord = focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'word' && focusedTimestamp?.wordIndex === wi;
                  const isActiveWord = wi === activeWordIndex;
                  const canHaveReading = isKanji(w.word || '');
                  const readingFmt = settings?.editor?.display?.readingFormat || 'hiragana';
                  const fmtReading = (r) => r ? (readingFmt === 'katakana' ? toKatakana(r) : toHiragana(r)) : r;
                  return (
                    <div key={wi} className="flex flex-col items-center gap-0">
                      {/* Furigana reading row — only for kanji */}
                      {canHaveReading && (isEditingReading ? (
                        <ReadingInput
                          defaultValue={fmtReading(w.reading) || ''}
                          onCommit={(val) => { handleSetWordReading?.(i, wi, val); setEditingReadingWordIndex(null); }}
                          onCancel={() => setEditingReadingWordIndex(null)}
                          readingFormat={readingFmt}
                          className="text-[9px] font-mono text-center bg-transparent border-b border-primary outline-none text-primary px-0 py-0.5"
                          style={{ width: `${Math.max(32, (w.reading?.length || 1) * 8, displayWord.length * 11)}px` }}
                        />
                      ) : (
                        <Tip content={w.reading ? t('editor.wordReadingEdit', { reading: fmtReading(w.reading) }) : t('editor.wordReadingAdd')}>
                          <span
                            onClick={(e) => { e.stopPropagation(); setEditingReadingWordIndex(wi); }}
                            className={`text-[9px] font-mono leading-none cursor-pointer select-none border-b transition-colors ${
                              w.reading
                                ? 'text-zinc-400 border-zinc-600/60 hover:text-primary hover:border-primary/50'
                                : 'text-transparent border-transparent hover:text-zinc-600 hover:border-zinc-700'
                            }`}
                            style={{ width: `${Math.max(24, (w.reading?.length || 1) * 8, displayWord.length * 11)}px`, textAlign: 'center', display: 'block' }}
                          >
                            {fmtReading(w.reading) || '　'}
                          </span>
                        </Tip>
                      ) )}
                      {/* Word chip */}
                      {w.time != null ? (
                        <div className="group/word flex items-center gap-0.5">
                          <Tip content={canHaveReading ? t('editor.wordChipTitleReading', { word: w.word, time: formatTime(w.time) }) : t('editor.wordChipTitle', { word: w.word, time: formatTime(w.time) })}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (playerRef?.current?.seek) {
                                  playerRef.current.seek(w.time);
                                  if (settings.playback?.seekPlays && playerRef.current.play) playerRef.current.play();
                                }
                                if (activeWordIndex !== -1) handleSetActiveWordIndex(wi);
                                setFocusedTimestamp({ lineIndex: i, type: 'word', wordIndex: wi });
                              }}
                              onDoubleClick={(e) => { e.stopPropagation(); if (canHaveReading) setEditingReadingWordIndex(wi); }}
                              className={`text-[11px] px-1.5 py-0.5 rounded border leading-none transition-colors cursor-pointer hover:border-primary hover:bg-primary/20 hover:text-primary ${
                                isFocusedWord
                                  ? 'bg-primary/30 border-primary text-primary ring-1 ring-primary/50'
                                  : isActiveWord
                                    ? 'bg-primary/20 border-primary/60 text-primary animate-pulse-glow'
                                    : 'bg-zinc-800 border-primary/30 text-primary/70'
                              }`}
                            >
                              {displayWord}
                            </button>
                          </Tip>
                          <Tip content={t('editor.clearWordTimestamp', { word: w.word })}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleClearWordTimestamp(i, wi); }}
                              className="opacity-0 group-hover/word:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 -ml-0.5"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </Tip>
                        </div>
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); if (canHaveReading) setEditingReadingWordIndex(wi); }}
                          className={`text-[11px] px-1.5 py-0.5 rounded border leading-none ${
                            isActiveWord
                              ? 'bg-primary/20 border-primary/60 text-primary animate-pulse-glow'
                              : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-600'
                          }`}
                        >
                          {displayWord}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            )}
            {/* Secondary word chips — shown only when stampTarget is 'secondary' */}
            {stampTarget === 'secondary' && hasCJK(line.text || '') && line.secondary && (
              <div className="flex flex-wrap gap-x-1 gap-y-1 max-w-[200px] min-h-[22px] items-end content-start">
                {(line.secondaryWords?.length
                  ? line.secondaryWords
                  : line.secondary.trim().split(/\s+/).filter(Boolean).map((word) => ({ word, time: null }))
                ).map((w, wi) => {
                  const isActiveSecondaryWord = wi === activeWordIndex;
                  const isFocusedSecondaryWord = focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'secondaryWord' && focusedTimestamp?.wordIndex === wi;
                  return w.time != null ? (
                    <div key={wi} className="group/sword flex items-center gap-0.5">
                      <Tip content={`${w.word} @ ${formatTime(w.time)}`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (playerRef?.current?.seek) {
                              playerRef.current.seek(w.time);
                              if (settings.playback?.seekPlays && playerRef.current.play) playerRef.current.play();
                            }
                            if (activeWordIndex !== -1) handleSetActiveWordIndex(wi);
                            setFocusedTimestamp({ lineIndex: i, type: 'secondaryWord', wordIndex: wi });
                          }}
                          className={`text-[11px] px-1.5 py-0.5 rounded border leading-none transition-colors cursor-pointer hover:border-accent-blue hover:bg-accent-blue/20 hover:text-accent-blue ${
                            isFocusedSecondaryWord
                              ? 'bg-accent-blue/30 border-accent-blue text-accent-blue ring-1 ring-accent-blue/50'
                              : isActiveSecondaryWord
                                ? 'bg-accent-blue/20 border-accent-blue/60 text-accent-blue animate-pulse-glow'
                                : 'bg-accent-blue/10 border-accent-blue/30 text-accent-blue/70'
                          }`}
                        >
                          {w.word}
                        </button>
                      </Tip>
                      <Tip content={t('editor.clearWordTimestamp', { word: w.word })}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleClearWordTimestamp(i, wi, 'secondaryWords'); }}
                          className="opacity-0 group-hover/sword:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5 -ml-0.5"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Tip>
                    </div>
                  ) : (
                    <span
                      key={wi}
                      className={`text-[11px] px-1.5 py-0.5 rounded border leading-none transition-colors ${
                        isActiveSecondaryWord
                          ? 'bg-accent-blue/20 border-accent-blue/60 text-accent-blue animate-pulse-glow'
                          : 'bg-zinc-800/50 border-zinc-700/30 text-zinc-500'
                      }`}
                    >
                      {w.word}
                    </span>
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
                className={`flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums transition-all w-fit ${
                  focusedTimestamp?.lineIndex === i && focusedTimestamp?.type === 'end'
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
          <div className={`flex flex-col gap-0.5 group/text min-w-0 w-full ${editorMode === 'words' ? 'pt-0.5' : ''}`}>
            <div className="flex items-center gap-2">
              <p
                className={`text-xs transition-colors ${editorMode !== 'words' && (line.words?.some(w => w.reading) || editingReadingWordIndex != null || inlineEditCharIdx != null) ? 'overflow-hidden' : 'truncate'} ${isActive
                  ? 'text-zinc-100 font-medium'
                  : isSynced
                    ? line.words?.some(w => w.time != null) ? 'text-zinc-300' : 'text-zinc-100'
                    : 'text-zinc-500'
                  }`}
                style={editorMode !== 'words' && (line.words?.some(w => w.reading) || editingReadingWordIndex != null || inlineEditCharIdx != null)
                  ? { lineHeight: '2.2' }
                  : undefined}
              >
                {editorMode === 'words' && line.words?.length > 0
                  ? line.words.map((w, wi) => (
                      <span
                        key={wi}
                        className={`transition-colors ${
                          isActive && wi === activeWordIndex
                            ? 'text-primary underline decoration-dotted underline-offset-2'
                            : w.time != null
                              ? 'text-primary/70'
                              : isActive || isSynced ? 'text-zinc-100' : ''
                        }`}
                      >
                        {w.word}{' '}
                      </span>
                    ))
                  : line.words?.length > 0
                    ? line.words.map((w, wi) => {
                        const canHaveReading = isKanji(w.word || '');
                        const isEditingThisReading = editingReadingWordIndex === wi;
                        const rubyFmt = settings?.editor?.display?.readingFormat || 'hiragana';
                        const fmtR = (r) => r ? (rubyFmt === 'katakana' ? toKatakana(r) : toHiragana(r)) : r;
                        const trailingSpace = /[a-zA-Z0-9]/.test(w.word) ? ' ' : null;
                        if (isEditingThisReading) {
                          return (
                            <React.Fragment key={wi}>
                              <ruby>
                                {w.word}
                                <rt>
                                  <ReadingInput
                                    defaultValue={fmtR(w.reading) || ''}
                                    onCommit={(val) => { handleSetWordReading?.(i, wi, val); setEditingReadingWordIndex(null); }}
                                    onCancel={() => setEditingReadingWordIndex(null)}
                                    readingFormat={rubyFmt}
                                    className="text-[9px] font-mono text-center bg-transparent border-b border-primary outline-none text-primary px-0 py-0.5"
                                    style={{ width: `${Math.max(30, [...(w.reading || '')].length * 8, [...w.word].length * 9)}px` }}
                                  />
                                </rt>
                              </ruby>
                              {trailingSpace}
                            </React.Fragment>
                          );
                        }
                        if (w.reading) {
                          return (
                            <React.Fragment key={wi}>
                              <ruby
                                onClick={(e) => { e.stopPropagation(); if (canHaveReading) setEditingReadingWordIndex(wi); }}
                                className={canHaveReading ? 'cursor-pointer' : ''}
                              >
                                {w.word}
                                <rt className="text-[10px] font-mono text-zinc-400 hover:text-primary transition-colors select-none">{fmtR(w.reading)}</rt>
                              </ruby>
                              {trailingSpace}
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={wi}>
                            <span
                              onClick={(e) => { if (!canHaveReading) return; e.stopPropagation(); setEditingReadingWordIndex(wi); }}
                              className={canHaveReading ? 'cursor-pointer hover:text-primary/70 transition-colors' : ''}
                            >{w.word}</span>
                            {trailingSpace}
                          </React.Fragment>
                        );
                      })
                    : [...(line.text || '♪')].map((ch, ci) => {
                        if (!isKanji(ch)) return <span key={ci}>{ch}</span>;
                        const rubyFmt = settings?.editor?.display?.readingFormat || 'hiragana';
                        if (inlineEditCharIdx === ci) {
                          return (
                            <ruby key={ci}>
                              {ch}
                              <rt>
                                <ReadingInput
                                  defaultValue=""
                                  onCommit={(val) => {
                                    if (val) {
                                      const chars = [...(line.text || '')];
                                      const before = chars.slice(0, ci).join('');
                                      const after = chars.slice(ci + 1).join('');
                                      handleSaveLineText?.(i, `${before}{${ch}|${val}}${after}`, line.secondary, line.translation);
                                    }
                                    setInlineEditCharIdx(null);
                                  }}
                                  onCancel={() => setInlineEditCharIdx(null)}
                                  readingFormat={rubyFmt}
                                  className="text-[9px] font-mono text-center bg-transparent border-b border-primary outline-none text-primary px-0 py-0.5"
                                  style={{ width: '30px' }}
                                />
                              </rt>
                            </ruby>
                          );
                        }
                        return (
                          <span
                            key={ci}
                            onClick={(e) => { e.stopPropagation(); setInlineEditCharIdx(ci); }}
                            className="cursor-pointer hover:text-primary/70 transition-colors"
                          >{ch}</span>
                        );
                      })
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
              <Tip content={t('editor.editLine') || 'Edit text (Double-click)'}>
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
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-zinc-500 hover:text-primary hover:bg-zinc-800/60"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </Tip>
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
      {/* Mark button — always visible on the active unsaved line */}
      {isActive && editingLineIndex !== i && (
        <Tip content={
            editorMode === 'words' && line.timestamp != null
              ? stampTarget === 'secondary'
                ? `Stamp "${(line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean).map(w => ({ word: w })))?.[Math.min(activeWordIndex, (line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean).map(w => ({ word: w })) ?? [])?.length - 1)]?.word || 'word'}" (${activeWordIndex}/${(line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean))?.length ?? 0})`
                : `Stamp "${line.words?.[Math.min(activeWordIndex, (line.words?.length ?? 1) - 1)]?.word || 'word'}" (${activeWordIndex}/${line.words?.length ?? 0})`
              : t('editor.mark')
          }>
          <Button
            onClick={(e) => { e.stopPropagation(); handleMark(); }}
            className={`h-7 px-2 gap-1.5 border font-semibold rounded-lg flex-shrink-0 text-xs ${
              editorMode === 'words' && line.timestamp != null
                ? stampTarget === 'secondary'
                  ? 'bg-accent-blue/15 hover:bg-accent-blue/25 border-accent-blue/40 text-accent-blue'
                  : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-400'
                : 'bg-primary/20 hover:bg-primary/30 border-primary/40 text-primary'
            }`}
        >
          {editorMode === 'words' && line.timestamp != null && stampTarget === 'secondary'
            ? (() => {
                const secWords = line.secondaryWords ?? line.secondary?.trim().split(/\s+/).filter(Boolean).map(w => ({ word: w }));
                const w = secWords?.[Math.min(activeWordIndex, (secWords?.length ?? 1) - 1)];
                return w ? <span className="font-mono text-[10px] max-w-[48px] truncate">{w.word}</span> : null;
              })()
            : editorMode === 'words' && line.timestamp != null && line.words?.[Math.min(activeWordIndex, (line.words?.length ?? 1) - 1)] ? (
            <span className="font-mono text-[10px] max-w-[48px] truncate">{line.words[Math.min(activeWordIndex, (line.words?.length ?? 1) - 1)].word.replace(/^[()'"]+|[,;.!?()'"]+$/g, '')}</span>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          </Button>
        </Tip>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                className="text-zinc-500 hover:bg-primary/20 hover:text-primary mr-1"
              >
                <Play className="w-3 h-3" fill="currentColor" />
              </Button>
            </Tip>
            {line.nextTimestamp != null && (
              <Tip content={t('editor.loopCurrentLine')}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (playerRef?.current?.setLoop) {
                      playerRef.current.setLoop(line.timestamp, line.endTime ?? line.nextTimestamp);
                      playerRef.current.seek(line.timestamp);
                      if (playerRef.current.play) playerRef.current.play();
                    }
                  }}
                  className="text-zinc-500 hover:bg-accent-purple/20 hover:text-accent-purple mr-1"
                >
                  <Repeat className="w-3 h-3" />
                </Button>
              </Tip>
            )}
            {selectedLines.size === 0 && (
              <>
                <Tip content={`-${settings.editor?.nudge?.default || 0.1}s`}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); shiftTime(i, -(settings.editor?.nudge?.default || 0.1)); }}
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                </Tip>
                <Tip content={`+${settings.editor?.nudge?.default || 0.1}s`}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); shiftTime(i, (settings.editor?.nudge?.default || 0.1)); }}
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Tip>
                <div className="w-px h-4 bg-zinc-700/50 mx-1" />
                <Tip content={t('editor.addLine')}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => { e.stopPropagation(); handleAddLine(i); }}
                    className="text-zinc-500 hover:text-green-400 hover:bg-green-500/10"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </Tip>
              </>
            )}
          </>
        )}
        {selectedLines.size === 0 && (
          <Popover>
            <Tip content={t('editor.lineOptions')}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => e.stopPropagation()}
                  className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/60"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
            </Tip>
            <PopoverContent
              className="min-w-[160px]"
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              {line.timestamp != null && (
                <PopoverItem
                  onClick={() => handleClearLine(i)}
                  className="hover:bg-orange-500/10 hover:text-orange-400"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('editor.clearTimestamp')}
                </PopoverItem>
              )}
              <PopoverItem
                onClick={() => handleDeleteLine(i)}
                className="hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('editor.removeLine')}
              </PopoverItem>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {/* Progress stripe for active synced line */}
      {segmentProgress != null && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800/50">
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
