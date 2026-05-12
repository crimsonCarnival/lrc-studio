import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@ui/tooltip';
import { Spinner } from '@ui/skeleton';
import { Button } from '@ui/button';
import { projects } from '@/api';
import Player from '@features/player/Player';
import Preview from '@features/preview/Preview';
import SharedProjectError from './SharedProjectError';
import { LogIn, UserPlus, Music2, Copy, Check, ExternalLink } from 'lucide-react';
import { Tip } from '@ui/tip';
import { useAuthContext } from '@/contexts/useAuthContext';
import { AppHeader } from '@/app/layout/AppHeader';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * Full-page, unauthenticated shared-project viewer.
 * Rendered when pathname matches /share/:id — no auth required.
 *
 * Layout: Preview (flex-1) → Player bar → Login CTA banner
 * Player is in viewerMode: only seek/play controls, no upload/load actions.
 */
function SharedProjectViewerInner({ projectId }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const getStartTime = () => {
    const s = searchParams.get('s') || searchParams.get('t');
    if (s) return parseInt(s);
    // Fallback for malformed URLs (e.g., ?readonly=1?s=55)
    const match = window.location.search.match(/[?&][st]=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  const startTime = getStartTime();
  const [hasMedia, setHasMedia] = useState(false);
  const { user, logout, loading } = useAuthContext();

  // Clear query params after initial parse to prevent "reload to seek" tricks
  useEffect(() => {
    if (window.location.search.includes('s=') || window.location.search.includes('t=')) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.delete('s');
      newUrl.searchParams.delete('t');
      window.history.replaceState(null, '', newUrl.toString());
    }
  }, []);

  // ── Minimal state ──
  const [lines, setLines] = useState([]);
  const [editorMode, setEditorMode] = useState('lrc');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [mediaTitle, setMediaTitle] = useState('');
  const [initialYtUrl, setInitialYtUrl] = useState('');
  const [initialCloudinaryUpload, setInitialCloudinaryUpload] = useState(null);

  // ── Fetch state ──
  const [loadStatus, setLoadStatus] = useState('loading'); // 'loading' | 'ok' | 403 | 404
  const [projectData, setProjectData] = useState(null);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef(null);

  usePageTitle(mediaTitle);

  // ── Load project on mount ──
  useEffect(() => {
    let cancelled = false;
    projects.getShare(projectId)
      .then((result) => {
        if (cancelled) return;
        const project = result?.project;
        console.log('[SharedProjectViewer] getShare result:', result);
        console.log('[SharedProjectViewer] project.upload:', project?.upload);
        console.log('[SharedProjectViewer] project.uploadId:', project?.uploadId);
        if (!project) {
          setLoadStatus(404);
          return;
        }
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
        setMediaTitle(project.upload?.title || project.title || '');
        setProjectData(project);
        if (project.upload?.source === 'youtube' && project.upload?.youtubeUrl) {
          setInitialYtUrl(project.upload.youtubeUrl);
        } else if (project.upload) {
          // Handle cloudinary and spotify via initialCloudinaryUpload
          // Player checks upload.source to determine how to play
          setInitialCloudinaryUpload(project.upload);
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

  // ── Clone project handler ──
  const handleClone = useCallback(() => {
    window.location.href = `/project/fork/${projectId}`;
  }, [projectId]);

  useEffect(() => {
    if (loading) return;
    
    if (searchParams.get('clone') === '1') {
      handleClone();
    }
  }, [loading, searchParams, handleClone]);

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
    <div className={`min-h-screen lg:h-screen bg-zinc-950 relative overflow-x-hidden flex flex-col ${user ? 'pt-[60px] sm:pt-[72px] lg:pt-[88px]' : ''}`}>
      {user && (
        <AppHeader
          user={user}
          logout={logout}
          isReady={true}
          lines={lines}
          mediaTitle={mediaTitle}
          setMediaTitle={() => {}}
          triggerImportSave={() => {}}
          hasUnsavedChanges={() => false}
          activeProjectId={projectId}
          setShowSettings={() => {}}
          setShowKeyboardHelp={() => {}}
          focusMode="default"
          setFocusMode={() => {}}
          hideEditor={false}
          setHideEditor={() => {}}
          setUnsavedModalTarget={() => {}}
        />
      )}
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl" />
      </div>

      {/* ── Preview (flex-1) ── */}
      <div className="relative z-base flex-1 min-h-0 px-2 sm:px-4 lg:px-6 py-4 lg:pb-0 flex flex-col">
        {/* Project Metadata Section */}
        <div className="px-2 mb-6 animate-fade-in flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight leading-tight">
                {projectData?.title || t('library.untitled')}
              </h1>
              {/* Author info inline */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800/80 text-[10px] sm:text-xs font-medium text-zinc-400 shrink-0">
                <Music2 className="w-3.5 h-3.5 text-primary" />
                <span>{t('share.by')} <span className="text-zinc-200">{projectData?.user?.username || t('share.guest')}</span></span>
                {projectData?.createdAt && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-zinc-700 mx-1" />
                    <span>{new Date(projectData.createdAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
              {projectData?.forkedFrom && (
                <Tip content={projectData.forkedFrom.username ? t('share.forkedFrom', { username: projectData.forkedFrom.username, defaultValue: `Forked from {{username}}` }) : t('share.forkedProject', 'Forked project')}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-[10px] sm:text-xs font-bold text-accent-blue uppercase shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    <span>{t('share.forkedBadge', 'Forked')}</span>
                  </div>
                </Tip>
              )}
            </div>
            {/* Description */}
            <p className="text-sm sm:text-base text-zinc-400 max-w-3xl leading-relaxed">
              {projectData?.metadata?.description || t('share.noDescription')}
            </p>
          </div>

          {/* Tags on the right */}
          <div className="flex flex-wrap gap-2 sm:justify-end sm:max-w-[40%]">
            {projectData?.metadata?.tags?.length > 0 ? (
              projectData.metadata.tags.map((tag, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[10px] sm:text-xs text-zinc-300 font-medium tracking-wide">
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-600 italic">{t('share.noTags')}</span>
            )}
          </div>
        </div>

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
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
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
            onPlayingChange={setIsPlaying}
            onSpeedChange={setPlaybackSpeed}
            onDurationChange={() => { }}
            onMediaChange={handleMediaChange}
            onYtUrlChange={() => { }}
            onTitleChange={setMediaTitle}
            initialYtUrl={initialYtUrl}
            initialCloudinaryUpload={initialCloudinaryUpload}
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
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
              <img 
                src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png" 
                alt="LRC Studio" 
                className="w-full h-full object-contain"
              />
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
              className="h-8 px-3 bg-primary hover:bg-primary-dim text-zinc-950 text-xs font-semibold gap-1.5 rounded-lg disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('share.createCopy', 'Create Copy')}
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
