import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import NumberInput from '@shared/NumberInput';
import { Button } from '@ui/button';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from '@ui/popover';
import { Tip } from '@ui/tip';
import { ChevronDown, Minus, Plus } from 'lucide-react';

const SpeedControl = React.memo(function SpeedControl({
  playbackSpeed,
  applySpeed,
  MIN_SPEED,
  MAX_SPEED,
  SPEED_PRESETS
}) {
  const { t } = useTranslation();
  const [customSpeedInput, setCustomSpeedInput] = useState('');

  const handleCustomSpeedSubmit = () => {
    const val = parseFloat(customSpeedInput);
    if (!isNaN(val) && val >= MIN_SPEED && val <= MAX_SPEED) {
      applySpeed(val);
      setCustomSpeedInput('');
    }
  };

  const isCustomValid =
    customSpeedInput &&
    !isNaN(parseFloat(customSpeedInput)) &&
    parseFloat(customSpeedInput) >= MIN_SPEED &&
    parseFloat(customSpeedInput) <= MAX_SPEED;

  const stepDown = () => applySpeed(Math.round((playbackSpeed - 0.05) * 1000) / 1000);
  const stepUp = () => applySpeed(Math.round((playbackSpeed + 0.05) * 1000) / 1000);

  return (
    <div className="flex items-center gap-1 sm:gap-0.5 flex-shrink-0" role="group" aria-label={t('player.speed') || 'Playback speed'}>
      {/* Speed down */}
      <button
        onClick={stepDown}
        disabled={playbackSpeed <= MIN_SPEED}
        className="w-8 h-8 lg:w-6 lg:h-6 flex items-center justify-center rounded-full lg:rounded bg-zinc-800/60 lg:bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Decrease speed"
      >
        <Minus className="w-4 h-4 lg:w-3 lg:h-3" />
      </button>

      {/* Speed badge + dropdown */}
      <Popover>
        <Tip content={t('player.speed') || 'Speed'}>
          <PopoverTrigger asChild>
            <Button
              id="speed-btn"
              aria-label={`${t('player.speed') || 'Speed'}: ${playbackSpeed}x`}
              className={`h-9 lg:h-9 px-2.5 sm:px-3 font-mono font-bold rounded-full gap-1 transition-all ${
                playbackSpeed !== 1
                  ? 'bg-primary text-zinc-950 shadow-lg shadow-primary/30 hover:bg-primary-dim'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              <span className="text-[13px] lg:text-sm">{playbackSpeed}x</span>
              <ChevronDown className="w-3 h-3 lg:w-2.5 lg:h-2.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent
          className="w-48 lg:w-44 p-0 overflow-hidden bg-zinc-950 border-zinc-800 shadow-2xl"
          align="end"
        >
          <div className="p-1.5 max-h-64 overflow-y-auto no-scrollbar">
            {SPEED_PRESETS.map((speed) => (
              <PopoverItem
                key={speed}
                onClick={() => applySpeed(speed)}
                className={`font-mono rounded-lg py-2.5 lg:py-1.5 ${
                  playbackSpeed === speed
                    ? 'bg-primary/20 text-primary font-bold hover:bg-primary/30'
                    : ''
                }`}
              >
                {speed}x {speed === 1 && <span className="text-zinc-500 font-sans ml-1">(normal)</span>}
              </PopoverItem>
            ))}
          </div>
          <div className="border-t border-zinc-800 p-3 lg:p-2" onPointerDown={(e) => e.stopPropagation()}>
            <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2 block">
              {t('player.customSpeed') || 'Custom'} ({MIN_SPEED}–{MAX_SPEED}x)
            </label>
            <div className="flex gap-1.5">
              <NumberInput
                id="custom-speed-input"
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={0.05}
                value={customSpeedInput}
                onChange={(e) => setCustomSpeedInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSpeedSubmit()}
                placeholder="e.g. 1.3"
                className="flex-1 w-0 h-9 lg:h-8"
              />
              <Button
                size="sm"
                onClick={handleCustomSpeedSubmit}
                disabled={!isCustomValid}
                className="px-3 bg-primary hover:bg-primary-dim disabled:bg-zinc-900 disabled:text-zinc-700 text-zinc-950 font-bold"
              >
                OK
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Speed up */}
      <button
        onClick={stepUp}
        disabled={playbackSpeed >= MAX_SPEED}
        className="w-8 h-8 lg:w-6 lg:h-6 flex items-center justify-center rounded-full lg:rounded bg-zinc-800/60 lg:bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Increase speed"
      >
        <Plus className="w-4 h-4 lg:w-3 lg:h-3" />
      </button>
    </div>
  );
});

export default SpeedControl;
