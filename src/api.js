/**
 * API barrel — backward-compatible re-exports.
 *
 * All domain-specific API logic now lives in src/services/*.service.js.
 * This file re-exports everything under the original named export shapes
 * so existing imports like `import { auth, projects } from '@/api'` keep working.
 *
 * New code should import directly from the service files:
 *   import { authService } from '@/services/auth.service'
 */
export { setAccessToken, getAccessToken, clearAccessToken, request, setAuthFlag } from './services/api.client.js';

import { authService } from './services/auth.service.js';
import { settingsService } from './services/settings.service.js';
import { projectsService } from './services/projects.service.js';
import { lyricsService, editorService } from './services/lyrics.service.js';
import { uploadsService } from './services/uploads.service.js';
import { spotifyService } from './services/spotify.service.js';
import { adminService } from './services/admin.service.js';
import { request } from './services/api.client.js';

// Original named exports (object-style, backward compatible)
export const auth = authService;
export const settings = settingsService;
export const projects = projectsService;
export const lyrics = lyricsService;
export const editor = editorService;
export const uploads = uploadsService;
export const spotify = spotifyService;
export const admin = adminService;

export const api = {
  auth,
  settings,
  projects,
  lyrics,
  editor,
  uploads,
  spotify,
  admin,
  getHealth() { return request('/health'); },
};

export default api;
