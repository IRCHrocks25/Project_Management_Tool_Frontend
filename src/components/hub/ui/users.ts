/**
 * useHubUsers — everyone from GET /auth/users, fetched once and shared by every Hub component.
 *
 *   const { users, byId, loading, error, me, reload } = useHubUsers();
 *   byId(product.ownerId)?.name
 *   me: the signed-in user (HubUser) from localStorage, or null.
 */
import { useCallback, useEffect, useState } from 'react';
import { hubService, HubUser } from '../../../services/hub.service';
import { authService } from '../../../services/auth.service';

let cache: HubUser[] | null = null;
let inflight: Promise<HubUser[]> | null = null;
const listeners = new Set<() => void>();

function load(force = false): Promise<HubUser[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = hubService
    .listUsers()
    .then((list) => {
      cache = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      listeners.forEach((l) => l());
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function currentHubUser(): HubUser | null {
  const u = authService.getUser();
  return u && u.id ? { id: u.id, name: u.name || u.email || 'You', avatarUrl: u.avatarUrl ?? null, role: u.role ?? null } : null;
}

export function useHubUsers() {
  const [users, setUsers] = useState<HubUser[]>(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    const sync = () => alive && cache && setUsers(cache);
    listeners.add(sync);
    if (!cache) {
      load()
        .then(() => alive && setError(null))
        .catch((e) => alive && setError(e))
        .finally(() => alive && setLoading(false));
    }
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, []);

  const byId = useCallback((id: string | null | undefined) => (id ? users.find((u) => u.id === id) || null : null), [users]);
  const reload = useCallback(() => load(true), []);

  return { users, byId, loading, error, me: currentHubUser(), reload };
}
