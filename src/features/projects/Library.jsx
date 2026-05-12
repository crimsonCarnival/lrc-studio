import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { projects } from '@/api';
import { Button } from '@ui/button';
import { Tip } from '@ui/tip';
import { Music, Video, Upload, FileText, Trash2, ExternalLink, Clock, ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { SkeletonCard } from '@ui/skeleton';
import ProjectSetupModal from '@features/editor/components/ProjectSetupModal';
import useConfirm from '@/hooks/useConfirm';
import { useSettings } from '@/contexts/useSettings';
import { formatInTimezone, getRelativeTime } from '@/utils/date';


function SourceIcon({ source }) {
  if (source === 'youtube') return <Video className="w-4 h-4 text-red-400" />;
  if (source === 'local') return <Upload className="w-4 h-4 text-blue-400" />;
  return <Music className="w-4 h-4 text-zinc-400" />;
}

export default function Library({ onOpenProject, onBack }) {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const timezone = settings.advanced?.timezone;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [requestConfirm, confirmModal] = useConfirm();

  const fetchProjects = useCallback(async () => {
    try {
      const list = await projects.list() || [];
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleDelete = (e, projectId, title) => {
    e.stopPropagation();
    requestConfirm(
      t('confirm.deleteProject', { title: title || t('library.untitled') }),
      async () => {
        setDeletingId(projectId);
        try {
          await projects.remove(projectId);
          setItems((prev) => prev.filter((s) => s.projectId !== projectId));
        } catch {
          // ignore
        } finally {
          setDeletingId(null);
        }
      },
      { title: t('confirm.deleteProjectTitle'), variant: 'danger' }
    );
  };

  return (
    <div className="flex flex-col h-full pt-0 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest">
          {t('library.title')}
        </h2>
        <span className="text-xs text-zinc-500 ml-auto">
          {!loading && t('library.count', { count: items.length })}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 space-y-2 animate-fade-in">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center">
            <FileText className="w-7 h-7 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 font-medium">{t('library.empty')}</p>
          <p className="text-xs text-zinc-500">{t('library.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 settings-scroll">
          {items.map((project) => (
            <div
              key={project.projectId}
              role="button"
              tabIndex={0}
              onClick={() => onOpenProject(project.projectId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenProject(project.projectId); } }}
              className="w-full group relative flex items-start gap-3 p-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/40 hover:border-zinc-600/60 transition-all duration-150 text-left cursor-pointer"
            >
              {/* Cover or Source icon */}
              <div className="w-9 h-9 rounded-lg bg-zinc-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                <SourceIcon source={project.upload?.source} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100 truncate">
                    {project.title || project.upload?.fileName || t('library.untitled')}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded flex-shrink-0">
                    {project.editorMode}
                  </span>
                  {project.forkedFrom?.projectId && (
                    <Tip content={project.forkedFrom.username ? t('share.forkedFrom', { username: project.forkedFrom.username, defaultValue: `Forked from {{username}}` }) : t('share.forkedProject', 'Forked project')}>
                      <span className="text-[10px] font-bold uppercase text-accent-blue bg-accent-blue/10 border border-accent-blue/20 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {t('share.forkedBadge', 'Forked')}
                      </span>
                    </Tip>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {t('library.lines', { count: project.lineCount || 0 })}
                  </span>
                  {project.upload?.duration && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(project.upload.duration / 60)}:{String(Math.floor(project.upload.duration % 60)).padStart(2, '0')}
                    </span>
                  )}
                  {project.upload?.youtubeUrl && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {t('uploads.youtube')}
                    </span>
                  )}
                </div>

                <Tip content={formatInTimezone(project.updatedAt, timezone, {
                  dateStyle: 'full',
                  timeStyle: 'long'
                }, i18n.resolvedLanguage || i18n.language)}>
                  <span className="text-[10px] text-zinc-600 mt-1 block">
                    {getRelativeTime(project.updatedAt, t, timezone, i18n.resolvedLanguage || i18n.language)}
                  </span>
                </Tip>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingProject(project);
                  }}
                  className="text-zinc-500 hover:text-primary hover:bg-primary/10 w-7 h-7"
                  title={t('project.editMetadata')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(e, project.projectId, project.title)}
                  disabled={deletingId === project.projectId}
                  className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 w-7 h-7"
                >
                  {deletingId === project.projectId
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
      {confirmModal}
    </div>
  );
}
