import { useCallback } from 'react';
import { projects, uploads, getAccessToken } from '@/api';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { updateServerSnapshot } from './useManualSave';

const PROJECT_KEY = 'lrc-syncer-project';
const SHARED_PROJECT_KEY = 'lrc-syncer-shared-project';
const ACTIVE_PROJECT_ID_KEY = 'lrc-syncer-active-project-id';

function sanitizeLines(raw) {
  return (raw || [])
    .filter((l) => l && typeof l === 'object' && typeof l.text === 'string')
    .map((l) => ({
      text: l.text,
      timestamp: typeof l.timestamp === 'number' && isFinite(l.timestamp) ? l.timestamp : null,
      endTime: typeof l.endTime === 'number' && isFinite(l.endTime) ? l.endTime : undefined,
      secondary: typeof l.secondary === 'string' ? l.secondary : '',
      translation: typeof l.translation === 'string' ? l.translation : '',
      id: typeof l.id === 'string' ? l.id : crypto.randomUUID(),
      words: Array.isArray(l.words)
        ? l.words.map((w) => ({ word: typeof w.word === 'string' ? w.word : '', time: typeof w.time === 'number' && isFinite(w.time) ? w.time : null, ...(typeof w.reading === 'string' && w.reading ? { reading: w.reading } : {}) })).filter((w) => w.word)
        : undefined,
      secondaryWords: Array.isArray(l.secondaryWords)
        ? l.secondaryWords.map((w) => ({ word: typeof w.word === 'string' ? w.word : '', time: typeof w.time === 'number' && isFinite(w.time) ? w.time : null })).filter((w) => w.word)
        : undefined,
    }));
}

/**
 * CRUD-level project actions: load, restore, discard, reset, and media handlers.
 */
