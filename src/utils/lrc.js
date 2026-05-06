/**
 * LRC / SRT utilities — format timestamps, compile, parse, download.
 */

import { serializeToRubyMarkup, parseRubyMarkup } from './furigana';

/**
 * Build the secondary (furigana/romaji) text for a line.
 * If the line has words with readings, serialize to {word|reading} markup.
 * If the line has secondaryWords with timestamps, serialize with <mm:ss.xx> tokens.
 * Otherwise fall back to line.secondary.
 * @param {{ secondary?: string, secondaryWords?: Array, words?: Array }} line
 * @returns {string|null}
 */
function buildSecondaryText(line, wordPrecision) {
  if (line.secondaryWords?.length && line.secondaryWords.some(w => w.time != null)) {
    return formatWordsToLrc(line.secondaryWords, wordPrecision);
  }
  if (line.words?.some(w => w.reading)) {
    return serializeToRubyMarkup(line.words);
  }
  return line.secondary || null;
}

/**
 * Format an array of {word, time} into LRC inline word-timestamp text.
 * E.g. "<00:05.12>Hello <00:05.56>world"
 */
function formatWordsToLrc(words, precision = 'hundredths') {
  const cjk = (ch) => { const c = ch?.codePointAt(0) ?? 0; return (c >= 0x3000 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x20000 && c <= 0x2FA1F); };
  return words.map((w, i, arr) => {
    const ts = w.time != null ? formatWordTimestamp(w.time, precision) : '';
    const token = `${ts}${w.word}`;
    const next = arr[i + 1];
    if (!next) return token;
    const lastChar = w.word.slice(-1);
    const firstChar = next.word.slice(0, 1);
    return cjk(lastChar) || cjk(firstChar) ? token : token + ' ';
  }).join('');
}

