import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { lyrics } from '../../api';
import { matchKey } from '../../utils/keyboard';
import { toHiragana, toKatakana, parseRubyMarkup, hasCJK } from '../../utils/furigana';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/useSettings';
import useConfirm from '../../hooks/useConfirm';
import {
  applyBulkShift,
  applyGlobalOffset,
  clearAllTimestamps,
  clearLineTimestamp,
  applyMark,
  detectDuplicateTimestamps,
} from './editorService';

export function useEditor({
  lines,
  setLines,
  syncMode,
  setSyncMode,
  activeLineIndex,
  setActiveLineIndex,
  playbackPosition,
  playerRef,
  editorMode,
  setEditorMode,
  onImport,
}) {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [rawText, setRawText] = useState('');
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingSecondary, setEditingSecondary] = useState('');
  const [editingTranslation, setEditingTranslation] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedLines, setSelectedLines] = useState(new Set());
  // awaitingEndMark is derived: only non-null when the stored context still matches
  const [awaitingEndMarkFor, setAwaitingEndMarkFor] = useState(null); // null | { lineIndex, mode }
  const awaitingEndMark =
    awaitingEndMarkFor?.lineIndex === activeLineIndex && awaitingEndMarkFor?.mode === editorMode
      ? awaitingEndMarkFor.lineIndex
      : null;
  const [focusedTimestamp, setFocusedTimestamp] = useState(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null);
  const [isActiveLineLocked, setIsActiveLineLocked] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [stampTarget, setStampTarget] = useState('main'); // 'main' | 'secondary'

  const [requestConfirm, confirmModal] = useConfirm();

  const lastClickedRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stable refs to avoid recreating handleMark/keyboard effects on every frame
  const linesRef = useRef(lines);
  const playbackPositionRef = useRef(playbackPosition);
  const activeLineIndexRef = useRef(activeLineIndex);
  const focusedTimestampRef = useRef(focusedTimestamp);
  const selectedLinesRef = useRef(selectedLines);
  const activeWordIndexRef = useRef(0);
  const stampTargetRef = useRef('main');
  useEffect(() => {
    linesRef.current = lines;
    playbackPositionRef.current = playbackPosition;
    activeLineIndexRef.current = activeLineIndex;
    focusedTimestampRef.current = focusedTimestamp;
    selectedLinesRef.current = selectedLines;
    activeWordIndexRef.current = activeWordIndex;
    stampTargetRef.current = stampTarget;
  });

  // Sync active word cursor with lines (covers undo/redo restoring a previous stamp state)
  useEffect(() => {
    if (editorMode !== 'words') {
      setActiveWordIndex(0);
      activeWordIndexRef.current = 0;
      return;
    }

    // If the user has manually focused a word, do not auto-advance the cursor away from it
    if (focusedTimestamp?.type === 'word' || focusedTimestamp?.type === 'secondaryWord') {
      return;
    }

    const words = stampTarget === 'secondary'
      ? lines[activeLineIndex]?.secondaryWords
      : lines[activeLineIndex]?.words;
    if (!words?.length) {
      setActiveWordIndex(0);
      activeWordIndexRef.current = 0;
      return;
    }
    const idx = words.findIndex((w) => w.time == null);
    const newIdx = idx === -1 ? words.length : idx;
    setActiveWordIndex(newIdx);
    activeWordIndexRef.current = newIdx;
  }, [activeLineIndex, lines, editorMode, stampTarget, focusedTimestamp]);

  // Reset stampTarget when the active line changes
  useEffect(() => {
    setStampTarget('main');
    stampTargetRef.current = 'main';
  }, [activeLineIndex]);

  useEffect(() => {
    if (editorMode === 'words') {
      setLines((prev) =>
        prev.map((line) => {
          const rawValue = (line.text || '').trim();
          if (!rawValue) return line;

          const { plainText, segments } = parseRubyMarkup(rawValue);
          const hasMarkup = segments.some(s => s.reading);
          const textChanged = plainText !== (line.text || '');

          // If no markup and already has words that match the current text, skip
          if (!hasMarkup && line.words?.length) {
            const existingText = line.words.map(w => w.word).join('');
            if (existingText === plainText) return line;
          }

          // Build a map from old char positions so timestamps survive edits if text didn't change too much
          const oldWordAtPos = new Map();
          let flat = 0;
          for (const w of line.words || []) {
            for (let k = 0; k < [...w.word].length; k++) oldWordAtPos.set(flat + k, w);
            flat += [...w.word].length;
          }

          let charPos = 0;
          const newWords = [];
          const isCJKText = hasCJK(plainText);

          for (const seg of segments) {
            const segChars = [...seg.text];
            if (seg.reading) {
              // Annotated segment — store as one word with the reading
              const anchor = oldWordAtPos.get(charPos);
              newWords.push({ word: seg.text, time: anchor?.time ?? null, reading: seg.reading });
              charPos += segChars.length;
            } else if (isCJKText) {
              // Mixed CJK+Latin: split CJK chars individually, keep Latin runs as words
              let ci = 0;
              while (ci < segChars.length) {
                const ch = segChars[ci];
                if (!ch.trim()) { charPos++; ci++; continue; }
                if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(ch)) {
                  const old = oldWordAtPos.get(charPos);
                  const w = { word: ch, time: old?.time ?? null };
                  if (old?.reading) w.reading = old.reading;
                  newWords.push(w);
                  charPos++; ci++;
                } else {
                  let j = ci;
                  while (j < segChars.length && !/[\u3000-\u9FFF\uF900-\uFAFF]/.test(segChars[j]) && segChars[j].trim()) j++;
                  const latinToken = segChars.slice(ci, j).join('');
                  const old = oldWordAtPos.get(charPos);
                  newWords.push({ word: latinToken, time: old?.time ?? null });
                  charPos += [...latinToken].length;
                  ci = j;
                }
              }
            } else {
              // Pure Latin
              const tokens = seg.text.split(/\s+/).filter(Boolean);
              for (const token of tokens) {
                const old = oldWordAtPos.get(charPos);
                newWords.push({ word: token, time: old?.time ?? null });
                charPos += [...token].length;
              }
            }
          }

          const filteredWords = newWords.filter(w => w.word.trim());
          if (filteredWords.length === 0) return line;

          return { ...line, text: plainText, words: filteredWords };
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);

  const displayedActiveIndex = isActiveLineLocked
    ? activeLineIndex
    : (hoveredLineIndex ?? activeLineIndex);

  const handleLineHover = useCallback((i) => {
    if (!isActiveLineLocked) {
      setHoveredLineIndex(i);
    }
  }, [isActiveLineLocked]);

  const handleLineHoverEnd = useCallback(() => {
    setHoveredLineIndex(null);
  }, []);

  const handleConfirmLyrics = async () => {
    const looksLikeLrc = /^\[(\d{1,2}):(\d{2}\.\d{2,3})\]/m.test(rawText);
    const looksLikeSrt = /^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/m.test(rawText);
    const looksLikeWordLrc = looksLikeLrc && /<\d{1,2}:\d{2}\.\d{2,3}>/.test(rawText);
    if (looksLikeLrc || looksLikeSrt) {
      const filename = looksLikeSrt ? 'lyrics.srt' : 'lyrics.lrc';
      try {
        const { lines: parsed } = await lyrics.parse(rawText, filename);
        if (parsed.length > 0) {
          setLines(parsed);
          if (looksLikeSrt) setEditorMode('srt');
          else if (looksLikeWordLrc) setEditorMode('words');
          else setEditorMode('lrc');
          setActiveLineIndex(Math.max(0, parsed.findIndex((l) => l.timestamp == null)));
          setSyncMode(true);
          return;
        }
      } catch (err) {
        console.error('Failed to parse lyrics via API', err);
        toast.error(t('import.failed') || 'Failed to parse lyrics');
        return;
      }
    }

    const newLinesData = rawText.split('\n').map((rawLine) => {
      const { plainText, segments } = parseRubyMarkup(rawLine.trim());
      const isCJKText = hasCJK(plainText);
      const newWords = [];
      for (const seg of segments) {
        const segChars = [...seg.text];
        if (seg.reading) {
          newWords.push({ word: seg.text, time: null, reading: seg.reading });
        } else if (isCJKText) {
          let ci = 0;
          while (ci < segChars.length) {
            const ch = segChars[ci];
            if (!ch.trim()) { ci++; continue; }
            if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(ch)) {
              newWords.push({ word: ch, time: null });
              ci++;
            } else {
              let j = ci;
              while (j < segChars.length && !/[\u3000-\u9FFF\uF900-\uFAFF]/.test(segChars[j]) && segChars[j].trim()) j++;
              const latinToken = segChars.slice(ci, j).join('');
              newWords.push({ word: latinToken, time: null });
              ci = j;
            }
          }
        } else {
          const tokens = seg.text.split(/\s+/).filter(Boolean);
          for (const token of tokens) {
            newWords.push({ word: token, time: null });
          }
        }
      }
      return { plainText, words: newWords.length > 0 ? newWords : undefined };
    });

    const updated = newLinesData.map((data, i) => {
      const old = lines[i] || {};
      const line = {
        ...old,
        text: data.plainText,
        timestamp: old.timestamp ?? null,
        id: old.id || crypto.randomUUID()
      };
      if (data.words) {
        // If we already had words with timestamps, try to preserve them by position
        if (old.words?.length) {
          let charIdx = 0;
          old.words.forEach((oldWord) => {
            let pos = 0;
            let tokIdx = 0;
            while (tokIdx < data.words.length && pos + [...data.words[tokIdx].word].length <= charIdx) {
              pos += [...data.words[tokIdx].word].length;
              tokIdx++;
            }
            if (tokIdx < data.words.length) {
              if (oldWord.time != null) data.words[tokIdx].time = oldWord.time;
              // Markup readings in the paste area take priority over old readings
              if (!data.words[tokIdx].reading && oldWord.reading) data.words[tokIdx].reading = oldWord.reading;
            }
            charIdx += [...oldWord.word].length;
          });
        }
        line.words = data.words;
      }
      return line;
    });
    setLines(updated);
    setActiveLineIndex(Math.max(0, updated.findIndex((l) => l.timestamp == null)));
    setSyncMode(true);
  };
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['lrc', 'srt', 'txt'].includes(ext)) {
      toast.error(t('import.unsupportedFormat') || 'Unsupported file type. Use .lrc, .srt, or .txt files.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('import.tooLarge') || 'File too large (max 5 MB)');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const { lines: parsed } = await lyrics.parse(evt.target.result, file.name);
        if (parsed.length > 0) {
          setLines(parsed);
          {
            const isSrt = file.name.toLowerCase().endsWith('.srt');
            const hasWords = !isSrt && parsed.some(l => l.words?.length > 0);
            setEditorMode(isSrt ? 'srt' : hasWords ? 'words' : 'lrc');
          }
          setActiveLineIndex(Math.max(0, parsed.findIndex((l) => l.timestamp == null)));
          setSyncMode(true);
          toast.success(t('import.success', { count: parsed.length }) || `Imported ${parsed.length} lines`);
          onImport?.();
        } else {
          toast.error(t('import.noLines') || 'No lyrics found in file');
        }
      } catch (err) {
        console.error('Failed to parse lyrics file', err);
        toast.error(t('import.failed') || 'Failed to parse lyrics file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUrlImport = async (url) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return { error: t('import.invalidUrl') || 'Invalid URL. Use http:// or https://' };
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const filename = parsedUrl.pathname.split('/').pop() || 'lyrics.lrc';
      const { lines: parsed } = await lyrics.parse(text, filename);
      if (parsed.length === 0) {
        return { error: t('import.noLines') || 'No lyrics found in file' };
      }
      setLines(parsed);
      {
        const isSrt = filename.toLowerCase().endsWith('.srt');
        const hasWords = !isSrt && parsed.some(l => l.words?.length > 0);
        setEditorMode(isSrt ? 'srt' : hasWords ? 'words' : 'lrc');
      }
      setActiveLineIndex(Math.max(0, parsed.findIndex((l) => l.timestamp == null)));
      setSyncMode(true);
      toast.success(t('import.success', { count: parsed.length }) || `Imported ${parsed.length} lines`);
      onImport?.();
      return { success: true };
    } catch {
      return { error: t('import.fetchError') || 'Failed to fetch. The server may not allow cross-origin requests.' };
    }
  };

  // ——— Timestamp operations ———

  // Set a timestamp to an exact value (for inline editing)
  const handleSetTimestamp = useCallback(
    (index, type, value) => {
      const numericValue = Number(value);
      if (isNaN(numericValue) || numericValue < 0) return;
      setLines((prev) => {
        const updated = [...prev];
        if (!updated[index]) return prev;
        if (type === 'end') {
          updated[index] = { ...updated[index], endTime: numericValue };
        } else if (type === 'word') {
          // Not used yet, but ready for future
        } else {
          updated[index] = { ...updated[index], timestamp: numericValue };
        }
        return updated;
      });
      if (playerRef?.current?.seek) {
        playerRef.current.seek(numericValue);
      }
    },
    [setLines, playerRef],
  );

  const shiftTime = useCallback(
    (index, delta) => {
      const numericDelta = Number(delta) || 0;
      const currentLines = linesRef.current;
      if (!currentLines[index]) return;

      // Compute target time before updating state — state updaters must be pure
      let targetTime = null;
      const ftWordField = focusedTimestamp?.type === 'secondaryWord' ? 'secondaryWords' : 'words';

      // Nudge word only in 'words' mode
      if (
        editorMode === 'words' &&
        focusedTimestamp?.lineIndex === index &&
        (focusedTimestamp.type === 'word' || focusedTimestamp.type === 'secondaryWord') &&
        focusedTimestamp.wordIndex != null &&
        currentLines[index][ftWordField]?.[focusedTimestamp.wordIndex]?.time != null
      ) {
        const newWordTime = Math.max(0, currentLines[index][ftWordField][focusedTimestamp.wordIndex].time + numericDelta);
        if (!isNaN(newWordTime)) targetTime = newWordTime;
      } 
      // Nudge end time only in 'srt' or 'words' mode
      else if (
        (editorMode === 'srt' || editorMode === 'words') &&
        focusedTimestamp?.lineIndex === index &&
        focusedTimestamp.type === 'end' &&
        currentLines[index].endTime != null
      ) {
        const newEndTime = Math.max(0, Number(currentLines[index].endTime) + numericDelta);
        if (!isNaN(newEndTime)) targetTime = newEndTime;
      } 
      // Fallback: nudge line start
      else if (currentLines[index].timestamp != null) {
        const newTimestamp = Math.max(0, Number(currentLines[index].timestamp) + numericDelta);
        if (!isNaN(newTimestamp)) targetTime = newTimestamp;
      }

      setLines((prev) => {
        const updated = [...prev];
        if (!updated[index]) return prev;

        const wField = focusedTimestamp?.type === 'secondaryWord' ? 'secondaryWords' : 'words';
        if (
          editorMode === 'words' &&
          focusedTimestamp?.lineIndex === index &&
          (focusedTimestamp.type === 'word' || focusedTimestamp.type === 'secondaryWord') &&
          focusedTimestamp.wordIndex != null &&
          updated[index][wField]?.[focusedTimestamp.wordIndex]?.time != null
        ) {
          const wi = focusedTimestamp.wordIndex;
          const newWordTime = Math.max(0, updated[index][wField][wi].time + numericDelta);
          if (!isNaN(newWordTime)) {
            const newWords = [...updated[index][wField]];
            newWords[wi] = { ...newWords[wi], time: newWordTime };
            updated[index] = { ...updated[index], [wField]: newWords };
          }
        } else if (
          (editorMode === 'srt' || editorMode === 'words') &&
          focusedTimestamp?.lineIndex === index &&
          focusedTimestamp.type === 'end' &&
          updated[index].endTime != null
        ) {
          const newEndTime = Math.max(0, Number(updated[index].endTime) + numericDelta);
          if (!isNaN(newEndTime)) {
            updated[index] = { ...updated[index], endTime: newEndTime };
          }
        } else if (updated[index].timestamp != null) {
          const newTimestamp = Math.max(0, Number(updated[index].timestamp) + numericDelta);
          if (!isNaN(newTimestamp)) {
            updated[index] = { ...updated[index], timestamp: newTimestamp };
          }
        }
        return updated;
      });

      if (targetTime !== null && playerRef?.current?.seek) {
        playerRef.current.seek(targetTime);
      }
    },
    [playerRef, setLines, focusedTimestamp],
  );

  const handleMark = useCallback(() => {
    const currentLines = linesRef.current;
    const idx = activeLineIndexRef.current;
    if (idx >= currentLines.length) return;
    const time = playerRef?.current?.getCurrentTime?.() ?? playbackPositionRef.current;

    if (settings.editor?.autoPauseOnMark) {
      playerRef?.current?.pause?.();
    }

    const result = applyMark({
      lines: currentLines,
      activeLineIndex: idx,
      time,
      editorMode,
      activeWordIndex: activeWordIndexRef.current,
      stampTarget: stampTargetRef.current,
      awaitingEndMark,
      focusedTimestamp: focusedTimestampRef.current,
      settings: settings.editor || {},
    });

    setLines(result.nextLines);
    if (result.nextActiveLineIndex != null) {
      setActiveLineIndex(result.nextActiveLineIndex);
    }
    if (result.nextAwaitingEndMark !== undefined) {
      setAwaitingEndMarkFor(result.nextAwaitingEndMark);
    }
    if (result.nextActiveWordIndex !== undefined) {
      setActiveWordIndex(result.nextActiveWordIndex);
      activeWordIndexRef.current = result.nextActiveWordIndex;
    }
    // Clear focused timestamp after each mark — it's a one-shot action
    if (focusedTimestampRef.current) {
      setFocusedTimestamp(null);
      focusedTimestampRef.current = null;
    }
  }, [
    playerRef,
    setLines,
    setActiveLineIndex,
    editorMode,
    awaitingEndMark,
    settings.editor,
  ]);

  // ——— Shortcut handler (sync mode) ———
  useEffect(() => {
    if (!syncMode) return;

    const handler = (e) => {
      // Ignore IME composition events (e.g. Japanese input)
      if (e.isComposing || e.keyCode === 229) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const handleNudge = (delta) => {
        const ft = focusedTimestampRef.current;
        if (ft) {
          shiftTime(ft.lineIndex, delta);
        } else if (selectedLinesRef.current.size > 0) {
          setLines((prev) => applyBulkShift(prev, selectedLinesRef.current, delta));
        } else {
          shiftTime(activeLineIndexRef.current, delta);
        }
      };

      if (matchKey(e, settings.shortcuts?.mark?.[0] || 'Space')) {
        e.preventDefault();
        handleMark();
      } else if (matchKey(e, settings.shortcuts?.nudgeLeftFine?.[0] || 'Shift+ArrowLeft')) {
        e.preventDefault();
        handleNudge(-(settings.editor?.nudge?.fine || 0.01));
      } else if (matchKey(e, settings.shortcuts?.nudgeRightFine?.[0] || 'Shift+ArrowRight')) {
        e.preventDefault();
        handleNudge(settings.editor?.nudge?.fine || 0.01);
      } else if (matchKey(e, settings.shortcuts?.nudgeLeft?.[0] || 'Alt+ArrowLeft')) {
        e.preventDefault();
        handleNudge(-(settings.editor?.nudge?.default || 0.1));
      } else if (matchKey(e, settings.shortcuts?.nudgeRight?.[0] || 'Alt+ArrowRight')) {
        e.preventDefault();
        handleNudge(settings.editor?.nudge?.default || 0.1);
      } else if (matchKey(e, settings.shortcuts?.deselect?.[0] || 'Escape') && focusedTimestampRef.current) {
        e.preventDefault();
        setFocusedTimestamp(null);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const modes = ['lrc', 'srt', 'words'];
        setEditorMode((prev) => modes[(modes.indexOf(prev) + 1) % modes.length]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    syncMode,
    handleMark,
    shiftTime,
    settings.editor?.nudge?.default,
    settings.editor?.nudge?.fine,
    setLines,
    settings.shortcuts?.mark,
    settings.shortcuts?.nudgeLeft,
    settings.shortcuts?.nudgeRight,
    settings.shortcuts?.nudgeLeftFine,
    settings.shortcuts?.nudgeRightFine,
    settings.shortcuts?.deselect,
    setEditorMode,
  ]);

  // Listen for touch-driven mark events dispatched by MiniPlayer / gesture handler
  useEffect(() => {
    if (!syncMode) return;
    const handler = () => handleMark();
    window.addEventListener('editor:mark', handler);
    return () => window.removeEventListener('editor:mark', handler);
  }, [syncMode, handleMark]);

  // ——— Line operations ———

  const handleClearLine = useCallback(
    (index) => {
      setLines((prev) => clearLineTimestamp(prev, index, editorMode === 'srt', editorMode === 'words'));
    },
    [setLines, editorMode],
  );

  const handleClearTimestamps = () => {
    requestConfirm(t('confirm.clearTimestamps') || 'Clear all timestamps?', () => {
      setLines((prev) => clearAllTimestamps(prev, editorMode === 'srt', editorMode === 'words'));
      setActiveLineIndex(0);
    });
  };

  const handleClearAllWordTimestamps = () => {
    requestConfirm(t('confirm.clearWordTimestamps') || 'Clear all word timestamps?', () => {
      setLines((prev) => prev.map((l) =>
        l.words ? { ...l, words: l.words.map((w) => ({ ...w, time: null })) } : l
      ));
    });
  };

  const handleClearActiveLineWordTimestamps = () => {
    const line = lines[activeLineIndex];
    if (!line?.words) return;
    setLines((prev) => {
      const updated = [...prev];
      updated[activeLineIndex] = { ...line, words: line.words.map((w) => ({ ...w, time: null })) };
      return updated;
    });
  };

  const handleSaveLineText = (index, newText, newSecondary, newTranslation) => {
    setLines((prev) => {
      const updated = [...prev];
      const prevLine = updated[index];
      const { plainText, segments } = parseRubyMarkup(newText || '');
      const hasMarkup = segments.some(s => s.reading);
      const line = { ...prevLine, text: plainText };
      if (newSecondary !== undefined) line.secondary = newSecondary || undefined;
      if (newTranslation !== undefined) line.translation = newTranslation || undefined;
      // Always re-tokenize when text or markup changed
      const textChanged = plainText !== (prevLine.text || '');
      if (hasMarkup || (line.words && textChanged)) {
        const isCJKText = hasCJK(plainText || '');
        // Build a map from old char positions so timestamps survive edits
        const oldWordAtPos = new Map();
        let flat = 0;
        for (const w of prevLine.words || []) {
          for (let k = 0; k < [...w.word].length; k++) oldWordAtPos.set(flat + k, w);
          flat += [...w.word].length;
        }
        let charPos = 0;
        const newWords = [];
        for (const seg of segments) {
          const segChars = [...seg.text];
          if (seg.reading) {
            // Multi-char annotated segment — store as one word with the reading
            const anchor = oldWordAtPos.get(charPos);
            newWords.push({ word: seg.text, time: anchor?.time ?? null, reading: seg.reading });
            charPos += segChars.length;
          } else if (isCJKText) {
            // Mixed CJK+Latin: split CJK chars individually, keep Latin runs as whole words
            let ci = 0;
            while (ci < segChars.length) {
              const ch = segChars[ci];
              if (!ch.trim()) { charPos++; ci++; continue; }
              if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(ch)) {
                const old = oldWordAtPos.get(charPos);
                const w = { word: ch, time: old?.time ?? null };
                if (old?.reading) w.reading = old.reading;
                newWords.push(w);
                charPos++; ci++;
              } else {
                let j = ci;
                while (j < segChars.length && !/[\u3000-\u9FFF\uF900-\uFAFF]/.test(segChars[j]) && segChars[j].trim()) j++;
                const latinToken = segChars.slice(ci, j).join('');
                const old = oldWordAtPos.get(charPos);
                newWords.push({ word: latinToken, time: old?.time ?? null });
                charPos += [...latinToken].length;
                ci = j;
              }
            }
          } else {
            const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
            for (const token of tokens) {
              const old = oldWordAtPos.get(charPos);
              newWords.push({ word: token, time: old?.time ?? null });
              charPos += [...token].length;
            }
          }
        }
        line.words = newWords.filter(w => w.word.trim());
      }
      updated[index] = line;
      return updated;
    });
  };

  const handleSetWordReading = useCallback((lineIndex, wordIndex, reading) => {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[lineIndex] };
      const words = [...(line.words || [])];
      const trimmed = reading?.trim() || null;
      words[wordIndex] = trimmed
        ? { ...words[wordIndex], reading: trimmed }
        : (() => { const { reading: _r, ...rest } = words[wordIndex]; return rest; })();
      line.words = words;
      updated[lineIndex] = line;
      return updated;
    });
  }, [setLines]);

  const handleConvertReadings = useCallback((format) => {
    setLines((prev) =>
      prev.map((line) => {
        if (!line.words?.some((w) => w.reading)) return line;
        const newWords = line.words.map((w) => {
          if (!w.reading) return w;
          const converted = format === 'katakana' ? toKatakana(w.reading) : toHiragana(w.reading);
          return converted === w.reading ? w : { ...w, reading: converted };
        });
        return { ...line, words: newWords };
      })
    );
  }, [setLines]);

  const handleDeleteLine = (index) => {
    requestConfirm(t('confirm.deleteLine') || 'Delete this line?', () => {
      setLines((prev) => {
        const newLines = prev.filter((_, i) => i !== index);
        setActiveLineIndex((prevIdx) => {
          if (prevIdx > index) return prevIdx - 1;
          if (prevIdx === index) return Math.max(0, Math.min(prevIdx, newLines.length - 1));
          return prevIdx;
        });
        return newLines;
      });
      setEditingLineIndex(null);
    });
  };

  const handleAddLine = useCallback(
    (index) => {
      setLines((prev) => {
        const updated = [...prev];
        updated.splice(index + 1, 0, {
          text: '',
          timestamp: prev[index].timestamp,
          id: crypto.randomUUID(),
        });
        return updated;
      });
    },
    [setLines],
  );

  // ——— Drag-to-reorder ———

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === dropIndex) return;
    setLines((prev) => {
      // Extract timestamps in their current order to preserve them at these indices
      const timestamps = prev.map(l => ({
        timestamp: l.timestamp,
        endTime: l.endTime
      }));

      // Reorder the line objects themselves
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);

      // Re-apply the original timestamps to the new line order
      return updated.map((line, i) => ({
        ...line,
        timestamp: timestamps[i].timestamp,
        endTime: timestamps[i].endTime
      }));
    });
    if (activeLineIndex === dragIndex) {
      setActiveLineIndex(dropIndex);
    } else if (dragIndex < activeLineIndex && dropIndex >= activeLineIndex) {
      setActiveLineIndex(activeLineIndex - 1);
    } else if (dragIndex > activeLineIndex && dropIndex <= activeLineIndex) {
      setActiveLineIndex(activeLineIndex + 1);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ——— Global offset ———

  const handleApplyOffset = useCallback((direction) => {
    const amount = settings.editor?.shiftAllAmount ?? 0.5;
    const delta = direction * amount;
    setLines((prev) => applyGlobalOffset(prev, delta));
  }, [settings.editor?.shiftAllAmount, setLines]);

  // ——— Selection ———

  const handleLineClick = (i, e) => {
    const rangeKey = settings.shortcuts?.rangeSelect?.[0] || 'Shift';
    const toggleKey = settings.shortcuts?.toggleSelect?.[0] || 'Ctrl';
    const modActive = (mod) => {
      if (mod === 'Shift') return e.shiftKey;
      if (mod === 'Ctrl') return e.ctrlKey || e.metaKey;
      if (mod === 'Alt') return e.altKey;
      return false;
    };
    const isRange = modActive(rangeKey);
    const isToggle = modActive(toggleKey);

    // Modifier keys: handle selection without touching lock
    if (isRange || isToggle) {
      setActiveLineIndex(i);
      if (isRange && lastClickedRef.current != null) {
        const start = Math.min(lastClickedRef.current, i);
        const end = Math.max(lastClickedRef.current, i);
        setSelectedLines((prev) => {
          const next = new Set(prev);
          for (let idx = start; idx <= end; idx++) next.add(idx);
          return next;
        });
      } else if (isToggle) {
        setSelectedLines((prev) => {
          const next = new Set(prev);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          return next;
        });
      }
      lastClickedRef.current = i;
      return;
    }

    // Plain click: toggle lock
    if (isActiveLineLocked && activeLineIndex === i) {
      // Clicking the locked active line unlocks
      setIsActiveLineLocked(false);
    } else {
      // Lock onto the clicked line
      setActiveLineIndex(i);
      setIsActiveLineLocked(true);
      setHoveredLineIndex(null);
    }
    lastClickedRef.current = i;
  };

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const handleToggleLine = useCallback((i) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const handleBulkClearTimestamps = useCallback(() => {
    requestConfirm(t('confirm.bulkClear') || 'Clear timestamps for selected lines?', () => {
      setLines((prev) =>
        prev.map((l, idx) =>
          selectedLines.has(idx)
            ? { ...l, timestamp: null, ...(editorMode === 'srt' && { endTime: null }) }
            : l,
        ),
      );
      clearSelection();
    });
  }, [selectedLines, editorMode, setLines, clearSelection, requestConfirm, t]);

  const handleBulkDelete = useCallback(() => {
    requestConfirm(t('confirm.bulkDelete') || 'Delete selected lines?', () => {
      setLines((prev) => prev.filter((_, idx) => !selectedLines.has(idx)));
      setActiveLineIndex((prev) => {
        let offset = 0;
        for (const idx of selectedLines) {
          if (idx < prev) offset++;
        }
        return Math.max(0, prev - offset);
      });
      clearSelection();
    });
  }, [selectedLines, t, setLines, setActiveLineIndex, clearSelection, requestConfirm]);

  const handleBulkShift = (delta) => {
    setLines((prev) => applyBulkShift(prev, selectedLines, delta));
  };

  const handleClearWordTimestamp = useCallback((lineIndex, wordIndex, field = 'words') => {
    setLines((prev) => {
      const updated = [...prev];
      const line = updated[lineIndex];
      if (!line?.[field]) return prev;
      const newWords = [...line[field]];
      newWords[wordIndex] = { ...newWords[wordIndex], time: null };
      updated[lineIndex] = { ...line, [field]: newWords };
      return updated;
    });
    // activeWordIndex is synced by the lines effect above
  }, [setLines]);

  const handleSetActiveWordIndex = useCallback((wordIndex) => {
    setActiveWordIndex(wordIndex);
    activeWordIndexRef.current = wordIndex;
  }, []);

  const handleStampTargetToggle = useCallback(() => {
    const line = linesRef.current[activeLineIndexRef.current];
    if (!line) return;
    const newTarget = stampTargetRef.current === 'main' ? 'secondary' : 'main';
    if (newTarget === 'secondary' && line.secondary) {
      if (!line.secondaryWords?.length) {
        const tokens = line.secondary.trim().split(/\s+/).filter(Boolean);
        if (tokens.length) {
          const secondaryWords = tokens.map((word) => ({ word, time: null }));
          // Eagerly update linesRef so the next keypress sees secondaryWords immediately
          linesRef.current = linesRef.current.map((l, idx) =>
            idx !== activeLineIndexRef.current ? l : { ...l, secondaryWords },
          );
          setLines((prev) => prev.map((l, idx) =>
            idx !== activeLineIndexRef.current ? l : { ...l, secondaryWords },
          ));
        }
      }
    }
    // Reset word cursor to 0 for the new layer
    setActiveWordIndex(0);
    activeWordIndexRef.current = 0;
    setStampTarget(newTarget);
    stampTargetRef.current = newTarget;
  }, [setLines]);

  // ——— Global keybinds ———
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (matchKey(e, settings.shortcuts?.deselect?.[0] || 'Escape') && selectedLines.size > 0) {
        clearSelection();
        return;
      }

      if (matchKey(e, settings.shortcuts?.deleteLine?.[0] || 'Delete')) {
        e.preventDefault();
        if (selectedLines.size > 0) {
          handleBulkDelete();
        } else {
          setLines((prev) => {
            const newLines = prev.filter((_, i) => i !== activeLineIndex);
            setActiveLineIndex((prevIndex) =>
              Math.max(0, Math.min(prevIndex, newLines.length - 1)),
            );
            return newLines;
          });
          clearSelection();
        }
      } else if (matchKey(e, settings.shortcuts?.addLine?.[0] || 'Insert')) {
        e.preventDefault();
        handleAddLine(activeLineIndex);
      } else if (matchKey(e, settings.shortcuts?.clearTimestamp?.[0] || 'Backspace')) {
        e.preventDefault();
        if (selectedLines.size > 0) {
          handleBulkClearTimestamps();
        } else {
          handleClearLine(activeLineIndex);
        }
      } else if (matchKey(e, settings.shortcuts?.switchMode?.[0] || 'Tab')) {
        e.preventDefault();
        const nextMode = editorMode === 'lrc' ? 'srt' : 'lrc';
        setEditorMode(nextMode);
        updateSetting('export.copyFormat', nextMode);
        updateSetting('export.downloadFormat', nextMode);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    selectedLines,
    handleBulkDelete,
    clearSelection,
    settings.shortcuts?.deleteLine,
    settings.shortcuts?.addLine,
    settings.shortcuts?.clearTimestamp,
    settings.shortcuts?.switchMode,
    settings.shortcuts?.deselect,
    activeLineIndex,
    lines.length,
    handleAddLine,
    handleBulkClearTimestamps,
    handleClearLine,
    editorMode,
    setEditorMode,
    updateSetting,
    setLines,
    setActiveLineIndex,
  ]);

  // Duplicate/overlapping timestamp detection
  const overlappingLines = useMemo(
    () => detectDuplicateTimestamps(lines, settings.editor?.overlapThreshold ?? 0.05),
    [lines, settings.editor?.overlapThreshold],
  );

  return {
    // state
    rawText,
    setRawText,
    editingLineIndex,
    setEditingLineIndex,
    editingText,
    setEditingText,
    editingSecondary,
    setEditingSecondary,
    editingTranslation,
    setEditingTranslation,
    dragIndex,
    dragOverIndex,
    selectedLines,
    setSelectedLines,
    awaitingEndMark,
    focusedTimestamp,
    setFocusedTimestamp,
    displayedActiveIndex,
    isActiveLineLocked,
    handleLineHover,
    handleLineHoverEnd,
    // refs
    listRef,
    fileInputRef,
    // handlers
    handleConfirmLyrics,
    handleFileUpload,
    handleUrlImport,
    shiftTime,
    handleMark,
    handleClearLine,
    handleClearTimestamps,
    handleClearAllWordTimestamps,
    handleClearActiveLineWordTimestamps,
    handleSaveLineText,
    handleDeleteLine,
    handleAddLine,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    handleApplyOffset,
    handleLineClick,
    clearSelection,
    handleToggleLine,
    handleBulkClearTimestamps,
    handleBulkDelete,
    handleBulkShift,
    handleClearWordTimestamp,
    handleSetActiveWordIndex,
    handleSetTimestamp,
    handleSetWordReading,
    handleConvertReadings,
    stampTarget,
    handleStampTargetToggle,
    activeWordIndex,
    overlappingLines,
    // extras
    requestConfirm,
    confirmModal,
    settings,
    t,
    updateSetting,
  };
}
