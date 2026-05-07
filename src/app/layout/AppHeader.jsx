import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Music2, UploadCloud, Settings as SettingsIcon, LogOut, BookOpen, Pencil,
  ShieldAlert, Eye, EyeOff, User, HelpCircle, Lightbulb
} from 'lucide-react';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Popover, PopoverContent, PopoverItem, PopoverTrigger } from '@ui/popover';
import { Tip } from '@ui/tip';
import { Kbd } from '@shared/Kbd';
import { projects, uploads } from '@/api';

/**
 * Full application header: logo/breadcrumb, nav buttons, language/theme/user menus.
 */
export function AppHeader({
  user,
  logout,
  isReady,
  lines,
  mediaTitle,
  setMediaTitle,
  triggerImportSave,
  hasUnsavedChanges,
  activeProjectId,
  setShowSettings,
  setShowKeyboardHelp,
  focusMode,
  setFocusMode,
  hideEditor,
  setHideEditor,
  setUnsavedModalTarget,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [counts, setCounts] = useState({ library: 0, uploads: 0 });

  const fetchCounts = async () => {
    if (!user) return;
    try {
      const [pRes, uRes] = await Promise.all([projects.list(), uploads.listMedia()]);
      setCounts({ library: pRes?.length || 0, uploads: uRes?.length || 0 });
    } catch (err) { console.error('Failed to fetch counts for menu:', err); }
  };

  // ——— Tip Rotation Logic ———
  const [tipIndex, setTipIndex] = useState(0);
  const tips = t('home.tips', { returnObjects: true });
  const hasTips = Array.isArray(tips) && tips.length > 0;

  useEffect(() => {
    if (!hasTips) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 20000); // Rotate every 20s
    return () => clearInterval(interval);
  }, [hasTips, tips.length]);

  const isHomePage = location.pathname === '/home' || location.pathname === '/';

  const goHomeOrWarn = () => {
    if (location.pathname.startsWith('/project/') && hasUnsavedChanges()) {
      setUnsavedModalTarget('/home');
    } else {
      navigate('/home');
    }
  };

  const navTo = (path) => {
    const inProject = location.pathname.startsWith('/project/');
    if (inProject && hasUnsavedChanges()) {
      setUnsavedModalTarget(path);
    } else if (location.pathname.startsWith(path)) {
      navigate(activeProjectId ? `/project/${activeProjectId}` : '/project/new');
    } else {
      navigate(path);
    }
  };

  const NAV_ACTIVE = `bg-primary text-zinc-950 border-primary hover:bg-primary-dim hover:text-zinc-950`;
  const NAV_IDLE = `bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700`;

  return (
    <header className="fixed top-0 left-0 right-0 z-nav animate-fade-in bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50 pointer-events-none">
      <div className="max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-3 sm:py-5 flex flex-row items-center justify-between gap-2 pointer-events-auto">
        {/* ── Logo + breadcrumb ── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
          <button
            onClick={goHomeOrWarn}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png" 
              alt="LRC Studio" 
              className="w-full h-full object-contain"
            />
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-2 min-w-0">
            <button
              onClick={goHomeOrWarn}
              className="text-sm lg:text-lg font-bold text-zinc-100 tracking-tight truncate cursor-pointer hover:opacity-80 transition-opacity text-left"
            >
              {t('app.name')}
            </button>

            {isReady ? (
              <div className="flex items-center gap-1 lg:gap-2 min-w-0">
                <span className="text-zinc-600 hidden lg:inline">/</span>
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
                      if (e.key === 'Enter') { setEditingProjectName(false); triggerImportSave({ title: mediaTitle }); }
                      else if (e.key === 'Escape') { setEditingProjectName(false); }
                    }}
                    autoFocus
                    maxLength={200}
                    className="h-6 lg:h-7 text-xs lg:text-sm bg-zinc-800/60 border-zinc-700/60 text-zinc-200 min-w-[100px] max-w-[200px]"
                  />
                ) : (
                  <button
                    onClick={() => setEditingProjectName(true)}
                    className="flex items-center gap-1.5 min-w-0 group py-1 -my-1"
                    aria-label={t('setup.projectNamePlaceholder')}
                  >
                    <span className="text-xs lg:text-sm font-medium text-zinc-400 group-hover:text-zinc-200 truncate transition-colors">
                      {mediaTitle || t('setup.projectNamePlaceholder')}
                    </span>
                    <div className="p-1.5 -m-1.5 lg:p-0 lg:m-0">
                      <Pencil className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                    </div>
                  </button>
                )}
              </div>
            ) : location.pathname !== '/home' && location.pathname !== '/' && (
              <div className="flex items-center gap-1 lg:gap-2 min-w-0">
                <span className="text-zinc-600 hidden lg:inline">/</span>
                <span className="text-xs lg:text-sm font-medium text-zinc-400 truncate capitalize">
                  {location.pathname.split('/')[1].replace(/-/g, ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Tips (Hidden on Home) ── */}
        {!isHomePage && hasTips && (
          <div className="hidden lg:flex flex-1 items-center justify-center px-8 animate-fade-in pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-900/40 border border-zinc-800/60 rounded-full group pointer-events-auto cursor-help transition-all hover:bg-zinc-800/40 hover:border-zinc-700/60 shadow-inner">
              <div className="flex items-center gap-1.5 shrink-0">
                <Lightbulb className="w-3 h-3 text-amber-400/80 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors whitespace-nowrap">
                {tips[tipIndex]}
              </p>
            </div>
          </div>
        )}

        {/* ── Right-hand nav controls ── */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Hide Editor toggle (desktop, project pages only) */}
          {isReady && (
            <Tip content={`${t('app.hideEditor')} (Ctrl+2)`}>
              <Button
                variant="outline"
                aria-label={t('app.hideEditor')}
                onClick={() => {
                  if (focusMode === 'playback') { setFocusMode('default'); setHideEditor(false); }
                  else { setHideEditor(h => !h); }
                }}
                className={`${lines.length === 0 ? '!hidden' : 'hidden lg:flex'} px-2 py-1.5 h-auto text-[10px] font-bold border rounded-lg gap-1 flex-shrink-0 transition-colors ${(hideEditor || focusMode === 'playback') ? NAV_ACTIVE : NAV_IDLE
                  }`}
              >
                {(hideEditor || focusMode === 'playback') ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </Tip>
          )}

          {/* Keyboard shortcuts button — always visible in header */}
          <Tip content={`${t('shortcuts.title') || 'Keyboard Shortcuts'} (?)`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowKeyboardHelp(p => !p)}
              aria-label={t('shortcuts.title') || 'Keyboard Shortcuts'}
              className="h-8 w-8 sm:h-9 sm:w-9 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700/40 rounded-lg flex-shrink-0 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </Tip>

          {/* Unified User Profile Menu */}
          <Popover onOpenChange={(open) => { if (open) fetchCounts(); }}>
            <PopoverTrigger className="relative z-[110] h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 flex-shrink-0 transition-all focus:ring-2 focus:ring-primary/50 cursor-pointer outline-none">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user?.username || user?.email} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/50 to-accent-purple/50 text-white font-bold text-sm">
                  {(user?.username || user?.email || '?').charAt(0).toUpperCase()}
                </div>}
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-32px)] sm:w-64 p-0" align="end" sideOffset={8}>
              <div className="px-3 py-3 border-b border-zinc-800/60 flex flex-col">
                <span className="text-sm font-bold text-zinc-100 truncate">{user?.username || t('auth.user')}</span>
                <span className="text-xs text-zinc-400 truncate">{user?.email || ''}</span>
              </div>

              <div className="p-1 border-b border-zinc-800/60">
                <PopoverItem onClick={() => { navigate('/profile'); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                  <User className="w-4 h-4 text-zinc-400" />{t('profile.title')}
                </PopoverItem>
                <PopoverItem onClick={() => navTo('/library')} className="flex items-center justify-between cursor-pointer font-medium text-sm py-3 sm:py-2">
                  <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-zinc-400" />{t('library.title')}</span>
                  {counts.library > 0 && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] tabular-nums font-bold">{counts.library}</span>}
                </PopoverItem>
                <PopoverItem onClick={() => navTo('/uploads')} className="flex items-center justify-between cursor-pointer font-medium text-sm py-3 sm:py-2">
                  <span className="flex items-center gap-2"><UploadCloud className="w-4 h-4 text-zinc-400" />{t('uploads.title')}</span>
                  {counts.uploads > 0 && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] tabular-nums font-bold">{counts.uploads}</span>}
                </PopoverItem>
              </div>

              <div className="p-1 border-b border-zinc-800/60">
                {user?.role === 'admin' && (
                  <PopoverItem onClick={() => { navigate('/admin'); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2 text-indigo-400 hover:text-indigo-300">
                    <ShieldAlert className="w-4 h-4" />{t('admin.dashboard.title')}
                  </PopoverItem>
                )}
                <PopoverItem onClick={() => { setShowSettings(true); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                  <SettingsIcon className="w-4 h-4 text-zinc-400" />{t('settings.title')}
                </PopoverItem>
                <PopoverItem onClick={() => { setShowKeyboardHelp(p => !p); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                  <Kbd>?</Kbd><span className="ml-1">{t('shortcuts.title')}</span>
                </PopoverItem>
              </div>

              <div className="p-1">
                <PopoverItem onClick={() => { logout(); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2 text-red-400 hover:text-red-300">
                  <LogOut className="w-4 h-4" />{t('auth.logout')}
                </PopoverItem>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
