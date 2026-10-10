'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './client-api';
export type SessionActor = { name: string; email: string; role: string; mfa?: boolean };
export function useSession() {
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const session = await api<{ actor: SessionActor | null }>('session'); setActor(session.actor); }
    catch { setActor(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener('balaji-session-changed', update);
    window.addEventListener('focus', update);
    return () => { window.removeEventListener('balaji-session-changed', update); window.removeEventListener('focus', update); };
  }, [refresh]);
  return { actor, loading, refresh };
}
