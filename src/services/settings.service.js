import { gqlRequest } from './graphql.client.js';

const GET_SETTINGS = `
  query GetSettings {
    settings {
      playback {
        volume
        muted
        autoRewindOnPause { enabled seconds }
        speedBounds { min max }
        showWaveform
        waveformSnap
        loopCurrentLine
        speedPresets
        seekTime
        seekPlays
      }
      editor {
        autoPauseOnMark
        nudge { fine coarse default }
        autoAdvance { enabled skipBlank mode }
        showShiftAll
        shiftAllAmount
        showLineNumbers
        timestampPrecision
        srt { defaultSubtitleDuration minSubtitleGap snapToNextLine }
        history { limit groupingThresholdMs }
        display {
          activeHighlight
          showNextLine
          dualLine
          languageLayout
          translationLayout
          readingFormat
          karaokeFillTrack
          karaokeFillEasing
        }
        scroll { mode alignment }
      }
      export {
        lineEndings
        copyFormat
        downloadFormat
        timestampPrecision
        defaultFilenamePattern
        includeMetadata
        stripEmptyLines
        normalizeTimestamps
      }
      interface {
        theme
        defaultLanguage
        fontSize
        spacing
        previewAlignment
        focusMode
        layoutSwap
        playerTop
        editorWidth
        lockLayout
        mobileTab
      }
      shortcuts {
        mark nudgeLeft nudgeRight nudgeLeftFine nudgeRightFine
        addLine deleteLine clearTimestamp switchMode deselect showHelp
        rangeSelect toggleSelect playPause seekForward seekBackward mute
        speedUp speedDown addSecondary addTranslation toggleTranslation
        focusSync focusPreview focusPlayback
      }
      import { expandRepeats }
      advanced {
        autoSave { enabled timeInterval }
        confirmDestructive
        timezone
      }
    }
  }
`;

const UPDATE_SETTINGS = `
  mutation UpdateSettings($input: UpdateSettingsInput!) {
    updateSettings(input: $input) {
      interface { theme fontSize spacing }
    }
  }
`;

const RESET_SETTINGS = `
  mutation ResetSettings {
    resetSettings
  }
`;

export const settingsService = {
  async get() {
    const data = await gqlRequest(GET_SETTINGS);
    return data.settings;
  },

  async save(input) {
    const data = await gqlRequest(UPDATE_SETTINGS, { input });
    return data.updateSettings;
  },

  // patch maps to save for GQL (partial updates work the same way)
  async patch(input) {
    return this.save(input);
  },

  async reset() {
    const data = await gqlRequest(RESET_SETTINGS);
    return data.resetSettings;
  },
};
