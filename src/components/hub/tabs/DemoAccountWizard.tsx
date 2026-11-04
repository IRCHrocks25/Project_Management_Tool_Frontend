/**
 * Add / edit demo account wizard: Client → Login → Content → Review.
 *   Create: login email + optional password, with "Save the password in the Vault" (the backend then
 *   creates a shareable "Demo login · <client>" credential and links it).
 *   Edit: choose the linked Vault credential instead.
 */
import React from 'react';
import { ContentStatus, Credential, DemoAccount, hubService, ProductDetail } from '../../../services/hub.service';
import { CONTENT_STATUS, CREDENTIAL_ENV, isValidEmail } from '../hubUtils';
import { Who } from '../ui/Avatar';
import { ReviewList, SelectField, TextField, ToggleField, useForm, UserField } from '../ui/FormModal';
import { useHubUsers } from '../ui/users';
import { Wizard } from '../ui/Wizard';
import { SecretField } from './CredentialModals';

export const CONTENT_OPTIONS = (Object.keys(CONTENT_STATUS) as ContentStatus[]).map((k) => ({ value: k, label: CONTENT_STATUS[k].label }));

interface DemoValues {
  clientName: string;
  purpose: string;
  ownerId: string;
  loginEmail: string;
  password: string;
  savePassword: boolean;
  credentialId: string;
  avatarStatus: string;
  transcriptStatus: string;
}

const DemoAccountWizard: React.FC<{
  product: ProductDetail;
  demo?: DemoAccount | null;
  credentials: Credential[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ product, demo, credentials, onClose, onSaved }) => {
  const { me, byId } = useHubUsers();
  const editing = !!demo;
  const form = useForm<DemoValues>({
    clientName: demo?.clientName || '',
    purpose: demo?.purpose || '',
    ownerId: demo?.ownerId || me?.id || '',
    loginEmail: demo?.loginEmail || '',
    password: '',
    savePassword: true,
    credentialId: demo?.credentialId || '',
    avatarStatus: demo?.avatarStatus || 'not_started',
    transcriptStatus: demo?.transcriptStatus || 'not_started',
  });

  const credOptions = [
    { value: '', label: 'Not saved in the Vault' },
    ...credentials.map((c) => ({ value: c.id, label: `${c.label} (${CREDENTIAL_ENV[c.environment] || c.environment})` })),
  ];
  // Keep the current link selectable even if the list didn't include it.
  if (demo?.credential && !credentials.some((c) => c.id === demo.credential!.id)) {
    credOptions.push({ value: demo.credential.id, label: demo.credential.label });
  }
  const credLabel = (id: string) => credOptions.find((o) => o.value === id)?.label || 'Saved in the Vault';

  const passwordSummary = (v: DemoValues) => {
    if (editing) return v.credentialId ? `Linked to ${credLabel(v.credentialId)}` : 'Not saved in the Vault';
    if (!v.password) return 'Add later';
    return v.savePassword ? `Will be saved in the Vault as "Demo login · ${v.clientName.trim()}"` : 'Not saved (only used here)';
  };

  return (
    <Wizard
      form={form}
      title={editing ? 'Edit demo account' : 'Add demo account'}
      description="Keep the demo login, its purpose and its content status together."
      submitLabel={editing ? 'Save changes' : 'Add demo account'}
      failMessage={editing ? "Couldn't save the changes." : "Couldn't add the demo account."}
      steps={[
        {
          title: 'Client',
          fields: ['clientName', 'purpose', 'ownerId'],
          validate: (v) => ({
            clientName: !v.clientName.trim() ? 'Enter the client name.' : undefined,
            ownerId: !v.ownerId ? 'Choose who owns this demo account.' : undefined,
          }),
          render: () => (
            <>
              <TextField form={form} name="clientName" label="Client name" required maxLength={160} placeholder="e.g. Harbor Academy" />
              <TextField form={form} name="purpose" label="Purpose" width="full" placeholder="e.g. Sales demo on Nov 12" />
              <UserField form={form} name="ownerId" label="Owner" required hint="They get a notification when it's someone else." />
            </>
          ),
        },
        {
          title: 'Login',
          fields: ['loginEmail', 'password', 'credentialId'],
          validate: (v) => ({
            loginEmail: !v.loginEmail.trim()
              ? 'Enter the email used to sign in to the demo.'
              : !isValidEmail(v.loginEmail)
                ? 'Enter a valid email, like demo.client@example.com.'
                : undefined,
          }),
          render: () => (
            <>
              <TextField form={form} name="loginEmail" label="Login email" required width="full" type="email" inputMode="email" mono />
              {editing ? (
                <SelectField
                  form={form}
                  name="credentialId"
                  label="Password in Vault"
                  width="full"
                  options={credOptions}
                  hint="Link the Vault item that holds this demo's password. To save a new one, add it in the Vault first."
                />
              ) : (
                <>
                  <SecretField form={form} name="password" label="Password" hint="Leave empty if you'll add it later." />
                  <ToggleField
                    form={form}
                    name="savePassword"
                    label="Save the password in the Vault"
                    hint='Saved as "Shareable with client" so you can send it to them.'
                  />
                </>
              )}
            </>
          ),
        },
        {
          title: 'Content',
          fields: ['avatarStatus', 'transcriptStatus'],
          render: () => (
            <>
              <SelectField form={form} name="avatarStatus" label="Avatar" required options={CONTENT_OPTIONS} />
              <SelectField form={form} name="transcriptStatus" label="Transcript" required options={CONTENT_OPTIONS} />
            </>
          ),
        },
      ]}
      review={(v) => (
        <ReviewList
          rows={[
            ['Client', v.clientName.trim()],
            ['Purpose', v.purpose.trim() || <span className="hub-muted">Not set</span>],
            ['Owner', <Who user={byId(v.ownerId)} fallback="Not set" />],
            ['Login email', <span className="hub-mono">{v.loginEmail.trim()}</span>],
            ['Password', passwordSummary(v)],
            ['Avatar', CONTENT_STATUS[v.avatarStatus as ContentStatus]?.label],
            ['Transcript', CONTENT_STATUS[v.transcriptStatus as ContentStatus]?.label],
          ]}
        />
      )}
      mapServerError={(msg) => {
        if (/client name/i.test(msg)) return { clientName: msg };
        if (/owner/i.test(msg)) return { ownerId: msg };
        if (/email/i.test(msg)) return { loginEmail: msg };
        if (/password/i.test(msg) && !editing) return { password: msg };
        if (/credential|vault item/i.test(msg) && editing) return { credentialId: msg };
        return null;
      }}
      onSubmit={async (v) => {
        const base = {
          clientName: v.clientName.trim(),
          loginEmail: v.loginEmail.trim(),
          purpose: v.purpose.trim() || null,
          ownerId: v.ownerId,
          avatarStatus: v.avatarStatus as ContentStatus,
          transcriptStatus: v.transcriptStatus as ContentStatus,
        };
        if (editing) {
          await hubService.updateDemoAccount(product.id, demo!.id, { ...base, credentialId: v.credentialId || null });
          onSaved();
          return 'Changes saved';
        }
        const savePw = !!v.password && v.savePassword;
        await hubService.createDemoAccount(product.id, savePw ? { ...base, password: v.password, savePassword: true } : base);
        onSaved();
        return savePw ? `${base.clientName} demo account added and the password saved in the Vault` : `${base.clientName} demo account added`;
      }}
      onClose={onClose}
    />
  );
};

export default DemoAccountWizard;
