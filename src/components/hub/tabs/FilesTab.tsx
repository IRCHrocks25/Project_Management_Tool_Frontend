/**
 * Files & links tab.
 *   Files: Iceberg-backed uploads (header "Upload files"): drag and drop or browse, per-file
 *   progress, folders, delete with confirm + Undo.
 *   Domains: renewal / SSL expiry badges; add, edit, remove.
 *   Links: environments (Production, Staging…) and other links; add, edit, remove.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HUB_MAX_FILE_BYTES,
  hubErrorMessage,
  hubService,
  LinkKind,
  ProductDetail,
  ProductDomain,
  ProductFile,
  ProductLink,
} from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import { Badge, ExpiryBadge } from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { DateField, Field, FieldRow, FormModal, SelectField, TextField, useForm } from '../ui/FormModal';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import OverflowMenu from '../ui/OverflowMenu';
import { SkeletonRows } from '../ui/Skeleton';
import { useSearchParams } from 'react-router-dom';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import { useHubUsers } from '../ui/users';
import { fmtDate, fmtSize, isValidDomain, isValidUrl } from '../hubUtils';

export interface FilesTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const DEFAULT_FOLDER = 'General';

/* ------------------------------------------------------------------ */
/* Upload modal                                                        */
/* ------------------------------------------------------------------ */

interface UploadItem {
  key: number;
  file: File;
  pct: number | null;
  status: 'ready' | 'uploading' | 'done' | 'failed';
  error?: string;
}

let uploadKey = 0;

