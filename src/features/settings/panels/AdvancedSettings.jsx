import { useTranslation } from 'react-i18next';
import { Section, SettingRow, Toggle } from '../shared';
import { useAdvancedSettings } from '../hooks/useAdvancedSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { SlidersHorizontal, Save, Timer, ShieldAlert, Globe, Lock } from 'lucide-react';

const COMMON_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Bogota', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Mexico_City',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Moscow',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Seoul', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Nairobi',
];

export default function AdvancedSettings({ settings, updateSetting, searchTerm, isGuest }) {
  const { t } = useTranslation();
  const {
    handleAutoSaveToggle,
    handleAutoSaveTimeIntervalChange,
    handleConfirmDestructiveChange,
    handleTimezoneChange,
  } = useAdvancedSettings(updateSetting);

  return (
    <Section title={t('settings.advanced.label')} icon={SlidersHorizontal} searchTerm={searchTerm}>
      {isGuest ? (
        /* Guests: show Auto Save row as locked with a note */
        <SettingRow icon={Save} label={t('settings.advanced.autoSave')} description={t('settings.advanced.autoSaveDesc')}>
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-[11px] text-zinc-500 italic">
              {t('settings.advanced.autoSaveGuestNote', 'Requires an account')}
            </span>
          </div>
        </SettingRow>
      ) : (
        <>
          <SettingRow icon={Save} label={t('settings.advanced.autoSave')} description={t('settings.advanced.autoSaveDesc')}>
            <Toggle
              id="toggle-auto-save"
              checked={settings.advanced?.autoSave?.enabled ?? false}
              onChange={handleAutoSaveToggle}
            />
          </SettingRow>

          {settings.advanced?.autoSave?.enabled && (
            <SettingRow
              icon={Timer}
              label={t('settings.advanced.autoSaveInterval')}
              description={t('settings.advanced.autoSaveIntervalDesc')}
            >
              <Select
                value={String(settings.advanced?.autoSave?.timeInterval ?? 30)}
                onValueChange={(val) => handleAutoSaveTimeIntervalChange({ target: { value: Number(val) } })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="5">{t('settings.advanced.autoSaveSeconds', { count: 5 })}</SelectItem>
                  <SelectItem value="10">{t('settings.advanced.autoSaveSeconds', { count: 10 })}</SelectItem>
                  <SelectItem value="30">{t('settings.advanced.autoSaveSeconds', { count: 30 })}</SelectItem>
                  <SelectItem value="60">{t('settings.advanced.autoSaveSeconds', { count: 60 })}</SelectItem>
                  <SelectItem value="120">{t('settings.advanced.autoSaveSeconds', { count: 120 })}</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          )}
        </>
      )}

      <SettingRow
        icon={ShieldAlert}
        label={t('settings.advanced.confirmDestructive')}
        description={t('settings.advanced.confirmDestructiveDesc')}
      >
        <Toggle
          id="toggle-confirm-destructive"
          checked={settings.advanced?.confirmDestructive ?? true}
          onChange={handleConfirmDestructiveChange}
        />
      </SettingRow>

      <SettingRow
        icon={Globe}
        label={t('settings.advanced.timezone') || 'Timezone'}
        description={t('settings.advanced.timezoneDesc') || 'Override detected timezone for saved timestamps'}
      >
        <Select
          value={settings.advanced?.timezone ?? 'auto'}
          onValueChange={(val) => handleTimezoneChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="auto">
              {t('settings.advanced.timezoneAuto') || 'Auto'} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </SelectItem>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </Section>
  );
}
