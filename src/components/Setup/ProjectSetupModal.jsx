import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { uploads as uploadsApi } from '../../api';
import toast from 'react-hot-toast';

export default function ProjectSetupModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  initialName = '',
  initialDescription = '',
  initialTags = [],
  initialCoverUrl = '',
  initialCoverPublicId = ''
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPublicId, setCoverPublicId] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const tagInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setDescription(initialDescription || '');
      setTags(initialTags || []);
      setTagInput('');
      setCoverUrl(initialCoverUrl || '');
      setCoverPublicId(initialCoverPublicId || '');
    }
  }, [isOpen, initialName, initialDescription, initialTags, initialCoverUrl, initialCoverPublicId]);

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

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('setup.invalidImageType'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('setup.imageTooLarge'));
      return;
    }

    setCoverUploading(true);

    try {
      const { secure_url, public_id } = await uploadsApi.uploadImage(
        file,
        () => uploadsApi.getCoverSignature()
      );
      setCoverUrl(secure_url);
      setCoverPublicId(public_id);
      toast.success(t('setup.coverUploaded'));
    } catch (err) {
      console.error('Cover upload failed:', err);
      toast.error(t('setup.coverUploadFailed'));
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCover = () => {
    setCoverUrl('');
    setCoverPublicId('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalTags = tagInput.trim() ? [...tags, tagInput.trim()] : tags;
    onConfirm({ 
      name: name.trim(), 
      description: description.trim(), 
      tags: finalTags,
      coverUrl: coverUrl || null,
      coverPublicId: coverPublicId || null,
    });
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
              <h3 className="text-lg font-bold text-zinc-100">{t('setup.title')}</h3>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
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

            {/* Cover image */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-zinc-300">
                {t('setup.projectCover')}
              </Label>
              <div className="flex items-start gap-3">
                {coverUrl ? (
                  <div className="relative group">
                    <img
                      src={coverUrl}
                      alt="Cover"
                      className="w-20 h-20 rounded-lg object-cover border-2 border-zinc-700"
                    />
                    {coverUploading && (
                      <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                  </div>
                )}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={coverUploading}
                      className="gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {coverUrl ? t('setup.changeCover') : t('setup.uploadCover')}
                    </Button>
                    {coverUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRemoveCover}
                        disabled={coverUploading}
                        className="gap-2 text-red-400 hover:text-red-300 border-red-900/20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t('setup.coverHint')}
                  </p>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dim text-zinc-950 font-semibold text-sm rounded-xl h-10 mt-1"
            >
              {t('setup.startProject')}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
