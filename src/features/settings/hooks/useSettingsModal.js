import { useState, useEffect, useCallback, useRef } from 'react';
import useDraggable from '@/hooks/useDraggable';
import { DEFAULT_SETTINGS } from '@/contexts/settingsDefaults';

export function useSettingsModal(isOpen, onClose, globalSettings, updateAllSettings) {
  const [settings, setSettings] = useState(globalSettings || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('playback');
  const [searchTerm, setSearchTerm] = useState('');
  const { position, handleMouseDown } = useDraggable(isOpen);

  // Sync local settings copy when the modal opens (getDerivedStateFromProps pattern)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSettings(globalSettings);
      // If isOpen is a string (tab ID), switch to that tab
      if (typeof isOpen === 'string') {
        setActiveTab(isOpen);
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const autoSaveRef = useRef(null);

  const updateSetting = useCallback(
    (key, value) => {
      setSettings((prev) => {
        const keys = key.split('.');
        const nextSettings = JSON.parse(JSON.stringify(prev));
        let current = nextSettings;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;

        if (nextSettings.advanced?.autoSave?.enabled || prev.advanced?.autoSave?.enabled) {
          autoSaveRef.current = nextSettings;
        }
        return nextSettings;
      });
    },
    [],
  );

  useEffect(() => {
    if (autoSaveRef.current) {
      updateAllSettings(autoSaveRef.current);
      autoSaveRef.current = null;
    }
  });

  const validateShortcut = useCallback(
    (newKey, currentKeyName) => {
      // Block undo/redo keys from being reassigned to any shortcut
      const reserved = ['Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z'];
      if (reserved.some((r) => r.toLowerCase() === newKey.toLowerCase())) return false;

      const shortcutKeys = [
        'mark',
        'nudgeLeft',
        'nudgeRight',
        'addLine',
        'deleteLine',
        'clearTimestamp',
        'switchMode',
        'nudgeLeftFine',
        'nudgeRightFine',
        'deselect',
        'showHelp',
        'playPause',
        'seekForward',
        'seekBackward',
        'mute',
        'speedUp',
        'speedDown',
        'addSecondary',
        'addTranslation',
        'toggleTranslation',
      ];
      for (const k of shortcutKeys) {
        if (k !== currentKeyName && settings.shortcuts[k]?.includes(newKey)) return false;
      }
      return true;
    },
    [settings.shortcuts],
  );

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    if (
      settings.advanced?.autoSave?.enabled ||
      DEFAULT_SETTINGS.advanced?.autoSave?.enabled
    ) {
      updateAllSettings(DEFAULT_SETTINGS);
    }
  }, [settings.advanced?.autoSave?.enabled, updateAllSettings]);

  const handleApply = useCallback(() => {
    updateAllSettings(settings);
    onClose();
  }, [settings, updateAllSettings, onClose]);

  return {
    settings,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    position,
    handleMouseDown,
    updateSetting,
    validateShortcut,
    handleReset,
    handleApply,
  };
}
