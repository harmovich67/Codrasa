import { create } from 'zustand';
import { api, tokenStore, setUnauthorizedHandler } from '../lib/api.js';

export const useAuth = create((set, getState) => ({
  user: null,
  ready: false,
  platform: { platform_name: 'Codrasa', allow_registration: true, currency: 'ج.م', payment_phone: '+201022596130', questions_enabled: true },

  async init() {
    const platform = await api.get('/settings/public').catch(() => null);
    if (platform) {
      set({ platform });
      document.title = platform.platform_name;
    }
    if (!tokenStore.get()) return set({ ready: true });
    try {
      const { user } = await api.get('/auth/me');
      set({ user, ready: true });
    } catch {
      tokenStore.clear();
      set({ user: null, ready: true });
    }
  },

  async refreshPlatform() {
    const platform = await api.get('/settings/public');
    set({ platform });
    document.title = platform.platform_name;
  },

  async authenticate(path, body) {
    const { token, user, pending } = await api.post(path, body);
    // Self-registration waits for the teacher's approval: no session yet.
    if (pending) return { pending: true };
    tokenStore.set(token);
    set({ user });
    return user;
  },

  logout() {
    tokenStore.clear();
    set({ user: null });
  },

  isTeacher: () => getState().user?.role === 'teacher',
}));

setUnauthorizedHandler(() => {
  if (useAuth.getState().user) useAuth.getState().logout();
});
