import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/useSettings';
import { toHiragana, toKatakana, parseRubyMarkup } from '@/utils/furigana';
import { Tip } from '@ui/tip';

export default function PreviewLine({
  line,
  originalIndex: i,
  displayedActiveIndex,
  lockedLineIndex,
  isDualLine,
  displayLines,
  playbackPosition,
  activeRef,
  handleLineClick,
  handleLineHover,
  handleLineHoverEnd,
  showTranslationsInPreview,
  showFuriganaInPreview,
  sizeOption,
  spacingOption,
  activeSecondarySizes,
  inactiveSecondarySizes,
  activeFontSizes,
  inactiveFontSizes,
  activeMargin,
  distanceFromActive,
  hasMedia,
  isPlaying,
  playbackSpeed = 1,
}) {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const isActive = i === displayedActiveIndex || (isDualLine && i === displayLines[0].originalIndex);
  const isPast = line.timestamp != null && line.timestamp < playbackPosition && !isActive;
  const isLocked = lockedLineIndex === i;

  // Parallax opacity: active = 1.0, gradient to 0.3 for distant lines
  const parallaxOpacity = isActive
    ? 1.0
    : distanceFromActive != null
      ? Math.max(0.3, 1.0 - distanceFromActive * 0.15)
      : isPast ? 0.5 : 0.7;

  // Stagger delay for entrance animation (lines close to active appear first)
  const staggerDelay = distanceFromActive != null
    ? `${Math.min(distanceFromActive * 40, 200)}ms`
    : '0ms';

  const hasWordTimestamps = line.words?.some((w) => w.time != null);

  const translationLayout = settings.editor?.display?.translationLayout || 'side-by-side';

  const hasReadings = showFuriganaInPreview && line.words?.some((w) => w.reading);

  const inner = (
    <div
      ref={isActive && !isDualLine ? activeRef : null}
      onClick={hasMedia ? () => handleLineClick(line, i) : undefined}
      onMouseEnter={hasMedia ? () => handleLineHover(i) : undefined}
      onMouseLeave={hasMedia ? handleLineHoverEnd : undefined}
      style={{
        opacity: parallaxOpacity,
        animationDelay: staggerDelay,
      }}
      className={`group px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-opacity duration-100 ease-out flex select-none relative overflow-hidden animate-preview-line-in ${hasMedia ? 'cursor-pointer' : 'cursor-default'
        } ${translationLayout === 'side-by-side' && line.translation && showTranslationsInPreview
          ? 'flex-row items-baseline gap-3 sm:gap-6'
          : 'flex-col'
        } ${settings.interface?.previewAlignment === 'right' ? 'items-end text-right' :
          settings.interface?.previewAlignment === 'center' ? 'items-center text-center' :
            'items-start text-left'
        } ${isActive
          ? `${settings.editor?.display?.activeHighlight === 'zoom' ? 'scale-y-105' : ''} origin-center bg-zinc-800/10 ${activeMargin[spacingOption] || 'my-1 sm:my-2'}`
          : hasMedia ? 'hover:bg-zinc-800/30' : ''
        }`}
    >
      {line.timestamp != null && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex items-center justify-center pointer-events-none ${isLocked ? 'text-amber-400' : 'text-primary'
          } ${settings.interface?.previewAlignment === 'right' ? 'right-0 translate-x-full pl-2' : 'left-0 -translate-x-full pr-2'
          } ${isActive ? 'animate-timestamp-pulse' : ''}`}>
          {isLocked ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C9.24 2 7 4.24 7 7v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7c0-2.76-2.24-5-5-5zm3 10H9v-2c0-1.66 1.34-3 3-3s3 1.34 3 3v2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      )}

      {/* Left column for side-by-side: main + secondary */}
      {translationLayout === 'side-by-side' && line.translation && showTranslationsInPreview ? (
        <>
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Main Track (furigana renders as ruby on kanji) */}
            {renderMainTrack({
              line, isActive, isPast, hasWordTimestamps, playbackPosition,
              activeFontSizes, inactiveFontSizes, sizeOption, spacingOption, settings, showFuriganaInPreview,
              isPlaying, playbackSpeed, hasReadings
            })}
            {/* Secondary/Romaji Track — below main */}
            {line.secondary && renderSecondaryTrack({
              line, isActive, playbackPosition, activeSecondarySizes, inactiveSecondarySizes, sizeOption, settings,
              isPlaying, playbackSpeed
            })}
          </div>

          {/* Vertical Divider — spans full height while allowing baseline alignment for content columns */}
          <div className="w-px self-stretch bg-zinc-700/40 mx-3 sm:mx-6" />

          {/* Right column: translation */}
          <div className="flex-1 min-w-0">
            <p
              className={`transition-colors duration-100 w-full font-lyrics break-words overflow-wrap-anywhere hyphens-auto ${isActive
                ? `${activeFontSizes[sizeOption]} text-zinc-500 font-medium ${spacingOption === 'compact' ? 'my-0' : 'my-0.5 sm:my-1'}`
                : `${inactiveFontSizes[sizeOption]} text-zinc-600`
                }`}
              style={{ lineHeight: hasReadings ? '2' : undefined }}
            >
              {line.translation}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Main Track (furigana renders as ruby on kanji) */}
          {renderMainTrack({
            line, isActive, isPast, hasWordTimestamps, playbackPosition,
            activeFontSizes, inactiveFontSizes, sizeOption, spacingOption, settings, showFuriganaInPreview,
            isPlaying, playbackSpeed, hasReadings
          })}

          {/* Secondary/Romaji Track — below main */}
          {line.secondary && renderSecondaryTrack({
            line, isActive, playbackPosition, activeSecondarySizes, inactiveSecondarySizes, sizeOption, settings,
            isPlaying, playbackSpeed
          })}

          {/* Translation Track — below secondary */}
          {(line.translation && showTranslationsInPreview) && (
            <p
              className={`transition-colors duration-100 w-full font-lyrics break-words overflow-wrap-anywhere hyphens-auto ${isActive
                ? `${activeFontSizes[sizeOption]} text-zinc-500 font-medium ${spacingOption === 'compact' ? 'my-0' : 'my-0.5 sm:my-1'}`
                : `${inactiveFontSizes[sizeOption]} text-zinc-600`
                }`}
              style={{ lineHeight: hasReadings ? '2' : undefined }}
            >
              {line.translation}
            </p>
          )}
        </>
      )}
    </div>
  );

  return hasMedia ? <Tip content={isLocked ? t('preview.locked') : t('preview.hoverHint')}>{inner}</Tip> : inner;
}

// ——— CJK detection for spaceless scripts ———
function isCJKChar(ch) {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  return (
    (code >= 0x3000 && code <= 0x9FFF) ||  // CJK Unified, Hiragana, Katakana, CJK Symbols
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility Ideographs
    (code >= 0xFF00 && code <= 0xFFEF) ||   // Fullwidth Forms
    (code >= 0x20000 && code <= 0x2FA1F)    // CJK Extensions
  );
}

function needsSpaceAfter(currentWord, nextWord) {
  if (!nextWord) return false;
  const lastChar = currentWord.slice(-1);
  const firstChar = nextWord.slice(0, 1);
  return !isCJKChar(lastChar) && !isCJKChar(firstChar);
}

// ——— Render main text track with karaoke fill ———
// Fill effect is ONLY applied when word-level timestamps exist.
function renderMainTrack({ line, isActive, isPast, hasWordTimestamps, playbackPosition, activeFontSizes, inactiveFontSizes, sizeOption, spacingOption, settings, showFuriganaInPreview = true, isPlaying, playbackSpeed, hasReadings }) {
  const fillTrack = settings.editor?.display?.karaokeFillTrack ?? 'main';
  const fillEasing = settings.editor?.display?.karaokeFillEasing ?? 'linear';
  const skipMainFill = isActive && fillTrack === 'secondary';
  const effectiveHasWordTimestamps = hasWordTimestamps && !skipMainFill;
  const highlightMode = settings.editor?.display?.activeHighlight;
  // Active = white (fill effect provides green); past/completed = green; future = dim
  const activeClass = `${activeFontSizes[sizeOption]} font-bold font-lyrics text-zinc-100 ${highlightMode === 'glow' ? 'glow-line' : ''} ${spacingOption === 'compact' ? 'my-0' : 'my-0.5 sm:my-1'}`;
  const pastClass = `${inactiveFontSizes[sizeOption]} font-lyrics ${highlightMode === 'dim' ? 'text-zinc-700' : 'text-primary'}`;
  const futureClass = `${inactiveFontSizes[sizeOption]} font-lyrics ${highlightMode === 'dim' ? 'text-zinc-800' : 'text-zinc-600'}`;

  // Furigana readings come from word.reading; gated by showFuriganaInPreview
  const mainText = line.text || '♪';
  const readingFmt = settings.editor?.display?.readingFormat || 'hiragana';
  const fmtReading = (r) => r ? (readingFmt === 'katakana' ? toKatakana(r) : toHiragana(r)) : r;

  // Estimate fill end time for the last timed word to avoid an abrupt 0→100% snap
  let lastWordFillEnd = null;
  if (effectiveHasWordTimestamps) {
    const timedWordsList = line.words.filter((w2) => w2.time != null);
    if (timedWordsList.length > 0) {
      const lastTW = timedWordsList[timedWordsList.length - 1];
      if (line.endTime != null && line.endTime > lastTW.time) {
        lastWordFillEnd = line.endTime;
      } else if (timedWordsList.length >= 2) {
        const avgDur = (lastTW.time - timedWordsList[0].time) / (timedWordsList.length - 1);
        lastWordFillEnd = lastTW.time + avgDur;
      } else {
        lastWordFillEnd = lastTW.time + 0.8;
      }
    }
  }

  const words = line.words || [];

  return (
    <p className={`transition-colors duration-100 ease-out w-full break-words overflow-wrap-anywhere hyphens-auto ${isActive ? activeClass : isPast ? pastClass : futureClass}`} style={{ lineHeight: hasReadings ? '2' : undefined, willChange: 'opacity, transform' }}>
      {effectiveHasWordTimestamps
        ? words.map((w, wi) => {
          // Calculate effective start and end times for this word (interpolate if untimed)
          let startTime = w.time;
          let endTime = null;

          if (startTime == null) {
            // Untimed word: find surrounding timed anchors
            let prevT = line.timestamp ?? 0;
            let untimedCountBefore = 0;
            for (let j = wi - 1; j >= 0; j--) {
              if (words[j].time != null) { prevT = words[j].time; break; }
              untimedCountBefore++;
            }
            let nextT = lastWordFillEnd;
            let untimedCountAfter = 0;
            for (let j = wi + 1; j < words.length; j++) {
              if (words[j].time != null) { nextT = words[j].time; break; }
              untimedCountAfter++;
            }
            const totalGapWords = untimedCountBefore + untimedCountAfter + 1;
            const gapDur = Math.max(0.1, (nextT ?? (prevT + 1)) - prevT);
            const slice = gapDur / (totalGapWords + 1);
            startTime = prevT + (slice * (untimedCountBefore + 1));
            endTime = prevT + (slice * (untimedCountBefore + 2));
          } else {
            // Timed word: ends when next timed word starts
            endTime = words.slice(wi + 1).find((w2) => w2.time != null)?.time ?? lastWordFillEnd;
          }
          const nextWord = words[wi + 1];
          const addSpace = needsSpaceAfter(w.word, nextWord?.word);

          const wordContent = w.reading && isKanjiWord(w.word) && showFuriganaInPreview
            ? <ruby>{w.word}<rp>(</rp><rt style={{ paddingBottom: '2px' }}>{fmtReading(w.reading)}</rt><rp>)</rp></ruby>
            : w.word;

          return (
            <React.Fragment key={wi}>
              <span className="relative inline-block">
                <span className={isActive ? 'text-zinc-500 transition-colors duration-100' : ''}>{wordContent}</span>
                {isActive && (
                  <span
                    className="absolute left-0 top-0 h-full overflow-hidden text-primary whitespace-nowrap karaoke-fill-glow karaoke-fill-mask"
                    style={{
                      animationName: 'karaoke-fill-anim',
                      animationDuration: `${(endTime - startTime) / playbackSpeed}s`,
                      animationTimingFunction: fillEasing,
                      animationFillMode: 'both',
                      animationDelay: `${(startTime - playbackPosition) / playbackSpeed}s`,
                      animationPlayState: isPlaying ? 'running' : 'paused',
                      willChange: 'width'
                    }}
                  >
                    {wordContent}
                  </span>
                )}
              </span>
              {addSpace ? ' ' : null}
            </React.Fragment>
          );
        })
        // No word timestamps: just render text with furigana if available, no fill
        : hasReadings ? renderLineWithReadings(line, fmtReading, showFuriganaInPreview) : mainText
      }
    </p>
  );
}

function renderSecondaryTrack({ line, isActive, playbackPosition, activeSecondarySizes, inactiveSecondarySizes, sizeOption, settings, isPlaying, playbackSpeed }) {
  const fillTrack = settings?.editor?.display?.karaokeFillTrack ?? 'main';
  const fillEasing = settings?.editor?.display?.karaokeFillEasing ?? 'linear';
  const hasSecondaryStamps = line.secondaryWords?.some((w) => w.time != null);
  const doFill = isActive && hasSecondaryStamps && (fillTrack === 'secondary' || fillTrack === 'both');
  // secondary stays dim (inactive style) when fillTrack is 'main' — no active styling applied
  const treatAsActive = isActive && fillTrack !== 'main';
  const baseClass = `transition-colors duration-100 w-full font-lyrics break-words overflow-wrap-anywhere hyphens-auto ${treatAsActive
    ? `${activeSecondarySizes[sizeOption]} text-zinc-400 font-medium`
    : `${inactiveSecondarySizes[sizeOption]} text-zinc-600`
    }`;

  if (!doFill) {
    return <p className={baseClass}>{renderParsedSecondary(line.secondary)}</p>;
  }

  // Estimate fill end time for the last timed secondary word
  const timedSecWordsList = line.secondaryWords.filter((w2) => w2.time != null);
  let lastSecWordFillEnd = null;
  if (timedSecWordsList.length > 0) {
    const lastTW = timedSecWordsList[timedSecWordsList.length - 1];
    if (timedSecWordsList.length >= 2) {
      const avgDur = (lastTW.time - timedSecWordsList[0].time) / (timedSecWordsList.length - 1);
      lastSecWordFillEnd = lastTW.time + avgDur;
    } else {
      lastSecWordFillEnd = lastTW.time + 0.8;
    }
  }

  return (
    <p className={baseClass}>
      {line.secondaryWords.map((w, wi) => {
        // Calculate effective start and end times for this word (interpolate if untimed)
        let startTime = w.time;
        let endTime = null;

        if (startTime == null) {
          // Untimed word: find surrounding timed anchors
          let prevT = line.timestamp ?? 0;
          let untimedCountBefore = 0;
          for (let j = wi - 1; j >= 0; j--) {
            if (line.secondaryWords[j].time != null) { prevT = line.secondaryWords[j].time; break; }
            untimedCountBefore++;
          }
          let nextT = lastSecWordFillEnd;
          let untimedCountAfter = 0;
          for (let j = wi + 1; j < line.secondaryWords.length; j++) {
            if (line.secondaryWords[j].time != null) { nextT = line.secondaryWords[j].time; break; }
            untimedCountAfter++;
          }
          const totalGapWords = untimedCountBefore + untimedCountAfter + 1;
          const gapDur = Math.max(0.1, (nextT ?? (prevT + 1)) - prevT);
          const slice = gapDur / (totalGapWords + 1);
          startTime = prevT + (slice * (untimedCountBefore + 1));
          endTime = prevT + (slice * (untimedCountBefore + 2));
        } else {
          // Timed word: ends when next timed word starts
          endTime = line.secondaryWords.slice(wi + 1).find((w2) => w2.time != null)?.time ?? lastSecWordFillEnd;
        }
        const addSpace = wi < line.secondaryWords.length - 1;
        return (
          <React.Fragment key={wi}>
            <span className="relative inline-block">
              <span className="text-zinc-600 transition-colors duration-100">{w.word}</span>
              <span
                className="absolute left-0 top-0 h-full overflow-hidden text-zinc-200 whitespace-nowrap karaoke-fill-mask"
                style={{
                  animationName: 'karaoke-fill-anim',
                  animationDuration: `${(endTime - startTime) / playbackSpeed}s`,
                  animationTimingFunction: fillEasing,
                  animationFillMode: 'both',
                  animationDelay: `${(startTime - playbackPosition) / playbackSpeed}s`,
                  animationPlayState: isPlaying ? 'running' : 'paused',
                  willChange: 'width'
                }}
              >
                {w.word}
              </span>
            </span>
            {addSpace ? ' ' : null}
          </React.Fragment>
        );
      })}
    </p>
  );
}

// ——— Parse {word|reading} markup in secondary text into rendered ruby elements ———
function renderParsedSecondary(text) {
  if (!text) return null;
  const { segments } = parseRubyMarkup(text);
  return segments.map((seg, i) =>
    seg.reading ? (
      <ruby key={i}>{seg.text}<rp>(</rp><rt style={{ paddingBottom: '2px' }}>{seg.reading}</rt><rp>)</rp></ruby>
    ) : (
      <React.Fragment key={i}>{seg.text}</React.Fragment>
    )
  );
}

// ——— Kanji detection: only kanji get ruby annotations, not hiragana/katakana ———
const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
function isKanjiWord(word) {
  return KANJI_RE.test(word);
}


// ——— Render line text with ruby annotations from word.reading (only on kanji) ———
function renderLineWithReadings(line, fmtReading, showFurigana = true) {
  const words = line.words || [];
  if (words.length === 0) return line.text || '♪';
  return words.map((w, i) => {
    const addSpace = needsSpaceAfter(w.word, words[i + 1]?.word);
    if (w.reading && isKanjiWord(w.word) && showFurigana) {
      return (
        <React.Fragment key={i}>
          <ruby>{w.word}<rp>(</rp><rt style={{ paddingBottom: '2px' }}>{fmtReading(w.reading)}</rt><rp>)</rp></ruby>
          {addSpace ? ' ' : null}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{w.word}{addSpace ? ' ' : null}</React.Fragment>;
  });
}
