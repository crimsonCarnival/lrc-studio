import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { Label } from '@ui/label';
import { Badge } from '@ui/badge';
import { X, Sparkles, Image as ImageIcon, Upload, Loader2, Video, Music2 } from 'lucide-react';


export default function ProjectSetupModal({
  isOpen,
  onClose,
  onConfirm,
  initialName = '',
  initialDescription = '',
  initialTags = [],
  isEditing = false,
  sourceInfo = null
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(initialName || '');
      setDescription(initialDescription || '');
      setTags(initialTags || []);
      setTagInput('');
    }
  }, [isOpen, initialName, initialDescription, initialTags]);

  if (!isOpen) return null;

  const addTag = (text) => {
    const trimmed = text.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
  };

  const removeTag = (index) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTagInputChange = (e) => {
    const value = e.target.value;
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.slice(0, -1).forEach((p) => addTag(p));
      setTagInput(parts[parts.length - 1]);
    } else {
      setTagInput(value);
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        addTag(tagInput);
        setTagInput('');
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalTags = tagInput.trim() ? [...tags, tagInput.trim()] : tags;
    onConfirm({
      name: name.trim(),
      description: description.trim(),
      tags: finalTags,
    });
  };

  const renderSourceInfo = () => {
    if (!sourceInfo) return null;
    const { ytUrl, cloudinary, spotifyId, title } = sourceInfo;

    let sourceIcon = <Music2 className="w-4 h-4" />;
    let sourceLabel = t('setup.audioSource');
    let sourceValue = title || initialName;

    if (ytUrl) {
      sourceIcon = <Video className="w-4 h-4 text-red-500" />;
      sourceLabel = t('setup.youtubeVideo');
      // title is the resolved media title (e.g. fetched from YouTube oEmbed).
      // Fall back to the raw URL so the field is never blank.
      sourceValue = title || initialName || ytUrl;
    } else if (spotifyId) {
      sourceIcon = <Music2 className="w-4 h-4 text-primary" />;
      sourceLabel = t('setup.spotifyTrack');
      // title is populated once the Spotify metadata resolves.
      // Fall back to the track ID so the field is never blank.
      sourceValue = title || initialName || spotifyId;
    } else if (cloudinary) {
      sourceIcon = <Upload className="w-4 h-4 text-blue-400" />;
      sourceLabel = t('setup.cloudUpload');
      sourceValue = cloudinary.title || cloudinary.fileName || title || initialName;
    }

    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50 mb-2">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-700/60 shadow-sm">
          {sourceIcon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider leading-none mb-1">
            {sourceLabel}
          </p>
          <p className="text-sm font-medium text-zinc-200 truncate">
            {sourceValue}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-modal-backdrop animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-elevated pointer-events-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-700/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">
                {isEditing ? t('setup.settingsTitle') || 'Project Settings' : t('setup.title')}
              </h3>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 pt-4">
            {renderSourceInfo()}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name" className="text-xs font-semibold text-zinc-300">
                {t('setup.projectName')}
              </Label>
              <Input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('setup.projectNamePlaceholder')}
                autoFocus
                maxLength={200}
                className="bg-zinc-800/80 border-zinc-700/60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-desc" className="text-xs font-semibold text-zinc-300">
                {t('setup.projectDescription')}
              </Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('setup.projectDescriptionPlaceholder')}
                maxLength={1000}
                className="min-h-[80px] max-h-[140px] bg-zinc-800/80 border-zinc-700/60 resize-none text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-tags" className="text-xs font-semibold text-zinc-300">
                {t('setup.projectTags')}
              </Label>
              <div
                className="flex flex-wrap items-center gap-1.5 min-h-[38px] px-2.5 py-1.5 bg-zinc-800/80 border border-zinc-700/60 rounded-md cursor-text focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all"
                onClick={() => tagInputRef.current?.focus()}
              >
                {tags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-zinc-700/80 text-zinc-200 border-zinc-600/50 animate-fade-in"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-zinc-600/80 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
                <input
                  ref={tagInputRef}
                  id="project-tags"
                  type="text"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? t('setup.projectTagsPlaceholder') : ''}
                  maxLength={100}
                  className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-500"
                />
              </div>
            </div>



            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 font-semibold text-sm rounded-xl h-10"
              >
                {t('setup.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10"
              >
                {isEditing ? t('setup.saveChanges') : t('setup.startToSync')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}