import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/button';
import { ToggleGroup, ToggleGroupItem } from '@ui/toggle-group';
import { Tip } from '@ui/tip';
import { Badge } from '@ui/badge';
import { Popover, PopoverContent, PopoverItem, PopoverSeparator, PopoverTrigger } from '@ui/popover';
import { 
  FileText, Pencil, Save, Check, RefreshCw,
  Trash2, ListChecks,
  Repeat, EyeOff, MoreHorizontal, Plus, X, Loader2, HelpCircle, TimerOff
} from 'lucide-react';
import { serializeToRubyMarkup } from '@/utils/furigana';

// Mobile-friendly dropdown for actions that overflow
const ActionsDropdown = ({ children, icon: Icon = MoreHorizontal, label }) => {
  const { t } = useTranslation();
  return (
  <Popover>
    <Tip content={label || t('editor.lineOptions')}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800">
          <Icon className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
    </Tip>
    <PopoverContent className="w-56 p-1 bg-zinc-900 border-zinc-800 shadow-xl" align="end">
      {children}
    </PopoverContent>
  </Popover>
  );
};

export default function EditorToolbar({
  user,
  editorMode,
  setEditorMode,
  updateSetting,
  settings,
  syncMode,
  lines,
  setSelectedLines,
  selectedLines,
  handleClearTimestamps,
  handleClearAllWordTimestamps,
  requestConfirm,
  setRawText,
  setSyncMode,
  handleManualSave,
  handleGuestSave,
  handleRemoveAllLyrics,
  isAutosaving,
  isSaving,
  overlappingLines,
  onNewProject,
  onShowKeyboardHelp,
  activeLineIndex,
  activeWordIndex,
  stampTarget,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasAnyTimestamp = useMemo(() => lines.some((l) => l.timestamp != null), [lines]);

  const syncProgress = useMemo(() => {
    if (!lines.length) return null;
    const synced = lines.filter(l => l.timestamp != null).length;
    const wordCount = lines.reduce((acc, l) => acc + (l.text ? l.text.trim().split(/\s+/).filter(Boolean).length : 0), 0);
    const charCount = lines.reduce((acc, l) => acc + (l.text ? l.text.length : 0), 0);

    // Active line word progress for Words mode
    const activeLine = lines[activeLineIndex];
    const activeWords = stampTarget === 'secondary' ? activeLine?.secondaryWords : activeLine?.words;
    const totalWordsInLine = activeWords?.length || 0;
    const currentWordNum = activeWordIndex !== -1 ? Math.min(activeWordIndex + 1, totalWordsInLine) : 0;

    return { synced, total: lines.length, wordCount, charCount, totalWordsInLine, currentWordNum };
  }, [lines, activeLineIndex, activeWordIndex, stampTarget]);

  if (!syncMode) return null;

  return (
    <div className="flex flex-col gap-2 mb-1 sm:mb-2 sticky top-[-1px] lg:static z-raised py-2 px-4 -mx-4 border-b border-zinc-800/50 transition-all bg-zinc-950/50 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none lg:border-none lg:p-0 lg:m-0">
      {/* Top Row: Title + Sync Info + Save */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <h2 className="text-xs sm:text-sm font-semibold tracking-widest text-zinc-400 flex items-center gap-2">
            <span className="uppercase shrink-0 text-xs sm:text-sm flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t('editor.title')}
            </span>
          </h2>
          {syncMode && lines.length > 0 && (
            <Tip content={t('editor.backToEdit')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setRawText(lines.map(l => serializeToRubyMarkup(l.words) || l.text).join('\n'));
                  setSyncMode(false);
                }}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex-shrink-0 h-7 w-7"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </Tip>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Keyboard shortcuts quick access */}
          {onShowKeyboardHelp && (
            <Tip content={t('shortcuts.title') || 'Keyboard Shortcuts'}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onShowKeyboardHelp}
                className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 hidden lg:flex"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </Button>
            </Tip>
          )}

          {/* Sync progress + word/char count badge */}
          {syncProgress && (
            <Tip content={`${syncProgress.wordCount} words · ${syncProgress.charCount} chars`}>
              <div className={`text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-900/50 flex items-center gap-1.5 cursor-default ${
                syncProgress.synced === syncProgress.total ? 'text-primary border-primary/20' : 'text-zinc-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  syncProgress.synced === syncProgress.total ? 'bg-primary' : 'bg-zinc-700'
                }`} />
                {editorMode === 'words' && syncProgress.totalWordsInLine > 0 ? (
                  <span>{syncProgress.currentWordNum}/{syncProgress.totalWordsInLine}</span>
                ) : (
                  <span>{syncProgress.synced}/{syncProgress.total}</span>
                )}
                <span className="text-zinc-600 hidden sm:inline">·</span>
                <span className="text-zinc-600 hidden sm:inline">{syncProgress.wordCount}w</span>
              </div>
            </Tip>
          )}

          {handleManualSave && (!settings.advanced?.autoSave?.enabled || !user) && (
            <Tip content={isSaving ? (t('project.saving') || 'Saving…') : isAutosaving ? (t('project.saved') || 'Saved') : (t('project.save') || 'Save')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (!user) {
                    try {
                      await handleGuestSave();
                      navigate(`/auth?action=signin&redirect=${encodeURIComponent('/project/local?claim=true')}`);
                    } catch {
                      // toast already shown by handleGuestSave — abort navigation
                    }
                  } else {
                    handleManualSave();
                  }
                }}
                disabled={isSaving}
                className={`flex-shrink-0 h-8 w-8 transition-colors ${
                  isSaving ? 'text-zinc-400' : isAutosaving ? 'text-primary' : 'text-zinc-400'
                }`}
              >
                {isSaving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isAutosaving
                    ? <Check className="w-4 h-4" />
                    : <Save className="w-4 h-4" />}
              </Button>
            </Tip>
          )}
        </div>
      </div>

      {/* Bottom Row: Editor Modes + Actions */}
      <div className="flex items-center justify-between w-full gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
          {/* Editor Modes ToggleGroup */}
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
              className="bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-hidden h-auto p-0.5 gap-0.5 flex-nowrap"
            >
              <ToggleGroupItem
                value="lrc"
                className="px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border-0 data-[state=on]:bg-primary data-[state=on]:text-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-auto min-w-[50px]"
              >
                {t('editor.modeLRC')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="srt"
                className="px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border-0 data-[state=on]:bg-primary data-[state=on]:text-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-auto min-w-[50px]"
              >
                {t('editor.modeSRT')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="words"
                disabled={!hasAnyTimestamp}
                className="px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border-0 data-[state=on]:bg-primary data-[state=on]:text-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-auto min-w-[50px] disabled:opacity-40"
              >
                {t('editor.modeWords')}
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {overlappingLines?.size > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono tabular-nums border-orange-500/40 bg-orange-500/10 text-orange-400 select-none animate-pulse shrink-0 ml-1"
            >
              {t('editor.overlappingTimestamps', { count: overlappingLines.size }) || `${overlappingLines.size} overlapping`}
            </Badge>
          )}

          <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

          {/* Primary Actions */}
          {selectedLines.size > 0 && (
            <Tip content={t('editor.selection.deselectAll')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedLines(new Set())}
                className="h-9 w-9 shrink-0 text-primary"
              >
                <X className="w-4 h-4" />
              </Button>
            </Tip>
          )}

          {/* Desktop-only individual action buttons */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <Tip content={t('editor.selection.selectAll')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedLines(new Set(lines.map((_, i) => i)))}
                className="h-9 w-9 text-zinc-400 shrink-0"
              >
                <ListChecks className="w-4 h-4" />
              </Button>
            </Tip>

            <Tip content={t('editor.selection.clearTimestamps')}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearTimestamps}
                className="h-9 w-9 text-zinc-400 shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </Tip>

            {editorMode === 'words' && (
              <Tip content={t('editor.clearWordTimestamps')}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearAllWordTimestamps}
                  className="h-9 w-9 text-zinc-400 shrink-0"
                >
                  <TimerOff className="w-4 h-4" />
                </Button>
              </Tip>
            )}

            </div>
          </div>

        <div className="flex items-center gap-1">
          {/* Secondary Actions Dropdown (Mobile-first) */}
          <ActionsDropdown icon={MoreHorizontal}>
            <div className="p-1 space-y-0.5">
              <PopoverItem onClick={() => setSelectedLines(new Set(lines.map((_, i) => i)))}>
                <ListChecks className="w-4 h-4" />
                {t('editor.selection.selectAll')}
              </PopoverItem>

              <PopoverItem onClick={handleClearTimestamps}>
                <RefreshCw className="w-4 h-4" />
                {t('editor.selection.clearTimestamps')}
              </PopoverItem>

              {editorMode === 'words' && (
                <PopoverItem onClick={handleClearAllWordTimestamps}>
                  <TimerOff className="w-4 h-4" />
                  {t('editor.clearWordTimestamps')}
                </PopoverItem>
              )}

              <PopoverSeparator className="bg-zinc-800/50" />

              <PopoverItem onClick={onNewProject} className="text-xs">
                <Plus className="w-4 h-4" />
                {t('home.newProject')}
              </PopoverItem>
              
              <PopoverItem
                onClick={() => requestConfirm(t('confirm.removeAll'), handleRemoveAllLyrics, { title: t('confirm.removeAllTitle'), variant: 'danger' })}
                className="text-xs text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                {t('editor.removeAll')}
              </PopoverItem>
            </div>
          </ActionsDropdown>
        </div>
      </div>
    </div>
  );
}
