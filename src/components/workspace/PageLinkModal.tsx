/** Add or change the link on the selected text. With nothing selected, it also asks for the text to show. */
import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import { isAllowedPageHref, normalizeLinkInput } from './pageUtils';

const PageLinkModal: React.FC<{ editor: Editor; onClose: () => void }> = ({ editor, onClose }) => {
  const [current] = useState<string>(() => editor.getAttributes('link').href || '');
  const [needsText] = useState(() => editor.state.selection.empty && !current);
  const [url, setUrl] = useState(current);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const href = normalizeLinkInput(url);
    if (!href) {
      setError('Enter a web address, an email address, or a path starting with /.');
      return;
    }
    if (needsText) {
      const text = label.trim() || url.trim();
      // The plain space keeps whatever is typed next from joining the link.
      editor
        .chain()
        .focus()
        .insertContent([
          { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] },
          { type: 'text', text: ' ' },
        ])
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <Modal
      title={current ? 'Edit link' : 'Add a link'}
      size="sm"
      onClose={onClose}
      footer={({ requestClose }) => (
        <div className="hub-acts">
          {current ? (
            <button type="button" className="hub-btn hub-btn-ghost hub-sp" onClick={remove}>
              Remove link
            </button>
          ) : null}
          <button type="button" className="hub-btn" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" form="ws-link-form" className="hub-btn hub-btn-primary">
            {current ? 'Save link' : 'Add link'}
          </button>
        </div>
      )}
    >
      <form id="ws-link-form" className="ws-form" onSubmit={submit} noValidate>
        <div className="hub-fld">
          <label htmlFor="ws-link-url">Link</label>
          <input
            id="ws-link-url"
            className="hub-inp"
            data-autofocus
            value={url}
            placeholder="https://example.com"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={!!error}
            aria-describedby={error ? 'ws-link-err' : undefined}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <div id="ws-link-err" className="ws-field-err" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        {needsText && (
          <div className="hub-fld">
            <label htmlFor="ws-link-text">Text to show</label>
            <input id="ws-link-text" className="hub-inp" value={label} placeholder="Optional" onChange={(e) => setLabel(e.target.value)} />
          </div>
        )}
        {current && isAllowedPageHref(current) ? (
          <a className="ws-link-open" href={current} target="_blank" rel="noopener noreferrer">
            <Icon name="ext" size={14} /> Open this link
          </a>
        ) : null}
      </form>
    </Modal>
  );
};

export default PageLinkModal;
