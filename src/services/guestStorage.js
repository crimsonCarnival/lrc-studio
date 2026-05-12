const GUEST_SESSION_KEY = 'lrc-studio-guest-session';
const GUEST_PROJECTS_KEY = 'lrc-studio-guest-projects';
const GUEST_SETTINGS_KEY = 'lrc-syncer-settings';

function generateUUID() {
  return crypto.randomUUID();
}

export function getGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session && session.sessionId) return session;
    }
  } catch { /* ignore */ }
  return null;
}

export function createGuestSession() {
  const session = {
    sessionId: generateUUID(),
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
  return session;
}

export function touchGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      session.lastActiveAt = new Date().toISOString();
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
    }
  } catch { /* ignore */ }
}

export function clearGuestSession() {
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch { /* ignore */ }
}

export function getGuestProjects() {
  try {
    const raw = localStorage.getItem(GUEST_PROJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveGuestProject(project) {
  try {
    const projects = getGuestProjects();
    const idx = projects.findIndex((p) => p.tempId === project.tempId);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.push({
        ...project,
        tempId: project.tempId || generateUUID(),
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    localStorage.setItem(GUEST_PROJECTS_KEY, JSON.stringify(projects));
    touchGuestSession();
  } catch (e) {
    console.error('Failed to save guest project', e);
  }
}

export function removeGuestProject(tempId) {
  try {
    const projects = getGuestProjects().filter((p) => p.tempId !== tempId);
    localStorage.setItem(GUEST_PROJECTS_KEY, JSON.stringify(projects));
  } catch { /* ignore */ }
}

export function getGuestProject(tempId) {
  return getGuestProjects().find((p) => p.tempId === tempId) || null;
}

export function clearGuestProjects() {
  try {
    localStorage.removeItem(GUEST_PROJECTS_KEY);
  } catch { /* ignore */ }
}

export function hasGuestProjects() {
  const projects = getGuestProjects();
  return projects.length > 0;
}