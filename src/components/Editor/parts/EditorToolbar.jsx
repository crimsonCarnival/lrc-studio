import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serializeToRubyMarkup } from '../../../utils/furigana';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
  PopoverSeparator,
} from '@/components/ui/popover';
import { Tip } from '@/components/ui/tip';
import { Undo2, Redo2, ListChecks, TimerOff, Trash2, MousePointerClick, FileText, Repeat, Pencil, Save, Check, Eraser, SquareX, MoreHorizontal, X } from 'lucide-react';

function ActionsDropdown({ children, t }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip content={t('editor.actions')}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            {open ? <X className="w-3.5 h-3.5" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
          </Button>
        </PopoverTrigger>
      </Tip>
      {children}
    </Popover>
  );
}

export default function EditorToolbar({
  editorMode,
  setEditorMode,
  updateSetting,
  settings,
  isActiveLineLocked,
  syncMode,
  undo,
  redo,
  canUndo,
  canRedo,
  lines,
  setSelectedLines,
  selectedLines,
  handleClearTimestamps,
  handleClearAllWordTimestamps,
  handleClearActiveLineWordTimestamps,
  requestConfirm,
  setLines,
  setRawText,
  setSyncMode,
  handleManualSave,
  handleRemoveAllLyrics,
  isAutosaving,
  compact,
  overlappingLines,
  onConvertReadings,
}) {
  const { t } = useTranslation();
  const hasAnyTimestamp = lines.some((l) => l.timestamp != null);

  const syncProgress = useMemo(() => {
    if (!lines.length) return null;
    const synced = lines.filter(l => l.timestamp != null).length;
    return { synced, total: lines.length };
  }, [lines]);

  // Compact vertical sidebar mode
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 py-1 border-r border-zinc-700/60 pr-2 flex-shrink-0">
        {/* Mode toggle */}
        {lines.length > 0 && (
          <ToggleGroup
            type="single"
            value={editorMode}
            onValueChange={(val) => {
              if (!val) return;
              setEditorMode(val);
              const exportFmt = val === 'words' ? 'lrc' : val;
              updateSetting('export.copyFormat', exportFmt);
              updateSetting('export.downloadFormat', exportFmt);
            }}
            orientation="vertical"
            className="flex flex-col bg-zinc-800/80 rounded-lg border border-zinc-700/60 overflow-hidden p-0 gap-0"
          >
            <Tip content={t('editor.modeLRCDesc')}>
            <ToggleGroupItem
              value="lrc"
              className="px-1.5 py-1 text-[9px] font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto leading-none"
            >
              LRC
            </ToggleGroupItem>
            </Tip>
            <Tip content={t('editor.modeSRTDesc')}>
            <ToggleGroupItem
              value="srt"
              className="px-1.5 py-1 text-[9px] font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto leading-none"
            >
              SRT
            </ToggleGroupItem>
            </Tip>
            <Tip content={!hasAnyTimestamp ? t('editor.wordsNeedsTimestamps') : t('editor.modeWordsDesc')}>
            <ToggleGroupItem
              value="words"
              disabled={!hasAnyTimestamp}
              className="px-1.5 py-1 text-[9px] font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto leading-none disabled:opacity-40"
            >
              W
            </ToggleGroupItem>
            </Tip>
          </ToggleGroup>
        )}

        {syncMode && (
          <>
            <div className="w-4 h-px bg-zinc-700/80" />
            {/* Back to edit */}
            <Tip content={t('editor.backToEdit')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setRawText(lines.map(l => serializeToRubyMarkup(l.words) || l.text).join('\n'));
                setSyncMode(false);
              }}
              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            </Tip>
            {/* Loop */}
            <Tip content={t('editor.loopCurrentLine')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => isActiveLineLocked && updateSetting('playback.loopCurrentLine', !settings?.playback?.loopCurrentLine)}
              disabled={!isActiveLineLocked}
              className={`${
                !isActiveLineLocked
                  ? 'text-zinc-600 opacity-40 cursor-not-allowed'
                  : settings?.playback?.loopCurrentLine
                    ? 'text-primary bg-primary/10 hover:bg-primary/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </Button>
            </Tip>
            <div className="w-4 h-px bg-zinc-700/80" />
            {/* Select all */}
            <Tip content={selectedLines?.size === lines.length ? t('editor.selection.deselectAll') : t('editor.selection.selectAll')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (selectedLines?.size === lines.length) {
                  setSelectedLines(new Set());
                } else {
                  setSelectedLines(new Set(lines.map((_, i) => i)));
                }
              }}
              className={`${
                selectedLines?.size > 0
                  ? 'text-primary hover:text-zinc-300 hover:bg-zinc-800'
                  : 'text-zinc-400 hover:text-primary hover:bg-primary/20'
              }`}
            >
              {selectedLines?.size > 0
                ? <ListChecks className="w-3.5 h-3.5" />
                : <MousePointerClick className="w-3.5 h-3.5" />
              }
            </Button>
            </Tip>
            {/* Clear timestamps */}
            <Tip content={t('editor.selection.clearTimestamps')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearTimestamps}
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
            >
              <TimerOff className="w-3.5 h-3.5" />
            </Button>
            </Tip>
            <div className="w-4 h-px bg-zinc-700/80" />
            {/* Actions dropdown */}
            <ActionsDropdown t={t}>
              <PopoverContent className="w-44" side="right" align="start">
                <PopoverItem
                  onClick={undo}
                  disabled={!canUndo}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {t('editor.undo')} <span className="ml-auto text-[10px] text-zinc-500">Ctrl+Z</span>
                </PopoverItem>
                <PopoverItem
                  onClick={redo}
                  disabled={!canRedo}
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  {t('editor.redo')} <span className="ml-auto text-[10px] text-zinc-500">Ctrl+Y</span>
                </PopoverItem>
                {editorMode === 'words' && (
                  <>
                    <PopoverSeparator />
                    <PopoverItem
                      onClick={() => {
                        const current = settings.editor?.display?.readingFormat || 'hiragana';
                        const next = current === 'hiragana' ? 'katakana' : 'hiragana';
                        updateSetting('editor.display.readingFormat', next);
                        onConvertReadings?.(next);
                      }}
                      className="text-zinc-400"
                    >
                      <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {(settings.editor?.display?.readingFormat || 'hiragana') === 'hiragana' ? 'ア' : 'あ'}
                      </span>
                      {t(`editor.readingFormat.${(settings.editor?.display?.readingFormat || 'hiragana') === 'hiragana' ? 'katakana' : 'hiragana'}`)}
                    </PopoverItem>
                    <PopoverSeparator />
                    <PopoverItem
                      onClick={handleClearAllWordTimestamps}
                      className="text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      {t('editor.clearWordTimestamps')}
                    </PopoverItem>
                    {isActiveLineLocked && (
                      <PopoverItem
                        onClick={handleClearActiveLineWordTimestamps}
                        className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
                      >
                        <SquareX className="w-3.5 h-3.5" />
                        {t('editor.clearActiveLineWordTimestamps')}
                      </PopoverItem>
                    )}
                  </>
                )}
                <PopoverSeparator />
                <PopoverItem
                  onClick={() => {
                    requestConfirm(t('confirm.removeAll'), handleRemoveAllLyrics);
                  }}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('editor.removeAll')}
                </PopoverItem>
              </PopoverContent>
            </ActionsDropdown>
          </>
        )}

        {/* Sync progress + save */}
        {syncMode && syncProgress && (
          <>
            <div className="flex-1" />
            <span className={`text-[9px] font-mono tabular-nums select-none writing-mode-vertical ${
              syncProgress.synced === syncProgress.total
                ? 'text-primary'
                : 'text-zinc-500'
            }`} style={{ writingMode: 'vertical-lr' }}>
              {syncProgress.synced}/{syncProgress.total}
            </span>
            {handleManualSave && !settings.advanced?.autoSave?.enabled && (
              <Tip content={isAutosaving ? (t('project.saved') || 'Saved') : (t('project.save') || 'Save')}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleManualSave}
                className={`flex-shrink-0 ${
                  isAutosaving
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {isAutosaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              </Button>
              </Tip>
            )}
          </>
        )}
      </div>
    );
  }

  // Normal horizontal toolbar
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {t('editor.title')}
        </h2>
        {syncMode && lines.length > 0 && (
          <Tip content={t('editor.backToEdit')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setRawText(lines.map(l => serializeToRubyMarkup(l.words) || l.text).join('\n'));
              setSyncMode(false);
            }}
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex-shrink-0"
          >
            <Pencil className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </Button>
          </Tip>
        )}
        {lines.length > 0 && (
          <ToggleGroup
            type="single"
            value={editorMode}
            onValueChange={(val) => {
              if (!val) return;
              setEditorMode(val);
              const exportFmt = val === 'words' ? 'lrc' : val;
              updateSetting('export.copyFormat', exportFmt);
              updateSetting('export.downloadFormat', exportFmt);
            }}
            className="bg-zinc-800/80 rounded-lg border border-zinc-700/60 overflow-hidden h-auto p-0 gap-0"
          >
            <Tip content={t('editor.modeLRCDesc')}>
            <ToggleGroupItem
              value="lrc"
              className="px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto"
            >
              {t('editor.modeLRC')}
            </ToggleGroupItem>
            </Tip>
            <Tip content={t('editor.modeSRTDesc')}>
            <ToggleGroupItem
              value="srt"
              className="px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto"
            >
              {t('editor.modeSRT')}
            </ToggleGroupItem>
            </Tip>
            <Tip content={!hasAnyTimestamp ? t('editor.wordsNeedsTimestamps') : t('editor.modeWordsDesc')}>
            <ToggleGroupItem
              value="words"
              disabled={!hasAnyTimestamp}
              className="px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-none border-0 data-[state=on]:bg-primary data-[state=on]:text-primary text-zinc-400 hover:text-zinc-200 hover:bg-transparent h-auto disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('editor.modeWords')}
            </ToggleGroupItem>
            </Tip>
          </ToggleGroup>
        )}
        {/* Sync progress badge + save */}
        {syncMode && syncProgress && (
          <Badge
            variant="outline"
            className={`text-[10px] font-mono tabular-nums border-zinc-700/60 select-none ${
              syncProgress.synced === syncProgress.total
                ? 'text-primary border-primary/40 bg-primary/10'
                : 'text-zinc-500'
            }`}
          >
            {t('editor.syncProgress', { synced: syncProgress.synced, total: syncProgress.total })}
          </Badge>
        )}
        {syncMode && handleManualSave && !settings.advanced?.autoSave?.enabled && (
          <Tip content={isAutosaving ? (t('project.saved') || 'Saved') : (t('project.save') || 'Save')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleManualSave}
            className={`flex-shrink-0 ${
              isAutosaving
                ? 'text-primary hover:bg-primary/10'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {isAutosaving ? <Check className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Save className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
          </Button>
          </Tip>
        )}
        {/* Overlap warning */}
        {syncMode && overlappingLines?.size > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono tabular-nums border-orange-500/40 bg-orange-500/10 text-orange-400 select-none animate-pulse"
          >
            {t('editor.overlappingTimestamps', { count: overlappingLines.size }) || `${overlappingLines.size} overlapping`}
          </Badge>
        )}
      </div>
      {syncMode && (
        <div className="flex items-center justify-end gap-1.5 w-full">
          <Tip content={t('editor.loopCurrentLine')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => isActiveLineLocked && updateSetting('playback.loopCurrentLine', !settings?.playback?.loopCurrentLine)}
            disabled={!isActiveLineLocked}
            className={`flex-shrink-0 transition-colors ${
              !isActiveLineLocked
                ? 'text-zinc-600 opacity-40 cursor-not-allowed'
                : settings?.playback?.loopCurrentLine
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Repeat className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </Button>
          </Tip>
          <div className="w-px h-4 bg-zinc-700/80" />
          {selectedLines?.size > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-primary/80 select-none whitespace-nowrap">
              {selectedLines.size}/{lines.length}
            </span>
          )}
          <Tip content={selectedLines?.size === lines.length ? t('editor.selection.deselectAll') : t('editor.selection.selectAll')}>
          <Button
            id="select-all-btn"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (selectedLines?.size === lines.length) {
                setSelectedLines(new Set());
              } else {
                setSelectedLines(new Set(lines.map((_, i) => i)));
              }
            }}
            className={`flex-shrink-0 ${
              selectedLines?.size > 0
                ? 'text-primary hover:text-zinc-300 hover:bg-zinc-800'
                : 'text-zinc-400 hover:text-primary hover:bg-primary/20'
            }`}
          >
            {selectedLines?.size > 0
              ? <ListChecks className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
              : <MousePointerClick className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            }
          </Button>
          </Tip>
          <Tip content={t('editor.selection.clearTimestamps')}>
          <Button
            id="clear-timestamps-btn"
            variant="ghost"
            size="icon-sm"
            onClick={handleClearTimestamps}
            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 flex-shrink-0"
          >
            <TimerOff className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </Button>
          </Tip>
          {editorMode === 'words' && (
            <Tip content={t('editor.clearWordTimestamps')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearAllWordTimestamps}
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 flex-shrink-0"
            >
              <Eraser className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>
            </Tip>
          )}
          {editorMode === 'words' && isActiveLineLocked && (
            <Tip content={t('editor.clearActiveLineWordTimestamps')}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearActiveLineWordTimestamps}
              className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 flex-shrink-0"
            >
              <SquareX className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>
            </Tip>
          )}
          <div className="w-px h-4 bg-zinc-700/80" />
          {/* Actions dropdown: undo/redo/save/delete */}
          <ActionsDropdown t={t}>
            <PopoverContent className="w-48 bg-zinc-900 border-zinc-700/80" align="end">
              <PopoverItem
                onClick={undo}
                disabled={!canUndo}
                className="text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer gap-2"
              >
                <Undo2 className="w-3.5 h-3.5" />
                {t('editor.undo')} <span className="ml-auto text-[10px] text-zinc-500">Ctrl+Z</span>
              </PopoverItem>
              <PopoverItem
                onClick={redo}
                disabled={!canRedo}
                className="text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 cursor-pointer gap-2"
              >
                <Redo2 className="w-3.5 h-3.5" />
                {t('editor.redo')} <span className="ml-auto text-[10px] text-zinc-500">Ctrl+Y</span>
              </PopoverItem>
              {editorMode === 'words' && (
                <>
                  <PopoverSeparator className="bg-zinc-700/50" />
                  <PopoverItem
                    onClick={() => {
                      const current = settings.editor?.display?.readingFormat || 'hiragana';
                      const next = current === 'hiragana' ? 'katakana' : 'hiragana';
                      updateSetting('editor.display.readingFormat', next);
                      onConvertReadings?.(next);
                    }}
                    className="text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer gap-2"
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {(settings.editor?.display?.readingFormat || 'hiragana') === 'hiragana' ? 'ア' : 'あ'}
                    </span>
                    {t(`editor.readingFormat.${(settings.editor?.display?.readingFormat || 'hiragana') === 'hiragana' ? 'katakana' : 'hiragana'}`)}
                  </PopoverItem>
                </>
              )}
              <PopoverSeparator className="bg-zinc-700/50" />
              <PopoverItem
                onClick={() => {
                  requestConfirm(t('confirm.removeAll'), handleRemoveAllLyrics);
                }}
                className="text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('editor.removeAll')}
              </PopoverItem>
            </PopoverContent>
          </ActionsDropdown>
        </div>
      )}
    </div>
  );
}
