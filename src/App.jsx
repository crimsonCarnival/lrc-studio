import { lazy, Suspense, useEffect, useCallback, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Player from './components/Player';
import { SettingsProvider } from './contexts/SettingsContext';
import { SkeletonList, SkeletonEditor, SkeletonPreview, SkeletonSetup, SkeletonPlayer } from './components/ui/skeleton';

const Editor = lazy(() => import('./components/Editor'));
const Preview = lazy(() => import('./components/Preview'));
const Library = lazy(() => import('./components/Library/Library'));
const UploadsLibrary = lazy(() => import('./components/Library/UploadsLibrary'));
const UploadDetailView = lazy(() => import('./components/Library/UploadDetailView'));
const SetupScreen = lazy(() => import('./components/Setup/SetupScreen'));
const Home = lazy(() => import('./components/Home/Home'));
import ProjectSetupModal from './components/Setup/ProjectSetupModal';
import { useAppState } from './hooks/useAppState';
import { useSettings } from './contexts/useSettings';
import { useAuthContext } from './contexts/useAuthContext';
import { matchKey } from './utils/keyboard';
import { Kbd } from './components/shared/Kbd';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverItem,
  PopoverTrigger,
} from './components/ui/popover';
import { Tip } from './components/ui/tip';
import { Music2, UploadCloud, Globe, Settings as SettingsIcon, Eye, EyeOff, Lock, LockOpen, LayoutList, User, LogOut, BookOpen, Pencil, Share2, Loader2, Sun, Moon, Monitor, AlertCircle } from 'lucide-react';
import { useScrollLock } from './hooks/useScrollLock';
import { useNetworkStatus } from './hooks/useNetworkStatus';

const Settings = lazy(() => import('./components/Settings'));
const KeyboardHelp = lazy(() => import('./components/shared/KeyboardHelp'));

