import { useTranslation } from 'react-i18next';
import { Section, SettingRow, Toggle } from '../shared';
import { useInterfaceSettings } from '../hooks/useInterfaceSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Monitor, Moon, Sparkles, Globe, ScrollText, AlignCenter, AlignLeft, Type, Rows2, LayoutList, ChevronDown, Columns, BookOpen, Lock } from 'lucide-react';

export default function InterfaceSettings({ settings, updateSetting, searchTerm }) {
  const { t } = useTranslation();
  const {
    handleLanguageChange,
    handleThemeChange,
    handleActiveHighlightChange,
    handleScrollModeChange,
    handleScrollAlignmentChange,
    handlePreviewAlignmentChange,
    handleFontSizeChange,
    handleSpacingChange,
    handleTranslationLayoutChange,
  } = useInterfaceSettings(updateSetting);

  return (
    <Section title={t('settings.interface.label')} icon={Monitor} searchTerm={searchTerm}>
      <SettingRow icon={Moon} label={t('settings.interface.theme')} description={t('settings.interface.themeDesc')}>
        <Select
          value={settings.interface?.theme ?? 'dark'}
          onValueChange={(val) => handleThemeChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="dark">{t('settings.options.themes.dark')}</SelectItem>
            <SelectItem value="light">{t('settings.options.themes.light')}</SelectItem>
            <SelectItem value="dracula">{t('settings.options.themes.dracula')}</SelectItem>
            <SelectItem value="alucard">{t('settings.options.themes.alucard')}</SelectItem>
            <SelectItem value="alucardlight">{t('settings.options.themes.alucardLight')}</SelectItem>
            <SelectItem value="system">{t('settings.options.themes.system')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Sparkles} label={t('settings.interface.activeLineHighlight')} description={t('settings.interface.activeLineHighlightDesc')}>
        <Select
          value={settings.editor?.display?.activeHighlight ?? 'glow'}
          onValueChange={(val) => handleActiveHighlightChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="glow">{t('settings.options.highlights.glow')}</SelectItem>
            <SelectItem value="zoom">{t('settings.options.highlights.zoom')}</SelectItem>
            <SelectItem value="color">{t('settings.options.highlights.color')}</SelectItem>
            <SelectItem value="dim">{t('settings.options.highlights.dim')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Globe} label={t('settings.interface.language')} description={t('settings.interface.languageDesc')}>
        <Select
          value={settings.interface?.defaultLanguage ?? 'en'}
          onValueChange={(val) => handleLanguageChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="ja">日本語</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={ScrollText} label={t('settings.interface.scrollBehavior')} description={t('settings.interface.scrollBehaviorDesc')}>
        <Select
          value={settings.editor?.scroll?.mode ?? 'smooth'}
          onValueChange={(val) => handleScrollModeChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="smooth">{t('settings.interface.scrollSmooth')}</SelectItem>
            <SelectItem value="instant">{t('settings.interface.scrollInstant')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={AlignCenter} label={t('settings.interface.scrollBlock')} description={t('settings.interface.scrollBlockDesc')}>
        <Select
          value={settings.editor?.scroll?.alignment ?? 'center'}
          onValueChange={(val) => handleScrollAlignmentChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="center">{t('settings.interface.scrollCenter')}</SelectItem>
            <SelectItem value="nearest">{t('settings.interface.scrollNearest')}</SelectItem>
            <SelectItem value="start">{t('settings.interface.scrollTop')}</SelectItem>
            <SelectItem value="none">{t('settings.interface.scrollOff')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={AlignLeft} label={t('settings.interface.previewAlignment')} description={t('settings.interface.previewAlignmentDesc')}>
        <Select
          value={settings.interface?.previewAlignment ?? 'left'}
          onValueChange={(val) => handlePreviewAlignmentChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="left">{t('settings.interface.alignLeft')}</SelectItem>
            <SelectItem value="center">{t('settings.interface.alignCenter')}</SelectItem>
            <SelectItem value="right">{t('settings.interface.alignRight')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Type} label={t('settings.interface.fontSize')} description={t('settings.interface.fontSizeDesc')}>
        <Select
          value={settings.interface?.fontSize ?? 'normal'}
          onValueChange={(val) => handleFontSizeChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="small">{t('settings.options.sizes.small')}</SelectItem>
            <SelectItem value="normal">{t('settings.options.sizes.normal')}</SelectItem>
            <SelectItem value="large">{t('settings.options.sizes.large')}</SelectItem>
            <SelectItem value="xlarge">{t('settings.options.sizes.xLarge')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Rows2} label={t('settings.interface.spacing')} description={t('settings.interface.spacingDesc')}>
        <Select
          value={settings.interface?.spacing ?? 'normal'}
          onValueChange={(val) => handleSpacingChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="compact">{t('settings.options.spacing.compact')}</SelectItem>
            <SelectItem value="normal">{t('settings.options.spacing.normal')}</SelectItem>
            <SelectItem value="relaxed">{t('settings.options.spacing.relaxed')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={LayoutList} label={t('settings.interface.dualLine')} description={t('settings.interface.dualLineDesc')}>
        <Toggle
          id="toggle-dual-line"
          checked={settings.editor?.display?.dualLine ?? false}
          onChange={(v) => updateSetting('editor.display.dualLine', v)}
        />
      </SettingRow>
      {(settings.editor?.display?.dualLine) && (
        <SettingRow icon={ChevronDown} label={t('settings.interface.showNextLine')} description={t('settings.interface.showNextLineDesc')}>
          <Toggle
            id="toggle-show-next-line"
            checked={settings.editor?.display?.showNextLine ?? true}
            onChange={(v) => updateSetting('editor.display.showNextLine', v)}
          />
        </SettingRow>
      )}
      <SettingRow icon={Columns} label={t('settings.interface.translationLayout')} description={t('settings.interface.translationLayoutDesc')}>
        <Select
          value={settings.editor?.display?.translationLayout ?? 'side-by-side'}
          onValueChange={(val) => handleTranslationLayoutChange({ target: { value: val } })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="stacked">{t('settings.interface.layoutStacked')}</SelectItem>
            <SelectItem value="side-by-side">{t('settings.interface.layoutSideBySide')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Sparkles} label={t('settings.interface.karaokeFillTrack')} description={t('settings.interface.karaokeFillTrackDesc')}>
        <Select
          value={settings.editor?.display?.karaokeFillTrack ?? 'main'}
          onValueChange={(val) => updateSetting('editor.display.karaokeFillTrack', val)}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="main">{t('settings.interface.fillTrackMain')}</SelectItem>
            <SelectItem value="secondary">{t('settings.interface.fillTrackSecondary')}</SelectItem>
            <SelectItem value="both">{t('settings.interface.fillTrackBoth')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Sparkles} label={t('settings.interface.karaokeFillEasing') || 'Fill Easing'} description={t('settings.interface.karaokeFillEasingDesc') || 'Controls how the karaoke fill animates across each word'}>
        <Select
          value={settings.editor?.display?.karaokeFillEasing ?? 'linear'}
          onValueChange={(val) => updateSetting('editor.display.karaokeFillEasing', val)}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="linear">{t('settings.interface.fillEasingLinear') || 'Linear (Accurate)'}</SelectItem>
            <SelectItem value="ease-in-out">{t('settings.interface.fillEasingEaseInOut') || 'Ease In/Out (Smooth)'}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={BookOpen} label={t('settings.interface.readingFormat')} description={t('settings.interface.readingFormatDesc')}>
        <Select
          value={settings.editor?.display?.readingFormat ?? 'hiragana'}
          onValueChange={(val) => updateSetting('editor.display.readingFormat', val)}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:border-primary/50 h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="hiragana">{t('editor.readingFormat.hiragana')}</SelectItem>
            <SelectItem value="katakana">{t('editor.readingFormat.katakana')}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow icon={Lock} label={t('settings.interface.lockLayout')} description={t('settings.interface.lockLayoutDesc')}>
        <Toggle
          id="toggle-lock-layout"
          checked={settings.interface?.lockLayout ?? false}
          onChange={(v) => updateSetting('interface.lockLayout', v)}
        />
      </SettingRow>
    </Section>
  );
}
