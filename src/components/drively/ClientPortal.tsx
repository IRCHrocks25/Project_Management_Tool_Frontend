/**
 * What someone outside the company sees: set up from a one-time link, sign back in with a name and 6-digit code, and
 * browse only what was shared with them. None of the team app's navigation or data is reachable from these pages.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { clearClientSession, clientPortal, clientToken, ClientLinkInfo, saveClientSession } from '../../services/clientPortal.service';
import { clientSignInUrl, DriveItem, drivelyService } from '../../services/drively.service';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Skeleton } from '../hub/ui/Skeleton';
import { CardPreview } from './DrivelyHome';
import FileIcon from './FileIcon';

const CODE_LENGTH = 6;
const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, CODE_LENGTH);

const CodeInput: React.FC<{ label: string; hint?: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }> = ({ label, hint, value, onChange, autoComplete, autoFocus }) => (
  <label className="drv-field">
    {label}
    <input className="hub-inp drv-client-code" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={CODE_LENGTH} autoComplete={autoComplete} autoFocus={autoFocus} required value={value} onChange={(e) => onChange(onlyDigits(e.target.value))} />
    {hint && <span className="drv-muted">{hint}</span>}
  </label>
);

const Card: React.FC<{ title: string; intro?: React.ReactNode; children: React.ReactNode }> = ({ title, intro, children }) => (
  <main className="drv-client-page">
    <div className="drv-client-card">
      <div className="drv-client-mark"><FileIcon kind="folder" size={30} /></div>
      <h1>{title}</h1>
      {intro && <p className="drv-client-intro">{intro}</p>}
      {children}
    </div>
  </main>
);

/* ---------------------------- signing back in ---------------------------- */

export const ClientSignIn: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sign-in' | 'forgot' | 'reset'>('sign-in');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attempt = async (work: () => Promise<void>, fail: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(hubErrorMessage(err, fail));
    } finally {
      setBusy(false);
    }
  };

  const enter = (token: string) => {
    saveClientSession(token);
    navigate('/client/files', { replace: true });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'sign-in') attempt(async () => enter((await clientPortal.signIn({ name, code })).token), "Couldn't sign you in.");
    if (mode === 'forgot') {
      attempt(async () => {
        await clientPortal.forgotCode(email);
        setCode('');
        setMode('reset');
      }, "Couldn't send the code.");
    }
    if (mode === 'reset') attempt(async () => enter((await clientPortal.resetCode({ email, resetCode, code })).token), "Couldn't reset your code.");
  };

  if (clientToken()) return <Navigate to="/client/files" replace />;

  if (mode === 'forgot') {
    return (
      <Card title="Forgot your code?" intro="Enter the email on your account and we'll send you a reset code.">
        <form onSubmit={submit} className="drv-client-form">
          <label className="drv-field">Email<input className="hub-inp" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error && <p className="hub-err" role="alert">{error}</p>}
          <button className="hub-btn hub-btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
        </form>
        <p className="drv-client-note">Didn't add an email? Contact the person who shared the file with you, and they can send you a new link.</p>
        <button type="button" className="drv-client-inline" onClick={() => { setError(null); setMode('sign-in'); }}>Back to sign in</button>
      </Card>
    );
  }

  if (mode === 'reset') {
    return (
      <Card title="Check your email" intro={`If ${email} is on an account, a reset code is on its way. It expires in 10 minutes.`}>
        <form onSubmit={submit} className="drv-client-form">
          <CodeInput label="Reset code from the email" autoComplete="one-time-code" autoFocus value={resetCode} onChange={setResetCode} />
          <CodeInput label="Choose a new 6-digit code" autoComplete="new-password" value={code} onChange={setCode} />
          {error && <p className="hub-err" role="alert">{error}</p>}
          <button className="hub-btn hub-btn-primary" disabled={busy || resetCode.length < CODE_LENGTH || code.length < CODE_LENGTH}>{busy ? 'Saving…' : 'Save and continue'}</button>
        </form>
        <button type="button" className="drv-client-inline" onClick={() => { setError(null); setMode('sign-in'); }}>Back to sign in</button>
      </Card>
    );
  }

  return (
    <Card title="Are you a client?" intro="Enter your name and 6-digit code to see what's been shared with you.">
      <form onSubmit={submit} className="drv-client-form">
        <label className="drv-field">Your name<input className="hub-inp" autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <CodeInput label="6-digit code" autoComplete="current-password" value={code} onChange={setCode} />
        {error && <p className="hub-err" role="alert">{error}</p>}
        <button className="hub-btn hub-btn-primary" disabled={busy || !name.trim() || code.length < CODE_LENGTH}>{busy ? 'Signing in…' : 'Continue'}</button>
      </form>
      <button type="button" className="drv-client-inline" onClick={() => { setError(null); setMode('forgot'); }}>Forgot your code?</button>
    </Card>
  );
};

