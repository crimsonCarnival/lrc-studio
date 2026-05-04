import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@ui/button';
import { useTranslation } from 'react-i18next';

const Settings = lazy(() => import('@features/settings/SettingsModal'));
const KeyboardHelp = lazy(() => import('@shared/KeyboardHelp'));
import ProjectSetupModal from '@features/editor/components/ProjectSetupModal';

/**
 * All floating global modals: keyboard help, settings, project naming, restore prompt.
 */
export function AppModals({
  showKeyboardHelp,
  setShowKeyboardHelp,
  showSettings,
  setShowSettings,
  handleManualSave,
  showNamingModal,
  setShowNamingModal,
  handleProjectConfirm,
  mediaTitle,
  projectMetadata,
  pendingProject,
  handleDiscardProject,
  handleRestoreProject,
  unsavedModalTarget,
  setUnsavedModalTarget,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <Suspense fallback={null}>
        {showKeyboardHelp && (
          <KeyboardHelp isOpen={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showSettings && (
          <Settings
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onManualSave={handleManualSave}
          />
        )}
      </Suspense>

      <ProjectSetupModal
        isOpen={showNamingModal}
        onClose={() => setShowNamingModal(false)}
        onConfirm={handleProjectConfirm}
        initialName={mediaTitle}
        initialDescription={projectMetadata?.description}
        initialTags={projectMetadata?.tags}
        isEditing={true}
      />

      {pendingProject && (
        <div className="fixed inset-0 z-popover flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDiscardProject}
          />
          <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-elevated animate-fade-in">
            <h3 className="text-lg font-bold text-zinc-100 mb-4">{t('project.restoreTitle')}</h3>
            <p className="text-sm text-zinc-400 mb-6">{t('project.restoreMessage')}</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleDiscardProject} className="flex-1">
                {t('common.discard')}
              </Button>
              <Button
                onClick={handleRestoreProject}
                className="flex-1 bg-primary text-zinc-950 hover:bg-primary-dim"
              >
                {t('common.restore')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {unsavedModalTarget && (
        <div className="fixed inset-0 z-popover flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setUnsavedModalTarget(null)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-elevated animate-fade-in">
            <h3 className="text-lg font-bold text-zinc-100 mb-4">{t('confirm.unsavedChangesTitle') || 'Unsaved Changes'}</h3>
            <p className="text-sm text-zinc-400 mb-6">{t('confirm.unsavedChangesMessage') || 'You have unsaved changes. Do you want to save them before leaving?'}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={async () => {
                  await handleManualSave();
                  const target = unsavedModalTarget;
                  setUnsavedModalTarget(null);
                  navigate(target);
                }}
                className="w-full bg-primary text-zinc-950 hover:bg-primary-dim font-bold"
              >
                {t('common.saveAndLeave') || 'Save and Leave'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const target = unsavedModalTarget;
                  setUnsavedModalTarget(null);
                  navigate(target);
                }}
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {t('common.discardAndLeave') || 'Discard and Leave'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setUnsavedModalTarget(null)}
                className="w-full text-zinc-500"
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
