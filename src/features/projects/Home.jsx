import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { projects } from '@/api';
import { Music2, Video, Plus, Search, Play, FileText, ChevronRight, Activity, Lightbulb } from 'lucide-react';
import ProjectSetupModal from '@features/editor/components/ProjectSetupModal';
import YoutubeSearchPanel from './YoutubeSearchPanel';

function YtIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.8 8.001a2.75 2.75 0 0 0-1.937-1.948C18.2 5.6 12 5.6 12 5.6s-6.2 0-7.863.453A2.75 2.75 0 0 0 2.2 8.001 28.8 28.8 0 0 0 1.75 12a28.8 28.8 0 0 0 .45 3.999 2.75 2.75 0 0 0 1.937 1.948C5.8 18.4 12 18.4 12 18.4s6.2 0 7.863-.453a2.75 2.75 0 0 0 1.937-1.948A28.8 28.8 0 0 0 22.25 12a28.8 28.8 0 0 0-.45-3.999ZM9.75 15V9l5.25 3-5.25 3Z" />
    </svg>
  );
}

function formatRelativeTime(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('library.justNow') || 'Just now';
  if (mins < 60) return t('library.minutesAgo', { count: mins }) || `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('library.hoursAgo', { count: hours }) || `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return t('library.daysAgo', { count: days }) || `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [showYtSearch, setShowYtSearch] = useState(false);

  const [randomSeed, setRandomSeed] = useState({ greeting: 0, welcome: 0, search: 0, tip: 0 });
  useEffect(() => {
    setRandomSeed({
      greeting: Math.floor(Math.random() * 1000),
      welcome: Math.floor(Math.random() * 1000),
      search: Math.floor(Math.random() * 1000),
      tip: Math.floor(Math.random() * 1000)
    });
  }, []);

  const getRandStr = useCallback((key, seedVal, options = {}) => {
    const arr = t(key, { returnObjects: true, ...options });
    if (Array.isArray(arr) && arr.length > 0) {
      return arr[seedVal % arr.length];
    }
    return t(key, options);
  }, [t]);

  const fetchProjects = useCallback(async () => {
    try {
      const { projects: list } = await projects.list();
      setItems(list || []);
    } catch (err) {
      console.error('Failed to fetch projects', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = items.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.metadata?.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const lastProject = items.length > 0 ? items[0] : null;
  const username = user?.username || 'Creator';

  const handleYtSelect = ({ url, title }) => {
    // Store selected YouTube URL in sessionStorage so the new project page can pick it up
    sessionStorage.setItem('pendingYtUrl', url);
    sessionStorage.setItem('pendingYtTitle', title || '');
    navigate('/project/new');
  };

  const renderActionCards = () => (
    <div className="flex flex-col gap-4 w-full max-w-md animate-fade-in">
      <div
        onClick={() => navigate('/project/new')}
        className="group cursor-pointer glass rounded-2xl p-5 text-left hover:border-primary/50 transition-all shadow-elevated w-full flex items-center gap-5"
      >
        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-zinc-100 mb-0.5">{t('home.createNew')}</h3>
          <p className="text-sm text-zinc-500 leading-snug">{t('home.createNewDesc')}</p>
        </div>
      </div>

      <div
        onClick={() => setShowYtSearch(true)}
        className="group cursor-pointer glass rounded-2xl p-5 text-left hover:border-red-500/40 transition-all shadow-elevated w-full flex items-center gap-5"
      >
        <div className="w-12 h-12 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <YtIcon className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-zinc-100 mb-0.5">{t('home.searchYoutube')}</h3>
          <p className="text-sm text-zinc-500 leading-snug">{t('home.searchYoutubePlaceholder')}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Background aesthetics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col h-full overflow-hidden px-6 py-6 sm:px-10 lg:px-16">
        {/* YouTube Search Slide-over */}
        {showYtSearch && (
          <div className="absolute inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col animate-fade-in rounded-xl overflow-hidden">
            <YoutubeSearchPanel
              onSelect={handleYtSelect}
              onClose={() => setShowYtSearch(false)}
            />
          </div>
        )}

        <div className="max-w-7xl mx-auto w-full h-full flex flex-col lg:flex-row gap-10 overflow-hidden">

          {/* LEFT COLUMN: Welcome & Actions */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-8 overflow-y-auto scrollbar-none pb-10">
            <div className="flex flex-col items-center lg:items-start animate-fade-in shrink-0 w-full">
              <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100 tracking-tight mb-3">
                {getRandStr('home.welcome', randomSeed.welcome, { name: username })}
              </h1>
              <p className="text-zinc-400 text-base sm:text-lg max-w-xl leading-relaxed mb-8">
                {getRandStr('home.welcomeSub', randomSeed.welcome)}
              </p>
              <div className="flex flex-col items-center lg:items-start w-full">
                {renderActionCards()}
              </div>
            </div>

            {/* Featured / Resume Section (Main Area) */}
            {!loading && lastProject && (
              <section className="w-full max-w-md flex flex-col gap-4 animate-fade-in mt-4">
                <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{t('home.resumeLast')}</h2>
                <div
                  onClick={() => navigate(`/project/${lastProject.projectId}`)}
                  className="group relative glass rounded-2xl p-1 overflow-hidden cursor-pointer shadow-elevated border-primary/20 hover:border-primary/50 transition-all"
                >
                  <div className="relative flex items-center gap-4 p-3 bg-zinc-950/40 rounded-xl">
                    <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                      <Music2 className="w-6 h-6 text-primary/50" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-zinc-950 ml-0.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-zinc-100 truncate group-hover:text-primary transition-colors">
                        {lastProject.title || t('library.untitled') || 'Untitled'}
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{formatRelativeTime(lastProject.updatedAt, t)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </div>
                </div>
              </section>
            )}

            {/* Footer Tips (Main Area) */}
            <div className="mt-auto w-full max-w-md pt-10 pb-4 border-t border-zinc-800/50 hidden lg:block">
              <div className="flex items-center gap-2 mb-2 text-zinc-500">
                <Lightbulb className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Pro Tip</span>
              </div>
              <p className="text-xs text-zinc-400 italic leading-relaxed">
                "{getRandStr('home.tips', randomSeed.tip)}"
              </p>
            </div>
          </div>
 
          {/* RIGHT COLUMN: Project Sidebar */}
          <div className="w-full lg:w-[360px] flex flex-col gap-6 bg-zinc-900/20 glass-dark rounded-3xl p-6 h-[400px] lg:h-full overflow-hidden animate-slide-in-right">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">{t('home.recentProjects')}</h2>
              {!loading && items.length > 0 && (
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full">{items.length}</span>
              )}
            </div>
 
            {loading ? (
              <div className="flex flex-col gap-3 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-16 bg-zinc-800/50 rounded-2xl w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4 text-zinc-600">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm text-zinc-500">{t('home.noProjects') || 'No projects yet'}</p>
              </div>
            ) : (
              <>
                {/* Sidebar Search */}
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={getRandStr('home.searchProjects', randomSeed.search)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950/50 border border-zinc-800/60 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
 
                {/* Sidebar List */}
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 flex flex-col gap-2.5 min-h-0">

                  {filteredProjects.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-10">No results found</p>
                  ) : (
                    filteredProjects.map((project) => (
                      <div
                        key={project.projectId}
                        onClick={() => navigate(`/project/${project.projectId}`)}
                        className="group flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:border-zinc-700/50 hover:bg-zinc-800/40 cursor-pointer transition-all animate-fade-in"
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-primary/30 transition-colors">
                          {project.upload?.source === 'youtube' ? (
                            <Video className="w-4 h-4 text-red-500/60" />
                          ) : (
                            <Music2 className="w-4 h-4 text-primary/60" />
                          )}
                          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-zinc-200 truncate group-hover:text-primary transition-colors">
                            {project.title || t('library.untitled')}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-500">{formatRelativeTime(project.updatedAt, t)}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Activity className="w-2.5 h-2.5" />
                              {project.syncedLineCount || 0}/{project.lineCount || 0}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <ProjectSetupModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onConfirm={async (data) => {
          try {
            const { title, description, tags } = data;
            const updatedMetadata = { ...editingProject.metadata, description, tags };
            await projects.patch(editingProject.projectId, {
              title,
              metadata: updatedMetadata
            });
            // Update local state
            setItems(prev => prev.map(p =>
              p.projectId === editingProject.projectId
                ? { ...p, title, metadata: updatedMetadata }
                : p
            ));
            setEditingProject(null);
          } catch (err) {
            console.error('Failed to update project metadata:', err);
          }
        }}
        initialName={editingProject?.title || ''}
        initialDescription={editingProject?.metadata?.description || ''}
        initialTags={editingProject?.metadata?.tags || []}
        isEditing={true}
      />
    </div>
  );
}
