import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '@/contexts/useAuthContext';
import { authService } from '@/services/auth.service';
import { uploadsService } from '@/services/uploads.service';
import { User, Upload, Trash2, Loader2, Save, ExternalLink, Unplug } from 'lucide-react';
import SpotifyIcon from "@shared/SpotifyIcon";
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import toast from 'react-hot-toast';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

export default function ProfileSettings({ searchTerm }) {
  const { t } = useTranslation();
  const { user, setUser, connectSpotify, disconnectSpotify } = useAuthContext();
  const { executeRecaptcha } = useGoogleReCaptcha();
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.invalidImageType'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.imageTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const recaptchaToken = executeRecaptcha ? await executeRecaptcha('upload_avatar') : undefined;
      const { url, publicId } = await uploadsService.uploadAvatar(file, recaptchaToken);
      const { user: updatedUser } = await authService.updateProfile({ 
        avatarUrl: url, 
        avatarPublicId: publicId 
      });
      setUser(updatedUser);
      toast.success(t('profile.avatarUpdated'));
    } catch {
      toast.error(t('profile.avatarUploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      const { user: updatedUser } = await authService.updateProfile({ 
        avatarUrl: null, 
        avatarPublicId: null 
      });
      setUser(updatedUser);
      toast.success(t('profile.avatarRemoved'));
    } catch {
      toast.error(t('profile.avatarRemoveFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { user: updatedUser } = await authService.updateProfile(formData);
      setUser(updatedUser);
      toast.success(t('profile.saveSuccess'));
    } catch (err) {
      const msg = err.response?.data?.error || t('profile.saveError');
      toast.error(msg === 'Username already taken' ? t('auth.usernameTaken') : msg);
    } finally {
      setSaving(false);
    }
  };

  // When searching, hide if not matching
  const matchesSearch = !searchTerm || 
    t('profile.title').toLowerCase().includes(searchTerm.toLowerCase()) ||
    t('profile.username').toLowerCase().includes(searchTerm.toLowerCase()) ||
    t('profile.email').toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch) return null;

  return (
    <div className="space-y-8">
      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-zinc-800/60">
        <div className="relative group">
          <div 
            onClick={handleAvatarClick}
            className="w-24 h-24 rounded-3xl bg-zinc-800 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-zinc-700/50 group-hover:border-primary/50 transition-all duration-300"
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-zinc-600" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h4 className="text-sm font-bold text-zinc-100 mb-1">{t('profile.avatar')}</h4>
          <p className="text-xs text-zinc-500 mb-4">{t('profile.avatarHint')}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <Button 
              size="sm" 
              onClick={handleAvatarClick} 
              disabled={uploading}
              className="rounded-xl h-8 text-[11px] font-bold"
            >
              {user?.avatarUrl ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
            </Button>
            {user?.avatarUrl && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleRemoveAvatar}
                disabled={uploading}
                className="rounded-xl h-8 text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-400/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t('profile.removeAvatar')}
              </Button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Account Info Form */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
              {t('profile.username')}
            </label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder={t('profile.username')}
              className="bg-zinc-800/30 border-zinc-700/50 rounded-xl h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
              {t('profile.email')}
            </label>
            <Input
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('profile.email')}
              className="bg-zinc-800/30 border-zinc-700/50 rounded-xl h-10 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
              {t('profile.bio')}
            </label>
            <span className="text-[9px] text-zinc-600 font-bold mr-1">{formData.bio.length}/160</span>
          </div>
          <Textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value.slice(0, 160) }))}
            placeholder={t('profile.bioPlaceholder')}
            className="bg-zinc-800/30 border-zinc-700/50 rounded-2xl min-h-[100px] text-sm resize-none"
          />
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800/60 pb-8">
          <Button
            onClick={handleSave}
            disabled={saving || (
              formData.username === user?.username && 
              formData.email === user?.email && 
              formData.bio === (user?.bio || '')
            )}
            className="w-full sm:w-auto min-w-[140px] h-10 rounded-xl font-bold gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('profile.save')}
          </Button>
        </div>

        {/* Spotify Section (Re-integrated) */}
        <div className="pt-4 animate-fade-in">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            {t('settings.spotify.label') || 'Spotify'}
          </h3>
          <p className="text-xs text-zinc-500 mb-4">{t('settings.spotify.connectDesc')}</p>

          {user?.spotify?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-950/20 border border-green-900/30">
                <div className="w-10 h-10 rounded-full bg-green-900/20 flex items-center justify-center shrink-0">
                  <SpotifyIcon className="w-5 h-5 text-green-400 shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-300">{t('settings.spotify.connected')}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.spotify.spotifyId || '---'}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${user.spotify.isPremium ? 'bg-green-600/20 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                  {user.spotify.isPremium ? t('settings.spotify.premium') : t('settings.spotify.free')}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await disconnectSpotify();
                    toast.success(t('settings.spotify.disconnected'));
                  } catch {
                    toast.error(t('settings.spotify.connectFailed'));
                  }
                }}
                className="gap-2 text-red-400 hover:text-red-300 border-red-900/20 rounded-xl h-8 text-[11px] font-bold"
              >
                <Unplug className="w-3.5 h-3.5" />
                {t('settings.spotify.disconnect')}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await connectSpotify();
                } catch (err) {
                  if (err.message !== 'State mismatch') {
                    toast.error(t('settings.spotify.connectFailed'));
                  }
                }
              }}
              className="gap-2 bg-green-600 hover:bg-green-500 text-white rounded-xl h-10 px-6 font-bold shadow-lg shadow-green-900/20"
            >
              <SpotifyIcon className="w-3.5 h-3.5" />
              {t('settings.spotify.connect')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
