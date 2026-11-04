/**
 * Update modals, shared by the Overview and Updates tabs.
 *   <PostUpdateModal product={product} onClose={…} onPosted={(update) => …} />
 *   <EditUpdateModal product={product} update={u} onClose={…} onSaved={(update) => …} />
 */
import React, { useRef, useState } from 'react';
import {
  HUB_MAX_FILE_BYTES,
  HUB_MAX_UPDATE_FILES,
  hubService,
  ProductDetail,
  ProductUpdate,
  UpdateType,
} from '../../../services/hub.service';
import { Field, FormModal, MentionField, SelectField, useForm } from '../ui/FormModal';
import Icon from '../ui/Icon';
import { currentHubUser } from '../ui/users';
import { extractMentions, fmtSize, listNames, UPDATE_TYPE_OPTIONS } from '../hubUtils';

const mentionedOthers = (body: string) => {
  const me = currentHubUser()?.id;
  return extractMentions(body)
    .filter((m) => m.id !== me)
    .map((m) => m.name);
};

interface PostValues {
  type: UpdateType;
  body: string;
  files: File[];
}

export const PostUpdateModal: React.FC<{
  product: ProductDetail;
  onClose: () => void;
  onPosted: (update: ProductUpdate) => void;
}> = ({ product, onClose, onPosted }) => {
  const form = useForm<PostValues>({ type: 'progress', body: '', files: [] });
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filesId = form.fieldId('files');

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const next = form.values.files.slice();
    Array.from(list).forEach((f) => {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    });
    form.set('files', next);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <FormModal
      form={form}
      title="Post an update"
      description={`Everyone on ${product.name} will see it. Mention people with @ to notify them.`}
      submitLabel="Post update"
      busyLabel={progress != null && form.values.files.length ? `Uploading… ${progress}%` : 'Posting…'}
      failMessage="Couldn't post your update."
      validate={(v) => {
        const big = v.files.find((f) => f.size > HUB_MAX_FILE_BYTES);
        return {
          body: !v.body.trim() ? 'Write your update before posting.' : undefined,
          files: big
            ? `${big.name} is larger than 50 MB. Remove it or upload a smaller file.`
            : v.files.length > HUB_MAX_UPDATE_FILES
              ? `Attach up to ${HUB_MAX_UPDATE_FILES} files. Remove ${v.files.length - HUB_MAX_UPDATE_FILES}.`
              : undefined,
        };
      }}
      onSubmit={async (v) => {
        setProgress(v.files.length ? 0 : null);
        try {
          const created = await hubService.createUpdate(
            product.id,
            { type: v.type, body: v.body.trim(), files: v.files },
            v.files.length ? setProgress : undefined,
          );
          onPosted(created);
        } finally {
          setProgress(null);
        }
        const names = mentionedOthers(v.body);
        return `Update posted${names.length ? `. Notified ${listNames(names)}` : ''}`;
      }}
      onClose={onClose}
    >
      <SelectField form={form} name="type" label="Type of update" options={UPDATE_TYPE_OPTIONS} required />
      <MentionField
        form={form}
        name="body"
        label="Update"
        required
        rows={5}
        placeholder="What changed, what is blocked, or what do you need? Type @ to mention someone."
      />
      <Field
        id={filesId}
        label="Attachments"
        hint={`Up to ${HUB_MAX_UPDATE_FILES} files, 50 MB each. Attached files are also added to Files & links.`}
        error={form.errors.files}
      >
        <div>
          <input
            ref={fileRef}
            id={filesId}
            type="file"
            multiple
            className="hub-sr"
            onChange={(e) => addFiles(e.target.files)}
            aria-describedby={`${filesId}-h${form.errors.files ? ` ${filesId}-e` : ''}`}
          />
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => fileRef.current?.click()}>
            <Icon name="clip" size={14} />
            Choose files
          </button>{' '}
          {!form.values.files.length && <span className="hub-muted hub-small">No files chosen</span>}
        </div>
        {form.values.files.length > 0 && (
          <div className="hub-filelist">
            {form.values.files.map((f, i) => (
              <div className="hub-uprow" key={`${f.name}-${i}`}>
                <Icon name="file" size={18} className="hub-muted" />
                <span className="hub-nm">
                  {f.name} <span className="hub-muted hub-small">{fmtSize(f.size)}</span>
                </span>
                <button
                  type="button"
                  className="hub-icon-btn hub-sm"
                  aria-label={`Remove ${f.name}`}
                  onClick={() =>
                    form.set(
                      'files',
                      form.values.files.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Icon name="x" size={14} />
                </button>
                {f.size > HUB_MAX_FILE_BYTES && <p className="hub-err">Larger than 50 MB</p>}
              </div>
            ))}
          </div>
        )}
        {progress != null && (
          <div className="hub-bar" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <i style={{ width: `${progress}%` }} />
          </div>
        )}
      </Field>
    </FormModal>
  );
};

export const EditUpdateModal: React.FC<{
  product: ProductDetail;
  update: ProductUpdate;
  onClose: () => void;
  onSaved: (update: ProductUpdate) => void;
}> = ({ product, update, onClose, onSaved }) => {
  const form = useForm<{ type: UpdateType; body: string }>({ type: update.type, body: update.body });
  return (
    <FormModal
      form={form}
      title="Edit update"
      submitLabel="Save changes"
      failMessage="Couldn't save the update."
      validate={(v) => ({ body: !v.body.trim() ? "The update can't be empty." : undefined })}
      onSubmit={async (v) => {
        const saved = await hubService.editUpdate(product.id, update.id, { type: v.type, body: v.body.trim() });
        onSaved(saved && saved.id ? saved : { ...update, type: v.type, body: v.body.trim(), editedAt: new Date().toISOString() });
        const before = extractMentions(update.body).map((m) => m.id);
        const added = extractMentions(v.body).filter((m) => before.indexOf(m.id) < 0 && m.id !== currentHubUser()?.id);
        return `Update saved${added.length ? `. Notified ${listNames(added.map((m) => m.name))}` : ''}`;
      }}
      onClose={onClose}
    >
      <SelectField form={form} name="type" label="Type of update" options={UPDATE_TYPE_OPTIONS} required />
      <MentionField form={form} name="body" label="Update" required rows={5} />
    </FormModal>
  );
};
