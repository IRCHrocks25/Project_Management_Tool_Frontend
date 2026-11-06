import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowUp, FaHistory, FaKey, FaMagic, FaPaperclip, FaPlus, FaTimes } from 'react-icons/fa';
import { assistantService, AssistantAction, AssistantReply, PendingAction } from '../services/assistant.service';
import './AssistantWidget.css';

type Item =
  | { kind: 'message'; role: 'user' | 'assistant'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'file'; label: string; fileKind: string; path: string }
  | { kind: 'error'; text: string }
  | { kind: 'vault'; label: string; url: string; expiresAt: string; oneTime: boolean };

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const SUGGESTIONS = [
  'Who is the PM for each of my clients?',
  'What is overdue this week?',
  'Take me to my timeline',
  "What's waiting for approval?",
];
const HOW_TO_VIDEOS = [
  { question: 'How to create a task as a team', url: 'https://www.loom.com/share/62b94ba3053844398be6de46fb1209e3' },
  { question: 'How to claim a task', url: 'https://www.loom.com/share/e8d50167948a40a3a3bbded35e831a9b' },
  { question: 'How to move tasks', url: 'https://www.loom.com/share/37509b36bfc041118fc9174b0041a157' },
];

const errorText = (error: any) =>
  error?.response?.data?.message || 'The assistant could not answer just now. Please try again.';

/** Shows plain text with its links clickable. Nothing is rendered as HTML. */
const Linkified: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.replace(/\*\*(.+?)\*\*/g, '$1').split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

const AssistantWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [items, setItems] = useState<Item[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [history, setHistory] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<{ id: string; fileName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [items, pending, busy, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const applyReply = (reply: AssistantReply) => {
    setConversationId(reply.conversationId);
    setPending(reply.pending);
    const next: Item[] = [];
    reply.actions.forEach((action: AssistantAction) => {
      if (action.type === 'vault_link') {
        next.push({ kind: 'vault', label: action.label, url: action.url, expiresAt: action.expiresAt, oneTime: action.oneTime });
      } else if (action.type === 'navigate') {
        navigate(action.path);
        next.push({ kind: 'note', text: `Opened ${action.label}` });
      } else if (action.type === 'open_file') {
        next.push({ kind: 'file', label: action.label, fileKind: action.kind, path: action.path });
      }
    });
    if (reply.text) next.push({ kind: 'message', role: 'assistant', text: reply.text });
    setItems((current) => [...current, ...next]);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if ((!message && files.length === 0) || busy) return;
    const shown = [message, ...files.map((f) => `📎 ${f.fileName}`)].filter(Boolean).join('\n');
    const fileIds = files.map((f) => f.id);
    setItems((current) => [...current, { kind: 'message', role: 'user', text: shown }]);
    setInput('');
    setFiles([]);
    setPending([]);
    setView('chat');
    setBusy(true);
    try {
      applyReply(await assistantService.chat({ conversationId, message, fileIds, page: location.pathname }));
    } catch (error) {
      setItems((current) => [...current, { kind: 'error', text: errorText(error) }]);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!conversationId || busy) return;
    const decisions = Object.fromEntries(pending.map((p) => [p.id, decision]));
    setPending([]);
    setBusy(true);
    try {
      applyReply(await assistantService.decide(conversationId, decisions));
    } catch (error) {
      setItems((current) => [...current, { kind: 'error', text: errorText(error) }]);
    } finally {
      setBusy(false);
    }
  };

  const attach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setItems((current) => [...current, { kind: 'error', text: `"${file.name}" is over the 15 MB limit.` }]);
      return;
    }
    setUploading(true);
    try {
      const saved = await assistantService.uploadFile(file);
      setFiles((current) => [...current, { id: saved.id, fileName: saved.fileName }]);
    } catch (error) {
      setItems((current) => [...current, { kind: 'error', text: errorText(error) }]);
    } finally {
      setUploading(false);
    }
  };

  const newChat = () => {
    setConversationId(null);
    setItems([]);
    setPending([]);
    setFiles([]);
    setView('chat');
  };

  const showHistory = async () => {
    setView('history');
    try {
      setHistory(await assistantService.listConversations());
    } catch {
      setHistory([]);
    }
  };

  const openConversation = async (id: string) => {
    try {
      const conversation = await assistantService.getConversation(id);
      setConversationId(conversation.id);
      setItems(conversation.messages.map((m) => ({ kind: 'message' as const, role: m.role, text: m.text })));
      setPending(conversation.pending);
      setView('chat');
    } catch (error) {
      setItems((current) => [...current, { kind: 'error', text: errorText(error) }]);
      setView('chat');
    }
  };

  if (!open) {
    return (
      <button type="button" className="aw-trigger faq-help-trigger" onClick={() => setOpen(true)} aria-label="Open assistant" title="Ask the assistant">
        <FaMagic aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="aw-panel faq-help-trigger" role="dialog" aria-label="Assistant">
      <div className="aw-head">
        <h2>{view === 'history' ? 'Past chats' : 'Assistant'}</h2>
        <button type="button" className="aw-icon" onClick={newChat} aria-label="New chat" title="New chat"><FaPlus /></button>
        <button type="button" className="aw-icon" onClick={showHistory} aria-label="Past chats" title="Past chats"><FaHistory /></button>
        <button type="button" className="aw-icon" onClick={() => setOpen(false)} aria-label="Close assistant" title="Close"><FaTimes /></button>
      </div>

      <div className="aw-body" ref={bodyRef} aria-live="polite">
        {view === 'history' ? (
          history.length === 0 ? (
            <p className="aw-note">No past chats yet.</p>
          ) : (
            history.map((chat) => (
              <button key={chat.id} type="button" className="aw-history-row" onClick={() => openConversation(chat.id)}>
                <b>{chat.title}</b>
                <small>{new Date(chat.updatedAt).toLocaleString()}</small>
              </button>
            ))
          )
        ) : (
          <>
            {items.length === 0 && !busy && (
              <div className="aw-empty">
                <h3>What do you need?</h3>
                <p>Ask about clients and owners, or tell me what to do. I can open pages, update tasks, attach files and get you a temporary vault link.</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="aw-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
                <button
                  type="button"
                  className="aw-suggestion"
                  onClick={() => { setOpen(false); navigate('/dashboard?tour=1'); }}
                >
                  Show me around the new layout
                </button>
                <div className="aw-videos">
                  <b>How-to videos</b>
                  {HOW_TO_VIDEOS.map((v) => (
                    <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer">{v.question}</a>
                  ))}
                </div>
              </div>
            )}
            {items.map((item, i) => {
              if (item.kind === 'message') {
                return <div key={i} className={`aw-msg ${item.role}`}><Linkified text={item.text} /></div>;
              }
              if (item.kind === 'note') return <div key={i} className="aw-note">{item.text}</div>;
              if (item.kind === 'error') return <div key={i} className="aw-error" role="alert">{item.text}</div>;
              if (item.kind === 'file') {
                return (
                  <div key={i} className="aw-card">
                    <b>{item.label}</b>
                    <p>{item.fileKind} created.</p>
                    <div className="aw-card-actions">
                      <a className="aw-btn" href={item.path} target="_blank" rel="noopener noreferrer">Open</a>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="aw-card">
                  <b><FaKey aria-hidden="true" style={{ marginRight: 6, fontSize: 11 }} />{item.label}</b>
                  <p>{item.oneTime ? 'Works once. ' : ''}Expires {new Date(item.expiresAt).toLocaleString()}. Only you can see this link here.</p>
                  <div className="aw-card-actions">
                    <a className="aw-btn" href={item.url} target="_blank" rel="noopener noreferrer">View login</a>
                    <button type="button" className="aw-btn ghost" onClick={() => navigator.clipboard.writeText(item.url)}>Copy link</button>
                  </div>
                </div>
              );
            })}
            {pending.length > 0 && (
              <div className="aw-card">
                <b>Confirm before I do this</b>
                <ul>{pending.map((p) => <li key={p.id}>{p.summary}</li>)}</ul>
                <div className="aw-card-actions">
                  <button type="button" className="aw-btn" disabled={busy} onClick={() => decide('approve')}>Confirm</button>
                  <button type="button" className="aw-btn ghost" disabled={busy} onClick={() => decide('reject')}>Cancel</button>
                </div>
              </div>
            )}
            {busy && <div className="aw-typing">Working on it…</div>}
          </>
        )}
      </div>

      <div className="aw-foot">
        {files.length > 0 && (
          <div className="aw-chips">
            {files.map((f) => (
              <span key={f.id} className="aw-chip">
                <span>{f.fileName}</span>
                <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles((c) => c.filter((x) => x.id !== f.id))}><FaTimes /></button>
              </span>
            ))}
          </div>
        )}
        <div className="aw-input-row">
          <input ref={fileRef} type="file" hidden onChange={attach} />
          <button type="button" className="aw-icon" disabled={uploading} onClick={() => fileRef.current?.click()} aria-label="Attach a file" title="Attach a file"><FaPaperclip /></button>
          <textarea
            rows={1}
            value={input}
            placeholder={uploading ? 'Attaching file…' : 'Ask or tell me what to do…'}
            aria-label="Message the assistant"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button type="button" className="aw-icon aw-send" disabled={busy || uploading || (!input.trim() && files.length === 0)} onClick={() => send(input)} aria-label="Send"><FaArrowUp /></button>
        </div>
      </div>
    </div>
  );
};

export default AssistantWidget;