function formatWordTimestamp(seconds, precision = 'hundredths') {
  if (seconds == null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const decimals = precision === 'thousandths' ? 3 : 2;
  const padLen = decimals + 3;
  const ss = secs.toFixed(decimals).padStart(padLen, '0');
  return `<${mm}:${ss}>`;
}

/**
 * Formats a number of seconds into LRC timestamp format [mm:ss.xx] or [mm:ss.xxx]
 * @param {number} seconds
 * @param {'hundredths'|'thousandths'} precision
 * @returns {string}
 */
export function formatTimestamp(seconds, precision = 'hundredths') {
  if (seconds == null || isNaN(seconds) || seconds < 0) {
    return precision === 'thousandths' ? '00:00.000' : '00:00.00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const decimals = precision === 'thousandths' ? 3 : 2;
  const padLen = decimals + 3; // "ss." + decimals
  const ss = secs.toFixed(decimals).padStart(padLen, '0');
  return `${mm}:${ss}`;
}

/**
 * Parses an LRC timestamp string like "[01:23.45]" or "[01:23.456]" into seconds
 * @param {string} str
 * @returns {number|null}
 */
export function parseTimestamp(str) {
  const match = str.match(/\[(\d{2}):(\d{2}\.\d{2,3})\]/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseFloat(match[2]);
}

/**
 * Sanitizes a string for use inside LRC bracket tags.
 * @param {string} s
 * @returns {string}
 */
function sanitizeLrcTag(s) {
  if (typeof s !== 'string') return String(s || '');
  return s.replace(/[[\]]/g, '');
}

/**
 * Compiles an array of { text, timestamp } into a valid .lrc string
 * @param {Array} lines
 * @param {boolean} includeTranslations
 * @param {'hundredths'|'thousandths'} precision
 * @param {object} metadata
 * @param {'lf'|'crlf'} lineEndings
 * @returns {string}
 */
export function compileLRC(lines, includeTranslations = false, precision = 'hundredths', metadata = {}, lineEndings = 'lf', includeSecondary = false, wordPrecision) {
  const wp = wordPrecision || precision;
  let header = '';
  if (metadata.ti) header += `[ti:${sanitizeLrcTag(metadata.ti)}]\n`;
  if (metadata.ar) header += `[ar:${sanitizeLrcTag(metadata.ar)}]\n`;
  if (metadata.al) header += `[al:${sanitizeLrcTag(metadata.al)}]\n`;
  if (metadata.lg) header += `[lg:${sanitizeLrcTag(metadata.lg)}]\n`;

  const body = lines
    .flatMap((line) => {
      if (line.timestamp != null) {
        const ts = line.timestamp;
        const wordText = line.words?.length
          ? formatWordsToLrc(line.words, wp)
          : line.text;
        let out = `[${formatTimestamp(ts, precision)}] ${wordText}`;
        if (includeSecondary) {
          const sec = buildSecondaryText(line, wp);
          if (sec) out += `\n[${formatTimestamp(ts, precision)}] ${sec}`;
        }
        if (includeTranslations && line.translation) {
          out += `\n[${formatTimestamp(ts, precision)}] ${line.translation}`;
        }
        return out;
      }
      return [line.text];
    })
    .join('\n');
    
  let result = header + body;
  return lineEndings === 'crlf' ? result.replace(/\n/g, '\r\n') : result;
}

/**
 * Parses inline word-level timestamp tokens from LRC line text.
 * Format: <mm:ss.xx>word or <mm:ss.xxx>word
 * @param {string} text
 * @returns {Array<{word: string, time: number}>}
 */
export function parseWordTimestamps(text) {
  const re = /<(\d{1,2}):(\d{2}\.\d{2,3})>([^<]*)/g;
  const words = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
    const word = match[3].trimEnd();
    if (word) words.push({ word, time });
  }
  // Split CJK word groups into individual characters, distributing timestamps.
  // Latin/ASCII runs are kept as whole tokens.
  const hasCJK = words.some(w => /[\u3000-\u9FFF\uF900-\uFAFF]/.test(w.word));
  if (hasCJK && words.length > 0) {
    const expanded = [];
    const isCJKChar = (ch) => /[\u3000-\u9FFF\uF900-\uFAFF]/.test(ch);
    words.forEach((w, wi) => {
      const codePoints = [...w.word].filter(ch => ch.trim());
      // If the token has no CJK characters, keep it as-is (e.g. Latin words)
      if (!codePoints.some(isCJKChar)) {
        expanded.push(w);
        return;
      }
      // Single character — push directly
      if (codePoints.length <= 1) {
        expanded.push(w);
        return;
      }
      // Mixed token: split CJK chars individually, keep Latin runs intact
      const nextTime = words[wi + 1]?.time;
      const duration = nextTime != null ? nextTime - w.time : null;
      // Build sub-tokens (CJK individually, Latin as runs)
      const subTokens = [];
      let ci = 0;
      while (ci < codePoints.length) {
        const ch = codePoints[ci];
        if (isCJKChar(ch)) {
          subTokens.push(ch);
          ci++;
        } else {
          let j = ci;
          while (j < codePoints.length && !isCJKChar(codePoints[j])) j++;
          subTokens.push(codePoints.slice(ci, j).join(''));
          ci = j;
        }
      }
      subTokens.forEach((token, si) => {
        const t = duration != null
          ? w.time + (duration * si / subTokens.length)
          : w.time + si * 0.1;
        expanded.push({ word: token, time: parseFloat(t.toFixed(3)) });
      });
    });
    return expanded;
  }
  return words;
}



/**
 * Triggers a browser download of the given text content as a file.
 * @param {string} content
 * @param {string} filename
 */
export function downloadLRC(content, filename = 'lyrics.lrc') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formats a number of seconds into SRT timestamp format HH:MM:SS,mmm
 * @param {number} seconds
 * @returns {string}
 */
export function formatSrtTimestamp(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '00:00:00,000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const h = String(hrs).padStart(2, '0');
  const m = String(mins).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');
  return `${h}:${m}:${s},${msStr}`;
}

/**
 * Compiles an array of { text, timestamp } into a valid .srt string
 * @param {Array} lines
 * @param {number} duration
 * @param {boolean} includeTranslations
 * @param {'lf'|'crlf'} lineEndings
 * @param {object} srtConfig
 * @returns {string}
 */
export function compileSRT(lines, duration, includeTranslations = false, lineEndings = 'lf', srtConfig = {}, includeSecondary = false) {
  const minGap = srtConfig.minSubtitleGap || 0.05;
  const defaultDur = srtConfig.defaultSubtitleDuration || 5;

  const synced = lines.filter((l) => l.timestamp != null);
  if (synced.length === 0) return '';

  const body = synced.map((line, i) => {
    const start = line.timestamp;
    let end;
    if (line.endTime != null) {
      end = line.endTime;
    } else {
      const nextLine = synced[i + 1];
      if (nextLine && nextLine.timestamp != null) {
        end = Math.max(start + minGap, nextLine.timestamp - minGap);
      } else if (duration) {
        // Cap at start + defaultDur, but not beyond the track duration
        end = Math.min(start + defaultDur, duration);
      } else {
        end = start + defaultDur;
      }
    }

    return `${i + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${
      (includeSecondary && buildSecondaryText(line)) ? buildSecondaryText(line) + '\n' : ''
    }${line.text}${
      (includeTranslations && line.translation) ? '\n' + line.translation : ''
    }\n`;
  }).join('\n');
  
  return lineEndings === 'crlf' ? body.replace(/\n/g, '\r\n') : body;
}

const generateId = () => {
  try {
    return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);
  } catch {
    return Math.random().toString(36).slice(2, 11);
  }
};

/**
 * Parses an LRC or SRT file into an array of line objects.
 * @param {string} content
 * @param {string} filename
 * @returns {Array<{text: string, timestamp: number|null, endTime?: number, secondary?: string, translation?: string, id: string}>}
 */
export function parseLrcSrtFile(content, filename) {
  const isSrt = filename.toLowerCase().endsWith('.srt');
  const parsedLines = [];
  
  if (isSrt) {
    const blocks = content.replace(/\r\n/g, '\n').split('\n\n');
    blocks.forEach(block => {
      const parts = block.trim().split('\n');
      if (parts.length >= 3) {
        const timeMatch = parts[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (timeMatch) {
          const h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const s = parseInt(timeMatch[3], 10);
          const ms = parseInt(timeMatch[4], 10);
          const timestamp = h * 3600 + m * 60 + s + ms / 1000;
          
          const eh = parseInt(timeMatch[5], 10);
          const em = parseInt(timeMatch[6], 10);
          const es = parseInt(timeMatch[7], 10);
          const ems = parseInt(timeMatch[8], 10);
          const endTime = eh * 3600 + em * 60 + es + ems / 1000;
          
          // SRT multi-line text is joined as plain text by default
          const textLines = parts.slice(2);
          const text = textLines.join('\n');

          parsedLines.push({ text, timestamp, endTime, secondary: '', translation: '', id: generateId() });
        }
      }
    });
  } else {
    const lrcLines = content.replace(/\r\n/g, '\n').split('\n');
    lrcLines.forEach(line => {
      // Greedily collect all consecutive leading [mm:ss.xx] timestamp brackets
      let remaining = line.trim();
      const tsStepRe = /^\[(\d{1,2}):(\d{2}\.\d{2,3})\]/;
      const collectedTs = [];
      let step;
      while ((step = remaining.match(tsStepRe))) {
        collectedTs.push(parseInt(step[1], 10) * 60 + parseFloat(step[2]));
        remaining = remaining.slice(step[0].length);
      }
      if (collectedTs.length > 0) {
        const rawText = remaining.trim();
        // Parse word-level timestamps embedded in the line text
        const words = parseWordTimestamps(rawText);
        // Strip <mm:ss.xx> tokens to get clean display text
        const text = rawText.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, '').trim();
        collectedTs.sort((a, b) => a - b);

        const [primary] = collectedTs;
        const entry = { text, timestamp: primary, id: generateId() };
        if (words.length > 0) entry.words = words;
        parsedLines.push(entry);
      } else if (remaining !== '' && !/^\[[^\]]*:[^\]]*\]/.test(remaining)) {
        parsedLines.push({ text: remaining.trim(), timestamp: null, id: generateId() });
      }
    });
  }
  
  // Merge duplicate timestamps (for LRC bilingual files) using a Map for O(n) lookup
  const mergedLines = [];
  const timestampMap = new Map();

  for (const line of parsedLines) {
    if (line.timestamp == null) {
      mergedLines.push(line);
      continue;
    }

    const key = Math.round(line.timestamp * 100); // group within 0.01s
    if (timestampMap.has(key)) {
      const existingIndex = timestampMap.get(key);
      const existing = mergedLines[existingIndex];
      if (!existing.secondary && !existing.translation) {
        // 2nd same-ts line: treat as secondary (romaji / furigana markup)
        const secWords = parseWordTimestamps(line.text);
        if (secWords.length > 0) {
          existing.secondaryWords = secWords;
          existing.secondary = line.text.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, '').trim();
        } else if (/\{[^|{]+\|[^}]+\}/.test(line.text)) {
          // Ruby markup like {持|も}ち{上|あ}げて — strip to plain text and merge readings into words
          const { plainText, segments } = parseRubyMarkup(line.text);
          existing.secondary = plainText;
          
          if (!existing.words?.length) {
            // Case 1: No word timestamps on primary line — use segments directly as words
            existing.words = segments.map(s => ({
              word: s.text,
              reading: s.reading || undefined,
              time: null
            })).filter(w => w.word.trim());
          } else {
            // Case 2: Primary line has word timestamps — align segments with existing words
            const oldWords = [...existing.words];
            const newWords = [];
            let oldIdx = 0;
            
            for (const seg of segments) {
              const segText = seg.text;
              if (!segText) continue;
              
              // Find which old words (or characters) correspond to this segment
              let consumed = '';
              let firstTime = null;
              
              while (oldIdx < oldWords.length && consumed.length < segText.length) {
                const w = oldWords[oldIdx];
                if (firstTime === null) firstTime = w.time;
                consumed += w.word;
                oldIdx++;
              }
              
              newWords.push({
                word: segText,
                reading: seg.reading || undefined,
                time: firstTime
              });
            }
            // Append any leftover words
            if (oldIdx < oldWords.length) {
              newWords.push(...oldWords.slice(oldIdx));
            }
            existing.words = newWords;
          }
        } else {
          existing.secondary = line.text;
        }
      } else if (!existing.translation) {
        // 3rd same-ts line: treat as translation; keep text+secondary intact
        existing.translation = line.text;
      }
    } else {
      const idx = mergedLines.length;
      mergedLines.push({ ...line });
      timestampMap.set(key, idx);
    }
  }

  return mergedLines;
}

/**
 * Infers end times for lines that don't have them.
 * Uses the next line's start time (minus a tiny gap) or a default duration for the last line.
 * @param {Array} lines
 * @param {number} duration - total media duration
 * @param {object} srtConfig
 * @returns {Array} new array with endTime populated
 */
export function inferEndTimes(lines, duration, srtConfig = {}) {
  const minGap = srtConfig.minSubtitleGap || 0.05;
  const defaultDur = srtConfig.defaultSubtitleDuration || 5;

  return lines.map((line, i) => {
    // If already has an endTime, keep it
    if (line.endTime != null) return line;
    // If no start time, nothing to infer
    if (line.timestamp == null) return line;

    // Find the next synced line after this one
    let nextStart = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].timestamp != null) {
        nextStart = lines[j].timestamp;
        break;
      }
    }

    let endTime;
    if (nextStart != null) {
      endTime = Math.max(line.timestamp + minGap, nextStart - minGap);
    } else if (duration) {
      // Cap at start + defaultDur, but not beyond the track duration
      endTime = Math.min(line.timestamp + defaultDur, duration);
    } else {
      endTime = line.timestamp + defaultDur;
    }

    return { ...line, endTime };
  });
}
