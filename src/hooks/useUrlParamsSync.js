import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

/**
 * Synchronizes key application state with URL parameters using descriptive names.
 * Supports hl (language), mode, speed, focus, and view.
 */
export function useUrlParamsSync(appState, layoutState) {
  const { i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstLoad = useRef(true);
  const lastParamsRef = useRef('');

  const {
    editorMode,
    setEditorMode,
    playbackSpeed,
    setPlaybackSpeed,
  } = appState;

  const {
    focusMode,
    setFocusMode,
    mobileTab,
    setMobileTab,
    layoutSwap,
    setLayoutSwap
  } = layoutState;

  // 1. Initialization from URL on mount
  useEffect(() => {
    if (!isFirstLoad.current) return;

    const hl = searchParams.get('hl');
    const mode = searchParams.get('mode');
    const speed = searchParams.get('speed');
    const focus = searchParams.get('focus');
    const view = searchParams.get('view');
    const swap = searchParams.get('swap');

    if (hl && i18n.language !== hl) {
      i18n.changeLanguage(hl);
    }

    if (mode && ['lrc', 'srt', 'words'].includes(mode) && editorMode !== mode) {
      setEditorMode(mode);
    }

    if (speed && !isNaN(Number(speed)) && playbackSpeed !== Number(speed)) {
      setPlaybackSpeed(Number(speed));
    }

    if (focus && ['default', 'sync', 'playback'].includes(focus) && focusMode !== focus) {
      setFocusMode(focus);
    }

    if (view && ['editor', 'preview'].includes(view) && mobileTab !== view) {
      setMobileTab(view);
    }
    
    if (swap === 'true' && !layoutSwap) {
      setLayoutSwap(true);
    }

    isFirstLoad.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Sync state changes TO the URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    let changed = false;

    const updateParam = (key, val, defaultVal, force = false) => {
      const current = params.get(key);
      const strVal = val != null ? String(val) : null;
      
      if (!force && (val === defaultVal || val == null)) {
        if (current !== null) {
          params.delete(key);
          changed = true;
        }
      } else if (current !== strVal) {
        params.set(key, strVal || '');
        changed = true;
      }
    };

    const currentHl = i18n.language?.split('-')[0] || 'en';
    updateParam('hl', currentHl, 'en', true);
    
    // Sync Mode - ensure it's always present BUT only on project pages
    if (layoutState.isReady) {
      updateParam('mode', editorMode, 'lrc', true);
    } else {
      updateParam('mode', null, null); // Remove if not on project page
    }
    
    // Sync Speed
    updateParam('speed', playbackSpeed === 1 ? null : playbackSpeed.toFixed(2));
    
    // Sync Focus
    updateParam('focus', focusMode, 'default');

    // Sync Mobile Tab (View)
    updateParam('view', mobileTab, 'editor');

    // Sync Layout Swap
    updateParam('swap', layoutSwap ? 'true' : null, null);

    const paramsString = params.toString();
    if (changed && paramsString !== lastParamsRef.current) {
      lastParamsRef.current = paramsString;
      setSearchParams(params, { replace: true });
    }
  }, [i18n.language, editorMode, playbackSpeed, focusMode, mobileTab, layoutSwap, searchParams, setSearchParams]);
}
