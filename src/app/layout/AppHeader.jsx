import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Music2, UploadCloud, Settings as SettingsIcon, LogOut, BookOpen, Pencil,
  ShieldAlert, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Popover, PopoverContent, PopoverItem, PopoverTrigger } from '@ui/popover';
import { Tip } from '@ui/tip';
import { Kbd } from '@shared/Kbd';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const goHomeOrWarn = () => {
    setIsMenuOpen(false);
    if (location.pathname.startsWith('/project/') && hasUnsavedChanges()) {
      setUnsavedModalTarget('/home');
    } else {
      navigate('/home');
    }
  };

  const navTo = (path) => {
    setIsMenuOpen(false);
    const inProject = location.pathname.startsWith('/project/');
    if (inProject && hasUnsavedChanges()) {
      setUnsavedModalTarget(path);
    } else if (location.pathname.startsWith(path)) {
      navigate(activeProjectId ? `/project/${activeProjectId}` : '/project/new');
    } else {
      navigate(path);
    }
  };

  const NAV_BTN = `px-2 sm:px-3 h-8 sm:h-9 rounded-lg sm:rounded-xl flex-shrink-0 transition-colors`;
  const NAV_ACTIVE = `bg-primary text-zinc-950 border-primary hover:bg-primary-dim hover:text-zinc-950`;
  const NAV_IDLE = `bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700`;

  return (
    <header className="relative z-sticky flex flex-row items-center justify-between gap-2 w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-5 animate-fade-in">
      {/* ── Logo + breadcrumb ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
        <button
          onClick={goHomeOrWarn}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Music2 className="w-4 sm:w-5 h-4 sm:h-5 text-white" strokeWidth={2} />
        </button>

        <div className="overflow-hidden flex items-center gap-2 min-w-0">
          <button
            onClick={goHomeOrWarn}
            className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight truncate shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {t('app.name')}
          </button>



          {isReady && (
            <>
              <span className="text-zinc-600 shrink-0">/</span>
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
                  className="h-7 text-sm bg-zinc-800/60 border-zinc-700/60 text-zinc-200 min-w-[100px] max-w-[200px]"
                />
              ) : (
                <button onClick={() => setEditingProjectName(true)} className="flex items-center gap-1 min-w-0 group">
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

        {/* Unified User Profile Menu */}

        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="p-0 sm:p-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700/60 flex-shrink-0 transition-all focus:ring-2 focus:ring-primary/50">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user?.username || user?.email} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/50 to-accent-purple/50 text-white font-bold text-sm">
                  {(user?.username || user?.email || '?').charAt(0).toUpperCase()}
                </div>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="end">
            <div className="px-3 py-3 border-b border-zinc-800/60 flex flex-col">
              <span className="text-sm font-bold text-zinc-100 truncate">{user?.username || 'User'}</span>
              <span className="text-xs text-zinc-400 truncate">{user?.email || ''}</span>
            </div>

            <div className="p-1 border-b border-zinc-800/60">
              <PopoverItem onClick={() => navTo('/library')} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2">
                <BookOpen className="w-4 h-4 text-zinc-400" />{t('library.title')}
              </PopoverItem>
              <PopoverItem onClick={() => navTo('/uploads')} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2">
                <UploadCloud className="w-4 h-4 text-zinc-400" />{t('uploads.title')}
              </PopoverItem>
            </div>

            <div className="p-1 border-b border-zinc-800/60">
              {user?.role === 'admin' && (
                <PopoverItem onClick={() => { setIsMenuOpen(false); navigate('/admin'); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2 text-indigo-400 hover:text-indigo-300">
                  <ShieldAlert className="w-4 h-4" />Admin Dashboard
                </PopoverItem>
              )}
              <PopoverItem onClick={() => { setIsMenuOpen(false); setShowSettings(true); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2">
                <SettingsIcon className="w-4 h-4 text-zinc-400" />{t('settings.title')}
              </PopoverItem>
              <PopoverItem onClick={() => { setIsMenuOpen(false); setShowKeyboardHelp(p => !p); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2">
                <Kbd>?</Kbd><span className="ml-1">{t('shortcuts.title') || 'Shortcuts'}</span>
              </PopoverItem>
            </div>

            <div className="p-1">
              <PopoverItem onClick={() => { setIsMenuOpen(false); logout(); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-2 text-red-400 hover:text-red-300">
                <LogOut className="w-4 h-4" />{t('auth.logout')}
              </PopoverItem>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
