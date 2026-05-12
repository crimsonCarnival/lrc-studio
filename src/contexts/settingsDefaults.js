export const DEFAULT_SETTINGS = {
  playback: {
    volume: 1,
    muted: false,
    autoRewindOnPause: { enabled: false, seconds: 2 },
    speedBounds: { min: 0.25, max: 3 },
    showWaveform: true,
    waveformSnap: false,
    loopCurrentLine: false,
    speedPresets: [0.5, 0.75, 1, 1.25, 1.5, 2],
    seekTime: 5,
    seekPlays: false,
  },
  editor: {
    autoPauseOnMark: true,
    nudge: { fine: 0.01, coarse: 0.1, default: 0.1 },
    autoAdvance: { enabled: true, skipBlank: false, mode: 'next' },
    showShiftAll: true,
    shiftAllAmount: 0.5,
    showLineNumbers: true,
    timestampPrecision: 'thousandths',
    srt: {
      defaultSubtitleDuration: 5,
      minSubtitleGap: 0,
      snapToNextLine: false
    },
    history: {
      limit: 250,
      groupingThresholdMs: 1000
    },
    display: {
      activeHighlight: 'glow',
      showNextLine: true,
      dualLine: false,
      languageLayout: 'stacked',
      translationLayout: 'side-by-side',
      readingFormat: 'hiragana',
      karaokeFillTrack: 'main',
      karaokeFillEasing: 'linear'
    },
    scroll: {
      mode: 'smooth',
      alignment: 'center'
    }
  },
  export: {
    lineEndings: 'lf',
    copyFormat: 'lrc',
    downloadFormat: 'lrc',
    timestampPrecision: 'thousandths',
    wordTimestampPrecision: 'hundredths',
    defaultFilenamePattern: 'fixed',
    includeMetadata: true,
    stripEmptyLines: false,
    normalizeTimestamps: false
  },
  interface: {
    theme: 'system',
    defaultLanguage: 'en',
    fontSize: 'normal',
    spacing: 'normal',
    previewAlignment: 'left',
    focusMode: 'default',
    layoutSwap: false,
    playerTop: false,
    editorWidth: 50,
    lockLayout: false,
    mobileTab: 'editor',
    toastPosition: 'bottom-right'
  },
  shortcuts: {
    mark: ['Enter'],
    nudgeLeft: ['Alt+ArrowLeft'],
    nudgeRight: ['Alt+ArrowRight'],
    nudgeLeftFine: ['Shift+ArrowLeft'],
    nudgeRightFine: ['Shift+ArrowRight'],
    addLine: ['Ctrl+Enter'],
    deleteLine: ['Delete'],
    clearTimestamp: ['Backspace'],
    switchMode: ['Ctrl+m'],
    deselect: ['Escape'],
    showHelp: ['?'],
    rangeSelect: ['Shift'],
    toggleSelect: ['Ctrl'],
    // Player
    playPause: ['Space'],
    seekForward: ['ArrowRight'],
    seekBackward: ['ArrowLeft'],
    mute: ['m'],
    speedUp: ['+'],
    speedDown: ['-'],
    // Preview
    addSecondary: ['Shift+H'],
    addTranslation: ['Shift+T'],
    toggleTranslation: ['t'],
    // Focus modes
    focusSync: ['Ctrl+1'],
    focusPreview: ['Ctrl+2'],
    focusPlayback: ['Ctrl+3'],
  },
  import: {
    expandRepeats: true
  },
  advanced: {
    autoSave: { enabled: true, timeInterval: 60 },
    confirmDestructive: true,
    timezone: 'auto'
  }
};
