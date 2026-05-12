import { useState, useRef, useEffect } from 'react';

/**
 * Uncontrolled input that binds wanakana romaji→hiragana conversion while mounted.
 * Only activates if the global `window.wanakana` is available (CDN load).
 */
export function ReadingInput({ defaultValue, onCommit, onCancel, className, style, placeholder, readingFormat }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const toKana = readingFormat === 'katakana' ? 'toKatakana' : 'toHiragana';
    window.wanakana?.bind(el, { IMEMode: toKana });
    return () => { window.wanakana?.unbind(el); };
  }, [readingFormat]);

  const commit = (val, direction = 0) => {
    if (committedRef.current) return;

    if (!val) {
      committedRef.current = true;
      onCommit('', direction);
      return;
    }

    let final = val;
    const isKatakana = readingFormat === 'katakana';

    // Force trailing 'n' to 'ん'/'ン' if it didn't convert
    if (final.toLowerCase().endsWith('n')) {
      final = final.slice(0, -1) + (isKatakana ? 'ン' : 'ん');
    }

    // Final conversion pass to catch any lingering romaji
    if (window.wanakana) {
      final = isKatakana ? window.wanakana.toKatakana(final) : window.wanakana.toHiragana(final);
    }

    // Validate: must be entirely Kana (Hiragana, Katakana, or long vowel marks)
    if (window.wanakana && final && !window.wanakana.isKana(final)) {
      setError(true);
      setTimeout(() => setError(false), 1000);
      return; // committedRef stays false so user can correct and retry
    }

    committedRef.current = true;
    onCommit(final, direction);
  };

  return (
    <input
      ref={ref}
      autoFocus
      type="text"
      defaultValue={defaultValue}
      onBlur={(e) => commit(e.target.value, 0)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          commit(e.target.value, e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          committedRef.current = true; // prevent blur-on-unmount from committing
          onCancel();
        }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder ?? '…'}
      className={`${className} caret-primary ${error ? 'ring-2 ring-red-500 animate-shake bg-red-500/10' : ''}`}
      style={{ ...style, minWidth: '24px' }}
    />
  );
}
