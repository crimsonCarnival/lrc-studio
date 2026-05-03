import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../../contexts/useAuthContext';
import { projects } from '../../api';
import { Button } from '@/components/ui/button';
import { 
  Music2, 
  Video, 
  Upload, 
  Plus, 
  Search, 
  Clock, 
  Play, 
  FileText,
  ChevronRight,
  MoreVertical,
  Activity,
  Pencil
} from 'lucide-react';
import ProjectSetupModal from '../Setup/ProjectSetupModal';

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

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in max-w-2xl mx-auto text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
        <Music2 className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
        {t('home.welcome', { name: username })}
      </h2>
      <p className="text-zinc-400 text-lg mb-8 max-w-lg">
        {t('home.welcomeSub')}
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <div 
          onClick={() => navigate('/project/new')}
          className="group cursor-pointer glass rounded-2xl p-6 text-left hover:border-primary/50 transition-all shadow-elevated"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-1">{t('home.createNew')}</h3>
          <p className="text-sm text-zinc-500">{t('home.createNewDesc')}</p>
        </div>
        
        <div 
          onClick={() => navigate('/templates')}
          className="group cursor-pointer glass rounded-2xl p-6 text-left hover:border-accent-purple/50 transition-all shadow-elevated"
        >
          <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6 text-accent-purple" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 mb-1">{t('home.exploreTemplates')}</h3>
          <p className="text-sm text-zinc-500">{t('home.exploreTemplatesDesc')}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Background aesthetics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative flex-1 flex flex-col overflow-y-auto px-6 py-8 sm:px-10 sm:py-12 lg:px-16 scrollbar-thin">
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-10">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-100 tracking-tight mb-2">
                {t('home.greeting', { name: username })}
              </h1>
              <p className="text-zinc-400">{t('home.ready')}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.searchProjects')}
                  className="pl-9 pr-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all w-64"
                />
              </div>
              <Button 
                onClick={() => navigate('/project/new')}
                className="bg-primary hover:bg-primary-dim text-zinc-950 font-bold rounded-full px-6 gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('home.newProject')}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-6 animate-pulse">
              <div className="h-48 bg-zinc-900/50 rounded-2xl w-full" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl" />)}
              </div>
            </div>
          ) : items.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {/* Quick Resume Section */}
              {!searchQuery && lastProject && (
                <section className="flex flex-col gap-4 animate-fade-in">
                  <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{t('home.resumeLast')}</h2>
                  <div 
                    onClick={() => navigate(`/project/${lastProject.projectId}`)}
                    className="group relative glass rounded-2xl p-1 overflow-hidden cursor-pointer shadow-elevated border-primary/20 hover:border-primary/50 transition-all"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent-purple/5 group-hover:from-primary/10 group-hover:to-accent-purple/10 transition-colors" />
                    <div className="relative flex items-center gap-6 p-4 sm:p-6 bg-zinc-950/40 rounded-xl">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner relative">
                        {lastProject.metadata?.coverUrl || lastProject.coverUrl ? (
                          <img src={lastProject.metadata?.coverUrl || lastProject.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <Music2 className="w-8 h-8 text-primary/50" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-4 h-4 text-zinc-950 ml-1" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-zinc-100 mb-1 truncate group-hover:text-primary transition-colors">
                          {lastProject.title || t('library.untitled') || 'Untitled'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatRelativeTime(lastProject.updatedAt, t)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-zinc-700" />
                          <span className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" />
                            {lastProject.syncedLineCount || 0} / {lastProject.lineCount || 0} {t('library.lines', { count: '' }).replace(/[0-9]/g, '').trim()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="hidden sm:flex items-center text-primary font-medium text-sm gap-1 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        {t('home.continueEditing')} <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Projects Grid */}
              <section className="flex flex-col gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                  {searchQuery ? t('home.searchResults') : t('home.recentProjects')}
                </h2>
                
                {filteredProjects.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    {t('home.noResults', { query: searchQuery })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {filteredProjects.map((project, idx) => (
                      <div 
                        key={project.projectId}
                        onClick={() => navigate(`/project/${project.projectId}`)}
                        className="group flex flex-col glass rounded-xl p-4 cursor-pointer hover:border-zinc-600 transition-all hover:-translate-y-1 hover:shadow-elevated"
                        style={{ animationDelay: `${150 + idx * 50}ms` }}
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                            {project.metadata?.coverUrl || project.coverUrl ? (
                              <img src={project.metadata?.coverUrl || project.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-5 h-5 text-zinc-500" />
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <h4 className="text-base font-bold text-zinc-200 truncate group-hover:text-primary transition-colors">
                              {project.title || t('library.untitled') || 'Untitled'}
                            </h4>
                            <p className="text-xs text-zinc-500 truncate mt-0.5">
                              {project.metadata?.description || t('home.noDescription')}
                            </p>
                          </div>
                          <button 
                            className="p-1.5 rounded-md text-zinc-500 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProject(project);
                            }}
                            title={t('project.editMetadata') || 'Edit Metadata'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="mt-auto pt-3 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatRelativeTime(project.updatedAt, t)}
                          </div>
                          {(project.lineCount > 0 || project.syncedLineCount > 0) && (
                            <div className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
                              {project.syncedLineCount || 0} / {project.lineCount || 0} {t('library.lines', { count: '' }).replace(/[0-9]/g, '').trim()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <ProjectSetupModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onConfirm={async (data) => {
          try {
            const { title, description, tags, coverUrl, coverPublicId } = data;
            const updatedMetadata = { ...editingProject.metadata, description, tags, coverUrl, coverPublicId };
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
        initialCoverUrl={editingProject?.metadata?.coverUrl || ''}
        initialCoverPublicId={editingProject?.metadata?.coverPublicId || ''}
      />
    </div>
  );
}
