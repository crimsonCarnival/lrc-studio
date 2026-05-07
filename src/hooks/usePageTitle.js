import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

/**
 * Custom hook to dynamically update the document title based on the current route.
 * It uses translations and syncs with the app name.
 */
export function usePageTitle(projectName = null) {
  const { t } = useTranslation();
  const location = useLocation();
  const { id } = useParams();

  useEffect(() => {
    const appName = t('app.name') || 'LRC Studio';
    let pageTitle = '';

    const path = location.pathname;

    // Remove leading/trailing slashes for easier matching
    const cleanPath = path.replace(/^\/|\/$/g, '');

    if (cleanPath === 'home' || cleanPath === '') {
      pageTitle = t('app.titles.home');
    } else if (cleanPath === 'library' || cleanPath === 'projects') {
      pageTitle = t('app.titles.library');
    } else if (cleanPath === 'uploads') {
      pageTitle = t('app.titles.uploads');
    } else if (cleanPath === 'profile') {
      pageTitle = t('app.titles.profile');
    } else if (cleanPath === 'auth') {
      pageTitle = t('app.titles.auth');
    } else if (cleanPath === 'admin') {
      pageTitle = t('app.titles.admin');
    } else if (cleanPath.startsWith('share/')) {
      pageTitle = t('app.titles.shared');
    } else if (cleanPath === 'project/new') {
      pageTitle = t('app.titles.newProject');
    } else if (cleanPath.startsWith('project/') || cleanPath.startsWith('uploads/')) {
      // For existing projects or upload details, use the name if provided
      pageTitle = projectName || (cleanPath.startsWith('uploads/') ? t('app.titles.uploads') : t('app.titles.library'));
    }

    if (pageTitle) {
      document.title = `${pageTitle} — ${appName}`;
    } else {
      document.title = appName;
    }
  }, [location.pathname, id, projectName, t]);
}
