import { useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEditor } from './useEditor';
import EditorToolbar from './parts/EditorToolbar';
import EditorPasteArea from './parts/EditorPasteArea';
import EditorLineItem from './parts/EditorLineItem';
import SelectionActionBar from './parts/SelectionActionBar';
import EditorSyncControls from './parts/EditorSyncControls';

export default function Editor({
  lines,
  setLines,
  syncMode,
  setSyncMode,
  activeLineIndex,
  setActiveLineIndex,
  playbackPosition,
  playerRef,
  undo,
  redo,
  canUndo,
  canRedo,
  editorMode,
  setEditorMode,
  onImport,
  handleManualSave,
  handleRemoveAllLyrics,
  isAutosaving,
  compact,
}) {
  "use no memo";
  const {
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
    listRef,
    fileInputRef,
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
    handleAddExtraTimestamp,
    handleRemoveExtraTimestamp,
    requestConfirm,
    confirmModal,
    settings,
    updateSetting,
    activeWordIndex,
    handleClearWordTimestamp,
    handleSetActiveWordIndex,
    handleSetTimestamp,
    handleSetWordReading,
    handleConvertReadings,
    stampTarget,
    handleStampTargetToggle,
    overlappingLines,
  } = useEditor({
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
  });

  return (
    <div
      onMouseLeave={handleLineHoverEnd}
      className={`glass rounded-xl sm:rounded-2xl p-3 sm:p-5 flex ${compact ? 'flex-row gap-2' : 'flex-col'} h-full animate-fade-in`}
    >
      <EditorToolbar
        editorMode={editorMode}
        setEditorMode={setEditorMode}
        updateSetting={updateSetting}
        settings={settings}
        isActiveLineLocked={isActiveLineLocked}
        syncMode={syncMode}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        lines={lines}
        setSelectedLines={setSelectedLines}
        selectedLines={selectedLines}
        handleClearTimestamps={handleClearTimestamps}
        handleClearAllWordTimestamps={handleClearAllWordTimestamps}
        handleClearActiveLineWordTimestamps={handleClearActiveLineWordTimestamps}
        requestConfirm={requestConfirm}
        setLines={setLines}
        setRawText={setRawText}
        setSyncMode={setSyncMode}
        handleManualSave={handleManualSave}
        handleRemoveAllLyrics={handleRemoveAllLyrics}
        isAutosaving={isAutosaving}
        compact={compact}
        overlappingLines={overlappingLines}
        onConvertReadings={handleConvertReadings}
      />

      <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Edit Mode */}
      {!syncMode && (
        <EditorPasteArea
          rawText={rawText}
          setRawText={setRawText}
          handleConfirmLyrics={handleConfirmLyrics}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          handleUrlImport={handleUrlImport}
          onCancel={lines.length > 0 ? () => setSyncMode(true) : null}
        />
      )}

      {/* Sync Mode */}
      {syncMode && (
        <VirtualizedLineList
          lines={lines}
          displayedActiveIndex={displayedActiveIndex}
          activeLineIndex={activeLineIndex}
          isActiveLineLocked={isActiveLineLocked}
          editorMode={editorMode}
          awaitingEndMark={awaitingEndMark}
          focusedTimestamp={focusedTimestamp}
          setFocusedTimestamp={setFocusedTimestamp}
          handleLineClick={handleLineClick}
          handleLineHover={handleLineHover}
          handleLineHoverEnd={handleLineHoverEnd}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragEnd={handleDragEnd}
          handleDrop={handleDrop}
          dragOverIndex={dragOverIndex}
          dragIndex={dragIndex}
          selectedLines={selectedLines}
          settings={settings}
          editingLineIndex={editingLineIndex}
          setEditingLineIndex={setEditingLineIndex}
          editingText={editingText}
          setEditingText={setEditingText}
          editingSecondary={editingSecondary}
          setEditingSecondary={setEditingSecondary}
          editingTranslation={editingTranslation}
          setEditingTranslation={setEditingTranslation}
          handleSaveLineText={handleSaveLineText}
          playerRef={playerRef}
          shiftTime={shiftTime}
          handleAddLine={handleAddLine}
          handleClearLine={handleClearLine}
          handleDeleteLine={handleDeleteLine}
          listRef={listRef}
          handleApplyOffset={handleApplyOffset}
          handleMark={handleMark}
          handleBulkClearTimestamps={handleBulkClearTimestamps}
          handleBulkShift={handleBulkShift}
          handleBulkDelete={handleBulkDelete}
          clearSelection={clearSelection}
          handleToggleLine={handleToggleLine}
          handleAddExtraTimestamp={handleAddExtraTimestamp}
          handleRemoveExtraTimestamp={handleRemoveExtraTimestamp}
          updateSetting={updateSetting}
          activeWordIndex={activeWordIndex}
          handleClearWordTimestamp={handleClearWordTimestamp}
          handleSetActiveWordIndex={handleSetActiveWordIndex}
          handleSetTimestamp={handleSetTimestamp}
          handleSetWordReading={handleSetWordReading}
          stampTarget={stampTarget}
          handleStampTargetToggle={handleStampTargetToggle}
          playbackPosition={playbackPosition}
          overlappingLines={overlappingLines}
        />
      )}
      </div>

      {confirmModal}
    </div>
  );
}

const ESTIMATED_LINE_HEIGHT = 44;
const LINE_GAP = 4;