/* ---------------------------- the one-time link ---------------------------- */

export const ClientClaim: React.FC = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [link, setLink] = useState<ClientLinkInfo | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientPortal
      .describeLink(token)
      .then(setLink)
      .catch((err) => setGone(hubErrorStatus(err) === 404 ? 'used' : hubErrorMessage(err, "Couldn't open this link.")));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await clientPortal.claim(token, link?.type === 'invite' ? { name, email: email.trim() || undefined, code } : { code });
      saveClientSession(session.token);
      if (link?.type === 'new_code') navigate('/client/files', { replace: true });
      else navigate(session.itemKind === 'folder' ? `/client/folders/${session.itemId}` : `/client/d/${session.itemId}`, { replace: true });
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't finish setting this up."));
      setBusy(false);
    }
  };

  if (gone) {
    return (
      <Card title={gone === 'used' ? 'This link has already been used' : "Couldn't open this link"} intro={gone === 'used' ? 'If you set up your access with it, sign in with your name and code. Otherwise ask the person who sent it for a new one.' : gone}>
        <Link className="hub-btn hub-btn-primary" to="/client">Sign in with your code</Link>
      </Card>
    );
  }
  if (!link) return <main className="drv-client-page"><div className="drv-client-card"><Skeleton height={260} /></div></main>;

  if (link.type === 'new_code') {
    return (
      <Card title={link.clientName ? `Hi ${link.clientName}` : 'Choose a new code'} intro="Choose a new 6-digit code. You'll use it with your name from now on.">
        <form onSubmit={submit} className="drv-client-form">
          <CodeInput label="New 6-digit code" autoComplete="new-password" autoFocus value={code} onChange={setCode} />
          {error && <p className="hub-err" role="alert">{error}</p>}
          <button className="hub-btn hub-btn-primary" disabled={busy || code.length < CODE_LENGTH}>{busy ? 'Saving…' : 'Save and continue'}</button>
        </form>
      </Card>
    );
  }

  return (
    <Card
      title={link.sharedBy ? `${link.sharedBy} shared something with you` : 'Something was shared with you'}
      intro={<span className="drv-client-item"><FileIcon kind={link.itemKind} size={18} /> {link.itemName}</span>}
    >
      <form onSubmit={submit} className="drv-client-form">
        <label className="drv-field">Your name<input className="hub-inp" autoComplete="name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <CodeInput label="Choose a 6-digit code" hint="You'll use your name and this code to come back. Already have one? Enter the same name and code." autoComplete="new-password" value={code} onChange={setCode} />
        <label className="drv-field">
          Email (optional)
          <input className="hub-inp" type="email" autoComplete="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="drv-muted">Only used to send you a reset code if you forget yours.</span>
        </label>
        {error && <p className="hub-err" role="alert">{error}</p>}
        <button className="hub-btn hub-btn-primary" disabled={busy || !name.trim() || code.length < CODE_LENGTH}>{busy ? 'Opening…' : link.itemKind === 'folder' ? 'Open folder' : 'Open file'}</button>
      </form>
      <p className="drv-client-note">This link works once. After this, you'll come back with your name and code.</p>
    </Card>
  );
};

