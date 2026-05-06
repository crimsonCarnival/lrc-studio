import { request } from './api.client.js';
import {
  parseLrcSrtFile as localParse,
  compileLRC as localCompileLRC,
  compileSRT as localCompileSRT,
  inferEndTimes as localInferEndTimes,
} from '../utils/lrc';

// ——— Lyrics (parse/compile) — falls back to local utils when server is unreachable ———

function isNetworkError(err) {
  return err instanceof TypeError || err.message === 'Failed to fetch';
}

export const lyricsService = {
  async parse(content, filename) {
    try {
      return await request('/lyrics/parse', {
        method: 'POST',
        body: JSON.stringify({ content, filename }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const lines = localParse(content, filename);
        return { lines, detectedFormat: filename.toLowerCase().endsWith('.srt') ? 'srt' : 'lrc', count: lines.length };
      }
      throw err;
    }
  },

  async compileLrc({ lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision }) {
    try {
      return await request('/lyrics/compile/lrc', {
        method: 'POST',
        body: JSON.stringify({ lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision }),
      });
    } catch (err) {
      // Fallback to local compilation if server fails (e.g. 404, 500, or network error)
      const output = localCompileLRC(lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision);
      return { output, format: 'lrc' };
    }
  },

  async compileSrt({ lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary }) {
    try {
      return await request('/lyrics/compile/srt', {
        method: 'POST',
        body: JSON.stringify({ lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary }),
      });
    } catch (err) {
      // Fallback to local compilation if server fails
      const output = localCompileSRT(lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary);
      return { output, format: 'srt' };
    }
  },

  async inferEndTimes({ lines, duration, srtConfig }) {
    try {
      return await request('/lyrics/infer-end-times', {
        method: 'POST',
        body: JSON.stringify({ lines, duration, srtConfig }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const result = localInferEndTimes(lines, duration, srtConfig);
        return { lines: result };
      }
      throw err;
    }
  },
};

// ——— Editor operations ———

export const editorService = {
  async mark({ lines, activeLineIndex, time, editorMode, activeWordIndex, stampTarget, awaitingEndMark, focusedTimestamp, settings }) {
    return request('/editor/mark', {
      method: 'POST',
      body: JSON.stringify({ lines, activeLineIndex, time, editorMode, activeWordIndex, stampTarget, awaitingEndMark, focusedTimestamp, settings }),
    });
  },

  async bulkShift({ lines, selectedIndices, delta }) {
    return request('/editor/bulk-shift', {
      method: 'POST',
      body: JSON.stringify({ lines, selectedIndices, delta }),
    });
  },

  async globalOffset({ lines, delta }) {
    return request('/editor/global-offset', {
      method: 'POST',
      body: JSON.stringify({ lines, delta }),
    });
  },

  async clearAll({ lines, isSrt, isWords }) {
    return request('/editor/clear-all', {
      method: 'POST',
      body: JSON.stringify({ lines, isSrt, isWords }),
    });
  },

  async clearLine({ lines, index, isSrt, isWords }) {
    return request('/editor/clear-line', {
      method: 'POST',
      body: JSON.stringify({ lines, index, isSrt, isWords }),
    });
  },

  async detectDuplicates({ lines, threshold }) {
    return request('/editor/detect-duplicates', {
      method: 'POST',
      body: JSON.stringify({ lines, threshold }),
    });
  },
};