const UploadModal: React.FC<{
  product: ProductDetail;
  folders: string[];
  initial?: File[];
  onClose: () => void;
  onUploaded: () => void;
}> = ({ product, folders, initial, onClose, onUploaded }) => {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>(() => (initial || []).map((file) => ({ key: ++uploadKey, file, pct: null, status: 'ready' })));
  const [folder, setFolder] = useState(folders[0] || DEFAULT_FOLDER);
  const [newFolder, setNewFolder] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [listError, setListError] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const folderOptions = useMemo(() => Array.from(new Set([...folders, DEFAULT_FOLDER])), [folders]);

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list as ArrayLike<File>);
    if (!arr.length) return;
    setItems((cur) => [
      ...cur,
      ...arr
        .filter((f) => !cur.some((c) => c.file.name === f.name && c.file.size === f.size && c.status !== 'done'))
        .map((file) => ({ key: ++uploadKey, file, pct: null, status: 'ready' as const })),
    ]);
    setListError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pending = items.filter((i) => i.status !== 'done');
  const tooBig = pending.filter((i) => i.file.size > HUB_MAX_FILE_BYTES);
  const targetFolder = folder === '__new' ? newFolder.trim() : folder;

  const patchItem = (key: number, patch: Partial<UploadItem>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const upload = async () => {
    if (busyRef.current) return;
    if (!pending.length) {
      setListError(items.length ? 'Everything is already uploaded.' : 'Choose at least one file to upload.');
      return;
    }
    if (tooBig.length) {
      setListError(`${tooBig.length === 1 ? tooBig[0].file.name + ' is' : `${tooBig.length} files are`} larger than 50 MB. Remove ${tooBig.length === 1 ? 'it' : 'them'} to continue.`);
      return;
    }
    if (folder === '__new' && !targetFolder) {
      setFolderError('Enter a name for the new folder.');
      document.getElementById('hub-up-newfolder')?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setBanner(null);
    const queue = pending.slice();
    queue.forEach((i) => patchItem(i.key, { status: 'uploading', pct: 0, error: undefined }));
    let failed = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const it = queue.shift();
        if (!it) return;
        try {
          await hubService.uploadFile(product.id, it.file, targetFolder, (pct) => patchItem(it.key, { pct }));
          patchItem(it.key, { status: 'done', pct: 100 });
          done++;
        } catch (err) {
          failed++;
          patchItem(it.key, { status: 'failed', pct: null, error: hubErrorMessage(err, 'Upload failed.') });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    busyRef.current = false;
    setBusy(false);
    if (done) onUploaded();
    if (!failed) {
      toast.show(`${done} file${done === 1 ? '' : 's'} uploaded to ${targetFolder}`);
      onClose();
    } else {
      setBanner(
        `${failed} of ${done + failed} file${done + failed === 1 ? '' : 's'} couldn't be uploaded.${done ? ' The others were uploaded.' : ''} Check your connection and try again.`,
      );
    }
  };

  const hasFailed = items.some((i) => i.status === 'failed');

  return (
    <Modal
      title="Upload files"
      description={`Files are shared with everyone on ${product.name}.`}
      onClose={onClose}
      busy={busy}
      dirty={pending.length > 0}
      footer={({ requestClose }) => (
        <div className="hub-acts">
          <button type="button" className="hub-btn" onClick={requestClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="hub-btn hub-btn-primary" onClick={upload} disabled={busy}>
            {busy ? <span className="hub-spin" aria-hidden="true" /> : null}
            {busy
              ? 'Uploading…'
              : hasFailed
                ? 'Retry failed uploads'
                : pending.length
                  ? `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}`
                  : 'Upload'}
          </button>
        </div>
      )}
    >
      {banner ? (
        <div className="hub-banner hub-banner-err" role="alert">
          <Icon name="alert" />
          <div>
            <b>Some uploads failed.</b> {banner}
          </div>
        </div>
      ) : null}
      <div
        className={`hub-drop${over ? ' hub-over' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) add(e.dataTransfer.files);
        }}
      >
        <span className="hub-ei" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
          <Icon name="upload" size={20} />
        </span>
        <b>Drag files here</b>
        <span>or</span>
        <input ref={inputRef} id="hub-up-input" type="file" multiple className="hub-sr" onChange={(e) => add(e.target.files)} disabled={busy} />
        <button type="button" className="hub-btn hub-btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          Browse files
        </button>
        <span className="hub-hint">Up to 50 MB per file</span>
      </div>

      {items.length > 0 && (
        <div className="hub-uplist" aria-live="polite">
          {items.map((it) => (
            <div className="hub-uprow" key={it.key}>
              <Icon name={it.status === 'done' ? 'check' : 'file'} size={18} className="hub-muted" />
              <span className="hub-nm">
                {it.file.name} <span className="hub-muted hub-small">{fmtSize(it.file.size)}</span>
              </span>
              <span className="hub-small hub-muted">
                {it.status === 'uploading' ? (
                  `${it.pct ?? 0}%`
                ) : it.status === 'done' ? (
                  'Uploaded'
                ) : (
                  <button
                    type="button"
                    className="hub-icon-btn hub-sm"
                    aria-label={`Remove ${it.file.name}`}
                    onClick={() => setItems((cur) => cur.filter((c) => c.key !== it.key))}
                    disabled={busy}
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </span>
              {it.status === 'uploading' && (
                <div className="hub-bar" role="progressbar" aria-label={`Uploading ${it.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={it.pct ?? 0}>
                  <i style={{ width: `${it.pct ?? 0}%` }} />
                </div>
              )}
              {it.file.size > HUB_MAX_FILE_BYTES && it.status !== 'done' ? <p className="hub-err">Larger than 50 MB. Upload a smaller file.</p> : null}
              {it.status === 'failed' ? (
                <p className="hub-err">
                  <Icon name="alert" size={14} />
                  {it.error || 'Upload failed.'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {listError ? (
        <p className="hub-err" role="alert">
          <Icon name="alert" size={14} />
          {listError}
        </p>
      ) : null}

      <FieldRow>
        <Field id="hub-up-folder" label="Folder" required>
          <select
            id="hub-up-folder"
            className="hub-inp hub-w-md"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              setFolderError(null);
            }}
            disabled={busy}
          >
            {folderOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value="__new">New folder…</option>
          </select>
        </Field>
        {folder === '__new' && (
          <Field id="hub-up-newfolder" label="New folder name" required error={folderError || undefined}>
            <input
              id="hub-up-newfolder"
              className="hub-inp hub-w-md"
              value={newFolder}
              onChange={(e) => {
                setNewFolder(e.target.value);
                setFolderError(null);
              }}
              placeholder="e.g. Brand kits"
              aria-invalid={folderError ? 'true' : 'false'}
              aria-describedby={folderError ? 'hub-up-newfolder-e' : undefined}
              disabled={busy}
              maxLength={60}
            />
          </Field>
        )}
      </FieldRow>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Link + domain modals                                                */
/* ------------------------------------------------------------------ */

const LinkModal: React.FC<{ product: ProductDetail; link?: ProductLink | null; defaultKind?: LinkKind; onClose: () => void; onSaved: () => void }> = ({
  product,
  link,
  defaultKind = 'link',
  onClose,
  onSaved,
}) => {
  const form = useForm({ kind: (link?.kind || defaultKind) as LinkKind, label: link?.label || '', url: link?.url || '' });
  return (
    <FormModal
      form={form}
      title={link ? 'Edit link' : 'Add link'}
      submitLabel={link ? 'Save changes' : 'Add link'}
      failMessage={link ? "Couldn't save the link." : "Couldn't add the link."}
      validate={(v) => ({
        label: !v.label.trim() ? 'Enter a name for the link.' : undefined,
        url: !v.url.trim() ? 'Enter the web address.' : !isValidUrl(v.url) ? 'Enter a full web address that starts with https://' : undefined,
      })}
      onSubmit={async (v) => {
        const body = { kind: v.kind, label: v.label.trim(), url: v.url.trim() };
        if (link) await hubService.updateLink(product.id, link.id, body);
        else await hubService.addLink(product.id, body);
        onSaved();
        return link ? 'Changes saved' : 'Link added';
      }}
      onClose={onClose}
    >
      <SelectField
        form={form}
        name="kind"
        label="Kind"
        width="md"
        required
        options={[
          { value: 'environment', label: 'Environment (Production, Staging…)' },
          { value: 'link', label: 'Other link (repo, designs, dashboard…)' },
        ]}
      />
      <TextField form={form} name="label" label="Name" required placeholder={form.values.kind === 'environment' ? 'e.g. Staging' : 'e.g. Analytics dashboard'} />
      <TextField form={form} name="url" label="Web address" type="url" inputMode="url" width="full" required placeholder="https://" />
    </FormModal>
  );
};

const DomainModal: React.FC<{ product: ProductDetail; domain?: ProductDomain | null; onClose: () => void; onSaved: () => void }> = ({
  product,
  domain,
  onClose,
  onSaved,
}) => {
  const form = useForm({
    domain: domain?.domain || '',
    registrar: domain?.registrar || '',
    dnsProvider: domain?.dnsProvider || '',
    renewsOn: (domain?.renewsOn || '').slice(0, 10),
    sslExpiresOn: (domain?.sslExpiresOn || '').slice(0, 10),
  });
  return (
    <FormModal
      form={form}
      title={domain ? `Edit ${domain.domain}` : 'Add domain'}
      description="You'll be warned 30 days before the domain or its SSL certificate expires."
      submitLabel={domain ? 'Save changes' : 'Add domain'}
      failMessage={domain ? "Couldn't save the domain." : "Couldn't add the domain."}
      validate={(v) => ({
        domain: !v.domain.trim()
          ? 'Enter the domain, like courseforge.com.'
          : !isValidDomain(v.domain)
            ? 'Enter only the domain, without https:// or a path.'
            : undefined,
        renewsOn: !v.renewsOn ? 'Choose the renewal date.' : undefined,
        sslExpiresOn: !v.sslExpiresOn ? 'Choose the SSL expiry date.' : undefined,
      })}
      onSubmit={async (v) => {
        const body = {
          domain: v.domain.trim().toLowerCase(),
          registrar: v.registrar.trim() || null,
          dnsProvider: v.dnsProvider.trim() || null,
          renewsOn: v.renewsOn,
          sslExpiresOn: v.sslExpiresOn,
        };
        if (domain) await hubService.updateDomain(product.id, domain.id, body);
        else await hubService.addDomain(product.id, body);
        onSaved();
        return domain ? 'Changes saved' : 'Domain added';
      }}
      onClose={onClose}
    >
      <TextField form={form} name="domain" label="Domain" required placeholder="example.com" mono />
      <FieldRow>
        <TextField form={form} name="registrar" label="Registrar" width="sm" placeholder="e.g. Namecheap" />
        <TextField form={form} name="dnsProvider" label="DNS provider" width="sm" placeholder="e.g. Cloudflare" />
      </FieldRow>
      <FieldRow>
        <DateField form={form} name="renewsOn" label="Domain renewal date" required />
        <DateField form={form} name="sslExpiresOn" label="SSL expiry date" required />
      </FieldRow>
    </FormModal>
  );
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).indexOf('Files') >= 0;

type Confirm =
  | { kind: 'file'; item: ProductFile }
  | { kind: 'link'; item: ProductLink }
  | { kind: 'domain'; item: ProductDomain };

const FilesTab: React.FC<FilesTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const { byId } = useHubUsers();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const [files, setFiles] = useState<ProductFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ initial?: File[] } | null>(null);
  const [linkModal, setLinkModal] = useState<{ link: ProductLink | null; kind?: LinkKind } | null>(null);
  const [domainModal, setDomainModal] = useState<{ domain: ProductDomain | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pageDrag, setPageDrag] = useState(false);
  const [params, setParams] = useSearchParams();
  const [flashId, setFlashId] = useState<string | null>(null);
  const deepLink = params.get('file');

  usePrimaryAction({ label: 'Upload files', icon: 'upload', onClick: () => setUploading({}) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setFiles(await hubService.listFiles(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the files."));
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link from SOP steps: scroll to and highlight ?file=<id> once the list has loaded.
  useEffect(() => {
    if (!deepLink || !files) return;
    const el = document.getElementById(`hub-file-${deepLink}`);
    if (!el) {
      if (!files.some((f) => f.id === deepLink)) toast.show("That file isn't here any more. It may have been deleted.", { kind: 'info' });
      return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    setFlashId(deepLink);
    const t = window.setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(params);
      next.delete('file');
      setParams(next, { replace: true });
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, files]);

  const visibleFiles = (files || []).filter((f) => !hidden.has(f.id));
  const folders = useMemo(() => {
    const names = Array.from(new Set((files || []).map((f) => f.folder || DEFAULT_FOLDER)));
    return names.sort((a, b) => (a === DEFAULT_FOLDER ? -1 : b === DEFAULT_FOLDER ? 1 : a.localeCompare(b)));
  }, [files]);
  const shownFolders = folders.filter((fo) => visibleFiles.some((f) => (f.folder || DEFAULT_FOLDER) === fo));

  const links = (product.links || []).filter((l) => !hidden.has(l.id)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const envs = links.filter((l) => l.kind === 'environment');
  const others = links.filter((l) => l.kind !== 'environment');
  const domains = (product.domains || []).filter((d) => !hidden.has(d.id));

  const copy = (text: string, label: string) => {
    const fail = () => toast.error("Couldn't copy. Select the text and copy it yourself.");
    try {
      navigator.clipboard.writeText(text).then(() => toast.show(`${label} copied`), fail);
    } catch {
      fail();
    }
  };

  const runDelete = (c: Confirm) => {
    const id = c.item.id;
    if (c.kind === 'file') {
      deferredDelete({
        message: `${c.item.name} deleted`,
        hide: () => hidden.add(id),
        restore: () => hidden.remove(id),
        commit: () => hubService.deleteFile(product.id, id),
        onCommitted: () => {
          setFiles((list) => (list || []).filter((f) => f.id !== id));
          onChanged();
        },
        errorMessage: `Couldn't delete ${c.item.name}.`,
      });
    } else if (c.kind === 'link') {
      deferredDelete({
        message: `${c.item.label} removed`,
        hide: () => hidden.add(id),
        restore: () => hidden.remove(id),
        commit: () => hubService.removeLink(product.id, id),
        onCommitted: onChanged,
        errorMessage: `Couldn't remove ${c.item.label}.`,
      });
    } else {
      deferredDelete({
        message: `${c.item.domain} removed`,
        hide: () => hidden.add(id),
        restore: () => hidden.remove(id),
        commit: () => hubService.removeDomain(product.id, id),
        onCommitted: onChanged,
        errorMessage: `Couldn't remove ${c.item.domain}.`,
      });
    }
  };

  const linkRow = (l: ProductLink) => (
    <div className="hub-list-row" key={l.id}>
      <Icon name={l.kind === 'environment' ? 'globe' : 'link'} className="hub-muted" />
      <span className="hub-grow">
        <div className="hub-t">{l.label}</div>
        <a className="hub-s hub-mono" href={l.url} target="_blank" rel="noopener noreferrer">
          {l.url.replace(/^https?:\/\//, '')}
        </a>
      </span>
      <OverflowMenu
        label={`More actions for ${l.label}`}
        items={[
          { label: 'Open in a new tab', icon: 'ext', onSelect: () => window.open(l.url, '_blank', 'noopener,noreferrer') },
          { label: 'Copy address', icon: 'copy', onSelect: () => copy(l.url, 'Address') },
          { label: 'Edit', icon: 'edit', onSelect: () => setLinkModal({ link: l }) },
          { label: 'Remove link', icon: 'trash', danger: true, onSelect: () => setConfirm({ kind: 'link', item: l }) },
        ]}
      />
    </div>
  );

  return (
    <div
      className="hub-cols"
      onDragEnter={(e) => {
        if (!uploading && hasFiles(e)) setPageDrag(true);
      }}
      onDragOver={(e) => {
        if (!uploading && hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) setPageDrag(false);
      }}
      onDrop={(e) => {
        if (uploading || !hasFiles(e)) return;
        e.preventDefault();
        setPageDrag(false);
        const dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length) setUploading({ initial: dropped });
      }}
    >
      <div className="hub-stack">
        <section className="hub-sec" aria-labelledby="hub-files-h">
          <div className="hub-sec-h">
            <h2 id="hub-files-h">Files</h2>
          </div>
          {pageDrag && !uploading && (
            <div className="hub-drop hub-over" aria-hidden="true">
              <Icon name="upload" size={20} />
              <b>Drop files to upload them</b>
            </div>
          )}
          {error ? (
            <div className="hub-card">
              <EmptyState icon="alert" title="Couldn't load the files" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            </div>
          ) : !files ? (
            <SkeletonRows rows={4} />
          ) : !shownFolders.length ? (
            <div className="hub-card">
              <EmptyState
                icon="file"
                title="No files yet"
                text="Upload brand kits, demo scripts and guides so they are easy to find. You can also drag files onto this page."
                actionLabel="Upload files"
                actionIcon="upload"
                onAction={() => setUploading({})}
              />
            </div>
          ) : (
            shownFolders.map((fo) => {
              const inFolder = visibleFiles.filter((f) => (f.folder || DEFAULT_FOLDER) === fo);
              return (
                <div className="hub-card" key={fo}>
                  <div className="hub-list-row hub-folder-h">
                    <Icon name="folder" className="hub-muted" />
                    <b className="hub-small hub-grow">{fo}</b>
                    <span className="hub-muted hub-small">
                      {inFolder.length} file{inFolder.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {inFolder.map((f) => {
                    const by = f.uploadedBy || byId(f.uploadedById);
                    const meta = [fmtSize(f.sizeBytes), by?.name, fmtDate(f.createdAt)].filter(Boolean).join(' · ');
                    return (
                      <div className={`hub-list-row${flashId === f.id ? ' hub-flash' : ''}`} key={f.id} id={`hub-file-${f.id}`}>
                        <Icon name="file" size={18} className="hub-muted" />
                        <span className="hub-grow">
                          <a className="hub-t" href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            {f.name}
                          </a>
                          <div className="hub-s">
                            {meta}
                            {f.updateId ? (
                              <>
                                {' '}
                                <Badge plain>From an update</Badge>
                              </>
                            ) : null}
                          </div>
                        </span>
                        <OverflowMenu
                          label={`More actions for ${f.name}`}
                          items={[
                            { label: 'Open in a new tab', icon: 'ext', onSelect: () => window.open(f.url, '_blank', 'noopener,noreferrer') },
                            { label: 'Copy link', icon: 'copy', onSelect: () => copy(f.url, 'Link') },
                            { label: 'Delete file', icon: 'trash', danger: true, onSelect: () => setConfirm({ kind: 'file', item: f }) },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </section>

        <section className="hub-sec" aria-labelledby="hub-domains-h">
          <div className="hub-sec-h">
            <h2 id="hub-domains-h">Domains</h2>
            <div className="hub-sp">
              <button type="button" className="hub-btn hub-btn-sm" onClick={() => setDomainModal({ domain: null })}>
                <Icon name="plus" size={14} />
                Add domain
              </button>
            </div>
          </div>
          <div className="hub-card hub-tw">
            {domains.length ? (
              <table className="hub-tbl hub-rt">
                <thead>
                  <tr>
                    <th scope="col">Domain</th>
                    <th scope="col">Registrar / DNS</th>
                    <th scope="col">Domain renews</th>
                    <th scope="col">SSL expires</th>
                    <th scope="col" className="hub-act">
                      <span className="hub-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d) => (
                    <tr key={d.id}>
                      <td className="hub-mono">{d.domain}</td>
                      <td data-l="Registrar">
                        {[d.registrar, d.dnsProvider].filter(Boolean).join(' / ') || <span className="hub-muted">Not set</span>}
                      </td>
                      <td data-l="Renews">
                        <ExpiryBadge date={d.renewsOn} />
                        <div className="hub-cell-sub">{fmtDate(d.renewsOn)}</div>
                      </td>
                      <td data-l="SSL">
                        <ExpiryBadge date={d.sslExpiresOn} />
                        <div className="hub-cell-sub">{fmtDate(d.sslExpiresOn)}</div>
                      </td>
                      <td className="hub-act">
                        <OverflowMenu
                          label={`More actions for ${d.domain}`}
                          items={[
                            { label: 'Edit', icon: 'edit', onSelect: () => setDomainModal({ domain: d }) },
                            { label: 'Remove domain', icon: 'trash', danger: true, onSelect: () => setConfirm({ kind: 'domain', item: d }) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon="globe"
                title="No domains yet"
                text="Add domains to get warned before they or their SSL certificates expire."
                actionLabel="Add domain"
                onAction={() => setDomainModal({ domain: null })}
              />
            )}
          </div>
        </section>
      </div>

      <div className="hub-stack">
        <section className="hub-sec" aria-labelledby="hub-links-h">
          <div className="hub-sec-h">
            <h2 id="hub-links-h">Links</h2>
            <div className="hub-sp">
              <button type="button" className="hub-btn hub-btn-sm" onClick={() => setLinkModal({ link: null })}>
                <Icon name="plus" size={14} />
                Add link
              </button>
            </div>
          </div>
          <div className="hub-card">
            {envs.length > 0 && (
              <>
                <div className="hub-list-row hub-folder-h">
                  <b className="hub-small hub-grow">Environments</b>
                </div>
                {envs.map(linkRow)}
              </>
            )}
            {others.length > 0 && (
              <>
                <div className="hub-list-row hub-folder-h" style={envs.length ? { borderRadius: 0 } : undefined}>
                  <b className="hub-small hub-grow">Other links</b>
                </div>
                {others.map(linkRow)}
              </>
            )}
            {!links.length && (
              <EmptyState
                icon="link"
                title="No links yet"
                text="Add environments, repos, designs and dashboards so nobody has to ask for them."
                actionLabel="Add link"
                onAction={() => setLinkModal({ link: null })}
              />
            )}
          </div>
        </section>
      </div>

      {uploading && (
        <UploadModal
          product={product}
          folders={folders}
          initial={uploading.initial}
          onClose={() => setUploading(null)}
          onUploaded={() => {
            load();
            onChanged();
          }}
        />
      )}
      {linkModal && <LinkModal product={product} link={linkModal.link} defaultKind={linkModal.kind} onClose={() => setLinkModal(null)} onSaved={onChanged} />}
      {domainModal && <DomainModal product={product} domain={domainModal.domain} onClose={() => setDomainModal(null)} onSaved={onChanged} />}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'file' ? 'Delete this file?' : confirm.kind === 'link' ? `Remove ${confirm.item.label}?` : `Remove ${confirm.item.domain}?`
          }
          body={
            confirm.kind === 'file' ? (
              <>
                <b>{confirm.item.name}</b> will be deleted for everyone on {product.name}. You can undo this for a few seconds afterwards.
              </>
            ) : confirm.kind === 'link' ? (
              <>The link will be removed for everyone. You can undo this for a few seconds afterwards.</>
            ) : (
              <>You'll no longer get renewal or SSL warnings for this domain. You can undo this for a few seconds afterwards.</>
            )
          }
          confirmLabel={confirm.kind === 'file' ? 'Delete file' : confirm.kind === 'link' ? 'Remove link' : 'Remove domain'}
          onConfirm={() => runDelete(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default FilesTab;
