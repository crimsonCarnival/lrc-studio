import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../contexts/useSettings';
import useHistory from './useHistory';
import useConfirm from './useConfirm';
import { useThemeSync } from './useThemeSync';
import { useDragAndDrop } from './useDragAndDrop';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useLoopCurrentLine } from './useLoopCurrentLine';
import { useAutosave } from './useAutosave';
import { useManualSave, buildProjectPatch, updateServerSnapshot } from './useManualSave';
import { useSharedProject } from './useSharedProject';
import { useProjectActions } from './useProjectActions';
import { lyrics, projects, getAccessToken } from '@/api';

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const PROJECT_KEY = 'lrc-syncer-project';
const SHARED_PROJECT_KEY = 'lrc-syncer-shared-project';
const ACTIVE_PROJECT_ID_KEY = 'lrc-syncer-active-project-id';

export function useAppState(user) {
  const { t, i18n } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [searchParams] = useSearchParams();

  useThemeSync();

  // ——— Lines state with undo/redo ———
  // editorMode must be declared before useHistory so getCompanion can close over it
  const [editorMode, setEditorModeRaw] = useState('lrc');
  const [isProjectLoading, setIsProjectLoading] = useState(() => {
    try {
      return !!localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
    } catch {
      return false;
    }
  });

  const [lines, setLines, undo, redo, canUndo, canRedo] = useHistory([], {
    limit: settings.advanced?.history?.limit || 50,
    groupingThresholdMs: settings.advanced?.history?.groupingThresholdMs || 500,
    getCompanion: () => editorMode,
    onRestoreCompanion: setEditorModeRaw,
  });

  const [syncMode, setSyncMode] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaTitle, setMediaTitle] = useState('');
  const [projectMetadata, setProjectMetadata] = useState({ description: '', tags: [] });
  const [hasMedia, setHasMedia] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);


  const [pendingProject, setPendingProject] = useState(() => {
    // Always discard any leftover shared project (e.g. from a crash before beforeunload fired)
    localStorage.removeItem(SHARED_PROJECT_KEY);
    // If a shared project hash is in the URL, skip localStorage — useEffect handles it async
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#s=')) {
      return null;
    }
    // If we have an activeProjectId, this is a known project — skip the restore modal
    try {
      const existingId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
      if (existingId) return null; // will be silently restored in useEffect
    } catch { /* ignore localStorage errors */ }
    // Only show restore modal if user is authenticated
    if (!user) return null;
    try {
      const saved = localStorage.getItem(PROJECT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lines && parsed.lines.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse project data', e);
    }
    return null;
  });
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [projectYtUrl, setProjectYtUrl] = useState('');
  const [restoredYtUrl, setRestoredYtUrl] = useState('');
  const [restoredCloudinaryUpload, setRestoredCloudinaryUpload] = useState(null);
  const [restoredPosition, setRestoredPosition] = useState(0);
  const [restoredSpeed, setRestoredSpeed] = useState(1);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_PROJECT_ID_KEY) || null; } catch { return null; }
  });
  const [cloudinaryAudio, setCloudinaryAudio] = useState(null);
  const [projectSpotifyTrackId, setProjectSpotifyTrackId] = useState('');
  // Refs for stale-closure-safe reads inside save callbacks and guarded setLines
  const lastServerSnapshotRef = useRef(null);
  // Guard: prevents two concurrent project.create() calls (manual + autosave race)
  const isCreatingProjectRef = useRef(false);
  // Mirror isProjectLoading in a ref so the beforeunload handler (a non-reactive
  // closure) can always read the live value without being re-registered every render.
  // Initialised to match isProjectLoading's lazy initialiser so it's correct
  // from the very first render (before the sync useEffect can fire).
  const isProjectLoadingRef = useRef(isProjectLoading);
  // Keep activeProjectId accessible synchronously inside save callbacks (state is async)
  const activeProjectIdRef = useRef(activeProjectId);
  // Cache the persisted upload ID for the current session to avoid repeated saveMedia calls
  const sessionUploadIdRef = useRef(null);
  // Stable bound wrapper so callers (useAutosave, silent restore) don't need to pass the ref
  const saveServerSnapshot = useCallback(
    (data) => updateServerSnapshot(lastServerSnapshotRef, data),
    [],
  );
  // Callback registry: components (e.g. Editor) register teardown / post-save hooks here
  const afterSaveRef = useRef(null);
  const registerAfterSave = useCallback((fn) => { afterSaveRef.current = fn; }, []);
  const callAfterSave = useCallback(() => { afterSaveRef.current?.(); }, []);

  const playerRef = useRef(null);
  const langMenuRef = useRef(null);
  const [requestConfirm, confirmModal] = useConfirm();





  // ——— Silent restore when activeProjectId exists (known project, skip modal) ———
  const silentRestoreRan = useRef(false);
  useEffect(() => {
    if (silentRestoreRan.current) return;
    if (!activeProjectId) {
      setIsProjectLoading(false);
      return;
    }
    // If the URL has a shared project hash, skip silent restore
    if (window.location.hash.startsWith('#s=')) {
      setIsProjectLoading(false);
      return;
    }
    silentRestoreRan.current = true;

    // \u2705 FIX: Try loading from server first (source of truth), fall back to localStorage
    const restoreFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem(PROJECT_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        // \u2705 FIX: Allow restoring even if lines are empty (user may have deleted all lyrics)
        const validLines = (parsed.lines || []).filter(
          (l) => l && typeof l === 'object' && typeof l.text === 'string',
        ).map((l) => ({
          text: l.text,
          timestamp: typeof l.timestamp === 'number' && isFinite(l.timestamp) ? l.timestamp : null,
          endTime: typeof l.endTime === 'number' && isFinite(l.endTime) ? l.endTime : undefined,
          secondary: typeof l.secondary === 'string' ? l.secondary : '',
          translation: typeof l.translation === 'string' ? l.translation : '',
          id: typeof l.id === 'string' ? l.id : crypto.randomUUID(),
          words: Array.isArray(l.words) ? l.words.map((w) => ({
            word: typeof w.word === 'string' ? w.word : '',
            time: typeof w.time === 'number' && isFinite(w.time) ? w.time : null,
            ...(typeof w.reading === 'string' && w.reading ? { reading: w.reading } : {}),
          })).filter((w) => w.word) : undefined,
          secondaryWords: Array.isArray(l.secondaryWords) ? l.secondaryWords.map((w) => ({
            word: typeof w.word === 'string' ? w.word : '',
            time: typeof w.time === 'number' && isFinite(w.time) ? w.time : null,
          })).filter((w) => w.word) : undefined,
        }));
        setLines(validLines);
        setSyncMode(parsed.syncMode ?? true);
        const idx = parsed.activeLineIndex;
        if (typeof idx === 'number' && idx >= 0 && idx < validLines.length) {
          setActiveLineIndex(idx);
        }
        const restoredMode = parsed.editorMode
          || (validLines.some((l) => l.endTime != null) ? 'srt' : 'lrc');
        setEditorModeRaw(restoredMode);
        if (parsed.ytUrl) setRestoredYtUrl(parsed.ytUrl);
        if (typeof parsed.playbackPosition === 'number') setRestoredPosition(parsed.playbackPosition);
        if (typeof parsed.playbackSpeed === 'number') setRestoredSpeed(parsed.playbackSpeed);
        if (parsed.title) setMediaTitle(parsed.title);
        if (parsed.metadata) setProjectMetadata(parsed.metadata);
      } catch (e) {
        console.error('localStorage restore failed', e);
      }
    };

    // If authenticated, try server first (source of truth)
    if (getAccessToken()) {
      setIsProjectLoading(true);
      projects.get(activeProjectId)
        .then(({ project }) => {
          // Server data found - use it as source of truth
          const serverLines = (project.lyrics?.lines || []).map((l) => ({
            text: l.text || '',
            timestamp: l.timestamp ?? null,
            endTime: l.endTime ?? undefined,
            secondary: l.secondary || '',
            translation: l.translation || '',
            id: crypto.randomUUID(),
            words: l.words,
            secondaryWords: l.secondaryWords,
          }));
          setLines(serverLines);
          setSyncMode(project.state?.syncMode ?? true);
          setActiveLineIndex(project.state?.activeLineIndex || 0);
          setEditorModeRaw(project.lyrics?.editorMode || 'lrc');
          if (project.upload?.youtubeUrl) setRestoredYtUrl(project.upload.youtubeUrl);
          if (project.upload?.source === 'cloudinary' && project.upload?.cloudinaryUrl) {
            setRestoredCloudinaryUpload(project.upload);
          }
          if (project.state?.playbackPosition) setRestoredPosition(project.state.playbackPosition);
          if (project.state?.playbackSpeed) setRestoredSpeed(project.state.playbackSpeed);
          if (project.title) setMediaTitle(project.title);
          if (project.metadata) {
            setProjectMetadata({
              description: project.metadata.description || '',
              tags: project.metadata.tags || [],
            });
          }
          saveServerSnapshot({
            title: project.title || '',
            metadata: project.metadata || { description: '', tags: [] },
            state: {
              syncMode: project.state?.syncMode ?? true,
              activeLineIndex: project.state?.activeLineIndex || 0,
              playbackPosition: project.state?.playbackPosition || 0,
              playbackSpeed: project.state?.playbackSpeed || 1,
              saveTime: project.state?.saveTime || null,
              timezone: project.state?.timezone || null,
              utcOffset: project.state?.utcOffset || null,
            },
            editorMode: project.lyrics?.editorMode || 'lrc',
            lines: serverLines,
            uploadId: project.upload?.id,
          });

          // Sync server data to localStorage for offline access
          try {
            localStorage.setItem(PROJECT_KEY, JSON.stringify({
              lines: serverLines,
              syncMode: project.state?.syncMode ?? true,
              activeLineIndex: project.state?.activeLineIndex || 0,
              editorMode: project.lyrics?.editorMode || 'lrc',
              ytUrl: project.upload?.youtubeUrl || '',
              playbackPosition: project.state?.playbackPosition || 0,
              playbackSpeed: project.state?.playbackSpeed || 1,
            }));
          } catch { /* ignore localStorage errors */ }
        })
        .catch(() => {
          // Server failed (404, network error, etc.) — stale project ID, clear it
          setActiveProjectId(null);
          try {
            localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
            localStorage.removeItem(PROJECT_KEY);
          } catch { /* ignore */ }
        })
        .finally(() => setIsProjectLoading(false));
    } else {
      // Not authenticated - use localStorage
      restoreFromLocalStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep activeProjectIdRef in sync with state so save callbacks can read it synchronously
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);
  // Keep isProjectLoadingRef in sync for the beforeunload guard
  useEffect(() => { isProjectLoadingRef.current = isProjectLoading; }, [isProjectLoading]);




  // ——— Shared project (hash decode, fork guard, export-to-URL) ———
  const {
    isSharedProject,
    sharedReadOnly, setSharedReadOnly,
    shareModal, setShareModal,
    isSharedProjectRef,
    setLinesGuarded, exportToUrl,
  } = useSharedProject({
    setLines,
    setSyncMode,
    setActiveLineIndex,
    setEditorModeRaw,
    setRestoredYtUrl,
    setRestoredPosition,
    setRestoredSpeed,
    setIsProjectLoading,
    setActiveProjectId,
    setShareModal: undefined, // hook owns its own state
    activeProjectIdRef,
    lines,
    editorMode,
    syncMode,
    mediaTitle,
    projectMetadata,
    duration,
    projectYtUrl,
    cloudinaryAudio,
    projectSpotifyTrackId,
  });

  // Handle Playback Time (s) and Readonly params on mount
  useEffect(() => {
    const sParam = searchParams.get('s');
    if (sParam && !isNaN(Number(sParam))) {
      setRestoredPosition(Number(sParam));
    }
    
    const readonlyParam = searchParams.get('readonly');
    if (readonlyParam !== null) {
      setSharedReadOnly(readonlyParam === '1' || readonlyParam === 'true');
    }
  }, [searchParams, setRestoredPosition, setSharedReadOnly]);

  // ——— Manual save, payload building, import-save trigger ———
  const { handleManualSave, triggerImportSave, buildProjectPayload } = useManualSave({
    settings,
    lines,
    syncMode,
    activeLineIndex,
    editorMode,
    projectYtUrl,
    playbackPosition,
    hasMedia,
    mediaTitle,
    projectMetadata,
    duration,
    cloudinaryAudio,
    setCloudinaryAudio,
    activeProjectId,
    isSharedProjectRef,
    activeProjectIdRef,
    isCreatingProjectRef,
    sessionUploadIdRef,
    lastServerSnapshotRef,
    playerRef,
    setIsAutosaving,
    setIsSaving,
    setActiveProjectId,
    onSaveSuccess: callAfterSave,
  });

  // ——— Project CRUD actions ———
  const {
    loadProject,
    handleRestoreProject,
    handleDiscardProject,
    handleRemoveAllLyrics,
    resetAppState,
    handleMediaChange,
    handleDurationChange,
  } = useProjectActions({
    setLines,
    setSyncMode,
    setActiveLineIndex,
    setEditorModeRaw,
    setMediaTitle,
    setProjectMetadata,
    setProjectYtUrl,
    setRestoredYtUrl,
    setRestoredCloudinaryUpload,
    setRestoredPosition,
    setRestoredSpeed,
    setActiveProjectId,
    setCloudinaryAudio,
    setHasMedia,
    setPlaybackPosition,
    setDuration,
    setIsProjectLoading,
    setPendingProject,
    activeProjectId,
    activeProjectIdRef,
    lastServerSnapshotRef,
    sessionUploadIdRef,
    pendingProject,
    mediaTitle,
    projectMetadata,
    duration,
    t,
    toast,
    requestConfirm,
  });




  // ——— Mode switching with end-time inference ———
  const setEditorMode = useCallback(
    (mode) => {
      setEditorModeRaw(mode);
      if (mode === 'srt' && editorMode !== 'srt') {
        lyrics.inferEndTimes({
          lines,
          duration,
          srtConfig: settings.editor?.srt,
        }).then(({ lines: inferred }) => {
          setLines(inferred);
        }).catch((err) => {
          console.error('Failed to infer end times', err);
        });
      }
    },
    [editorMode, lines, duration, setLines, settings.editor?.srt],
  );

  // ——— Auto-save ———
  useAutosave({
    settings,
    pendingProject,
    isSharedProject,
    isSharedProjectRef,
    activeProjectId,
    activeProjectIdRef,
    isCreatingProjectRef,
    sessionUploadIdRef,
    lastServerSnapshotRef,
    cloudinaryAudio,
    mediaTitle,
    projectMetadata,
    editorMode,
    syncMode,
    activeLineIndex,
    lines,
    duration,
    buildProjectPayload,
    buildProjectPatch,
    updateServerSnapshot: saveServerSnapshot,
    setActiveProjectId,
    setIsAutosaving,
    isProjectLoading,
    onSaveSuccess: callAfterSave,
  });

  // ——— Global keyboard shortcuts ———
  useGlobalShortcuts({
    undo,
    redo,
    setShowKeyboardHelp,
    handleManualSave,
    settings,
    updateSetting,
    playerRef,
  });

  // ——— Close language menu on outside click ———
  useEffect(() => {
    if (!showLangMenu) return;
    const handler = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLangMenu]);

  const handleYtUrlChange = useCallback((url) => {
    // Clear upload ID cache whenever YouTube URL changes (different media)
    if (url !== projectYtUrl) sessionUploadIdRef.current = null;
    setProjectYtUrl(url || '');
  }, [projectYtUrl]);

  const handleTimeUpdate = useCallback((time) => {
    setPlaybackPosition(time);
  }, []);




  // ——— Page Exit Guard (Unsaved Changes) ———
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Never block exit while the project is still being restored from server —
      // the snapshot hasn't been written yet so every comparison looks dirty.
      if (isProjectLoadingRef.current) return;

      // Block exit while a save / create is in-flight so we don't corrupt state.
      if (isSaving || isCreatingProjectRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }

      // Build current payload and diff against the last known server snapshot.
      const payload = buildProjectPayload();
      const patch = buildProjectPatch({
        prevSnapshot: lastServerSnapshotRef.current,
        title: mediaTitle || '',
        metadata: projectMetadata,
        state: {
          syncMode,
          activeLineIndex,
          playbackPosition: payload.playbackPosition || 0,
          playbackSpeed: payload.playbackSpeed || 1,
          saveTime: payload.saveTime,
          timezone: payload.timezone,
          utcOffset: payload.utcOffset,
        },
        editorMode,
        lines: payload.lines || [],
      });

      // Treat as dirty if:
      // a) there is a meaningful diff against the snapshot, OR
      // b) we have lines but no snapshot AND autosave is off (autosave would
      //    otherwise save the project before the user can navigate away).
      const noSnapshot = !lastServerSnapshotRef.current && payload.lines?.length > 0;
      const autoSaveOn = settings.advanced?.autoSave?.enabled;
      const isDirty =
        (patch && Object.keys(patch).length > 0) ||
        (noSnapshot && !autoSaveOn);

      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    buildProjectPayload,
    mediaTitle,
    projectMetadata,
    syncMode,
    activeLineIndex,
    editorMode,
    isSaving,
    settings.advanced?.autoSave?.enabled,
  ]);


  const handleCloudinaryUpload = useCallback((info) => {
    setCloudinaryAudio(info);
    if (activeProjectIdRef.current) {
      triggerImportSave();
    }
  }, [triggerImportSave, setCloudinaryAudio]);

  // ——— Loop Current Line ———
  useLoopCurrentLine({
    enabled: settings.playback?.loopCurrentLine,
    syncMode,
    lines,
    activeLineIndex,
    editorMode,
    playbackPosition,
    playerRef,
  });

  // ——— Drag & Drop ———
  const { isDraggingFile } = useDragAndDrop({
    setLines: setLinesGuarded,
    setEditorMode: setEditorModeRaw,
    linesLength: lines.length,
    settings,
    requestConfirm,
    playerRef,
  });

  // ——— Process Query Parameters (?clone= and ?projectId=) ———
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cloneId = params.get('clone');
    const projId = params.get('projectId');
    
    if (cloneId && getAccessToken()) {
      // Remove query param
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('clone');
      window.history.replaceState(null, '', newUrl.toString());
      
      projects.clone(cloneId).then(res => {
        loadProject(res.projectId);
        toast.success(t('project.cloneSuccess') || 'Project copied successfully!');
      }).catch(err => {
        console.error('Failed to clone project:', err);
        toast.error(t('project.cloneFailed') || 'Failed to copy project');
      });
    } else if (projId && getAccessToken()) {
      // Remove query param
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('projectId');
      window.history.replaceState(null, '', newUrl.toString());
      
      loadProject(projId);
    }
  }, [t, loadProject]); // loadProject included as dependency

  const hasUnsavedChanges = useCallback(() => {
    // Unsaved local project with actual content
    if (!activeProjectId && lines.length > 0) return true;
    
    // Server project with potential differences
    if (activeProjectId && lastServerSnapshotRef.current) {
      if (isAutosaving) return true;
      if (mediaTitle !== lastServerSnapshotRef.current.title) return true;
      
      // Compare actual line content to accurately detect unsaved text/timestamp edits
      // We must use buildProjectPayload to get the rounded timestamps to correctly match the snapshot
      const currentPayloadLines = buildProjectPayload().lines || [];
      const currentLinesStr = JSON.stringify(currentPayloadLines);
      const snapshotLinesStr = JSON.stringify(lastServerSnapshotRef.current.lines || []);
      if (currentLinesStr !== snapshotLinesStr) return true;
    }
    return false;
  }, [activeProjectId, lines, mediaTitle, isAutosaving, buildProjectPayload]);

  return {
    t,
    i18n,
    settings,
    lines,
    setLines: setLinesGuarded,
    undo,
    redo,
    canUndo,
    canRedo,
    syncMode,
    setSyncMode,
    activeLineIndex,
    setActiveLineIndex,
    playbackPosition,
    duration,
    mediaTitle,
    setMediaTitle,
    projectMetadata,
    setProjectMetadata,
    hasMedia,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showSettings,
    setShowSettings,
    pendingProject,
    showLangMenu,
    setShowLangMenu,
    editorMode,
    setEditorMode,
    isDraggingFile,
    playerRef,
    langMenuRef,
    handleManualSave,
    triggerImportSave,
    handleRestoreProject,
    handleDiscardProject,
    handleRemoveAllLyrics,
    handleMediaChange,
    handleTimeUpdate,
    handleDurationChange,
    handleYtUrlChange,
    restoredYtUrl,
    restoredCloudinaryUpload,
    restoredPosition,
    restoredSpeed,
    exportToUrl,
    requestConfirm,
    hasUnsavedChanges,
    confirmModal,
    isAutosaving,
    isSaving,
    isSharedProject,
    sharedReadOnly,
    setSharedReadOnly,
    shareModal,
    setShareModal,
    activeProjectId,
    loadProject,
    resetAppState,
    handleCloudinaryUpload,
    setProjectSpotifyTrackId,
    isProjectLoading,
    setHasMedia,
    registerAfterSave,
  };
}
