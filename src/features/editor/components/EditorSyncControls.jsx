import { useTranslation } from 'react-i18next';
import { Kbd } from "@shared/Kbd";
import { Button } from '@ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Tip } from '@ui/tip';
import { KEY_SYMBOLS } from '../../settings/keySymbols';

export default function EditorSyncControls({
  settings,
  handleApplyOffset,
  selectedLines,
  editorMode,
  awaitingEndMark,
  onBulkMenu,
}) {
  const { t } = useTranslation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;


  const rangeKey = settings.shortcuts?.rangeSelect?.[0] || 'Shift';
  const toggleKey = settings.shortcuts?.toggleSelect?.[0] || 'Ctrl';
  const deselectKey = settings.shortcuts?.deselect?.[0] || 'Escape';
  const selectionHintText = `${KEY_SYMBOLS[rangeKey] ?? rangeKey}+Click: range · ${KEY_SYMBOLS[toggleKey] ?? toggleKey}+Click: toggle · ${KEY_SYMBOLS[deselectKey] ?? deselectKey}: deselect`;
  const shiftAmount = settings.editor?.shiftAllAmount ?? 0.5;

  return (
    <>
      <div className="flex flex-row gap-2 pt-2 border-t border-zinc-800/50 items-center justify-between">
        <div className="flex items-center gap-2">
          {isMobile && selectedLines.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkMenu}
              className="bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 text-xs h-8 rounded-full px-3"
            >
              <MoreHorizontal className="w-3.5 h-3.5 mr-1.5" />
              {t('editor.selection.actions') || 'Selection Actions'}
              <span className="ml-1.5 bg-primary/20 px-1.5 rounded-full text-[10px] font-bold">
                {selectedLines.size}
              </span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
        {settings.editor?.showShiftAll && (<>
          <span className="text-xs text-zinc-500 whitespace-nowrap flex-shrink-0">{t('editor.shiftAll')}</span>
          <div className="flex items-center gap-1">
            <Tip content={`-${shiftAmount}s`}>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleApplyOffset(-1)}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 w-7 h-7"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Tip>
            <span className="text-xs font-mono text-zinc-500 tabular-nums w-10 text-center select-none">
              {shiftAmount}s
            </span>
            <Tip content={`+${shiftAmount}s`}>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleApplyOffset(1)}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60 w-7 h-7"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Tip>
          </div>
        </>)}
        </div>
      </div>


      <p className="text-xs text-zinc-600 text-center">
        {selectedLines.size > 0
          ? selectionHintText
          : editorMode === 'srt'
            ? (awaitingEndMark != null ? t('editor.markEndInstruction').replace(/Space|Espacio/gi, settings.shortcuts?.mark?.[0] || 'Space') : t('editor.markInstructionSRT').replace(/Space|Espacio/gi, settings.shortcuts?.mark?.[0] || 'Space'))
            : editorMode === 'words'
              ? t('editor.markInstructionWords').replace(/Space|Espacio/gi, settings.shortcuts?.mark?.[0] || 'Space')
              : t('editor.markInstruction').replace(/Space|Espacio/gi, settings.shortcuts?.mark?.[0] || 'Space')
        }
      </p>
    </>
  );
}