/* ---------------------------- what's been shared ---------------------------- */

/** Client pages behind a session. An expired or replaced one is caught by the pages themselves. */
export const ClientGate: React.FC<{ children: React.ReactElement }> = ({ children }) =>
  clientToken() ? children : <Navigate to="/client" replace />;

export const ClientFiles: React.FC = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<DriveItem[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [folder, setFolder] = useState<{ name: string; path: { id: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    clearClientSession();
    navigate('/client', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    Promise.all([clientPortal.me(), clientPortal.list(folderId), folderId ? drivelyService.get(folderId) : Promise.resolve(null)])
      .then(([who, list, detail]) => {
        if (cancelled) return;
        setMe(who.name);
        setItems(list);
        setFolder(detail ? { name: detail.name, path: detail.path } : null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (hubErrorStatus(err) === 401) return signOut();
        setError(hubErrorStatus(err) === 404 ? "This isn't available any more. It may have been removed, or your access may have changed." : hubErrorMessage(err, "Couldn't load your files."));
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [folderId, signOut]);

  const list = items || [];
  const folders = list.filter((i) => i.kind === 'folder');
  const files = list.filter((i) => i.kind !== 'folder');

  return (
    <div className="drv-client-shell">
      <header className="drv-client-top">
        <Link to="/client/files" className="drv-logo"><FileIcon kind="folder" size={26} /><span>Your files</span></Link>
        <div className="drv-client-who">
          {me && <span className="drv-muted">{me}</span>}
          <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="drv-client-body">
        <div className="drv-head">
          {folderId && folder ? (
            <nav className="drv-trail drv-trail-lg" aria-label="Folder path">
              <Link to="/client/files">Your files</Link>
              {folder.path.map((p) => (
                <React.Fragment key={p.id}>
                  <Icon name="chev" size={15} />
                  <Link to={`/client/folders/${p.id}`}>{p.name}</Link>
                </React.Fragment>
              ))}
              <Icon name="chev" size={15} />
              <h1>{folder.name}</h1>
            </nav>
          ) : (
            <h1>Shared with you</h1>
          )}
        </div>

        {error && (
          <div className="drv-note drv-note-err" role="alert">
            {error} {folderId && <Link className="hub-btn hub-btn-sm" to="/client/files">Back to your files</Link>}
          </div>
        )}
        {!items && <div className="drv-files"><Skeleton height={230} /><Skeleton height={230} /><Skeleton height={230} /></div>}
        {items && !error && list.length === 0 && (
          <EmptyState icon="folder" title={folderId ? 'This folder is empty' : 'Nothing here right now'} text={folderId ? 'Files added to it will show up here.' : 'Files shared with you will show up here.'} />
        )}
        {folders.length > 0 && (
          <section aria-label="Folders">
            <h2>Folders</h2>
            <div className="drv-folders">
              {folders.map((item) => (
                <div key={item.id} className="drv-folder">
                  <Link className="drv-open" to={`/client/folders/${item.id}`} title={item.name}><FileIcon kind="folder" size={22} /><span className="drv-name">{item.name}</span></Link>
                </div>
              ))}
            </div>
          </section>
        )}
        {files.length > 0 && (
          <section aria-label="Files">
            <h2>Files</h2>
            <div className="drv-files">
              {files.map((item) => (
                <article key={item.id} className="drv-card">
                  <div className="drv-card-h">
                    <FileIcon kind={item.kind} size={20} />
                    <Link className="drv-open drv-name" to={`/client/d/${item.id}`} title={item.name}>{item.name}</Link>
                  </div>
                  <Link className="drv-card-pv" to={`/client/d/${item.id}`} tabIndex={-1} aria-hidden="true"><CardPreview item={item} /></Link>
                  <div className="drv-card-f">{item.owner?.name ? `From ${item.owner.name}` : 'Shared with you'}</div>
                </article>
              ))}
            </div>
          </section>
        )}
        <p className="drv-client-note">To come back later, go to <b>{clientSignInUrl()}</b> and enter your name and code.</p>
      </main>
    </div>
  );
};
