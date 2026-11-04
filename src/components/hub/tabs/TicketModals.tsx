/**
 * Ticket modals used by the Tickets tab.
 *
 *   <CreateTicketModal product={product} onClose={…} onCreated={(t) => …} />
 *     title, type, priority, assignee (defaults to me), details with @mentions.
 *   <EditTicketModal product={product} ticket={t} onClose={…} onSaved={(t) => …} />
 *     title, type, details. Status / priority / assignee change in the drawer itself.
 */
import React from 'react';
import { hubService, ProductDetail, ProductTicket, TicketPriority, TicketType } from '../../../services/hub.service';
import { FieldRow, FormModal, MentionField, SelectField, TextField, useForm, UserField } from '../ui/FormModal';
import { currentHubUser, useHubUsers } from '../ui/users';
import { extractMentions, listNames, TICKET_PRIORITY, TICKET_TYPE } from '../hubUtils';

export const TICKET_TYPE_OPTIONS = (Object.keys(TICKET_TYPE) as TicketType[]).map((k) => ({ value: k, label: TICKET_TYPE[k].label }));
export const TICKET_PRIORITY_OPTIONS = (Object.keys(TICKET_PRIORITY) as TicketPriority[]).map((k) => ({
  value: k,
  label: TICKET_PRIORITY[k].label,
}));

const TITLE_MAX = 200;

const validateTitle = (title: string) =>
  !title.trim() ? 'Enter a title so people know what this ticket is about.' : title.trim().length > TITLE_MAX ? `Keep the title under ${TITLE_MAX} characters.` : undefined;

/** "Notified Ana and Marco" for newly added mentions (never the actor). */
function mentionNote(next: string, prev = '', skipIds: string[] = []): string {
  const me = currentHubUser();
  const before = extractMentions(prev).map((m) => m.id);
  const names = extractMentions(next)
    .filter((m) => m.id !== me?.id && before.indexOf(m.id) < 0 && skipIds.indexOf(m.id) < 0)
    .map((m) => m.name);
  return names.length ? `Notified ${listNames(names)}` : '';
}

/* ------------------------------------------------------------------ */

export const CreateTicketModal: React.FC<{
  product: ProductDetail;
  onClose: () => void;
  onCreated: (t: ProductTicket) => void;
}> = ({ product, onClose, onCreated }) => {
  const me = currentHubUser();
  const { byId } = useHubUsers();
  const form = useForm({
    title: '',
    type: 'bug' as TicketType,
    priority: 'medium' as TicketPriority,
    assigneeId: me?.id || '',
    description: '',
  });

  return (
    <FormModal
      form={form}
      title="Create ticket"
      description="The assignee gets notified right away."
      submitLabel="Create ticket"
      busyLabel="Creating…"
      failMessage="Couldn't create the ticket."
      validate={(v) => ({ title: validateTitle(v.title) })}
      mapServerError={(msg) => (/title/i.test(msg) ? { title: msg } : null)}
      onSubmit={async (v) => {
        const t = await hubService.createTicket(product.id, {
          title: v.title.trim(),
          type: v.type,
          priority: v.priority,
          assigneeId: v.assigneeId || null,
          description: v.description.trim() || null,
        });
        onCreated(t);
        const assignee = v.assigneeId && v.assigneeId !== me?.id ? byId(v.assigneeId)?.name : '';
        const notes = [assignee ? `${assignee} was notified` : '', mentionNote(v.description, '', assignee ? [v.assigneeId] : [])]
          .filter(Boolean)
          .join('. ');
        return `${t?.key || 'Ticket'} created${notes ? `. ${notes}` : ''}`;
      }}
      onClose={onClose}
    >
      <TextField form={form} name="title" label="Title" required width="full" placeholder="e.g. Avatar preview fails on Safari" maxLength={TITLE_MAX + 20} />
      <FieldRow>
        <SelectField form={form} name="type" label="Type" required options={TICKET_TYPE_OPTIONS} />
        <SelectField form={form} name="priority" label="Priority" required options={TICKET_PRIORITY_OPTIONS} />
      </FieldRow>
      <UserField form={form} name="assigneeId" label="Assign to" allowEmpty emptyLabel="Unassigned" />
      <MentionField form={form} name="description" label="Details" placeholder="Steps to reproduce, links, @mentions" rows={5} />
    </FormModal>
  );
};

/* ------------------------------------------------------------------ */

export const EditTicketModal: React.FC<{
  product: ProductDetail;
  ticket: ProductTicket;
  onClose: () => void;
  onSaved: (t: ProductTicket) => void;
}> = ({ product, ticket, onClose, onSaved }) => {
  const form = useForm({
    title: ticket.title,
    type: ticket.type,
    description: ticket.description || '',
  });

  return (
    <FormModal
      form={form}
      title={`Edit ${ticket.key}`}
      submitLabel="Save changes"
      failMessage="Couldn't save the ticket."
      validate={(v) => ({ title: validateTitle(v.title) })}
      mapServerError={(msg) => (/title/i.test(msg) ? { title: msg } : null)}
      onSubmit={async (v) => {
        const saved = await hubService.updateTicket(product.id, ticket.id, {
          title: v.title.trim(),
          type: v.type,
          description: v.description.trim() || null,
        });
        onSaved(saved);
        const note = mentionNote(v.description, ticket.description || '');
        return `Changes saved${note ? `. ${note}` : ''}`;
      }}
      onClose={onClose}
    >
      <TextField form={form} name="title" label="Title" required width="full" maxLength={TITLE_MAX + 20} />
      <SelectField form={form} name="type" label="Type" required options={TICKET_TYPE_OPTIONS} />
      <MentionField form={form} name="description" label="Details" placeholder="Steps to reproduce, links, @mentions" rows={6} />
    </FormModal>
  );
};
