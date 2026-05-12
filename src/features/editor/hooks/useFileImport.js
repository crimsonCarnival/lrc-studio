import { useRef } from 'react';
import toast from 'react-hot-toast';
import { lyrics } from '@/api';
import { useTranslation } from 'react-i18next';

export function useFileImport({ setLines, setEditorMode, setActiveLineIndex, setSyncMode, onImport }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['lrc', 'srt', 'txt'].includes(ext)) {
      toast.error(t('import.unsupportedFormat') || 'Unsupported file type. Use .lrc, .srt, or .txt files.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('import.tooLarge') || 'File too large (max 5 MB)');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const { lines: parsed } = await lyrics.parse(evt.target.result, file.name);
        if (parsed.length > 0) {
          setLines(parsed);
          {
            const isSrt = file.name.toLowerCase().endsWith('.srt');
            const hasWords = !isSrt && parsed.some(l => l.words?.length > 0);
            setEditorMode(isSrt ? 'srt' : hasWords ? 'words' : 'lrc');
          }
          setActiveLineIndex(Math.max(0, parsed.findIndex((l) => l.timestamp == null)));
          setSyncMode(true);
          toast.success(t('import.success', { count: parsed.length }) || `Imported ${parsed.length} lines`);
          onImport?.();
        } else {
          toast.error(t('import.noLines') || 'No lyrics found in file');
        }
      } catch (err) {
        console.error('Failed to parse lyrics file', err);
        toast.error(t('import.failed') || 'Failed to parse lyrics file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUrlImport = async (url) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return { error: t('import.invalidUrl') || 'Invalid URL. Use http:// or https://' };
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const filename = parsedUrl.pathname.split('/').pop() || 'lyrics.lrc';
      const { lines: parsed } = await lyrics.parse(text, filename);
      if (parsed.length === 0) {
        return { error: t('import.noLines') || 'No lyrics found in file' };
      }
      setLines(parsed);
      {
        const isSrt = filename.toLowerCase().endsWith('.srt');
        const hasWords = !isSrt && parsed.some(l => l.words?.length > 0);
        setEditorMode(isSrt ? 'srt' : hasWords ? 'words' : 'lrc');
      }
      setActiveLineIndex(Math.max(0, parsed.findIndex((l) => l.timestamp == null)));
      setSyncMode(true);
      toast.success(t('import.success', { count: parsed.length }) || `Imported ${parsed.length} lines`);
      onImport?.();
      return { success: true };
    } catch {
      return { error: t('import.fetchError') || 'Failed to fetch. The server may not allow cross-origin requests.' };
    }
  };

  return { handleFileUpload, handleUrlImport, fileInputRef };
}
