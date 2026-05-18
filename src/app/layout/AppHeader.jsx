import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UploadCloud, Settings as SettingsIcon, LogOut, BookOpen, Pencil,
  ShieldAlert, Eye, EyeOff, User, HelpCircle, Lightbulb, ArrowLeft, Check,
  Sun, Moon, Monitor, Palette, Globe, ExternalLink
} from 'lucide-react';
import { useSetupContext } from '@/contexts/SetupContext';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Popover, PopoverContent, PopoverItem, PopoverTrigger } from '@ui/popover';
import { Tip } from '@ui/tip';
import { Kbd } from '@shared/Kbd';
import { projects, uploads } from '@/api';
import { savePendingProject } from '@/features/editor/services/guestProjectDb';

const THEMES = [
  { id: 'system',  label: 'System', Icon: Monitor, swatch: 'bg-zinc-500' },
  { id: 'dark',    label: 'Dark',   Icon: Moon,    swatch: 'bg-[#232136] border border-[#393552]' },
  { id: 'light',   label: 'Light',  Icon: Sun,     swatch: 'bg-[#faf4ed] border border-[#dfdad9]' },
  { id: 'cobalt',  label: 'Cobalt', Icon: Palette, swatch: 'bg-[#2F2FE4]' },
  { id: 'velvet',  label: 'Velvet', Icon: Palette, swatch: 'bg-[#A64D79]' },
  { id: 'sage',    label: 'Sage',   Icon: Palette, swatch: 'bg-[#5C8374]' },
];

const LANG_NAMES = {
  en: { en: 'English',  es: 'Inglés',    ja: '英語'        },
  es: { en: 'Spanish',  es: 'Español',   ja: 'スペイン語'  },
  ja: { en: 'Japanese', es: 'Japonés',   ja: '日本語'      },
};

const LANGUAGES = [
  { code: 'en', short: 'EN' },
  { code: 'es', short: 'ES' },
  { code: 'ja', short: 'JA' },
];

function getLangLabel(code, currentLang) {
  const native = LANG_NAMES[code]?.[code] || code;
  const translated = LANG_NAMES[code]?.[currentLang];
  if (!translated || translated === native) return native;
  return `${native} (${translated})`;
}

// Resolved outside render so ESLint doesn't flag it as a component created during render
const THEME_ICONS = {
  system: Monitor,
  dark: Moon,
  light: Sun,
  cobalt: Palette,
  velvet: Palette,
  sage: Palette,
};

