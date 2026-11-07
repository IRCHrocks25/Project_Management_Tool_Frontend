/**
 * The live session behind a Doc, Grid or Slides file: a Yjs document kept in step with everyone else through the
 * /drively socket. Edits made offline merge when the connection returns. The server writes the file to Iceberg.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';
import { DriveAccess, DriveDetail, driveToken, drivelyService } from '../../services/drively.service';
import { currentHubUser } from '../hub/ui/users';
import { previewFor } from './driveContent';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';
const PREVIEW_EVERY_MS = 5000;

export type SaveStatus = 'saved' | 'saving' | 'error' | 'offline';

export interface LiveUser {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

// Readable on white and clear of blue and purple, in line with the app's colours.
const CURSOR_COLORS = ['#0f766e', '#b45309', '#b91c1c', '#15803d', '#be185d', '#4d7c0f', '#c2410c', '#0e7490'];

export const liveColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
};

export interface LiveDoc {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  me: LiveUser;
  /** True once this person has what the server has. */
  synced: boolean;
  status: SaveStatus;
  level: DriveAccess;
  /** Other people in the file, one entry per person. */
  peers: LiveUser[];
  /** Access was taken away, or the file was trashed, while it was open. */
  removed: boolean;
  /** The server couldn't load the file from storage. */
  failed: boolean;
}

