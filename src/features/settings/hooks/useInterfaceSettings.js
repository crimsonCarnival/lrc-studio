import { useTranslation } from 'react-i18next';

export function useInterfaceSettings(updateSetting) {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    updateSetting('interface.defaultLanguage', lang);
    i18n.changeLanguage(lang);
  };

  const handleThemeChange = (e) => updateSetting('interface.theme', e.target.value);

  const handleActiveHighlightChange = (e) =>
    updateSetting('editor.display.activeHighlight', e.target.value);

  const handleScrollModeChange = (e) => updateSetting('editor.scroll.mode', e.target.value);

  const handleScrollAlignmentChange = (e) =>
    updateSetting('editor.scroll.alignment', e.target.value);

  const handlePreviewAlignmentChange = (e) =>
    updateSetting('interface.previewAlignment', e.target.value);

  const handleFontSizeChange = (e) => updateSetting('interface.fontSize', e.target.value);

  const handleSpacingChange = (e) => updateSetting('interface.spacing', e.target.value);

  const handleLanguageLayoutChange = (e) =>
    updateSetting('editor.display.languageLayout', e.target.value);

  const handleTranslationLayoutChange = (e) =>
    updateSetting('editor.display.translationLayout', e.target.value);

  const handleToastPositionChange = (e) =>
    updateSetting('interface.toastPosition', e.target.value);

  return {
    handleLanguageChange,
    handleThemeChange,
    handleActiveHighlightChange,
    handleScrollModeChange,
    handleScrollAlignmentChange,
    handlePreviewAlignmentChange,
    handleFontSizeChange,
    handleSpacingChange,
    handleLanguageLayoutChange,
    handleTranslationLayoutChange,
    handleToastPositionChange,
  };
}
