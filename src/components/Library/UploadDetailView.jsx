import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Calendar, FileAudio, Video, Trash2, Edit3, Music2, Clock } from 'lucide-react';
import { uploads } from '../../api';
import { Button } from '../ui/button';

export default function UploadDetailView({ onBack }) {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMedia() {
      try {
        setLoading(true);
        setError('');
        const data = await uploads.getMedia(id);
        setMedia(data);
      } catch (err) {
        setError(err.message || 'Failed to load media details');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadMedia();
  }, [id]);

  if (loading) {
    return (
      <div className="glass rounded-xl sm:rounded-2xl p-5 flex flex-col h-full animate-pulse">
        <div className="h-8 w-1/3 bg-zinc-800 rounded-lg mb-6"></div>
        <div className="h-32 w-full bg-zinc-800 rounded-xl mb-4"></div>
        <div className="h-20 w-full bg-zinc-800 rounded-xl"></div>
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="glass rounded-xl sm:rounded-2xl p-5 flex flex-col items-center justify-center h-full">
        <FileAudio className="w-12 h-12 text-zinc-600 mb-4" />
        <h2 className="text-xl font-bold text-zinc-300 mb-2">Error Loading Media</h2>
        <p className="text-zinc-500 mb-6 text-center max-w-sm">{error || 'Media not found'}</p>
        <Button onClick={onBack} variant="outline" className="px-6 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700">
          <ChevronLeft className="w-4 h-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>
      </div>
    );
  }

  const isYouTube = media.source === 'youtube';
  
  return (
    <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-zinc-700/50 flex-shrink-0">
        <Button
          onClick={onBack}
          variant="outline"
          className="w-8 h-8 sm:w-10 sm:h-10 p-0 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 shadow-sm"
          aria-label={t('common.back', 'Back')}
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 truncate tracking-tight">{media.title || media.fileName || t('uploads.unnamed', 'Unnamed Audio')}</h2>
          <div className="flex items-center gap-3 text-xs sm:text-sm text-zinc-500 mt-1.5">
             <span className="flex items-center gap-1.5">
               <Calendar className="w-3.5 h-3.5" />
               {new Date(media.createdAt).toLocaleDateString()}
             </span>
             <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/50">
               {isYouTube ? <Video className="w-3 h-3 text-red-500" /> : <FileAudio className="w-3 h-3 text-primary" />}
               <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{isYouTube ? 'YouTube' : 'Audio File'}</span>
             </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 space-y-6 sm:space-y-8 custom-scrollbar">
        {/* Details Section */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-inner">
           <h3 className="text-sm sm:text-base font-bold text-zinc-200 mb-4 flex items-center gap-2">
             <FileAudio className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
             {t('uploads.details', 'Media Details')}
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <p className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Source</p>
                <p className="text-sm sm:text-base text-zinc-300 truncate">
                  {isYouTube ? (
                     <a href={media.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                       {media.youtubeUrl}
                     </a>
                  ) : (
                     media.fileName || 'Unknown File'
                  )}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <p className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Duration</p>
                <p className="text-sm sm:text-base text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  {media.duration ? `${Math.floor(media.duration / 60)}:${Math.floor(media.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}
                </p>
              </div>
           </div>
        </div>

        {/* Associated Projects Section */}
        <div>
           <h3 className="text-sm sm:text-base font-bold text-zinc-200 mb-4 flex items-center gap-2">
             <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
             {t('uploads.associatedProjects', 'Associated Projects')}
             <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs ml-1 font-medium">{media.projects?.length || 0}</span>
           </h3>
           
           {media.projects && media.projects.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
               {media.projects.map(project => (
                 <div key={project.projectId} className="group relative bg-zinc-900/60 border border-zinc-800 hover:border-primary/50 hover:bg-zinc-800/60 rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer overflow-hidden flex flex-col"
                      onClick={() => navigate(`/project/${project.projectId}`)}>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="flex items-start gap-3 relative z-10">
                       <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                         {project.coverUrl ? (
                           <img src={project.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                         ) : (
                           <Music2 className="w-5 h-5 text-zinc-500" />
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <h4 className="text-sm font-bold text-zinc-200 truncate group-hover:text-primary transition-colors">{project.title || t('project.untitled', 'Untitled')}</h4>
                         <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                           <Calendar className="w-3 h-3" />
                           {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                         </p>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="bg-zinc-900/30 border border-dashed border-zinc-700/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
               <Music2 className="w-10 h-10 text-zinc-600 mb-3" />
               <p className="text-sm text-zinc-400 font-medium">No projects are using this media yet.</p>
               <p className="text-xs text-zinc-500 mt-1">Start a new project from the Setup screen.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