export function useLiveDoc(item: DriveDetail, seed: (doc: Y.Doc) => void): LiveDoc {
  const doc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new awarenessProtocol.Awareness(doc), [doc]);
  const me = useMemo<LiveUser>(() => {
    const u = currentHubUser();
    return { id: u?.id || 'me', name: u?.name || 'You', color: liveColor(u?.id || 'me'), avatarUrl: u?.avatarUrl ?? null };
  }, []);
  const [synced, setSynced] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [level, setLevel] = useState<DriveAccess>(item.myAccess);
  const [peers, setPeers] = useState<LiveUser[]>([]);
  const [removed, setRemoved] = useState(false);
  const [failed, setFailed] = useState(false);
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    const itemId = item.id;
    let canWrite = item.myAccess !== 'view';
    let pending = 0;
    let lastSeq = 0;
    let savedSeq = 0;
    let saveFailed = false;
    let shownLocally = false;
    const socket: Socket = io(`${API_URL}/drively`, { auth: { token: driveToken() }, transports: ['websocket', 'polling'] });

    const refresh = () => {
      if (!socket.connected) return setStatus('offline');
      if (saveFailed) return setStatus('error');
      return setStatus(pending === 0 && savedSeq >= lastSeq ? 'saved' : 'saving');
    };

    const send = (update: Uint8Array) => {
      if (!canWrite) return;
      if (!socket.connected) return refresh(); // The next join sends everything the server is missing.
      pending += 1;
      refresh();
      socket.emit('update', { itemId, update }, (ack: { ok: boolean; seq?: number }) => {
        pending -= 1;
        if (ack?.seq) lastSeq = Math.max(lastSeq, ack.seq);
        refresh();
      });
    };

    const runSeed = () => {
      doc.transact(() => seedRef.current(doc), 'seed');
      setSynced(true);
    };

    const onLocal = (update: Uint8Array, origin: unknown) => {
      if (origin !== socket) send(update);
    };
    doc.on('update', onLocal);

    const sendAwareness = (clients: number[]) =>
      socket.connected && socket.emit('awareness', { itemId, update: awarenessProtocol.encodeAwarenessUpdate(awareness, clients) });

    const onAwarenessUpdate = ({ added, updated, removed: gone }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === 'remote') {
        // Someone new: they need to hear about us too.
        if (added.some((c) => c !== doc.clientID)) sendAwareness([doc.clientID]);
        return;
      }
      sendAwareness([...added, ...updated, ...gone]);
    };
    awareness.on('update', onAwarenessUpdate);

    const onAwarenessChange = () => {
      const seen = new Map<string, LiveUser>();
      awareness.getStates().forEach((state, client) => {
        const user = state.user as LiveUser | undefined;
        if (client !== doc.clientID && user && user.id !== me.id) seen.set(user.id, user);
      });
      setPeers(Array.from(seen.values()));
    };
    awareness.on('change', onAwarenessChange);
    awareness.setLocalStateField('user', me);

    const join = () => {
      socket.emit(
        'join',
        { itemId, stateVector: Y.encodeStateVector(doc), clientId: doc.clientID },
        (ack: { ok: boolean; error?: string; level?: DriveAccess; update?: ArrayBuffer; stateVector?: ArrayBuffer; seed?: boolean; seq?: number; savedSeq?: number }) => {
          if (!ack?.ok) {
            if (ack?.error === 'not_found') setRemoved(true);
            else setFailed(true);
            return;
          }
          setFailed(false);
          canWrite = ack.level !== 'view';
          setLevel(ack.level as DriveAccess);
          lastSeq = Math.max(lastSeq, ack.seq || 0);
          savedSeq = Math.max(savedSeq, ack.savedSeq || 0);
          // An empty update is two bytes.
          if (shownLocally && ack.update && ack.update.byteLength > 2) return window.location.reload();
          if (ack.update) Y.applyUpdate(doc, new Uint8Array(ack.update), socket);
          if (ack.seed) runSeed();
          else if (ack.stateVector && canWrite) {
            const missing = Y.encodeStateAsUpdate(doc, new Uint8Array(ack.stateVector));
            if (missing.length > 2) send(missing);
          }
          // Holding no edits at all. `doc.share` can't tell: just reading a part of the document adds it there.
          const empty = Y.encodeStateVector(doc).length <= 1;
          if (!ack.seed && !canWrite && empty) {
            // Nobody who can edit has opened this yet, and a viewer can't fill the shared copy. Draw the saved content
            // here only: `send` refuses without write access, so none of it leaves this page.
            shownLocally = true;
            runSeed();
          } else if (!ack.seed && doc.share.size > 0) setSynced(true);
          sendAwareness([doc.clientID]);
          refresh();
        },
      );
    };

    socket.on('connect', join);
    socket.on('disconnect', refresh);
    socket.on('update', (m: { itemId: string; update: ArrayBuffer }) => {
      if (m.itemId !== itemId) return;
      // The shared copy now exists. Merging it with the local one would show everything twice, so start over from it.
      if (shownLocally) return window.location.reload();
      Y.applyUpdate(doc, new Uint8Array(m.update), socket);
      setSynced(true);
    });
    socket.on('awareness', (m: { itemId: string; update: ArrayBuffer }) => {
      if (m.itemId === itemId) awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(m.update), 'remote');
    });
    socket.on('peer-left', (m: { itemId: string; clientId: number }) => {
      if (m.itemId === itemId) awarenessProtocol.removeAwarenessStates(awareness, [m.clientId], 'remote');
    });
    socket.on('seed', (m: { itemId: string }) => {
      if (m.itemId === itemId) runSeed();
    });
    socket.on('saved', (m: { itemId: string; seq: number }) => {
      if (m.itemId !== itemId) return;
      savedSeq = Math.max(savedSeq, m.seq);
      saveFailed = false;
      refresh();
    });
    socket.on('save-failed', (m: { itemId: string }) => {
      if (m.itemId !== itemId) return;
      saveFailed = true;
      refresh();
    });
    socket.on('access', (m: { itemId: string; level: DriveAccess }) => {
      if (m.itemId !== itemId) return;
      // Newly able to edit, but holding a local-only copy: reload so its edits go to the shared one.
      if (shownLocally && m.level !== 'view') return window.location.reload();
      canWrite = m.level !== 'view';
      setLevel(m.level);
    });
    socket.on('removed', (m: { itemId: string }) => {
      if (m.itemId === itemId) setRemoved(true);
    });

    const warn = (e: BeforeUnloadEvent) => {
      if (canWrite && (pending > 0 || !socket.connected)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);

    return () => {
      window.removeEventListener('beforeunload', warn);
      doc.off('update', onLocal);
      awareness.off('update', onAwarenessUpdate);
      awareness.off('change', onAwarenessChange);
      socket.emit('leave', { itemId });
      socket.disconnect();
    };
  }, [awareness, doc, item.id, item.myAccess, me]);

  return { doc, awareness, me, synced, status, level, peers, removed, failed };
}

/** Keeps the sample on the file's card current. Whoever is editing sends it, at most every 5 seconds. */
export function useLivePreview(live: LiveDoc, itemId: string, kind: 'doc' | 'grid' | 'slides', getContent: () => unknown) {
  const read = useRef(getContent);
  read.current = getContent;
  useEffect(() => {
    if (live.level === 'view') return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = () => {
      timer = null;
      const preview = previewFor(kind, read.current());
      if (preview) drivelyService.update(itemId, { preview }).catch(() => undefined);
    };
    const onUpdate = () => {
      if (!timer) timer = setTimeout(send, PREVIEW_EVERY_MS);
    };
    live.doc.on('update', onUpdate);
    return () => {
      live.doc.off('update', onUpdate);
      if (timer) {
        clearTimeout(timer);
        send();
      }
    };
  }, [itemId, kind, live.doc, live.level]);
}
