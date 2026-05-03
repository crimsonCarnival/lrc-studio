/**
 * API client for the lyrics-syncer backend.
 * Provides typed wrappers around all server endpoints.
 * Lyrics operations fall back to local utils when the server is unreachable.
 */

import {
  parseLrcSrtFile as localParse,
  compileLRC as localCompileLRC,
  compileSRT as localCompileSRT,
  inferEndTimes as localInferEndTimes,
} from './utils/lrc';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

async function request(path, options = {}) {
  const headers = { ...options.headers };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// ——— Auth ———

export const auth = {
  async register({ username, email, password }) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  async login({ identifier, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  async refresh(refreshToken) {
    return request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  async me() {
    return request('/auth/me');
  },

  async updateProfile(data) {
    return request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ——— Settings ———

export const settings = {
  async get() {
    return request('/settings');
  },

  async save(data) {
    return request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async patch(data) {
    return request('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async reset() {
    return request('/settings', { method: 'DELETE' });
  },
};

// ——— Projects ———

export const projects = {
  async create(data) {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async list() {
    return request('/projects');
  },

  async get(projectId) {
    return request(`/projects/${encodeURIComponent(projectId)}`);
  },

  async update(projectId, data) {
    return request(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async patch(projectId, data) {
    return request(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async remove(projectId) {
    return request(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
  },

  async getShare(projectId) {
    return request(`/projects/share/${encodeURIComponent(projectId)}`);
  },

  async clone(projectId) {
    return request(`/projects/clone/${encodeURIComponent(projectId)}`, {
      method: 'POST',
    });
  },
};

// ——— Lyrics (parse/compile) — falls back to local utils when server is unreachable ———

function isNetworkError(err) {
  return err instanceof TypeError || err.message === 'Failed to fetch';
}

export const lyrics = {
  async parse(content, filename) {
    try {
      return await request('/lyrics/parse', {
        method: 'POST',
        body: JSON.stringify({ content, filename }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const lines = localParse(content, filename);
        return { lines, detectedFormat: filename.toLowerCase().endsWith('.srt') ? 'srt' : 'lrc', count: lines.length };
      }
      throw err;
    }
  },

  async compileLrc({ lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision }) {
    try {
      return await request('/lyrics/compile/lrc', {
        method: 'POST',
        body: JSON.stringify({ lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const output = localCompileLRC(lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision);
        return { output, format: 'lrc' };
      }
      throw err;
    }
  },

  async compileSrt({ lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary }) {
    try {
      return await request('/lyrics/compile/srt', {
        method: 'POST',
        body: JSON.stringify({ lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const output = localCompileSRT(lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary);
        return { output, format: 'srt' };
      }
      throw err;
    }
  },

  async inferEndTimes({ lines, duration, srtConfig }) {
    try {
      return await request('/lyrics/infer-end-times', {
        method: 'POST',
        body: JSON.stringify({ lines, duration, srtConfig }),
      });
    } catch (err) {
      if (isNetworkError(err)) {
        const result = localInferEndTimes(lines, duration, srtConfig);
        return { lines: result };
      }
      throw err;
    }
  },
};

// ——— Editor operations ———

export const editor = {
  async mark({ lines, activeLineIndex, time, editorMode, activeWordIndex, stampTarget, awaitingEndMark, focusedTimestamp, settings }) {
    return request('/editor/mark', {
      method: 'POST',
      body: JSON.stringify({ lines, activeLineIndex, time, editorMode, activeWordIndex, stampTarget, awaitingEndMark, focusedTimestamp, settings }),
    });
  },

  async bulkShift({ lines, selectedIndices, delta }) {
    return request('/editor/bulk-shift', {
      method: 'POST',
      body: JSON.stringify({ lines, selectedIndices, delta }),
    });
  },

  async globalOffset({ lines, delta }) {
    return request('/editor/global-offset', {
      method: 'POST',
      body: JSON.stringify({ lines, delta }),
    });
  },

  async clearAll({ lines, isSrt, isWords }) {
    return request('/editor/clear-all', {
      method: 'POST',
      body: JSON.stringify({ lines, isSrt, isWords }),
    });
  },

  async clearLine({ lines, index, isSrt, isWords }) {
    return request('/editor/clear-line', {
      method: 'POST',
      body: JSON.stringify({ lines, index, isSrt, isWords }),
    });
  },

  async detectDuplicates({ lines, threshold }) {
    return request('/editor/detect-duplicates', {
      method: 'POST',
      body: JSON.stringify({ lines, threshold }),
    });
  },
};

// ——— Uploads ———

export const uploads = {
  async getSignature({ fileName, fileSize }) {
    return request('/uploads/signature', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSize }),
    });
  },

  /**
   * Upload a file to Cloudinary using a server-signed request.
   * Returns { secure_url, public_id, duration }.
   */
  async uploadToCloudinary(file) {
    // 1. Get signature from our server
    const { signature, timestamp, cloudName, apiKey, folder, resourceType } =
      await this.getSignature({ fileName: file.name, fileSize: file.size });

    // 2. Upload directly to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    // NOTE: resource_type is a URL path param, not a form field

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
      { method: 'POST', body: formData },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `Upload failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      duration: data.duration || null,
    };
  },

  // ── Media library ──

  async listMedia({ limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request(`/uploads/media?${params.toString()}`);
  },

  async saveMedia(data) {
    return request('/uploads/media', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMedia(id) {
    return request(`/uploads/media/${encodeURIComponent(id)}`);
  },

  async deleteMedia(id) {
    return request(`/uploads/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async updateMedia(id, data) {
    return request(`/uploads/media/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // ── Avatar & Cover ──

  async getAvatarSignature() {
    return request('/uploads/avatar-signature', { method: 'POST' });
  },

  /**
   * Upload an image to Cloudinary (for avatars).
   * Returns { secure_url, public_id }.
   */
  async uploadImage(file, signatureGetter) {
    const { signature, timestamp, cloudName, apiKey, folder, resourceType } =
      await signatureGetter();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
      { method: 'POST', body: formData },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `Upload failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
    };
  },
};

// ——— Spotify ———

export const spotify = {
  async resolve(url) {
    return request('/spotify/resolve', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  async getAuthUrl() {
    return request('/spotify/auth/url');
  },

  async getToken() {
    return request('/spotify/token');
  },

  async disconnect() {
    return request('/spotify/disconnect', { method: 'POST' });
  },

  async createUpload(url) {
    return request('/spotify/upload', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  // ——— Search ———
  async search(q, { limit = 5, offset = 0 } = {}) {
    const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
    return request(`/spotify/search?${params}`);
  },

  // ——— Library browsing ———
  async getSavedTracks({ limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request(`/spotify/saved-tracks?${params}`);
  },

  async getRecentlyPlayed({ limit = 20 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    return request(`/spotify/recently-played?${params}`);
  },

  async getTopTracks({ timeRange = 'medium_term', limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ time_range: timeRange, limit: String(limit), offset: String(offset) });
    return request(`/spotify/top-tracks?${params}`);
  },

  // ——— Library save/remove/check ———
  async saveToLibrary(uris) {
    return request('/spotify/library', {
      method: 'PUT',
      body: JSON.stringify({ uris }),
    });
  },

  async removeFromLibrary(uris) {
    return request('/spotify/library', {
      method: 'DELETE',
      body: JSON.stringify({ uris }),
    });
  },

  async checkLibrary(uris) {
    const params = new URLSearchParams({ uris: uris.join(',') });
    return request(`/spotify/library/contains?${params}`);
  },

  // ——— Playlists ———
  async getPlaylists({ limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request(`/spotify/playlists?${params}`);
  },

  async getPlaylistTracks(playlistId, { limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request(`/spotify/playlists/${encodeURIComponent(playlistId)}/tracks?${params}`);
  },

  async createPlaylist(name, description = '', isPublic = false) {
    return request('/spotify/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, public: isPublic }),
    });
  },

  async addToPlaylist(playlistId, uris) {
    return request(`/spotify/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris }),
    });
  },

  // ——— Player / Devices ———
  async getDevices() {
    return request('/spotify/devices');
  },

  async transferPlayback(deviceId, play = false) {
    return request('/spotify/player/transfer', {
      method: 'PUT',
      body: JSON.stringify({ deviceId, play }),
    });
  },

  async getPlaybackState() {
    return request('/spotify/player');
  },

  async getCurrentlyPlaying() {
    return request('/spotify/player/currently-playing');
  },

  async addToQueue(uri, deviceId) {
    return request('/spotify/player/queue', {
      method: 'POST',
      body: JSON.stringify({ uri, deviceId }),
    });
  },

  async getQueue() {
    return request('/spotify/player/queue');
  },
};
