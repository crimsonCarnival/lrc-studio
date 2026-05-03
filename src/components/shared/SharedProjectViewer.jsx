import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { projects, getAccessToken } from '../../api';
import Player from '../Player';
import Preview from '../Preview';
import SharedProjectError from './SharedProjectError';
import { LogIn, UserPlus, Music2, Copy, Check } from 'lucide-react';

/**
 * Full-page, unauthenticated shared-project viewer.
 * Rendered when pathname matches /share/:id — no auth required.
 *
 * Layout: Preview (flex-1) → Player bar → Login CTA banner
 * Player is in viewerMode: only seek/play controls, no upload/load actions.
 */
function SharedProjectViewerInner({ projectId }) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const startTime = parseInt(searchParams.get('s')) || 0;

  // ── Minimal state ──
  const [lines, setLines] = useState([]);
  const [editorMode, setEditorMode] = useState('lrc');
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [mediaTitle, setMediaTitle] = useState('');
  const [initialYtUrl, setInitialYtUrl] = useState('');
  const [hasMedia, setHasMedia] = useState(false);

  // ── Fetch state ──
  const [loadStatus, setLoadStatus] = useState('loading'); // 'loading' | 'ok' | 403 | 404
  const [projectData, setProjectData] = useState(null);
  const [isCloning, setIsCloning] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef(null);

  // ── Load project on mount ──
  useEffect(() => {
    let cancelled = false;
    projects.getShare(projectId)
    .then(({ project }) => {
      if (cancelled) return;
      const rawLines = (project.lyrics?.lines || []).map((l) => ({
        text: l.text || '',
        timestamp: l.timestamp ?? null,
        endTime: l.endTime ?? undefined,
        secondary: l.secondary || '',
        translation: l.translation || '',
        id: crypto.randomUUID(),
        words: l.words,
        secondaryWords: l.secondaryWords,
      }));
      setLines(rawLines);
      setEditorMode(project.lyrics?.editorMode || 'lrc');
      setMediaTitle(project.title || '');
      setProjectData(project);
      if (project.upload?.youtubeUrl) {
        setInitialYtUrl(project.upload.youtubeUrl);
      }
      setLoadStatus('ok');
    })
    .catch((err) => {
      if (cancelled) return;
      setLoadStatus(err.status === 403 ? 403 : 404);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleTimeUpdate = useCallback((t) => setPlaybackPosition(t), []);
  const handleMediaChange = useCallback((v) => setHasMedia(v), []);

  // ── Redirect helpers ──
  const redirectUrl = `/share/${projectId}`;
  const loginUrl = `/?redirect=${encodeURIComponent(redirectUrl)}`;
  const registerUrl = `/?tab=register&redirect=${encodeURIComponent(redirectUrl)}`;

  // ── Clone project handler ──
  const handleClone = useCallback(async () => {
    if (getAccessToken()) {
      // Already logged in - clone directly
      setIsCloning(true);
      try {
        const result = await projects.clone(projectId);
        // Redirect to the new project
        window.location.href = `/?projectId=${result.projectId}`;
      } catch (err) {
        console.error('Failed to clone project:', err);
        setIsCloning(false);
      }
    } else {
      // Not logged in - redirect to login with continuation
      localStorage.setItem('cloneAfterAuth', projectId);
      window.location.href = registerUrl;
    }
  }, [projectId, registerUrl]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // ── Loading ──
  if (loadStatus === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size={28} className="text-primary" />
      </div>
    );
  }

  // ── Error ──
  if (loadStatus !== 'ok') {
    return <SharedProjectError status={loadStatus} projectId={projectId} />;
  }

  // ── Viewer ──
  return (
    <div className="min-h-screen lg:h-screen bg-zinc-950 relative overflow-x-hidden flex flex-col">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl" />
      </div>

      {/* ── Preview (flex-1) ── */}
      <div className="relative z-base flex-1 min-h-0 px-2 sm:px-4 lg:px-6 py-4 lg:pb-0 flex flex-col">
        <Preview
          lines={lines}
          setLines={() => { }} // read-only — no edits
          playbackPosition={playbackPosition}
          mediaTitle={mediaTitle}
          playerRef={playerRef}
          duration={0}
          editorMode={editorMode}
          exportToUrl={() => { }}
          isSharedProject={true}
          sharedReadOnly={true}
          setSharedReadOnly={() => { }}
          shareModal={null}
          setShareModal={() => { }}
          hasMedia={hasMedia}
          activeProjectId={projectId}
          project={projectData}
          projectMetadata={projectData?.metadata}
          viewerMode={true}
        />
      </div>

      {/* ── Player (viewer mode) ── */}
      <div className="relative z-raised w-full border-t border-zinc-700/50 bg-zinc-900/80 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <Player
            ref={playerRef}
            mediaTitle={mediaTitle}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={() => { }}
            onMediaChange={handleMediaChange}
            onYtUrlChange={() => { }}
            onTitleChange={setMediaTitle}
            initialYtUrl={initialYtUrl}
            initialSeek={startTime}
            initialSpeed={1}
            lines={lines}
            playbackPosition={playbackPosition}
            syncMode={false}
            onCloudinaryUpload={() => { }}
            projectMetadata={projectData?.metadata}
            viewerMode={true}
          />
        </div>
      </div>

{/* ── Create Copy CTA banner ── */}
<div className="relative z-sticky w-full bg-gradient-to-r from-zinc-900/95 via-zinc-900 to-zinc-900/95 border-t border-zinc-700/50 backdrop-blur-md">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
    {/* Callout Box */}
    <div className="flex items-start gap-3 min-w-0 flex-1">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center flex-shrink-0 mt-0.5">
        <Music2 className="w-4 h-4 text-white" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100 truncate">
          {t('share.likeThisProject', "Like this project?")}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {t('share.createCopyDesc', "Create your own editable copy and customize it")}
        </p>
      </div>
    </div>
    {/* Action Buttons */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyLink}
        disabled={copied}
        className="h-8 px-3 bg-zinc-800 border-zinc-700/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 text-xs font-semibold gap-1.5 rounded-lg transition-all"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t('share.copied', 'Copied') : t('share.copyLink', 'Copy Link')}
      </Button>
      <Button
        size="sm"
        onClick={handleClone}
        disabled={isCloning}
        className="h-8 px-3 bg-primary hover:bg-primary-dim text-zinc-950 text-xs font-semibold gap-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCloning ? (
          <>
            <Spinner size={14} className="w-3.5 h-3.5" />
            {t('share.creating', 'Creating...')}
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            {t('share.createCopy', 'Create Copy')}
          </>
        )}
      </Button>
    </div>
  </div>
</div>
    </div>
  );
}

/**
 * Wrapper that provides SettingsProvider and TooltipProvider
 * so the viewer can use settings (font size, scroll) without
 * the full app context.
 */
export default function SharedProjectViewer({ projectId }) {
  return (
    <SettingsProvider>
      <TooltipProvider>
        <SharedProjectViewerInner projectId={projectId} />
      </TooltipProvider>
    </SettingsProvider>
  );
}