export function useProjectActions({
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
}) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  // ── Load a project from the library ──────────────────────────────────────
  const loadProject = useCallback(async (projectId) => {
    setIsProjectLoading(true);
    try {
      const project = await projects.get(projectId);
      if (!project) throw new Error('Project not found');
      const projectLines = (project?.lyrics?.lines || []).map((l) => ({
        text: l.text || '',
        timestamp: l.timestamp ?? null,
        endTime: l.endTime ?? undefined,
        secondary: l.secondary || '',
        translation: l.translation || '',
        id: crypto.randomUUID(),
        words: l.words,
        secondaryWords: l.secondaryWords,
      }));
      // Always restore all project state regardless of whether lyrics exist
      if (projectLines.length > 0) {
        setLines(projectLines);
        setSyncMode(project.state?.syncMode ?? true);
        setActiveLineIndex(project.state?.activeLineIndex || 0);
        setEditorModeRaw(project.lyrics?.editorMode || 'lrc');
      }
      // Always restore media
      if (project.upload?.youtubeUrl) setRestoredYtUrl(project.upload.youtubeUrl);
      else if (project.upload?.source === 'cloudinary' || project.upload?.cloudinaryUrl) setRestoredCloudinaryUpload(project.upload);
      if (project.state?.playbackPosition) setRestoredPosition(project.state.playbackPosition);
      if (project.state?.playbackSpeed) setRestoredSpeed(project.state.playbackSpeed);
      if (project.title) setMediaTitle(project.title);
      setActiveProjectId(projectId);
      activeProjectIdRef.current = projectId;
      updateServerSnapshot(lastServerSnapshotRef, {
        title: project.title || '',
        metadata: project.metadata || { description: '', tags: [] },
        state: { syncMode: project.state?.syncMode ?? true, activeLineIndex: project.state?.activeLineIndex || 0, playbackPosition: project.state?.playbackPosition || 0, playbackSpeed: project.state?.playbackSpeed || 1, saveTime: project.state?.saveTime || null, timezone: project.state?.timezone || null, utcOffset: project.state?.utcOffset || null },
        editorMode: project.lyrics?.editorMode || 'lrc',
        lines: projectLines,
        uploadId: project.upload?.id,
      });
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, projectId);
      localStorage.setItem(PROJECT_KEY, JSON.stringify({ lines: projectLines, syncMode: true, activeLineIndex: project.state?.activeLineIndex || 0, editorMode: project.lyrics?.editorMode || 'lrc', ytUrl: project.upload?.youtubeUrl || '', playbackPosition: project.state?.playbackPosition || 0, playbackSpeed: project.state?.playbackSpeed || 1, title: project.title || '', metadata: project.metadata || {}, projectId }));
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setIsProjectLoading(false);
    }
  }, [setLines, setSyncMode, setActiveLineIndex, setEditorModeRaw, setMediaTitle, setRestoredYtUrl, setRestoredCloudinaryUpload, setRestoredPosition, setRestoredSpeed, setActiveProjectId, activeProjectIdRef, lastServerSnapshotRef, setIsProjectLoading]);

  // ── Restore pending (localStorage) project ────────────────────────────────
  const handleRestoreProject = useCallback(() => {
    if (!pendingProject) return;
    const validLines = sanitizeLines(pendingProject.lines);
    if (!validLines.length) { setPendingProject(null); return; }

    setLines(validLines);
    setSyncMode(true);
    const idx = pendingProject.activeLineIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < validLines.length) setActiveLineIndex(idx);
    const restoredMode = pendingProject.editorMode || (validLines.some((l) => l.endTime != null) ? 'srt' : 'lrc');
    setEditorModeRaw(restoredMode);
    if (pendingProject.ytUrl) setRestoredYtUrl(pendingProject.ytUrl);
    if (typeof pendingProject.playbackPosition === 'number') setRestoredPosition(pendingProject.playbackPosition);
    if (typeof pendingProject.playbackSpeed === 'number') setRestoredSpeed(pendingProject.playbackSpeed);

    if (getAccessToken()) {
      const persist = async () => {
        setIsProjectLoading(true);
        let uploadIdToSave = null;
        if (pendingProject.ytUrl) {
          try { const { upload } = await uploads.saveMedia({ source: 'youtube', youtubeUrl: pendingProject.ytUrl, fileName: '', title: mediaTitle || '', duration: duration || null }); uploadIdToSave = upload.id; } catch (err) { console.error(err); }
        }
        const serverPayload = { title: mediaTitle || pendingProject.title || '', metadata: projectMetadata, lyrics: { editorMode: restoredMode, lines: validLines }, state: { syncMode: true, activeLineIndex: idx || 0, playbackPosition: pendingProject.playbackPosition || 0, playbackSpeed: pendingProject.playbackSpeed || 1 }, readOnly: false };
        if (uploadIdToSave) serverPayload.uploadId = uploadIdToSave;

        const existingId = activeProjectId || pendingProject.projectId;
        if (existingId) {
          try {
            await projects.update(existingId, serverPayload);
            if (!activeProjectId) { setActiveProjectId(existingId); activeProjectIdRef.current = existingId; localStorage.setItem(ACTIVE_PROJECT_ID_KEY, existingId); }
            setIsProjectLoading(false);
            return;
          } catch { /* fall through to create */ }
        }
        try {
          const recaptchaToken = executeRecaptcha ? await executeRecaptcha('restore_project') : undefined;
          const res = await projects.create({ ...serverPayload, recaptchaToken });
          setActiveProjectId(res.projectId);
          activeProjectIdRef.current = res.projectId;
          localStorage.setItem(ACTIVE_PROJECT_ID_KEY, res.projectId);
        } catch { /* ignore */ }
        setIsProjectLoading(false);
      };
      persist();
    }
    setPendingProject(null);
  }, [pendingProject, setPendingProject, setLines, setSyncMode, setActiveLineIndex, setEditorModeRaw, setRestoredYtUrl, setRestoredPosition, setRestoredSpeed, setIsProjectLoading, activeProjectId, activeProjectIdRef, setActiveProjectId, mediaTitle, projectMetadata, duration, executeRecaptcha]);

  // ── Discard pending project ───────────────────────────────────────────────
  const handleDiscardProject = useCallback(() => {
    localStorage.removeItem(PROJECT_KEY);
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    setActiveProjectId(null);
    setPendingProject(null);
  }, [setActiveProjectId, setPendingProject]);

  // ── Remove all lyrics ─────────────────────────────────────────────────────
  const handleRemoveAllLyrics = useCallback(() => {
    requestConfirm(t('confirm.removeLyrics') || 'Are you sure you want to remove all lyrics?', () => {
      setLines([]);
      setActiveLineIndex(0);
      toast.success(t('editor.toast.allRemoved') || 'All lyrics removed');
    }, { title: t('confirm.removeLyricsTitle') || 'Remove Lyrics', variant: 'danger' });
  }, [setLines, setActiveLineIndex, requestConfirm, t, toast]);

  // ── Reset full app state ──────────────────────────────────────────────────
  const resetAppState = useCallback(() => {
    setLines([]);
    setSyncMode(false);
    setActiveLineIndex(0);
    setMediaTitle('');
    setProjectMetadata({ description: '', tags: [] });
    setProjectYtUrl('');
    setRestoredYtUrl('');
    setRestoredPosition(0);
    setRestoredSpeed(1);
    setActiveProjectId(null);
    activeProjectIdRef.current = null;
    setCloudinaryAudio(null);
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    localStorage.removeItem(PROJECT_KEY);
    localStorage.removeItem(SHARED_PROJECT_KEY);
    lastServerSnapshotRef.current = null;
    sessionUploadIdRef.current = null;
  }, [setLines, setSyncMode, setActiveLineIndex, setMediaTitle, setProjectMetadata, setProjectYtUrl, setRestoredYtUrl, setRestoredPosition, setRestoredSpeed, setActiveProjectId, activeProjectIdRef, setCloudinaryAudio, lastServerSnapshotRef, sessionUploadIdRef]);

  // ── Media change handlers ─────────────────────────────────────────────────
  const handleMediaChange = useCallback((loaded) => {
    setHasMedia(loaded);
    if (!loaded) {
      setPlaybackPosition(0);
      setDuration(0);
      setMediaTitle('');
      setCloudinaryAudio(null);
      sessionUploadIdRef.current = null;
    }
  }, [setHasMedia, setPlaybackPosition, setDuration, setMediaTitle, setCloudinaryAudio, sessionUploadIdRef]);

  const handleDurationChange = useCallback((d) => {
    setDuration(d);
    setCloudinaryAudio((prev) => {
      if (prev && (prev.duration === null || prev.duration === undefined)) return { ...prev, duration: d };
      return prev;
    });
  }, [setDuration, setCloudinaryAudio]);

  return {
    loadProject,
    handleRestoreProject,
    handleDiscardProject,
    handleRemoveAllLyrics,
    resetAppState,
    handleMediaChange,
    handleDurationChange,
  };
}
