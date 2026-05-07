import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { projects, uploads, getAccessToken } from '@/api';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

const PROJECT_KEY = 'lrc-syncer-project';
const SHARED_PROJECT_KEY = 'lrc-syncer-shared-project';
const ACTIVE_PROJECT_ID_KEY = 'lrc-syncer-active-project-id';

// ── Utilities ────────────────────────────────────────────────────────────────

function toLocalISOString(date, utcOffset) {
  const [sign, hh, mm] = utcOffset.match(/([+-])(\d{2}):(\d{2})/).slice(1);
  const offsetMs = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60000;
  const local = new Date(date.getTime() + offsetMs);
  return local.toISOString().replace('Z', utcOffset);
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cloneValue = (v) => JSON.parse(JSON.stringify(v));

function buildLyricsPatch(prev, nextMode, nextLines) {
  if (!prev) return { editorMode: nextMode, lines: nextLines };
  const prevLines = Array.isArray(prev.lines) ? prev.lines : [];
  const modeChanged = prev.editorMode !== nextMode;
  if (prevLines.length !== nextLines.length)
    return modeChanged ? { editorMode: nextMode, lines: nextLines } : { lines: nextLines };
  let changedIdx = -1;
  for (let i = 0; i < nextLines.length; i++) {
    if (!deepEqual(prevLines[i], nextLines[i])) {
      if (changedIdx !== -1) return modeChanged ? { editorMode: nextMode, lines: nextLines } : { lines: nextLines };
      changedIdx = i;
    }
  }
  if (changedIdx === -1) return modeChanged ? { editorMode: nextMode } : null;
  return modeChanged
    ? { editorMode: nextMode, lineIndex: changedIdx, line: nextLines[changedIdx] }
    : { lineIndex: changedIdx, line: nextLines[changedIdx] };
}

export function buildProjectPatch({ prevSnapshot, title, metadata, state, uploadId, editorMode, lines }) {
  const patch = {};
  if (!prevSnapshot || prevSnapshot.title !== title) patch.title = title;
  if (!prevSnapshot || !deepEqual(prevSnapshot.metadata, metadata)) patch.metadata = metadata;
  if (uploadId !== undefined && (!prevSnapshot || prevSnapshot.uploadId !== uploadId)) patch.uploadId = uploadId;
  const lyricsPatch = buildLyricsPatch(prevSnapshot, editorMode, lines);
  if (lyricsPatch) patch.lyrics = lyricsPatch;

  const prevState = prevSnapshot?.state || {};
  const isStateDirty = !prevSnapshot || 
      prevState.syncMode !== state.syncMode ||
      prevState.activeLineIndex !== state.activeLineIndex ||
      prevState.playbackPosition !== state.playbackPosition ||
      prevState.playbackSpeed !== state.playbackSpeed;
      
  // If anything else changed, or the state itself changed, include the state patch (to update saveTime)
  if (isStateDirty || Object.keys(patch).length > 0) {
    patch.state = state;
  }
  
  return patch;
}

export function updateServerSnapshot(ref, { title, metadata, state, editorMode, lines, uploadId }) {
  const prev = ref.current;
  ref.current = {
    title,
    metadata: cloneValue(metadata),
    state: cloneValue(state),
    editorMode,
    lines: cloneValue(lines),
    uploadId: uploadId ?? prev?.uploadId ?? null,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useManualSave({
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
  isSharedProjectRef,
  activeProjectIdRef,
  isCreatingProjectRef,
  sessionUploadIdRef,
  lastServerSnapshotRef,
  playerRef,
  setIsAutosaving,
  setIsSaving,
  setActiveProjectId,
  onSaveSuccess,
}) {
  const { t } = useTranslation();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const buildProjectPayload = useCallback(() => {
    const tzSetting = settings.advanced.timezone;
    const tz = (!tzSetting || tzSetting === 'auto')
      ? Intl.DateTimeFormat().resolvedOptions().timeZone : tzSetting;
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || '';
    const match = offsetPart.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
    let utcOffset = '+00:00';
    if (match) {
      const sign = match[1] || '+';
      utcOffset = `${sign}${match[2].padStart(2, '0')}:${(match[3] || '0').padStart(2, '0')}`;
    }
    return {
      lines: lines.map((l) => ({
        ...l,
        timestamp: typeof l.timestamp === 'number' ? Math.round(l.timestamp * 1000) / 1000 : l.timestamp,
        endTime: editorMode === 'srt'
          ? (typeof l.endTime === 'number' ? Math.round(l.endTime * 1000) / 1000 : (l.endTime ?? null))
          : null,
      })),
      syncMode, activeLineIndex, editorMode,
      ytUrl: projectYtUrl || '',
      playbackPosition: hasMedia ? playbackPosition : 0,
      playbackSpeed: hasMedia ? (playerRef.current?.getSpeed?.() ?? 1) : 1,
      saveTime: toLocalISOString(now, utcOffset),
      timezone: tz, utcOffset,
      title: mediaTitle || '',
      metadata: projectMetadata,
    };
  }, [lines, syncMode, activeLineIndex, editorMode, settings.advanced.timezone, projectYtUrl, playbackPosition, hasMedia, mediaTitle, projectMetadata, playerRef]);

  const handleManualSave = useCallback(async (overrides = {}) => {
    const key = isSharedProjectRef.current ? SHARED_PROJECT_KEY : PROJECT_KEY;
    const payload = buildProjectPayload();
    const finalMetadata = overrides.metadata !== undefined ? overrides.metadata : projectMetadata;
    let finalTitle = overrides.title !== undefined ? overrides.title : (mediaTitle || '');
    payload.metadata = finalMetadata;
    payload.title = finalTitle;
    localStorage.setItem(key, JSON.stringify(payload));
    setIsAutosaving(true);
    setTimeout(() => setIsAutosaving(false), 1200);

    if (getAccessToken() && activeProjectIdRef.current && !isSharedProjectRef.current) {
      setIsSaving?.(true);
      try {
      let uploadIdToSave = sessionUploadIdRef.current || null;
      if (!uploadIdToSave && cloudinaryAudio) {
        if (cloudinaryAudio.id) {
          uploadIdToSave = cloudinaryAudio.id;
          sessionUploadIdRef.current = cloudinaryAudio.id;
        } else {
          try {
            const upload = await uploads.saveMedia({ source: 'cloudinary', cloudinaryUrl: cloudinaryAudio.cloudinaryUrl, publicId: cloudinaryAudio.publicId, fileName: cloudinaryAudio.fileName, title: overrides?.title ?? mediaTitle ?? '', duration: cloudinaryAudio.duration });
            uploadIdToSave = upload.id;
            sessionUploadIdRef.current = upload.id;
            setCloudinaryAudio((prev) => ({ ...prev, id: upload.id }));
          } catch (err) { console.error('Failed to save upload:', err); }
        }
      } else if (!uploadIdToSave && payload.ytUrl) {
        try {
          const upload = await uploads.saveMedia({ source: 'youtube', youtubeUrl: payload.ytUrl, fileName: '', title: '', duration: duration || null });
          uploadIdToSave = upload.id;
          sessionUploadIdRef.current = upload.id;
          const isGeneric = ['Sin título', 'Untitled', '無題'].includes(finalTitle);
          if (isGeneric && upload.title) {
            finalTitle = upload.title;
          }
        } catch (err) { console.error('Failed to save upload:', err); }
      }

      const patchState = { syncMode, activeLineIndex, playbackPosition: payload.playbackPosition, playbackSpeed: payload.playbackSpeed, saveTime: payload.saveTime, timezone: payload.timezone, utcOffset: payload.utcOffset };
      const patchData = buildProjectPatch({ prevSnapshot: lastServerSnapshotRef.current, title: finalTitle, metadata: finalMetadata, state: patchState, uploadId: uploadIdToSave ?? undefined, editorMode, lines: payload.lines });
      if (overrides.title !== undefined) patchData.title = overrides.title;
      if (overrides.metadata !== undefined) patchData.metadata = overrides.metadata;

      if (Object.keys(patchData).length > 0) {
        try {
          await projects.patch(activeProjectIdRef.current, patchData);
          updateServerSnapshot(lastServerSnapshotRef, { title: finalTitle, metadata: finalMetadata, state: patchState, editorMode, lines: payload.lines, uploadId: uploadIdToSave ?? undefined });
        } catch (err) {
          console.error('[Manual Save] Server error:', err);
          toast.error(t('project.saveFailed') || 'Failed to save to server');
        }
      }
      onSaveSuccess?.();
      } finally { setIsSaving?.(false); }
    } else if (getAccessToken() && !activeProjectIdRef.current && !isSharedProjectRef.current && payload.lines?.length > 0) {
      if (isCreatingProjectRef.current) return;
      isCreatingProjectRef.current = true;
      let uploadIdToSave = null;
      if (cloudinaryAudio?.id) { uploadIdToSave = cloudinaryAudio.id; }
      else if (cloudinaryAudio) {
        try { const upload = await uploads.saveMedia({ source: 'cloudinary', cloudinaryUrl: cloudinaryAudio.cloudinaryUrl, publicId: cloudinaryAudio.publicId, fileName: cloudinaryAudio.fileName, title: cloudinaryAudio.fileName?.replace(/\.[^/.]+$/, '') || '', duration: cloudinaryAudio.duration }); uploadIdToSave = upload.id; setCloudinaryAudio((p) => ({ ...p, id: upload.id })); } catch (err) { console.error(err); }
      } else if (payload.ytUrl) {
        try { 
          const upload = await uploads.saveMedia({ source: 'youtube', youtubeUrl: payload.ytUrl, fileName: '', title: '', duration: duration || null }); 
          uploadIdToSave = upload.id; 
          const isGeneric = ['Sin título', 'Untitled', '無題'].includes(finalTitle);
          if (isGeneric && upload.title) {
            finalTitle = upload.title;
          }
        } catch (err) { console.error(err); }
      }
      const createData = { title: finalTitle, metadata: finalMetadata, lyrics: { editorMode, lines: payload.lines }, state: { syncMode, activeLineIndex, playbackPosition: payload.playbackPosition || 0, playbackSpeed: payload.playbackSpeed || 1, saveTime: payload.saveTime, timezone: payload.timezone, utcOffset: payload.utcOffset }, readOnly: false };
      if (uploadIdToSave) createData.uploadId = uploadIdToSave;

      const performCreate = async () => {
        try {
          const recaptchaToken = executeRecaptcha ? await executeRecaptcha('create_project').catch(err => { console.warn('reCAPTCHA failed:', err); return undefined; }) : undefined;
          const res = await projects.create({ ...createData, recaptchaToken });
          const { projectId } = res;
          setActiveProjectId(projectId);
          activeProjectIdRef.current = projectId;
          updateServerSnapshot(lastServerSnapshotRef, { title: createData.title, metadata: createData.metadata, state: createData.state, editorMode, lines: payload.lines, uploadId: uploadIdToSave ?? undefined });
          try { localStorage.setItem(ACTIVE_PROJECT_ID_KEY, projectId); } catch { /* ignore */ }
          onSaveSuccess?.();
          toast.success(t('project.created') || 'Project created');
        } catch (err) {
          console.error(err);
          toast.error(t('project.createFailed') || 'Failed to create project');
        } finally {
          isCreatingProjectRef.current = false;
        }
      };
      performCreate();
    }
  }, [buildProjectPayload, mediaTitle, projectMetadata, editorMode, syncMode, activeLineIndex, cloudinaryAudio, duration, t, isSharedProjectRef, activeProjectIdRef, isCreatingProjectRef, sessionUploadIdRef, lastServerSnapshotRef, setIsAutosaving, setIsSaving, setActiveProjectId, setCloudinaryAudio, executeRecaptcha]);

  // Save-after-import: fires after state settles
  const [importTick, setImportTick] = useState(0);
  const importPayloadRef = useRef(null);
  const manualSaveRef = useRef(null);
  useEffect(() => { manualSaveRef.current = handleManualSave; });
  useEffect(() => {
    if (importTick > 0) { manualSaveRef.current?.(importPayloadRef.current || {}); importPayloadRef.current = null; }
  }, [importTick]);

  const triggerImportSave = useCallback((payload = null) => {
    if (payload) importPayloadRef.current = payload;
    setImportTick((n) => n + 1);
  }, []);

  return { handleManualSave, triggerImportSave, buildProjectPayload };
}
