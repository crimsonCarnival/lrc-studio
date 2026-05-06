import {
  Suspense, lazy, useEffect, useState, useRef, useCallback, Fragment
} from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SkeletonList, SkeletonEditor, SkeletonPreview, SkeletonSetup } from '@ui/skeleton';
import { Loader2, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';

const Editor = lazy(() => import('@features/editor/components/Editor'));
const Preview = lazy(() => import('@features/preview/Preview'));
const Library = lazy(() => import('@features/projects/Library'));
const UploadsLibrary = lazy(() => import('@features/projects/UploadsLibrary'));
const UploadDetailView = lazy(() => import('@features/projects/UploadDetailView'));
const SetupScreen = lazy(() => import('@features/editor/components/SetupScreen'));
const Home = lazy(() => import('@features/projects/Home'));
const AdminDashboard = lazy(() => import('@features/admin/AdminDashboard'));
const ProfilePage = lazy(() => import('@features/profile/ProfilePage'));

function EditorContainer({ loadProject, activeProjectId, children }) {
  const { id } = useParams();

  useEffect(() => {
    if (id && id !== 'new' && id !== 'local' && id !== activeProjectId) {
      loadProject(id);
    }
  }, [id, activeProjectId, loadProject]);

  return children;
}

export function AppRouter({
  appState,
  layoutState,
  navigate
}) {
  const {
    loadProject,
    activeProjectId,
    isProjectLoading,
    lines,
    setLines,
    syncMode,
    setSyncMode,
    activeLineIndex,
    setActiveLineIndex,
    playbackPosition,
    playerRef,
    undo,
    redo,
    canUndo,
    canRedo,
    editorMode,
    setEditorMode,
    duration,
    triggerImportSave,
    handleManualSave,
    handleRemoveAllLyrics,
    isAutosaving,
    isSaving,
    registerAfterSave,
    mediaTitle,
    exportToUrl,
    isSharedProject,
    sharedReadOnly,
    setSharedReadOnly,
    shareModal,
    setShareModal,
    hasMedia,
    isPlaying,
    playbackSpeed,
    pendingProject,
    projectMetadata,
    handleSetupComplete,
    setShowSettings,
    setShowKeyboardHelp,
  } = appState;

  const { editorColClass, previewColClass, showEditor, showPreview, mobileTab, layoutSwap, setLayoutSwap, editorWidth, setEditorWidth, lockLayout, focusMode } = layoutState;
  const [draggingItem, setDraggingItem] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringDivider, setIsHoveringDivider] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleWinResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  // Reorder logic
  const items = layoutSwap ? ['preview', 'editor'] : ['editor', 'preview'];
  const handleReorder = (newOrder) => {
    const isSwapped = newOrder[0] === 'preview';
    if (isSwapped !== layoutSwap) setLayoutSwap(isSwapped);
  };

  const borderClass = (item) => {
    if (draggingItem === item) return 'border-dashed border-primary/40 shadow-2xl scale-[1.01] z-50';
    if (isResizing || isHoveringDivider) return 'border-primary/40 shadow-xl';
    
    // Apply active glow based on focusMode
    const isFocused = (item === 'editor' && focusMode === 'sync') || 
                      (item === 'preview' && focusMode === 'playback');
                      
    if (isFocused && !lockLayout) {
      return 'border-primary/40 shadow-[0_0_20px_rgba(29,185,84,0.15)] ring-1 ring-primary/20 transition-all duration-300';
    }
    
    return 'border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-300';
  };

  const handleResize = useCallback((e) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Convert pixel constraints to percentages based on current container width
    const minEditorPct = (620 / containerRect.width) * 100; // Safe width for editor tools
    const maxEditorPct = 100 - ((300 / containerRect.width) * 100); // Preview safe width

    const targetEditorWidth = layoutSwap ? 100 - newWidth : newWidth;

    // Priority: ensure editor gets its minimum width even if window is small
    const safeMaxPct = Math.max(minEditorPct, maxEditorPct);
    const clampedEditorWidth = Math.max(minEditorPct, Math.min(safeMaxPct, targetEditorWidth));

    setEditorWidth(clampedEditorWidth);
  }, [layoutSwap, setEditorWidth]);

  const startResizing = useCallback(() => {
    if (!isDesktop || lockLayout) return;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleResize);
    }, { once: true });
  }, [handleResize, isDesktop, lockLayout]);

  return (
    <Routes>
      <Route path="uploads" element={
        <Suspense fallback={<div className="glass rounded-xl p-5 flex-1"><SkeletonList count={3} /></div>}>
          <UploadsLibrary onSelect={(upload) => navigate(`/uploads/${upload.id}`)} onBack={() => navigate(-1)} />
        </Suspense>
      } />
      <Route path="uploads/:id" element={
        <Suspense fallback={<div className="glass rounded-xl p-5 flex-1"><SkeletonList count={3} /></div>}>
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
        <Suspense fallback={<div className="glass rounded-xl p-5 flex-1"><SkeletonList count={3} /></div>}>
          <Library
            onOpenProject={(projectId) => {
              loadProject(projectId);
              navigate(`/project/${projectId}`);
            }}
            onBack={() => navigate(-1)}
          />
        </Suspense>
      } />
      <Route path="admin" element={
        <Suspense fallback={<SkeletonList count={3} />}>
          <AdminDashboard />
        </Suspense>
      } />
      <Route path="project/:id" element={
        <EditorContainer loadProject={loadProject} activeProjectId={activeProjectId}>
          {isProjectLoading ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className={`${editorColClass} flex flex-col gap-4`}><SkeletonEditor /></div>
              <div className={`${previewColClass} flex flex-col`}><SkeletonPreview /></div>
            </div>
          ) : (
            <div ref={containerRef} className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden max-lg:pb-4">
              <Reorder.Group
                axis="x"
                values={items}
                onReorder={handleReorder}
                className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 pt-0 px-0 pb-0 w-full"
              >
                {items.map((item, index) => {
                  const isEditor = item === 'editor';
                  const isVisible = isEditor ? showEditor : showPreview;
                  if (!isVisible) return null;

                  // On desktop, we use the custom width and enforce hard pixel minimums. On mobile, it's always full width and full height.
                  const widthStyle = isDesktop ? {
                    flex: `0 0 ${isEditor ? editorWidth : (100 - editorWidth)}%`,
                    minWidth: isEditor ? '620px' : '300px'
                  } : {
                    flex: '1 1 auto'
                  };

                  // To have a gap of px-6 (24px) between items on desktop, we give each item px-3 (12px)
                  const itemPaddingClass = isDesktop && items.length > 1
                    ? (index === 0 ? 'pr-3' : 'pl-3')
                    : '';

                  return (
                    <Fragment key={item}>
                      <div className={`flex items-stretch min-h-0 min-w-0 ${itemPaddingClass}`} style={widthStyle}>
                        <Reorder.Item
                          value={item}
                          layout={isResizing ? false : "position"}
                          dragListener={isDesktop && !lockLayout}
                          whileDrag={{ scale: 1.01, zIndex: 50, boxShadow: "0px 20px 40px rgba(0,0,0,0.4)", opacity: 0.8 }}
                          className={`flex-1 flex flex-col min-h-0 ${isEditor ? 'gap-4' : ''} ${mobileTab !== item ? 'max-lg:hidden' : ''} relative group/reorder lg:border-2 lg:rounded-2xl border-0 rounded-none ${borderClass(item)} transition-colors duration-200 overflow-hidden lg:bg-zinc-900/50 lg:backdrop-blur-sm bg-zinc-950`}
                          onDragStart={() => setDraggingItem(item)}
                          onDragEnd={() => setDraggingItem(null)}
                        >
                          {/* Drag Handle - Hidden visually but functional */}
                          <div className={`absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 transition-all duration-300 z-50 cursor-grab active:cursor-grabbing bg-zinc-800 backdrop-blur-xl border border-zinc-600/50 rounded-xl p-2 shadow-2xl pointer-events-auto max-lg:hidden hover:scale-110 hover:border-primary/50 group/handle ${draggingItem === item || lockLayout ? 'hidden' : ''}`}>
                            <GripVertical className="w-5 h-5 text-zinc-400 group-hover/handle:text-primary transition-colors" />
                          </div>

                          <Suspense fallback={isEditor ? <SkeletonEditor /> : <SkeletonPreview />}>
                            {isEditor ? (
                              <Editor
                                lines={lines} setLines={setLines} syncMode={syncMode} setSyncMode={setSyncMode}
                                activeLineIndex={activeLineIndex} setActiveLineIndex={setActiveLineIndex}
                                playbackPosition={playbackPosition} playerRef={playerRef}
                                undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
                                editorMode={editorMode} setEditorMode={setEditorMode} duration={duration}
                                onImport={triggerImportSave} handleManualSave={handleManualSave}
                                handleRemoveAllLyrics={handleRemoveAllLyrics} isAutosaving={isAutosaving}
                                isSaving={isSaving}
                                onNewProject={() => navigate('/project/new')}
                                onShowKeyboardHelp={setShowKeyboardHelp ? () => setShowKeyboardHelp(p => !p) : undefined}
                                registerAfterSave={registerAfterSave}
                              />
                            ) : (
                              <Preview
                                lines={lines} setLines={setLines} playbackPosition={playbackPosition}
                                mediaTitle={mediaTitle} playerRef={playerRef} duration={duration}
                                editorMode={editorMode} exportToUrl={exportToUrl} isSharedProject={isSharedProject}
                                sharedReadOnly={sharedReadOnly} setSharedReadOnly={setSharedReadOnly}
                                shareModal={shareModal} setShareModal={setShareModal} hasMedia={hasMedia}
                                isPlaying={isPlaying} playbackSpeed={playbackSpeed} activeProjectId={activeProjectId}
                                project={pendingProject} projectMetadata={projectMetadata}
                              />
                            )}
                          </Suspense>
                        </Reorder.Item>
                      </div>

                      {/* Resize Handle (exactly between items) */}
                      {isDesktop && !lockLayout && index === 0 && items.length > 1 && (
                        <div
                          onMouseDown={startResizing}
                          onMouseEnter={() => setIsHoveringDivider(true)}
                          onMouseLeave={() => setIsHoveringDivider(false)}
                          className="w-0 relative cursor-col-resize self-stretch flex items-center justify-center z-[100] group/resizer"
                        >
                          {/* Invisible hit area perfectly centered in the gap */}
                          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-full">
                            <div className={`w-1 h-32 rounded-full transition-all duration-300 ${isResizing ? 'bg-primary scale-y-110 shadow-[0_0_15px_rgba(29,185,84,0.5)]' : isHoveringDivider ? 'bg-zinc-500 scale-y-105' : 'bg-zinc-800/50'}`} />
                          </div>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </Reorder.Group>
            </div>
          )}
        </EditorContainer>
      } />
      <Route path="home" element={
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
          <Home />
        </Suspense>
      } />
      <Route path="profile" element={
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
          <ProfilePage />
        </Suspense>
      } />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