function VirtualizedLineList({
  lines,
  displayedActiveIndex,
  activeLineIndex,
  isActiveLineLocked,
  editorMode,
  awaitingEndMark,
  focusedTimestamp,
  setFocusedTimestamp,
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
  listRef,
  handleMark,
  handleApplyOffset,
  handleBulkClearTimestamps,
  handleBulkShift,
  handleBulkDelete,
  clearSelection,
  handleToggleLine,
  handleAddExtraTimestamp,
  handleRemoveExtraTimestamp,
  updateSetting,
  activeWordIndex,
  handleClearWordTimestamp,
  handleSetActiveWordIndex,
  handleSetTimestamp,
  handleSetWordReading,
  stampTarget,
  handleStampTargetToggle,
  playbackPosition,
  overlappingLines,
}) {
  const scrollAlignment = settings.editor?.scroll?.alignment || 'center';
  const scrollMode = settings.editor?.scroll?.mode || 'smooth';

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ESTIMATED_LINE_HEIGHT,
    gap: LINE_GAP,
    overscan: 8,
  });

  // Auto-scroll to active line via virtualizer
  const prevActiveRef = useCallback((idx) => {
    if (scrollAlignment === 'none') return;
    virtualizer.scrollToIndex(idx, {
      align: scrollAlignment === 'start' ? 'start' : scrollAlignment === 'end' ? 'end' : 'center',
      behavior: scrollMode,
    });
  }, [virtualizer, scrollAlignment, scrollMode]);

  // Scroll when active line changes (not on hover)
  const lastScrolledIndex = useMemo(() => ({ current: -1 }), []);
  if (activeLineIndex !== lastScrolledIndex.current && activeLineIndex >= 0) {
    lastScrolledIndex.current = activeLineIndex;
    // Use queueMicrotask so the virtualizer has measured before scrolling
    queueMicrotask(() => prevActiveRef(activeLineIndex));
  }

  // Pre-compute nextTimestamp for each line
  const nextTimestamps = useMemo(() => {
    const result = new Array(lines.length).fill(null);
    let lastTs = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      result[i] = lastTs;
      if (lines[i].timestamp != null) lastTs = lines[i].timestamp;
    }
    return result;
  }, [lines]);

  return (
    <div className="flex flex-col flex-1 gap-3 animate-fade-in min-h-0">
      <div
        ref={listRef}
        onMouseLeave={handleLineHoverEnd}
        className="flex-1 overflow-y-auto pr-1 min-h-0 mask-edges"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const i = virtualRow.index;
            const line = lines[i];
            const isActive = i === displayedActiveIndex;
            const isSynced = line.timestamp != null;
            // Upcoming depth: 1-3 for the next unsynced lines after active
            const upcomingDepth = !isSynced && i > displayedActiveIndex && i <= displayedActiveIndex + 3
              ? i - displayedActiveIndex
              : 0;

            return (
              <div
                key={line.id || i}
                data-index={i}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EditorLineItem
                  line={{ ...line, nextTimestamp: nextTimestamps[i] }}
                  i={i}
                  displayedActiveIndex={displayedActiveIndex}
                  isActive={isActive}
                  isLocked={isActiveLineLocked && i === activeLineIndex}
                  isSynced={isSynced}
                  editorMode={editorMode}
                  awaitingEndMark={awaitingEndMark}
                  focusedTimestamp={focusedTimestamp}
                  setFocusedTimestamp={setFocusedTimestamp}
                  activeLineRef={null}
                  handleLineClick={handleLineClick}
                  handleLineHover={handleLineHover}
                  handleLineHoverEnd={handleLineHoverEnd}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDragEnd={handleDragEnd}
                  handleDrop={handleDrop}
                  dragOverIndex={dragOverIndex}
                  dragIndex={dragIndex}
                  selectedLines={selectedLines}
                  settings={settings}
                  editingLineIndex={editingLineIndex}
                  setEditingLineIndex={setEditingLineIndex}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  editingSecondary={editingSecondary}
                  setEditingSecondary={setEditingSecondary}
                  editingTranslation={editingTranslation}
                  setEditingTranslation={setEditingTranslation}
                  handleSaveLineText={handleSaveLineText}
                  playerRef={playerRef}
                  shiftTime={shiftTime}
                  handleAddLine={handleAddLine}
                  handleClearLine={handleClearLine}
                  handleDeleteLine={handleDeleteLine}
                  handleToggleLine={handleToggleLine}
                  handleAddExtraTimestamp={handleAddExtraTimestamp}
                  handleRemoveExtraTimestamp={handleRemoveExtraTimestamp}
                  handleMark={handleMark}
                  isLastLine={i === lines.length - 1}
                  activeWordIndex={i === activeLineIndex ? activeWordIndex : -1}
                  handleClearWordTimestamp={handleClearWordTimestamp}
                  handleSetActiveWordIndex={handleSetActiveWordIndex}
                  handleSetTimestamp={handleSetTimestamp}
                  handleSetWordReading={handleSetWordReading}
                  stampTarget={i === activeLineIndex ? stampTarget : 'main'}
                  handleStampTargetToggle={handleStampTargetToggle}
                  playbackPosition={isActive ? playbackPosition : null}
                  isOverlapping={overlappingLines.has(i)}
                  upcomingDepth={upcomingDepth}
                />
              </div>
            );
          })}
        </div>
      </div>

      <SelectionActionBar
        selectedLines={selectedLines}
        settings={settings}
        handleBulkClearTimestamps={handleBulkClearTimestamps}
        handleBulkShift={handleBulkShift}
        handleBulkDelete={handleBulkDelete}
        clearSelection={clearSelection}
        handleApplyOffset={handleApplyOffset}
      />

      <EditorSyncControls
        settings={settings}
        updateSetting={updateSetting}
        handleApplyOffset={handleApplyOffset}
        selectedLines={selectedLines}
        editorMode={editorMode}
        awaitingEndMark={awaitingEndMark}
      />
    </div>
  );
}
