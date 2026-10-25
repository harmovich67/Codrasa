import { create } from 'zustand';

export const useToasts = create((set) => ({
  items: [],
  push(item) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ items: [...s.items, { id, ...item }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), item.duration || 3800);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = {
  success: (message) => useToasts.getState().push({ type: 'success', message }),
  error: (message) => useToasts.getState().push({ type: 'error', message: message?.message || message, duration: 5500 }),
  info: (message) => useToasts.getState().push({ type: 'info', message }),
};
