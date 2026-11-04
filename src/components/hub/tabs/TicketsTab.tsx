/**
 * Tickets tab — board (To do / In progress / In review / Done) with text + assignee filters.
 *
 *   - Header primary action "Create ticket" (CreateTicketModal).
 *   - A card opens the ticket drawer; the open ticket lives in the URL (?ticket=<key>), so
 *     notification links and search results open it directly.
 *   - In the drawer, status / priority / assignee save immediately (optimistic; on failure the
 *     old value comes back and an error toast offers Retry). "Edit details" opens EditTicketModal.
 *   - Delete asks first, then hides the ticket and offers Undo (the DELETE waits ~6 s).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  hubErrorMessage,
  hubService,
  ProductDetail,
  ProductTicket,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import { Badge } from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Drawer } from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import MentionText from '../ui/MentionText';
import { Skeleton } from '../ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import UserPicker from '../ui/UserPicker';
import { Avatar } from '../ui/Avatar';
import { currentHubUser, useHubUsers } from '../ui/users';
import { fmtDate, fullDateTime, TICKET_PRIORITY, TICKET_STATUS, TICKET_TYPE, when } from '../hubUtils';
import { CreateTicketModal, EditTicketModal, TICKET_PRIORITY_OPTIONS } from './TicketModals';
import '../hub-tickets.css';

export interface TicketsTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const COLUMNS: TicketStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const STATUS_OPTIONS = COLUMNS.map((k) => ({ value: k, label: TICKET_STATUS[k] }));
const UNASSIGNED = '__none';

type Field = 'status' | 'priority' | 'assigneeId';
const FIELD_LABEL: Record<Field, string> = { status: 'status', priority: 'priority', assigneeId: 'assignee' };

/* ------------------------------------------------------------------ */

export const PriorityLabel: React.FC<{ priority: TicketPriority }> = ({ priority }) => {
  const p = TICKET_PRIORITY[priority] || TICKET_PRIORITY.medium;
  return (
    <span className={`hub-pri hub-pri-${priority}`}>
      <Icon name={p.icon} size={14} />
      {p.label}
      <span className="hub-sr"> priority</span>
    </span>
  );
};

const TicketTypeBadge: React.FC<{ type: ProductTicket['type'] }> = ({ type }) => {
  const t = TICKET_TYPE[type] || TICKET_TYPE.task;
  return <Badge tone={t.tone}>{t.label}</Badge>;
};

const TicketCard: React.FC<{ ticket: ProductTicket; active: boolean; onOpen: () => void }> = ({ ticket, active, onOpen }) => {
  const { byId } = useHubUsers();
  const assignee = ticket.assignee || byId(ticket.assigneeId);
  return (
    <button
      type="button"
      className="hub-tcard"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      aria-label={`${ticket.key}: ${ticket.title}. ${TICKET_TYPE[ticket.type]?.label || ''}, ${TICKET_PRIORITY[ticket.priority]?.label || ''} priority, ${
        assignee ? `assigned to ${assignee.name}` : 'unassigned'
      }`}
    >
      <span className="hub-tcard-r">
        <span className="hub-mono hub-muted">{ticket.key}</span>
        <TicketTypeBadge type={ticket.type} />
      </span>
      <span className="hub-tcard-t">{ticket.title}</span>
      <span className="hub-tcard-r">
        <PriorityLabel priority={ticket.priority} />
        <span className="hub-sp">{assignee ? <Avatar user={assignee} /> : <span className="hub-av-none" title="Unassigned" />}</span>
      </span>
    </button>
  );
};