export function AppHeader({
  user,
  logout,
  isReady,
  lines,
  mediaTitle,
  setMediaTitle,
  triggerImportSave,
  buildProjectPayload,
  hasUnsavedChanges,
  activeProjectId,
  forkedFrom,
  setShowSettings,
  setShowKeyboardHelp,
  focusMode,
  setFocusMode,
  hideEditor,
  setHideEditor,
  setUnsavedModalTarget,
  settings,
  updateSetting,
  i18n,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { step, setStep } = useSetupContext();
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [counts, setCounts] = useState({ library: 0, uploads: 0 });
  const projectNameInputRef = useRef(null);



  const isSetupPage = location.pathname === '/project/new';
  const isHomePage = location.pathname === '/home' || location.pathname === '/';

  const currentTheme = settings?.interface?.theme || 'dark';
  const currentLang = (i18n?.language || 'en').slice(0, 2).toUpperCase();

  const fetchCounts = async () => {
    if (!user) return;
    try {
      const [pRes, uRes] = await Promise.all([projects.list(), uploads.listMedia()]);
      setCounts({ library: pRes?.length || 0, uploads: uRes?.length || 0 });
    } catch (err) { console.error('Failed to fetch counts for menu:', err); }
  };

  const [tipIndex, setTipIndex] = useState(0);
  const tips = t('home.tips', { returnObjects: true });
  const hasTips = Array.isArray(tips) && tips.length > 0;

  useEffect(() => {
    if (!hasTips) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [hasTips, tips.length]);

  const goHomeOrWarn = () => {
    if (location.pathname.startsWith('/project/') && hasUnsavedChanges()) {
      setUnsavedModalTarget('/');
    } else {
      navigate('/');
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

  const stepLabels = [
    t('setup.stepDetails', 'Details'),
    t('setup.stepSetup', 'Setup'),
  ];

  const iconBtn = 'size-8 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors rounded-lg flex-shrink-0 cursor-pointer';

  const saveToIdb = async () => {
    const payload = buildProjectPayload ? buildProjectPayload() : { title: mediaTitle || '', lines: lines ?? [] };
    const idbPayload = {
      title: payload.title,
      lyrics: { editorMode: payload.editorMode, lines: payload.lines },
      state: {
        syncMode: payload.syncMode,
        activeLineIndex: payload.activeLineIndex,
        playbackPosition: payload.playbackPosition,
        playbackSpeed: payload.playbackSpeed,
        saveTime: payload.saveTime,
        timezone: payload.timezone,
        utcOffset: payload.utcOffset,
      },
      metadata: payload.metadata,
      ...(payload.ytUrl ? { ytUrl: payload.ytUrl } : {}),
      ...(payload.cloudinaryAudio ? {
        cloudinaryUrl: payload.cloudinaryAudio.cloudinaryUrl,
        cloudinaryPublicId: payload.cloudinaryAudio.publicId || null,
        fileName: payload.cloudinaryAudio.fileName || '',
        duration: payload.cloudinaryAudio.duration || null,
      } : {}),
    };
    await savePendingProject(idbPayload);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-nav animate-fade-in bg-zinc-950/85 backdrop-blur-lg border-b border-zinc-800/40 pointer-events-none">

      {/* Step indicator — absolutely centered */}
      {isSetupPage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-full px-3 py-1.5 backdrop-blur-sm pointer-events-auto">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              return (
                <div key={n} className="flex items-center">
                  {i > 0 && (
                    <div className={`w-5 h-px mx-1 transition-colors ${step > i ? 'bg-primary/50' : 'bg-zinc-700/60'}`} />
                  )}
                  <div className="flex items-center gap-1">
                    <div className={`size-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                      step === n ? 'bg-primary text-zinc-950 scale-110 shadow-sm shadow-primary/30'
                      : step > n ? 'bg-primary/20 border border-primary/40 text-primary'
                      : 'bg-zinc-800 border border-zinc-700/60 text-zinc-500'
                    }`}>
                      {step > n ? <Check className="size-2.5" /> : n}
                    </div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide hidden sm:block transition-colors ${
                      step === n ? 'text-primary' : step > n ? 'text-zinc-500' : 'text-zinc-600'
                    }`}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto w-full px-4 lg:px-6 py-2 sm:py-2.5 flex flex-row items-center justify-between gap-2 pointer-events-auto">

        {/* ── Left: Logo + breadcrumb ── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
          <button
            onClick={goHomeOrWarn}
            className="size-7 sm:size-8 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <img
              src="https://res.cloudinary.com/dzjid2tos/image/upload/v1778106770/lrc-logo_dkumwz.png"
              alt="LRC Studio"
              className="size-full object-contain"
            />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={goHomeOrWarn}
              className="text-sm font-bold text-zinc-100 tracking-tight cursor-pointer hover:opacity-80 transition-opacity shrink-0"
            >
              {t('app.name')}
            </button>

            {isReady ? (
              <>
                <span className="text-zinc-700 shrink-0">/</span>
                {editingProjectName ? (
                    <Input
                      ref={projectNameInputRef}
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
                      maxLength={200}
                      className="h-6 text-xs bg-zinc-800/60 border-zinc-700/60 text-zinc-200 min-w-[100px] max-w-[180px]"
                    />
                ) : (
                  <button
                    onClick={() => {
                      flushSync(() => setEditingProjectName(true));
                      projectNameInputRef.current?.focus();
                    }}
                    className="flex items-center gap-1 min-w-0 group py-1 -my-1"
                    aria-label={t('setup.projectNamePlaceholder')}
                  >
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 truncate transition-colors max-w-[120px] sm:max-w-[200px]">
                      {mediaTitle || t('setup.projectNamePlaceholder')}
                    </span>
                    <Pencil className="size-3 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                  </button>
                )}
                {forkedFrom?.projectId && (
                  <Tip content={forkedFrom.username ? t('share.forkedFrom', { username: forkedFrom.username, defaultValue: `Forked from {{username}}` }) : t('share.forkedProject', 'Forked project')}>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 text-[9px] font-bold text-accent-blue uppercase shrink-0 cursor-help transition-colors hover:bg-accent-blue/20">
                      <ExternalLink className="size-2.5" />
                      <span className="hidden xs:inline">{t('share.forkedBadge', 'Forked')}</span>
                    </div>
                  </Tip>
                )}
              </>
            ) : isSetupPage ? (
              step > 1 && (
                <button
                  onClick={() => setStep(prev => prev - 1)}
                  className="flex items-center gap-1 h-7 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-all text-xs font-medium"
                >
                  <ArrowLeft className="size-3.5" />
                  <span className="hidden sm:inline">{t('common.back') || 'Back'}</span>
                </button>
              )
            ) : location.pathname !== '/home' && location.pathname !== '/' && (
              <>
                <span className="text-zinc-700 shrink-0 hidden sm:inline">/</span>
                <span className="text-xs font-medium text-zinc-400 truncate capitalize hidden sm:block">
                  {location.pathname.split('/')[1].replace(/-/g, ' ')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Center: Tips pill ── */}
        {!isHomePage && !isSetupPage && hasTips && (
          <div className="hidden lg:flex flex-1 items-center justify-center px-8 pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/40 border border-zinc-800/50 rounded-full group pointer-events-auto cursor-help transition-all hover:bg-zinc-800/40 hover:border-zinc-700/60">
              <Lightbulb className="size-3 text-amber-400/70 group-hover:text-amber-400 transition-colors shrink-0" />
              <p className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors whitespace-nowrap">
                {tips[tipIndex]}
              </p>
            </div>
          </div>
        )}

        {/* ── Right: Controls ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">

          {/* Hide editor toggle — desktop, project pages, when lines exist */}
          {isReady && lines.length > 0 && (
            <Tip content={`${t('app.hideEditor')} (Ctrl+2)`}>
              <button
                aria-label={t('app.hideEditor')}
                onClick={() => {
                  if (focusMode === 'playback') { setFocusMode('default'); setHideEditor(false); }
                  else { setHideEditor(h => !h); }
                }}
                className={`hidden lg:flex size-8 items-center justify-center rounded-xl transition-colors flex-shrink-0 border text-xs font-bold ${
                  (hideEditor || focusMode === 'playback')
                    ? NAV_ACTIVE
                    : 'bg-zinc-800/60 border-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {(hideEditor || focusMode === 'playback') ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </Tip>
          )}

          {/* Grouped icon controls: theme | lang | shortcuts */}
          <div className="flex items-center bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden">

            {/* Theme switcher */}
            <Popover>
              <Tip content={t('settings.theme', 'Theme')}>
                <PopoverTrigger asChild>
                  <button className={iconBtn} aria-label={t('settings.theme', 'Theme')}>
                    {(() => { const TI = THEME_ICONS[currentTheme] || Moon; return <TI className="size-3.5" />; })()}
                  </button>
                </PopoverTrigger>
              </Tip>
              <PopoverContent className="w-44 p-1" align="end" sideOffset={8}>
                {THEMES.map(({ id, label, swatch }) => (
                  <PopoverItem
                    key={id}
                    onClick={() => updateSetting?.('interface.theme', id)}
                    className={`flex items-center gap-2.5 cursor-pointer text-sm py-2 ${currentTheme === id ? 'text-primary' : ''}`}
                  >
                    <span className={`size-3 rounded-full shrink-0 ${swatch}`} />
                    <span className="flex-1 text-left">{label}</span>
                    <Check className={`size-3 shrink-0 ${currentTheme === id ? 'text-primary' : 'invisible'}`} />
                  </PopoverItem>
                ))}
              </PopoverContent>
            </Popover>

            <div className="w-px h-4 bg-zinc-800/80 shrink-0" />

            {/* Language switcher */}
            <Popover>
              <Tip content={t('settings.language', 'Language')}>
                <PopoverTrigger asChild>
                  <button className={`${iconBtn} gap-0.5 w-auto px-2`} aria-label={t('settings.language', 'Language')}>
                    <Globe className="size-3.5 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wide">{currentLang}</span>
                  </button>
                </PopoverTrigger>
              </Tip>
              <PopoverContent className="w-48 p-1" align="end" sideOffset={8}>
                {LANGUAGES.map(({ code }) => {
                  const currentLang = (i18n?.language || 'en').split('-')[0];
                  const label = getLangLabel(code, currentLang);
                  const active = currentLang === code;
                  return (
                    <PopoverItem
                      key={code}
                      onClick={() => i18n?.changeLanguage(code)}
                      className={`flex items-center gap-2.5 cursor-pointer text-sm py-2 ${active ? 'text-primary' : ''}`}
                    >
                      <span className="flex-1 text-left">{label}</span>
                      <Check className={`size-3 shrink-0 ${active ? 'text-primary' : 'invisible'}`} />
                    </PopoverItem>
                  );
                })}
              </PopoverContent>
            </Popover>

            <div className="w-px h-4 bg-zinc-800/80 shrink-0" />

            {/* Keyboard shortcuts */}
            <Tip content={`${t('shortcuts.title') || 'Keyboard Shortcuts'} (?)`}>
              <button
                onClick={() => setShowKeyboardHelp(p => !p)}
                aria-label={t('shortcuts.title') || 'Keyboard Shortcuts'}
                className={iconBtn}
              >
                <HelpCircle className="size-3.5" />
              </button>
            </Tip>
          </div>

          {/* Auth section */}
          {!user ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={async () => {
                  if ((lines?.length ?? 0) > 0) {
                    try {
                      await saveToIdb();
                      navigate(`/auth?action=signin&redirect=${encodeURIComponent('/project/local?fromGuest=1')}`);
                    } catch {
                      import('react-hot-toast').then(({ default: toast }) => {
                        toast.error("Couldn't save draft locally — try a different browser or disable private mode.");
                      });
                    }
                  } else {
                    navigate('/auth?action=signin');
                  }
                }}
                className="h-8 px-3 text-xs font-semibold text-zinc-300 hover:text-zinc-100 bg-zinc-800/70 hover:bg-zinc-700/80 border border-zinc-800/50 rounded-xl transition-colors flex-shrink-0"
              >
                {t('auth.signIn', 'Sign in')}
              </button>
              <div className="relative flex-shrink-0">
                <button
                  onClick={async () => {
                    if ((lines?.length ?? 0) > 0) {
                      try {
                        await saveToIdb();
                        navigate(`/auth/signup?redirect=${encodeURIComponent('/project/local?fromGuest=1')}`);
                      } catch {
                        import('react-hot-toast').then(({ default: toast }) => {
                          toast.error("Couldn't save draft locally — try a different browser or disable private mode.");
                        });
                      }
                    } else {
                      navigate('/auth/signup');
                    }
                  }}
                  className="h-8 px-3 text-xs font-semibold text-zinc-950 bg-primary hover:bg-primary/90 rounded-xl transition-colors"
                >
                  {t('auth.signUp', 'Sign up')}
                </button>
                {(lines?.length ?? 0) > 0 && (
                  <Tip content={t('auth.signUpToSave', 'Sign up to save your project to the cloud')}>
                    <span
                      className="absolute -top-1 -right-1 size-2 rounded-full bg-primary animate-pulse pointer-events-none"
                    />
                  </Tip>
                )}
              </div>
            </div>
          ) : (
            <Popover onOpenChange={(open) => { if (open) fetchCounts(); }}>
              <PopoverTrigger className="relative z-[110] size-8 rounded-full overflow-hidden bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 flex-shrink-0 transition-all focus:ring-2 focus:ring-primary/50 cursor-pointer outline-none">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt={user?.username || user?.email} className="size-full object-cover" />
                  : <div className="size-full flex items-center justify-center bg-gradient-to-br from-primary/50 to-accent-purple/50 text-white font-bold text-sm">
                    {(user?.username || user?.email || '?').charAt(0).toUpperCase()}
                  </div>}
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-32px)] sm:w-64 p-0" align="end" sideOffset={8}>
                <div className="p-3 border-b border-zinc-800/60 flex flex-col">
                  <span className="text-sm font-bold text-zinc-100 truncate">{user?.username || t('auth.user')}</span>
                  <span className="text-xs text-zinc-400 truncate">{user?.email || ''}</span>
                </div>

                <div className="p-1 border-b border-zinc-800/60">
                  <PopoverItem onClick={() => { navigate('/profile'); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                    <User className="size-4 text-zinc-400" />{t('profile.title')}
                  </PopoverItem>
                  <PopoverItem onClick={() => navTo('/library')} className="flex items-center justify-between cursor-pointer font-medium text-sm py-3 sm:py-2">
                    <span className="flex items-center gap-2"><BookOpen className="size-4 text-zinc-400" />{t('library.title')}</span>
                    {counts.library > 0 && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] tabular-nums font-bold">{counts.library}</span>}
                  </PopoverItem>
                  <PopoverItem onClick={() => navTo('/uploads')} className="flex items-center justify-between cursor-pointer font-medium text-sm py-3 sm:py-2">
                    <span className="flex items-center gap-2"><UploadCloud className="size-4 text-zinc-400" />{t('uploads.title')}</span>
                    {counts.uploads > 0 && <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full text-[10px] tabular-nums font-bold">{counts.uploads}</span>}
                  </PopoverItem>
                </div>

                <div className="p-1 border-b border-zinc-800/60">
                  {user?.role === 'admin' && (
                    <PopoverItem onClick={() => { navigate('/admin'); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2 text-zinc-400 hover:text-zinc-200">
                      <ShieldAlert className="size-4" />{t('admin.dashboard.title')}
                    </PopoverItem>
                  )}
                  <PopoverItem onClick={() => { setShowSettings(true); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                    <SettingsIcon className="size-4 text-zinc-400" />{t('settings.title')}
                  </PopoverItem>
                  <PopoverItem onClick={() => { setShowKeyboardHelp(p => !p); }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2">
                    <Kbd>?</Kbd><span className="ml-1">{t('shortcuts.title')}</span>
                  </PopoverItem>
                </div>

                <div className="p-1">
                  <PopoverItem onClick={async () => { 
                    await logout();
                    window.location.href = '/auth/signin?from=logout';
                  }} className="flex items-center gap-2 cursor-pointer font-medium text-sm py-3 sm:py-2 text-red-400 hover:text-red-300">
                    <LogOut className="size-4" />{t('auth.signOut', 'Sign out')}
                  </PopoverItem>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}
