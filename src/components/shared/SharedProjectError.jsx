import { useTranslation } from 'react-i18next';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SharedProjectError({ status, projectId }) {
  const { t } = useTranslation();

  const isNotFound = status === 404;
  const isForbidden = status === 403;

  const title = isNotFound ? t('project.notFoundTitle', 'Project Not Found') :
                isForbidden ? t('project.forbiddenTitle', 'Access Denied') :
                t('project.errorTitle', 'Error Loading Project');

  const description = isNotFound ? t('project.notFoundDesc', 'The shared project you are looking for does not exist or has expired.') :
                      isForbidden ? t('project.forbiddenDesc', 'You do not have permission to view this project.') :
                      t('project.errorDesc', 'An unexpected error occurred while trying to load the project.');

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">{title}</h1>
        <p className="text-zinc-400 mb-8">{description}</p>
        
        <Button 
          onClick={() => window.location.href = '/'}
          className="w-full h-11 bg-primary text-zinc-950 hover:bg-primary/90 font-semibold gap-2"
        >
          <Home className="w-4 h-4" />
          {t('common.goHome', 'Go to Homepage')}
        </Button>
      </div>
    </div>
  );
}