function EditorContainer({ loadProject, activeProjectId, children }) {
  const { id } = useParams();

  useEffect(() => {
    if (id && id !== 'new' && id !== 'local' && id !== activeProjectId) {
      loadProject(id);
    }
  }, [id, loadProject, activeProjectId]);

  return children;
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    t,
    i18n,
    lines,
    setLines,
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
    showKeyboardHelp,
    setShowKeyboardHelp,
    showSettings,
    setShowSettings,
    pendingProject,
    editorMode,
    setEditorMode,
    isDraggingFile,
    playerRef,
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
    restoredPosition,
    restoredSpeed,
    confirmModal,
    requestConfirm,
    hasUnsavedChanges,
    isAutosaving,
    exportToUrl,
    isSharedProject,
    sharedReadOnly,
    setSharedReadOnly,
    shareModal,
    setShareModal,
    hasMedia,
    loadProject,
    activeProjectId,
    projectMetadata,
    setProjectMetadata,
    handleCloudinaryUpload,
    isProjectLoading,
  } = useAppState();

  useScrollLock(!!pendingProject);
  useNetworkStatus();

  const { settings, updateSetting, syncFromServer } = useSettings();
  const { user, logout } = useAuthContext();

  // Sync settings from server when user logs in
  useEffect(() => {
    if (user) syncFromServer();
  }, [user, syncFromServer]);
  const rawFocusMode = settings.interface?.focusMode || 'default';
  // Normalize: if old 'preview' mode was saved, fall back to 'default'
  const focusMode = ['default', 'sync', 'playback'].includes(rawFocusMode) ? rawFocusMode : 'default';
  const [hideEditor, setHideEditor] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const isReady = location.pathname.startsWith('/project/') && location.pathname !== '/project/new';

  // SEO Optimization & dynamic title
  useEffect(() => {
    let title = t('app.name') || 'Syncify';
    let description = 'Syncify is a powerful tool to synchronize lyrics with audio tracks and create engaging music videos.';

    if (isReady && mediaTitle) {
      title = `${mediaTitle} - ${t('app.name')}`;
      if (projectMetadata?.description) {
        description = projectMetadata.description;
      } else {
        description = `Editor session for ${mediaTitle}`;
      }
    } else if (location.pathname.startsWith('/uploads')) {
      title = `Uploads - ${t('app.name')}`;
    }

    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }
  }, [location.pathname, mediaTitle, projectMetadata, t]);

  // Root redirect handled by react-router <Navigate>

  // Pause player when navigating away from the project page
  useEffect(() => {
    if (!location.pathname.startsWith('/project/')) {
      playerRef.current?.pause?.();
    }
  }, [location.pathname, playerRef]);

  const [showNamingModal, setShowNamingModal] = useState(false);
  const [pendingSetupData, setPendingSetupData] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState(false);

  const handleSetupComplete = useCallback(({ lines: newLines, editorMode: newMode }) => {
    setPendingSetupData({ lines: newLines, editorMode: newMode });
    setShowNamingModal(true);
  }, []);

  const handleProjectConfirm = useCallback(({ name, description, tags, coverUrl, coverPublicId }) => {
    if (pendingSetupData) {
      setLines(pendingSetupData.lines);
      setEditorMode(pendingSetupData.editorMode);
      setSyncMode(true);
    }
    const newTitle = name || mediaTitle || '';
    const newMetadata = {
      description: description || '',
      tags: tags || [],
      coverUrl: coverUrl || '',
      coverPublicId: coverPublicId || ''
    };

    setMediaTitle(newTitle);
    setProjectMetadata(newMetadata);
    setShowNamingModal(false);
    setPendingSetupData(null);

    triggerImportSave({ title: newTitle, metadata: newMetadata });
    if (!activeProjectId) navigate('/project/local');
  }, [pendingSetupData, setLines, setEditorMode, setSyncMode, mediaTitle, setMediaTitle, setProjectMetadata, navigate, activeProjectId, triggerImportSave]);

  // Reset hideEditor when all lines are removed
  if (lines.length === 0 && hideEditor) {
    setHideEditor(false);
  }

  // Mobile tab state: 'editor' | 'preview'
  const [mobileTab, setMobileTab] = useState('editor');

  const setFocusMode = useCallback((mode) => {
    updateSetting('interface.focusMode', mode);
  }, [updateSetting]);

  // Focus mode keyboard shortcuts (Ctrl+1/2/3, Ctrl+0 = default)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (matchKey(e, settings.shortcuts?.focusSync?.[0] || 'Ctrl+1')) {
        e.preventDefault();
        setFocusMode(focusMode === 'sync' ? 'default' : 'sync');
      } else if (matchKey(e, settings.shortcuts?.focusPreview?.[0] || 'Ctrl+2')) {
        e.preventDefault();
        if (focusMode === 'playback') {
          setFocusMode('default');
          setHideEditor(false);
        } else {
          setHideEditor(h => !h);
        }
      } else if (matchKey(e, settings.shortcuts?.focusPlayback?.[0] || 'Ctrl+3')) {
        e.preventDefault();
        setFocusMode(focusMode === 'playback' ? 'default' : 'playback');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.shortcuts, focusMode, setFocusMode]);

  // Grid column classes per focus mode
  const editorColClass = ({
    default: 'lg:col-span-7',
    sync: 'lg:col-span-8',
    playback: 'hidden',
  }[focusMode]) || 'lg:col-span-7';

  const previewColClass = (hideEditor || focusMode === 'playback')
    ? 'lg:col-span-12'
    : ({ default: 'lg:col-span-5', sync: 'lg:col-span-4' }[focusMode] || 'lg:col-span-5');

  const showEditor = focusMode !== 'playback' && !hideEditor;
  const showPreview = true; // always visible

  return (
    <div className="min-h-screen lg:h-screen bg-zinc-950 relative overflow-x-hidden flex flex-col">
      {/* Background gradient blobs and noise texture */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl" />
      </div>

      {isDraggingFile && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none transition-all">
          <div className="flex flex-col items-center gap-4 text-primary animate-bounce">
            <UploadCloud className="w-20 h-20" />
            <h2 className="text-3xl font-bold tracking-tight text-center px-4">{t('player.dropAudio') || 'Drop your audio or lyrics file here'}</h2>
          </div>
        </div>
      )}

      {/* Logo and Header */}
      <header className="relative z-sticky flex flex-row items-center justify-between gap-2 w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-5 animate-fade-in">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
          <button
            onClick={() => {
              if (hasUnsavedChanges()) {
                setShowUnsavedModal(true);
              } else {
                navigate('/home');
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Music2 className="w-4 sm:w-5 h-4 sm:h-5 text-white" strokeWidth={2} />
          </button>
          <div className="overflow-hidden flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                if (hasUnsavedChanges()) {
                  setShowUnsavedModal(true);
                } else {
                  navigate('/home');
                }
              }}
              className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight truncate shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              {t('app.name')}
            </button>
            {isReady && (
              <>
                <span className="text-zinc-600 shrink-0">/</span>
                {projectMetadata?.coverUrl && (
                  <img
                    src={projectMetadata.coverUrl}
                    alt="Cover"
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded object-cover border border-zinc-700 shrink-0"
                  />
                )}
                {editingProjectName ? (
                  <Input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    onBlur={() => {
                      setEditingProjectName(false);
                      triggerImportSave({ title: mediaTitle });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingProjectName(false);
                        triggerImportSave({ title: mediaTitle });
                      } else if (e.key === 'Escape') {
                        setEditingProjectName(false);
                      }
                    }}
                    autoFocus
                    maxLength={200}
                    className="h-7 text-sm bg-zinc-800/60 border-zinc-700/60 text-zinc-200 min-w-[100px] max-w-[200px]"
                  />
                ) : (
                  <button
                    onClick={() => setEditingProjectName(true)}
                    className="flex items-center gap-1 min-w-0 group"
                  >
                    <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 truncate transition-colors">
                      {mediaTitle || t('setup.projectNamePlaceholder')}
                    </span>
                    <Pencil className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Hide Editor Toggle — desktop only, hidden during setup */}
          {isReady && (
            <Tip content={`${t('app.hideEditor')} (Ctrl+2)`}>
              <Button
                variant="outline"
                aria-label={t('app.hideEditor')}
                onClick={() => {
                  if (focusMode === 'playback') {
                    setFocusMode('default');
                    setHideEditor(false);
                  } else {
                    setHideEditor(h => !h);
                  }
                }}
                className={`${lines.length === 0 ? '!hidden' : 'hidden lg:flex'} px-2 py-1.5 h-auto text-[10px] font-bold border rounded-lg gap-1 flex-shrink-0 transition-colors ${(hideEditor || focusMode === 'playback')
                  ? 'bg-primary text-zinc-950 border-primary hover:bg-primary/90 hover:text-zinc-950'
                  : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                  }`}
              >
                {(hideEditor || focusMode === 'playback') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </Tip>
          )}

          {/* Library button */}
          <Tip content={t('library.title')}>
            <Button
              variant="outline"
              aria-label={t('library.title')}
              onClick={() => {
                if (location.pathname.startsWith('/library')) {
                  navigate(activeProjectId ? `/project/${activeProjectId}` : '/project/new');
                } else {
                  navigate('/library');
                }
              }}
              className={`px-2 sm:px-3 h-8 sm:h-9 rounded-lg sm:rounded-xl flex-shrink-0 transition-colors ${location.pathname.startsWith('/library')
                ? 'bg-primary text-zinc-950 border-primary hover:bg-primary/90 hover:text-zinc-950'
                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
            >
              <BookOpen className="w-4 sm:w-[18px] h-4 sm:h-[18px]" strokeWidth={1.8} />
            </Button>
          </Tip>


          {/* Uploads button — always visible so users can manage files before/during setup */}
          <Tip content={t('uploads.title')}>
            <Button
              variant="outline"
              aria-label={t('uploads.title')}
              onClick={() => {
                if (location.pathname.startsWith('/uploads')) {
                  navigate(activeProjectId ? `/project/${activeProjectId}` : '/project/new');
                } else {
                  navigate('/uploads');
                }
              }}
              className={`px-2 sm:px-3 h-8 sm:h-9 rounded-lg sm:rounded-xl flex-shrink-0 transition-colors ${location.pathname.startsWith('/uploads')
                ? 'bg-primary text-zinc-950 border-primary hover:bg-primary/90 hover:text-zinc-950'
                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
            >
              <UploadCloud className="w-4 sm:w-[18px] h-4 sm:h-[18px]" strokeWidth={1.8} />
            </Button>
          </Tip>

          {/* Language Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 h-8 sm:h-9 bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 rounded-lg sm:rounded-xl text-zinc-200 flex-shrink-0"
              >
                <Globe className="w-4 h-4 text-zinc-400" strokeWidth={2} />
                <span className="text-xs font-semibold uppercase">{i18n.resolvedLanguage?.split('-')[0] || 'en'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-28" align="end">
              {[
                { code: 'en', label: 'EN' },
                { code: 'es', label: 'ES' }
              ].map(lang => (
                <PopoverItem
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  className={`font-semibold text-center justify-center ${(i18n.resolvedLanguage?.split('-')[0] === lang.code)
                    ? 'bg-primary/15 text-primary hover:bg-primary/20'
                    : ''
                    }`}
                >
                  {lang.label}
                </PopoverItem>
              ))}
            </PopoverContent>
          </Popover>

          {/* Theme Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center justify-center px-2.5 sm:px-3 h-8 sm:h-9 bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 rounded-lg sm:rounded-xl text-zinc-200 flex-shrink-0"
                aria-label={t('settings.interface.theme') || 'Theme'}
              >
                {settings.interface.theme === 'light' ? (
                  <Sun className="w-4 h-4 text-zinc-400" strokeWidth={2} />
                ) : settings.interface.theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-zinc-400" strokeWidth={2} />
                ) : (
                  <Monitor className="w-4 h-4 text-zinc-400" strokeWidth={2} />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32" align="end">
              {[
                { code: 'light', label: t('settings.options.themes.light') || 'Light', icon: Sun },
                { code: 'dark', label: t('settings.options.themes.dark') || 'Dark', icon: Moon },
                { code: 'system', label: t('settings.options.themes.system') || 'System', icon: Monitor }
              ].map(th => {
                const Icon = th.icon;
                return (
                  <PopoverItem
                    key={th.code}
                    onClick={() => updateSetting('interface.theme', th.code)}
                    className={`font-semibold ${(settings.interface.theme === th.code)
                      ? 'bg-primary/15 text-primary hover:bg-primary/20'
                      : ''
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5 mr-2" />
                    {th.label}
                  </PopoverItem>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Auth button / User menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 h-8 sm:h-9 bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 rounded-lg sm:rounded-xl text-zinc-200 flex-shrink-0"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user?.username || user?.email}
                    className="w-5 h-5 rounded-full object-cover border border-zinc-600"
                  />
                ) : (
                  <User className="w-4 h-4 text-zinc-400" strokeWidth={2} />
                )}
                <span className="text-xs font-semibold truncate max-w-[80px] hidden sm:inline">{user?.username || user?.email}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40" align="end">
              <div className="px-2 py-1.5 text-xs text-zinc-400 truncate">{t('auth.loggedInAs', { name: user?.username || user?.email })}</div>
              <PopoverItem onClick={logout} className="text-red-400 hover:text-red-300">
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                {t('auth.logout')}
              </PopoverItem>
            </PopoverContent>
          </Popover>

          {/* Settings button */}
          <Tip content={t('settings.title')}>
            <Button
              variant="outline"
              onClick={() => setShowSettings(true)}
              aria-label={t('settings.title')}
              className="px-2 sm:px-3 h-8 sm:h-9 bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg sm:rounded-xl flex-shrink-0"
            >
              <SettingsIcon className="w-4 sm:w-[18px] h-4 sm:h-[18px]" strokeWidth={1.8} />
            </Button>
          </Tip>

          {/* Help button */}
          <Tip content={t('shortcuts.title') || 'Shortcuts'}>
            <Button
              variant="outline"
              onClick={() => setShowKeyboardHelp(prev => !prev)}
              aria-label={t('shortcuts.title') || 'Shortcuts'}
              className="px-2 sm:px-3 h-8 sm:h-9 bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-lg sm:rounded-xl flex-shrink-0"
            >
              <Kbd>?</Kbd>
            </Button>
          </Tip>


        </div>
      </header>

      <div className={`relative z-base max-w-7xl mx-auto w-full flex-1 min-h-0 px-2 sm:px-4 lg:px-6 lg:pb-4 flex flex-col ${isReady ? 'max-lg:pb-[144px]' : ''}`}>
        <Routes>
          <Route path="uploads" element={
            <Suspense fallback={
              <div className="glass rounded-xl sm:rounded-2xl p-5 flex-1">
                <SkeletonList count={3} />
              </div>
            }>
              <UploadsLibrary
                onSelect={(upload) => navigate(`/uploads/${upload.id}`)}
                onBack={() => navigate('/project/new')}
              />
            </Suspense>
          } />
          <Route path="uploads/:id" element={
            <Suspense fallback={
              <div className="glass rounded-xl sm:rounded-2xl p-5 flex-1">
                <SkeletonList count={3} />
              </div>
            }>
              <UploadDetailView onBack={() => navigate('/uploads')} />
            </Suspense>
          } />
          <Route path="project/new" element={
            <Suspense fallback={<SkeletonSetup />}>
              <SetupScreen
                onComplete={handleSetupComplete}
                playerRef={playerRef}
                onShowAllUploads={() => navigate('/uploads')}
                onOpenSettings={() => setShowSettings(true)}
              />
            </Suspense>
          } />
          <Route path="library" element={
            <Suspense fallback={
              <div className="glass rounded-xl sm:rounded-2xl p-5 flex-1">
                <SkeletonList count={3} />
              </div>
            }>
              <Library
                onOpenProject={(projectId) => {
                  loadProject(projectId);
                  navigate(`/project/${projectId}`);
                }}
                onBack={() => navigate('/project/new')}
              />
            </Suspense>
          } />
          <Route path="project/:id" element={
            <EditorContainer loadProject={loadProject} activeProjectId={activeProjectId}>
              {isProjectLoading ? (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:gap-4 min-h-0 overflow-visible transition-all duration-300">
                  <div className={`${editorColClass} flex flex-col gap-2 sm:gap-3 lg:gap-4 min-h-0 max-lg:h-full`}>
                    <SkeletonEditor />
                  </div>
                  <div className={`${previewColClass} flex flex-col min-h-0 max-lg:h-full`}>
                    <SkeletonPreview />
                  </div>
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:gap-4 min-h-0 overflow-visible transition-all duration-300">
                  {/* Left: Editor */}
                  {showEditor && (
                    <div className={`${editorColClass} relative flex flex-col gap-2 sm:gap-3 lg:gap-4 min-h-0 max-lg:h-full transition-all duration-300 ${mobileTab !== 'editor' ? 'max-lg:hidden' : ''}`}>
                      {isSharedProject && sharedReadOnly && (
                        <div className="absolute inset-0 z-raised rounded-xl sm:rounded-2xl backdrop-blur-[3px] bg-zinc-950/60 flex flex-col items-center justify-center gap-3">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-lg">
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-semibold text-zinc-100">{t('project.readOnly')}</span>
                          </div>
                          <p className="text-xs text-zinc-400 text-center px-8 max-w-xs">{t('project.readOnlyDesc')}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSharedReadOnly(false)}
                            className="mt-1 bg-zinc-800 border-zinc-600 text-zinc-100 hover:bg-zinc-700 gap-1.5 text-xs font-semibold"
                          >
                            <LockOpen className="w-3.5 h-3.5" />
                            {t('project.editCopy')}
                          </Button>
                        </div>
                      )}
                      <div className="flex-1 min-h-0 flex flex-col">
                        <Suspense fallback={<SkeletonEditor />}>
                          <Editor
                            lines={lines}
                            setLines={setLines}
                            syncMode={syncMode}
                            setSyncMode={setSyncMode}
                            activeLineIndex={activeLineIndex}
                            setActiveLineIndex={setActiveLineIndex}
                            playbackPosition={playbackPosition}
                            playerRef={playerRef}
                            undo={undo}
                            redo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            editorMode={editorMode}
                            setEditorMode={setEditorMode}
                            duration={duration}
                            onImport={triggerImportSave}
                            handleManualSave={handleManualSave}
                            handleRemoveAllLyrics={handleRemoveAllLyrics}
                            isAutosaving={isAutosaving}
                            compact={false}
                          />
                        </Suspense>
                      </div>
                    </div>
                  )}

                  {/* Right: Preview */}
                  {showPreview && (
                    <div className={`flex ${previewColClass} min-h-0 flex-col max-lg:h-full max-lg:mt-0 lg:mt-0 transition-all duration-300 ${mobileTab !== 'preview' ? 'max-lg:hidden' : ''}`}>
                      <Suspense fallback={<SkeletonPreview />}>
                        <Preview
                          lines={lines}
                          setLines={setLines}
                          playbackPosition={playbackPosition}
                          mediaTitle={mediaTitle}
                          playerRef={playerRef}
                          duration={duration}
                          editorMode={editorMode}
                          exportToUrl={exportToUrl}
                          isSharedProject={isSharedProject}
                          sharedReadOnly={sharedReadOnly}
                          setSharedReadOnly={setSharedReadOnly}
                          shareModal={shareModal}
                          setShareModal={setShareModal}
                          hasMedia={hasMedia}
                          activeProjectId={activeProjectId}
                          project={pendingProject || null}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}
            </EditorContainer>
          } />
          <Route path="home" element={
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            }>
              <Home />
            </Suspense>
          } />
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

      {/* ── Player (one instance) ──
          Desktop: docked bottom bar.
          Mobile:  fixed compact bar above the tab bar — compact layout
                   shows seekbar + finger-friendly action row.
          Hidden during setup phase but kept mounted for playerRef. ── */}
      <div className={`lg:relative lg:z-raised lg:w-full lg:mt-1 lg:border-t lg:border-zinc-700/50 lg:bg-zinc-900/80 lg:backdrop-blur-md lg:shadow-[0_-4px_24px_rgba(0,0,0,0.3)] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:z-player ${!isReady ? 'hidden' : ''}`}>
        <div className="max-w-7xl mx-auto max-lg:p-0 lg:px-6 lg:py-3">
          {isProjectLoading && isReady ? (
            <SkeletonPlayer />
          ) : (
            <Player
              ref={playerRef}
              mediaTitle={mediaTitle}
              onTitleChange={(newTitle) => {
                // Only auto-update the project title from media metadata if:
                // 1. We are in the initial setup screen
                // 2. The current title is empty or "Untitled"
                const isSetupPhase = location.pathname === '/project/new';
                if (isSetupPhase || !mediaTitle || mediaTitle === t('library.untitled') || mediaTitle === 'Untitled') {
                  setMediaTitle(newTitle);
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onMediaChange={handleMediaChange}
              onYtUrlChange={handleYtUrlChange}
              onCloudinaryUpload={handleCloudinaryUpload}
              initialYtUrl={restoredYtUrl}
              initialSeek={restoredPosition}
              initialSpeed={restoredSpeed}
              lines={lines}
              playbackPosition={playbackPosition}
              syncMode={syncMode}
            />
          )}
        </div>
      </div>

      {/* ── Mobile: Bottom tab bar ── */}
      {isReady && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-nav h-14 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-700/50 flex items-stretch pb-safe">
          {[
            { id: 'editor', label: t('app.tab.editor', 'Editor'), Icon: LayoutList },
            { id: 'preview', label: t('app.tab.preview', 'Preview'), Icon: Eye },
            { id: 'library', label: t('library.title'), Icon: BookOpen },
            { id: 'uploads', label: t('uploads.title'), Icon: UploadCloud },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'library') {
                  navigate('/library');
                } else if (id === 'uploads') {
                  navigate('/uploads');
                } else {
                  if (!location.pathname.startsWith('/project/')) {
                    navigate(activeProjectId ? `/project/${activeProjectId}` : '/project/new');
                  }
                  setMobileTab(id);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${(id === 'library' ? location.pathname.startsWith('/library') : id === 'uploads' ? location.pathname.startsWith('/uploads') : (location.pathname.startsWith('/project/') && mobileTab === id))
                ? 'text-primary'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
              aria-label={label}
              aria-current={mobileTab === id ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" strokeWidth={mobileTab === id ? 2.5 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      <Suspense fallback={null}>
        {showKeyboardHelp && <KeyboardHelp isOpen={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />}
      </Suspense>
      <Suspense fallback={null}>
        {showSettings && <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} onManualSave={handleManualSave} />}
      </Suspense>

      {/* Project Setup Modal */}
      <ProjectSetupModal
        isOpen={showNamingModal}
        onClose={() => setShowNamingModal(false)}
        onConfirm={handleProjectConfirm}
        initialName={mediaTitle}
        initialDescription={projectMetadata?.description}
        initialTags={projectMetadata?.tags}
        initialCoverUrl={projectMetadata?.coverUrl}
        initialCoverPublicId={projectMetadata?.coverPublicId}
      />


      {/* Project Restore Modal */}
      {pendingProject && (
        <div className="fixed inset-0 z-popover flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDiscardProject} />
          <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-elevated animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-zinc-100">{t('project.restoreTitle')}</h3>
            </div>
            {pendingProject.isUrlProject && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl">
                <Share2 className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={2} />
                <span className="text-xs text-primary font-medium">{t('project.sharedProject') || 'Shared project from link'}</span>
              </div>
            )}
            <p className="text-sm text-zinc-400 mb-2 leading-relaxed">{t('project.restoreMessage')}</p>
            <p className="text-xs text-zinc-500 mb-5">
              {pendingProject.lines?.length || 0} {t('project.restoreLines')}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDiscardProject}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 font-semibold text-sm rounded-xl h-10"
              >
                {t('project.discard')}
              </Button>
              <Button
                onClick={handleRestoreProject}
                className="flex-1 bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10"
              >
                {t('project.restore')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUnsavedModal(false)} />
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 animate-scale-in flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400 mb-2">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-zinc-100">{t('app.unsavedChangesTitle')}</h3>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {t('app.unsavedChangesMessage')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Button
                variant="outline"
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 font-semibold text-sm h-10 rounded-xl"
                onClick={() => setShowUnsavedModal(false)}
              >
                {t('app.cancel')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-zinc-800 hover:bg-red-500/20 text-red-400 border-zinc-700 hover:border-red-500/30 font-semibold text-sm h-10 rounded-xl"
                onClick={() => {
                  setShowUnsavedModal(false);
                  navigate('/home');
                }}
              >
                {t('app.discard')}
              </Button>
              <Button
                className="flex-1 bg-primary text-zinc-950 hover:bg-primary-dim font-semibold text-sm h-10 rounded-xl"
                onClick={async () => {
                  setShowUnsavedModal(false);
                  await handleManualSave();
                  navigate('/home');
                }}
              >
                {t('app.saveAndExit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal}

      {/* Autosave indicator */}
      {isAutosaving && (
        <div className="fixed bottom-4 right-4 z-sticky flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-lg animate-fade-in">
          <svg className="w-3.5 h-3.5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}