const BoardSkeleton: React.FC = () => (
  <div className="hub-board" aria-busy="true" aria-label="Loading tickets">
    {COLUMNS.map((c, i) => (
      <section key={c} className="hub-bcol" aria-hidden="true">
        <h3>{TICKET_STATUS[c]}</h3>
        {Array.from({ length: i === 3 ? 1 : 2 }).map((_, j) => (
          <div key={j} className="hub-tk-sk">
            <Skeleton width={70} />
            <Skeleton width="85%" />
            <Skeleton width={60} />
          </div>
        ))}
      </section>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */

const TicketDrawer: React.FC<{
  ticket: ProductTicket;
  saving: Partial<Record<Field, boolean>>;
  onChange: (field: Field, value: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ ticket, saving, onChange, onEdit, onDelete, onClose }) => {
  const { byId } = useHubUsers();
  const reporter = ticket.reporter || byId(ticket.reporterId);
  const id = (f: string) => `hub-td-${ticket.id}-${f}`;
  const savingNote = (f: Field) =>
    saving[f] ? (
      <span className="hub-tk-saving" role="status">
        <span className="hub-spin" aria-hidden="true" />
        Saving…
      </span>
    ) : null;

  return (
    <Drawer
      eyebrow={ticket.key}
      title={ticket.title}
      onClose={onClose}
      footer={
        <div className="hub-acts">
          <button type="button" className="hub-btn hub-btn-danger-text hub-sp" onClick={onDelete}>
            <Icon name="trash" size={15} />
            Delete ticket
          </button>
          <button type="button" className="hub-btn" onClick={onEdit}>
            <Icon name="edit" size={15} />
            Edit details
          </button>
        </div>
      }
    >
      <dl className="hub-props">
        <dt>
          <label htmlFor={id('status')}>Status</label>
        </dt>
        <dd>
          <select id={id('status')} className="hub-inp hub-w-full" value={ticket.status} onChange={(e) => onChange('status', e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {savingNote('status')}
        </dd>
        <dt>
          <label htmlFor={id('priority')}>Priority</label>
        </dt>
        <dd>
          <select id={id('priority')} className="hub-inp hub-w-full" value={ticket.priority} onChange={(e) => onChange('priority', e.target.value)}>
            {TICKET_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {savingNote('priority')}
        </dd>
        <dt>
          <label htmlFor={id('assignee')}>Assignee</label>
        </dt>
        <dd>
          <UserPicker
            id={id('assignee')}
            value={ticket.assigneeId || ''}
            onChange={(v) => onChange('assigneeId', v)}
            allowEmpty
            emptyLabel="Unassigned"
            className="hub-inp hub-w-full"
          />
          {savingNote('assigneeId')}
        </dd>
        <dt>Type</dt>
        <dd>
          <TicketTypeBadge type={ticket.type} />
        </dd>
        <dt>Created</dt>
        <dd title={fullDateTime(ticket.createdAt)}>
          {fmtDate(ticket.createdAt)}
          {reporter ? ` by ${reporter.name}` : ''}
        </dd>
        {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt ? (
          <>
            <dt>Updated</dt>
            <dd title={fullDateTime(ticket.updatedAt)}>{when(ticket.updatedAt)}</dd>
          </>
        ) : null}
      </dl>
      <section className="hub-tk-details" aria-labelledby={id('details')}>
        <h3 id={id('details')}>Details</h3>
        {ticket.description ? (
          <div className="hub-post-b">
            <MentionText text={ticket.description} />
          </div>
        ) : (
          <p className="hub-muted">No details yet. Use Edit details to add steps to reproduce or links.</p>
        )}
      </section>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */

const TicketsTab: React.FC<TicketsTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const deferredDelete = useDeferredDelete();
  const hidden = useHiddenIds();
  const { users, byId } = useHubUsers();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState<ProductTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductTicket | null>(null);
  const [deleting, setDeleting] = useState<ProductTicket | null>(null);
  const [saving, setSaving] = useState<Record<string, Partial<Record<Field, boolean>>>>({});
  const ticketsRef = useRef<ProductTicket[] | null>(null);
  ticketsRef.current = tickets;
  const openKey = params.get('ticket');

  usePrimaryAction({ label: 'Create ticket', icon: 'plus', onClick: () => setCreating(true) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setTickets(await hubService.listTickets(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the tickets."));
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  const setOpen = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(params);
      if (key) next.set('ticket', key);
      else next.delete('ticket');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const visible = useMemo(() => (tickets || []).filter((t) => !hidden.has(t.id)), [tickets, hidden]);
  const open = openKey ? visible.find((t) => t.key.toLowerCase() === openKey.toLowerCase()) || null : null;

  // Deep link to a ticket that isn't here (deleted, or another product's key).
  useEffect(() => {
    if (!openKey || !tickets) return;
    const exists = tickets.some((t) => t.key.toLowerCase() === openKey.toLowerCase());
    if (!exists) {
      toast.show(`Ticket ${openKey} isn't here any more. It may have been deleted.`, { kind: 'info' });
      setOpen(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, tickets]);

  const replace = (t: ProductTicket) =>
    setTickets((list) =>
      (list || []).map((x) =>
        x.id === t.id
          ? { ...x, ...t, assignee: t.assigneeId ? t.assignee || byId(t.assigneeId) || x.assignee : null, reporter: t.reporter || x.reporter }
          : x,
      ),
    );

  const patch = async (ticket: ProductTicket, field: Field, raw: string) => {
    const value = field === 'assigneeId' ? raw || null : raw;
    const prev = ticket[field];
    if (prev === value) return;
    const input: UpdateTicketInput = { [field]: value } as UpdateTicketInput;
    const optimistic: Partial<ProductTicket> =
      field === 'assigneeId' ? { assigneeId: value, assignee: value ? byId(value) : null } : ({ [field]: value } as Partial<ProductTicket>);
    setTickets((list) => (list || []).map((x) => (x.id === ticket.id ? { ...x, ...optimistic } : x)));
    setSaving((s) => ({ ...s, [ticket.id]: { ...s[ticket.id], [field]: true } }));
    try {
      const saved = await hubService.updateTicket(product.id, ticket.id, input);
      // Only take the server copy if nobody changed this field again meanwhile.
      const current = (ticketsRef.current || []).find((x) => x.id === ticket.id);
      // Merge only the field we changed: another change may be in flight for the other fields.
      if (saved && saved.id && current && current[field] === value) {
        setTickets((list) =>
          (list || []).map((x) =>
            x.id === ticket.id
              ? {
                  ...x,
                  [field]: saved[field],
                  updatedAt: saved.updatedAt || x.updatedAt,
                  ...(field === 'assigneeId' ? { assignee: saved.assigneeId ? saved.assignee || byId(saved.assigneeId) : null } : {}),
                }
              : x,
          ),
        );
      }
      const msg =
        field === 'status'
          ? `${ticket.key} moved to ${TICKET_STATUS[value as TicketStatus]}`
          : field === 'priority'
          ? `Priority set to ${TICKET_PRIORITY[value as TicketPriority].label}`
          : value
          ? `${ticket.key} assigned to ${value === currentHubUser()?.id ? 'you' : byId(value)?.name || 'them'}`
          : `${ticket.key} unassigned`;
      toast.show(msg);
      if (field !== 'assigneeId') onChanged();
    } catch (err) {
      setTickets((list) =>
        (list || []).map((x) =>
          x.id === ticket.id && x[field] === value
            ? { ...x, [field]: prev, ...(field === 'assigneeId' ? { assignee: ticket.assignee } : {}) }
            : x,
        ),
      );
      toast.error(`Couldn't update the ${FIELD_LABEL[field]} of ${ticket.key}. ${hubErrorMessage(err, '')}`.trim(), {
        action: {
          label: 'Retry',
          onClick: () => {
            const cur = (ticketsRef.current || []).find((x) => x.id === ticket.id);
            if (cur) patch(cur, field, raw);
          },
        },
      });
    } finally {
      setSaving((s) => ({ ...s, [ticket.id]: { ...s[ticket.id], [field]: false } }));
    }
  };

  const ql = q.trim().toLowerCase();
  const filtered = visible.filter(
    (t) =>
      (!ql || `${t.key} ${t.title}`.toLowerCase().includes(ql)) &&
      (!who || (who === UNASSIGNED ? !t.assigneeId : t.assigneeId === who)),
  );
  const filtering = !!ql || !!who;

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="hub-card">
        <EmptyState icon="alert" title="Couldn't load the tickets" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
      </div>
    );
  } else if (!tickets) {
    body = <BoardSkeleton />;
  } else if (!visible.length) {
    body = (
      <div className="hub-card">
        <EmptyState
          icon="ticket"
          title="No tickets yet"
          text={`Track bugs, features and client requests for ${product.name}. The assignee gets notified.`}
          actionLabel="Create ticket"
          onAction={() => setCreating(true)}
        />
      </div>
    );
  } else if (!filtered.length) {
    body = (
      <div className="hub-card">
        <EmptyState icon="search" title="No tickets match these filters" text='Try a different word or choose "Anyone" as the assignee.'>
          <button
            type="button"
            className="hub-btn"
            onClick={() => {
              setQ('');
              setWho('');
            }}
          >
            Clear filters
          </button>
        </EmptyState>
      </div>
    );
  } else {
    body = (
      <div className="hub-board">
        {COLUMNS.map((c) => {
          const col = filtered.filter((t) => t.status === c);
          const hid = `hub-bcol-${c}`;
          return (
            <section key={c} className="hub-bcol" aria-labelledby={hid}>
              <h3 id={hid}>
                {TICKET_STATUS[c]}
                <span>
                  {col.length}
                  <span className="hub-sr"> tickets</span>
                </span>
              </h3>
              {col.length ? (
                col.map((t) => <TicketCard key={t.id} ticket={t} active={open?.id === t.id} onOpen={() => setOpen(t.key)} />)
              ) : (
                <div className="hub-bcol-none">No tickets</div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="hub-tk">
      {tickets && visible.length > 0 && (
        <div className="hub-tk-bar">
          <div className="hub-tk-q">
            <Icon name="search" />
            <label className="hub-sr" htmlFor="hub-tk-q">
              Filter tickets
            </label>
            <input
              id="hub-tk-q"
              className="hub-inp"
              type="search"
              placeholder="Filter by title or number"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="hub-tk-who">
            <label className="hub-sr" htmlFor="hub-tk-who">
              Filter by assignee
            </label>
            <select id="hub-tk-who" className="hub-inp" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Anyone</option>
              <option value={UNASSIGNED}>Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === currentHubUser()?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="hub-tk-hint">Open a ticket to change its status, priority or assignee.</span>
          <span className="hub-sr" role="status">
            {filtering ? `${filtered.length} of ${visible.length} tickets shown` : ''}
          </span>
        </div>
      )}
      {body}

      {open && (
        <TicketDrawer
          ticket={open}
          saving={saving[open.id] || {}}
          onChange={(f, v) => patch(open, f, v)}
          onEdit={() => setEditing(open)}
          onDelete={() => setDeleting(open)}
          onClose={() => setOpen(null)}
        />
      )}
      {creating && (
        <CreateTicketModal
          product={product}
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            if (t && t.id) {
              const me = currentHubUser();
              setTickets((list) => [
                { ...t, assignee: t.assigneeId ? t.assignee || byId(t.assigneeId) : null, reporter: t.reporter || me },
                ...(list || []),
              ]);
            } else load();
            onChanged();
          }}
        />
      )}
      {editing && (
        <EditTicketModal
          product={product}
          ticket={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            if (t && t.id) replace(t);
            else load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.key}?`}
          body={
            <>
              <b>{deleting.title}</b> will be removed from the board. You can undo this for a few seconds afterwards.
            </>
          }
          confirmLabel="Delete ticket"
          onConfirm={() => {
            const t = deleting;
            setOpen(null);
            deferredDelete({
              message: `${t.key} deleted`,
              hide: () => hidden.add(t.id),
              restore: () => hidden.remove(t.id),
              commit: () => hubService.deleteTicket(product.id, t.id),
              onCommitted: () => {
                setTickets((list) => (list || []).filter((x) => x.id !== t.id));
                hidden.remove(t.id);
                onChanged();
              },
              errorMessage: `Couldn't delete ${t.key}.`,
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
};

export default TicketsTab;
