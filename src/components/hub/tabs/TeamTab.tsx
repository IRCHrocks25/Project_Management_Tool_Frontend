/**
 * Team tab — who owns each area and what to ask them about. Add (header "Add person"), edit and
 * remove (confirm + Undo). The person added gets notified by the backend.
 */
import React, { useState } from 'react';
import { hubService, ProductDetail, ProductMember } from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { FormModal, TextField, useForm, UserField } from '../ui/FormModal';
import OverflowMenu from '../ui/OverflowMenu';
import { useDeferredDelete, useHiddenIds } from '../ui/Toast';
import { Who } from '../ui/Avatar';
import { currentHubUser, useHubUsers } from '../ui/users';

export interface TeamTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const MemberModal: React.FC<{ product: ProductDetail; member?: ProductMember | null; onClose: () => void; onSaved: () => void }> = ({
  product,
  member,
  onClose,
  onSaved,
}) => {
  const { byId } = useHubUsers();
  const form = useForm({ userId: member?.userId || '', area: member?.area || '', askAbout: member?.askAbout || '' });
  return (
    <FormModal
      form={form}
      title={member ? 'Edit team role' : `Add person to ${product.name}`}
      description={member ? undefined : "They'll get a notification that they were added."}
      submitLabel={member ? 'Save changes' : 'Add person'}
      failMessage={member ? "Couldn't save the role." : "Couldn't add the person."}
      validate={(v) => ({
        userId: !v.userId ? 'Choose the person.' : undefined,
        area: !v.area.trim() ? 'Enter the area, like "Billing" or "Frontend".' : undefined,
      })}
      onSubmit={async (v) => {
        const body = { userId: v.userId, area: v.area.trim(), askAbout: v.askAbout.trim() || null };
        if (member) await hubService.updateMember(product.id, member.id, body);
        else await hubService.addMember(product.id, body);
        onSaved();
        const name = byId(v.userId)?.name || 'They';
        if (member) return 'Changes saved';
        return v.userId === currentHubUser()?.id ? `You were added as ${body.area}` : `${name} added to the team and notified`;
      }}
      onClose={onClose}
    >
      <UserField form={form} name="userId" label="Person" required />
      <TextField form={form} name="area" label="Area they handle" required placeholder="e.g. Billing" />
      <TextField form={form} name="askAbout" label="Ask them about" width="full" placeholder="e.g. Invoices, refunds" />
    </FormModal>
  );
};

const TeamTab: React.FC<TeamTabProps> = ({ product, onChanged }) => {
  const { byId } = useHubUsers();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const [modal, setModal] = useState<{ member: ProductMember | null } | null>(null);
  const [removing, setRemoving] = useState<ProductMember | null>(null);

  usePrimaryAction({ label: 'Add person', icon: 'plus', onClick: () => setModal({ member: null }) });

  const members = (product.members || []).filter((m) => !hidden.has(m.id));
  const nameOf = (m: ProductMember) => (m.user || byId(m.userId))?.name || 'This person';

  return (
    <div className="hub-sec" style={{ maxWidth: 860 }}>
      <p className="hub-muted">Who owns each part of {product.name}, and what to ask them about.</p>
      <div className="hub-card hub-tw">
        {members.length ? (
          <table className="hub-tbl hub-rt">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Person</th>
                <th scope="col">Ask them about</th>
                <th scope="col" className="hub-act">
                  <span className="hub-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.area}</b>
                  </td>
                  <td data-l="Person">
                    <Who user={m.user || byId(m.userId)} fallback="Unknown person" />
                  </td>
                  <td data-l="Ask about" className="hub-muted">
                    {m.askAbout || ''}
                  </td>
                  <td className="hub-act">
                    <OverflowMenu
                      label={`More actions for ${nameOf(m)}, ${m.area}`}
                      items={[
                        { label: 'Edit', icon: 'edit', onSelect: () => setModal({ member: m }) },
                        { label: 'Remove from team', icon: 'trash', danger: true, onSelect: () => setRemoving(m) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon="users"
            title="No one assigned yet"
            text="Add the people who work on this product so others know who to ask."
            actionLabel="Add person"
            onAction={() => setModal({ member: null })}
          />
        )}
      </div>

      {modal && <MemberModal product={product} member={modal.member} onClose={() => setModal(null)} onSaved={onChanged} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${nameOf(removing)} from ${removing.area}?`}
          body={<>They stay in the app; they're just no longer listed for this area of {product.name}. You can undo this for a few seconds afterwards.</>}
          confirmLabel="Remove from team"
          onConfirm={() => {
            const m = removing;
            deferredDelete({
              message: `${nameOf(m)} removed from ${m.area}`,
              hide: () => hidden.add(m.id),
              restore: () => hidden.remove(m.id),
              commit: () => hubService.removeMember(product.id, m.id),
              onCommitted: onChanged,
              errorMessage: `Couldn't remove ${nameOf(m)}.`,
            });
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
};

export default TeamTab;
