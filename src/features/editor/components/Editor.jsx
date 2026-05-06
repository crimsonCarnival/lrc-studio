import { useMemo, useCallback, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEditor } from '@features/editor/hooks/useEditor';
import EditorToolbar from './EditorToolbar';
import EditorPasteArea from './EditorPasteArea';
import EditorLineItem from './EditorLineItem';
import SelectionActionBar from './SelectionActionBar';
import EditorSyncControls from './EditorSyncControls';
import ActionDrawer, { DrawerItem } from '@/shared/ActionDrawer';
import { Play, X, Pencil, Trash2 } from 'lucide-react';
import { formatTime } from '@/utils/formatTime';
import { hasCJK } from '@/utils/furigana';

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
  isSaving,
  compact,
  onNewProject,
  onShowKeyboardHelp,
  registerAfterSave,
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
    stampTarget,
    handleStampTargetToggle,
    overlappingLines,
    modifiedLines,
    clearModifiedLines,
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

  // Register teardown / post-save hooks
  useEffect(() => {
    if (registerAfterSave) {
      registerAfterSave(clearModifiedLines);
    }
    return () => {
      if (registerAfterSave) registerAfterSave(null);
    };
  }, [registerAfterSave, clearModifiedLines]);

  const [activeDrawer, setActiveDrawer] = useState(null); // null | 'word' | 'bulk' | 'line'
  const [activeWordMenuData, setActiveWordMenuData] = useState({ lineIndex: null, wordIndex: null, word: null, isSecondary: false });
  const [activeLineMenuData, setActiveLineMenuData] = useState({ lineIndex: null, line: null });

  const handleWordMenuOpen = useCallback((lineIndex, wordIndex, word, isSecondary) => {
    setActiveWordMenuData({ lineIndex, wordIndex, word, isSecondary });
    setActiveDrawer('word');
  }, []);

  const handleLineMenuOpen = useCallback((lineIndex, line) => {
    setActiveLineMenuData({ lineIndex, line });
    setActiveDrawer('line');
  }, []);

  const handleBulkMenuOpen = useCallback(() => {
    setActiveDrawer('bulk');
  }, []);


  return (
    <div
      onMouseLeave={handleLineHoverEnd}
      className={`lg:glass lg:rounded-2xl rounded-none p-3 sm:p-5 flex ${compact ? 'flex-row gap-2' : 'flex-col'} flex-1 animate-fade-in min-h-0`}
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
        isSaving={isSaving}
        compact={compact}
        overlappingLines={overlappingLines}
        onNewProject={onNewProject}
        onShowKeyboardHelp={onShowKeyboardHelp}
      />

      {/* Visual separator between toolbar and lyrics list */}
      {syncMode && lines.length > 0 && (
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/80 to-transparent mb-3 -mx-1 flex-shrink-0" />
      )}

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
        <div className="relative flex flex-col flex-1 min-h-0">
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
          onWordMenu={handleWordMenuOpen}
          onLineMenu={handleLineMenuOpen}
          onBulkMenu={handleBulkMenuOpen}
          modifiedLines={modifiedLines}
        />
        </div>
      )}
      </div>

      {/* Action Drawer for Mobile Actions */}
      <ActionDrawer
        isOpen={activeDrawer !== null}
        onClose={() => setActiveDrawer(null)}
        title={activeDrawer === 'word' 
          ? (activeWordMenuData.word?.word ? `Word: ${activeWordMenuData.word.word}` : 'Word Actions')
          : activeDrawer === 'line'
            ? `Line ${activeLineMenuData.lineIndex + 1}`
            : `Selection: ${selectedLines.size} lines`
        }
      >
        {activeDrawer === 'word' && (
          <>
            <DrawerItem
              icon={Play}
              label={activeWordMenuData.word?.time != null ? `Jump to ${formatTime(activeWordMenuData.word.time)}` : 'Jump to Word'}
              onClick={() => {
                if (activeWordMenuData.word?.time != null && playerRef?.current?.seek) {
                  playerRef.current.seek(activeWordMenuData.word.time);
                  if (playerRef.current.play) playerRef.current.play();
                }
                setActiveDrawer(null);
              }}
            />
            
            {activeWordMenuData.word?.time != null && (
              <DrawerItem
                icon={X}
                label="Clear Timestamp"
                variant="danger"
                onClick={() => {
                  handleClearWordTimestamp(activeWordMenuData.lineIndex, activeWordMenuData.wordIndex, activeWordMenuData.isSecondary ? 'secondaryWords' : 'words');
                  setActiveDrawer(null);
                }}
              />
            )}

            {hasCJK(activeWordMenuData.word?.word || '') && (
              <DrawerItem
                icon={Pencil}
                label={activeWordMenuData.word?.reading ? "Edit Reading" : "Add Reading"}
                onClick={() => {
                  setActiveDrawer(null);
                  const currentReading = activeWordMenuData.word?.reading || '';
                  const newReading = window.prompt("Enter reading (furigana):", currentReading);
                  if (newReading !== null) {
                    handleSetWordReading(activeWordMenuData.lineIndex, activeWordMenuData.wordIndex, newReading);
                  }
                }}
              />
            )}
          </>
        )}

        {activeDrawer === 'line' && (
          <>
            <DrawerItem
              icon={Play}
              label={activeLineMenuData.line?.timestamp != null ? `Jump to ${formatTime(activeLineMenuData.line.timestamp)}` : 'Jump to Line'}
              onClick={() => {
                if (activeLineMenuData.line?.timestamp != null && playerRef?.current?.seek) {
                  playerRef.current.seek(activeLineMenuData.line.timestamp);
                  if (playerRef.current.play) playerRef.current.play();
                }
                setActiveDrawer(null);
              }}
            />
            {activeLineMenuData.line?.timestamp != null && (
              <DrawerItem
                icon={X}
                label="Clear Timestamp"
                variant="danger"
                onClick={() => {
                  handleClearLine(activeLineMenuData.lineIndex);
                  setActiveDrawer(null);
                }}
              />
            )}
            <DrawerItem
              icon={Trash2}
              label="Remove Line"
              variant="danger"
              onClick={() => {
                handleDeleteLine(activeLineMenuData.lineIndex);
                setActiveDrawer(null);
              }}
            />
          </>
        )}

        {activeDrawer === 'bulk' && (
          <>
            <DrawerItem
              icon={X}
              label="Clear Timestamps"
              variant="danger"
              onClick={() => {
                handleBulkClearTimestamps();
                setActiveDrawer(null);
              }}
            />
            <DrawerItem
              icon={Trash2}
              label="Delete Selected"
              variant="danger"
              onClick={() => {
                handleBulkDelete();
                setActiveDrawer(null);
              }}
            />
            <DrawerItem
              icon={X}
              label="Deselect All"
              onClick={() => {
                clearSelection();
                setActiveDrawer(null);
              }}
            />
          </>
        )}
      </ActionDrawer>

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
  onWordMenu,
  onLineMenu,
  onBulkMenu,
  modifiedLines,
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

  // Handle visualViewport resize (keyboard opening)
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      if (editingLineIndex !== null) {
        // Scroll the editing line into view when the keyboard opens/resizes
        setTimeout(() => {
          if (editingLineIndex !== null) {
            virtualizer.scrollToIndex(editingLineIndex, { align: 'center', behavior: 'smooth' });
          }
        }, 150);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    return () => {
      window.visualViewport.removeEventListener('resize', handleViewportChange);
      window.visualViewport.removeEventListener('scroll', handleViewportChange);
    };
  }, [editingLineIndex, virtualizer]);

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
                  onWordMenu={onWordMenu}
                  onLineMenu={onLineMenu}
                  isModified={modifiedLines?.has(i)}
                />
              </div>
            );
          })}
        </div>
      </div>

        <div className="hidden xl:block">
          <SelectionActionBar
            selectedLines={selectedLines}
            settings={settings}
            handleBulkClearTimestamps={handleBulkClearTimestamps}
            handleBulkShift={handleBulkShift}
            handleBulkDelete={handleBulkDelete}
            clearSelection={clearSelection}
            handleApplyOffset={handleApplyOffset}
          />
        </div>

      <EditorSyncControls
        settings={settings}
        updateSetting={updateSetting}
        handleApplyOffset={handleApplyOffset}
        selectedLines={selectedLines}
        editorMode={editorMode}
        awaitingEndMark={awaitingEndMark}
        onBulkMenu={onBulkMenu}
      />
    </div>
  );
}
