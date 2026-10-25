const TOKEN_KEY = 'codrasa_token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode — session will just not persist */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

function headers(extra = {}) {
  const token = tokenStore.get();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function fail(res) {
  const data = await res.json().catch(() => null);
  if (res.status === 401) onUnauthorized?.();
  const err = new Error(data?.error || `خطأ ${res.status}`);
  err.status = res.status;
  return err;
}

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${url}`, {
    method,
    headers: headers(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) throw await fail(res);
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData),

  // Streams a plain-text response, calling onChunk with the accumulated text.
  async stream(url, body, onChunk, signal) {
    const res = await fetch(`/api${url}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await fail(res);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onChunk(text);
    }
    return text;
  },

  // Fire-and-forget that survives page unloads (analytics, progress).
  beacon(url, body) {
    fetch(`/api${url}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  },
};
