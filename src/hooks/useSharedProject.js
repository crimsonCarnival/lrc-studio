import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { projects, uploads } from '@/api';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useSettings } from '../contexts/useSettings';

const SHARED_PROJECT_KEY = 'lrc-syncer-shared-project';
const ACTIVE_PROJECT_ID_KEY = 'lrc-syncer-active-project-id';

// Legacy URL-encoded share fallbacks
async function decompressFromBase64(str) {
  const { decompress } = await import('fflate');
  const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  return new Promise((res, rej) => decompress(bytes, (err, data) => err ? rej(err) : res(new TextDecoder().decode(data))));
}
function expandSharePayload(raw) { return raw; } // v1 format passthrough

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
    }));
}

/**
 * Manages shared-project state: URL-hash decode on mount, read-only fork guard,
 * cleanup on unload, and export-to-shareable-URL.
 */
export function useSharedProject({
  setLines,
  setSyncMode,
  setActiveLineIndex,
  setEditorModeRaw,
  setRestoredYtUrl,
  setRestoredPosition,
  setRestoredSpeed,
  setIsProjectLoading,
  setActiveProjectId,
  setShareModal,
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
}) {
  const { t } = useTranslation();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { updateSetting } = useSettings();

  const [isSharedProject, setIsSharedProject] = useState(false);
  const [sharedReadOnly, setSharedReadOnly] = useState(true);
  const [shareModal, _setShareModal] = useState(null);
  const [lastShareData, setLastShareData] = useState(null);
  const isSharedProjectRef = useRef(false);
  const sharedReadOnlyRef = useRef(true);

  useEffect(() => { isSharedProjectRef.current = isSharedProject; }, [isSharedProject]);
  useEffect(() => { sharedReadOnlyRef.current = sharedReadOnly; }, [sharedReadOnly]);

  // Expose shareModal setter so exportToUrl can call it
  const setShareModalState = setShareModal ?? _setShareModal;

  // ── Decode #s= hash on mount ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#s=')) return;
    const encoded = hash.slice(3);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    const restoreProject = (parsed) => {
      const validLines = sanitizeLines(parsed.lines);
      if (!validLines.length) return;
      setLines(validLines);
      if (parsed.syncMode) setSyncMode(parsed.syncMode);
      const idx = parsed.activeLineIndex;
      if (typeof idx === 'number' && idx >= 0 && idx < validLines.length) setActiveLineIndex(idx);
      const mode = parsed.editorMode || (validLines.some((l) => l.endTime != null) ? 'srt' : 'lrc');
      setEditorModeRaw(mode);
      if (parsed.ytUrl) setRestoredYtUrl(parsed.ytUrl);
      if (typeof parsed.playbackPosition === 'number') setRestoredPosition(parsed.playbackPosition);
      if (typeof parsed.playbackSpeed === 'number') setRestoredSpeed(parsed.playbackSpeed);
      const ro = parsed.readOnly !== false;
      setSharedReadOnly(ro);
      sharedReadOnlyRef.current = ro;
      setIsSharedProject(true);
      updateSetting('interface.focusMode', 'playback');
      localStorage.setItem(SHARED_PROJECT_KEY, JSON.stringify(parsed));
    };

    const looksLikeId = /^[A-Za-z0-9_-]{6,21}$/.test(encoded) && !encoded.includes('eJy');
    if (looksLikeId) {
      setIsProjectLoading(true);
      projects.get(encoded)
        .then((project) => {
          if (!project) throw new Error('Project not found');
          restoreProject({
            lines: project.lyrics?.lines || [],
            editorMode: project.lyrics?.editorMode || 'lrc',
            ytUrl: project.upload?.youtubeUrl || '',
            syncMode: project.state?.syncMode ?? true,
            activeLineIndex: project.state?.activeLineIndex || 0,
            playbackPosition: project.state?.playbackPosition || 0,
            playbackSpeed: project.state?.playbackSpeed || 1,
            readOnly: project.readOnly !== false,
          });
        })
        .catch(() => decompressFromBase64(encoded)
          .then((text) => { const raw = JSON.parse(text); restoreProject(raw.v === 1 ? expandSharePayload(raw) : raw); })
          .catch((err) => console.error('Failed to decode shared project URL', err)))
        .finally(() => setIsProjectLoading(false));
    } else {
      decompressFromBase64(encoded)
        .then((text) => { const raw = JSON.parse(text); restoreProject(raw.v === 1 ? expandSharePayload(raw) : raw); })
        .catch((err) => console.error('Failed to decode shared project URL', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on tab close ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isSharedProject) return;
    const cleanup = () => localStorage.removeItem(SHARED_PROJECT_KEY);
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [isSharedProject]);

  // ── Fork guard ────────────────────────────────────────────────────────────
  const forkFromShared = useCallback(() => {
    isSharedProjectRef.current = false;
    setIsSharedProject(false);
    localStorage.removeItem(SHARED_PROJECT_KEY);
  }, []);

  const setLinesGuarded = useCallback((updater) => {
    if (isSharedProjectRef.current && sharedReadOnlyRef.current) return;
    if (isSharedProjectRef.current && !sharedReadOnlyRef.current) forkFromShared();
    setLines(updater);
  }, [setLines, forkFromShared]);

  // ── Export to shareable URL ───────────────────────────────────────────────
  const exportToUrl = useCallback(async () => {
    // If we already have a share link, show it immediately while we update in the background
    if (lastShareData) {
      setShareModalState(lastShareData);
    } else {
      setShareModalState({ loading: 'media' });
    }

    try {
      let sharedId = activeProjectIdRef.current;
      let uploadIdToSave = null;
      if (cloudinaryAudio) {
        try {
          const upload = await uploads.saveMedia({
            source: 'cloudinary',
            cloudinaryUrl: cloudinaryAudio.cloudinaryUrl,
            publicId: cloudinaryAudio.publicId,
            fileName: cloudinaryAudio.fileName,
            title: cloudinaryAudio.fileName?.replace(/\.[^/.]+$/, '') || '',
            duration: cloudinaryAudio.duration,
          });
          uploadIdToSave = upload.id;
        } catch (err) {
          console.error(err);
        }
      } else if (projectYtUrl) {
        try {
          const upload = await uploads.saveMedia({
            source: 'youtube',
            youtubeUrl: projectYtUrl,
            fileName: '',
            title: mediaTitle || '',
            duration: duration || null,
          });
          uploadIdToSave = upload.id;
        } catch (err) {
          console.error(err);
        }
      }

      const projectData = {
        title: mediaTitle || '',
        metadata: projectMetadata,
        lyrics: { editorMode, lines: lines.map((l) => ({ ...l, id: undefined })) },
        state: { syncMode, activeLineIndex: 0, playbackPosition: 0, playbackSpeed: 1 },
        public: true,
      };
      if (uploadIdToSave) projectData.uploadId = uploadIdToSave;

      if (sharedId) {
        if (!lastShareData) setShareModalState({ loading: 'saving' });
        try { await projects.update(sharedId, projectData); }
        catch (err) { console.error(err); sharedId = null; }
      }
      if (!sharedId) {
        if (!lastShareData) setShareModalState({ loading: 'recaptcha' });
        const recaptchaToken = executeRecaptcha ? await executeRecaptcha('share_project') : undefined;
        if (!lastShareData) setShareModalState({ loading: 'creating' });
        const result = await projects.create({ ...projectData, recaptchaToken });
        sharedId = result.projectId;
        setActiveProjectId(sharedId);
        activeProjectIdRef.current = sharedId;
        localStorage.setItem(ACTIVE_PROJECT_ID_KEY, sharedId);
      }

      const finalData = {
        url: `${window.location.origin}/share/${sharedId}`,
        ytUrl: projectYtUrl,
        cloudinaryAudio,
        spotifyTrackId: projectSpotifyTrackId,
        mediaSource: projectSpotifyTrackId ? 'spotify' : (cloudinaryAudio ? 'cloudinary' : (projectYtUrl ? 'youtube' : 'none')),
        linesCount: lines.length,
        hasSynced: lines.some((l) => l.timestamp != null),
        readOnly: true,
      };
      setLastShareData(finalData);
      setShareModalState(finalData);
    } catch {
      setShareModalState(null);
      toast.error(t('project.shareFailed') || 'Could not generate share link.');
    }
  }, [lines, editorMode, projectYtUrl, syncMode, mediaTitle, cloudinaryAudio, duration, t, projectMetadata, activeProjectIdRef, setActiveProjectId, setShareModalState, executeRecaptcha, lastShareData, projectSpotifyTrackId]);

  return {
    isSharedProject, setIsSharedProject,
    sharedReadOnly, setSharedReadOnly,
    shareModal, setShareModal: setShareModalState,
    isSharedProjectRef, sharedReadOnlyRef,
    setLinesGuarded, forkFromShared, exportToUrl,
  };
}
