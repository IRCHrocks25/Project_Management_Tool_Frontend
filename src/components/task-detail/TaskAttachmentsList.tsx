import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaFileAlt, FaLink, FaSpinner, FaTrash, FaUpload } from 'react-icons/fa';
import ConfirmModal from '../ConfirmModal';
import { taskService } from '../../services/task.service';

interface TaskAttachmentsListProps {
  taskId: string;
}

const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const TaskAttachmentsList: React.FC<TaskAttachmentsListProps> = ({ taskId }) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskService.getAttachments(taskId);
      setAttachments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load attachments', err);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    fetchAttachments();
  }, [taskId, fetchAttachments]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.relatedTarget || !panelRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    if (files.length > MAX_FILES) {
      showToast(`Max ${MAX_FILES} files per upload`);
      return;
    }
    const oversized = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      showToast(
        `File${oversized.length > 1 ? 's' : ''} exceed 25 MB limit: ${oversized.map((f) => f.name).join(', ')}`
      );
      return;
    }
    setUploading(true);
    try {
      await taskService.uploadAttachments(taskId, files);
      await fetchAttachments();
    } catch {
      showToast('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    processFiles(files);
  };

  const handleLinkSubmit = async () => {
    const url = linkInput.trim();
    if (!url || addingLink) return;
    if (!/^https?:\/\//i.test(url)) {
      setLinkError('URL must start with http:// or https://');
      return;
    }
    setLinkError('');
    setAddingLink(true);
    try {
      await taskService.addLinkAttachment(taskId, url);
      setLinkInput('');
      await fetchAttachments();
    } catch {
      showToast('Failed to add link. Please try again.');
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await taskService.deleteAttachment(taskId, pendingDeleteId);
      await fetchAttachments();
      setPendingDeleteId(null);
    } catch {
      showToast('Failed to remove attachment.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        ref={panelRef}
        className="tdsm-card"
        style={{ borderColor: 'var(--td-border-card)' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="tdsm-card-label" style={{ color: 'var(--td-accent-primary)' }}>
          <FaLink />
          Files &amp; Links
        </div>

        <div
          className={`tdsm-drop-zone${isDragging ? ' dragging' : ''}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading
            ? <FaSpinner className="tdsm-spinner" style={{ fontSize: '16px' }} />
            : <FaUpload style={{ fontSize: '16px' }} />
          }
          <span>{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
        </div>

        <div className="tdsm-link-input-row">
          <input
            type="text"
            className="tdsm-link-text-input"
            placeholder="Paste a link (https://…)"
            value={linkInput}
            onChange={(e) => { setLinkInput(e.target.value); if (linkError) setLinkError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLinkSubmit(); }}
            disabled={addingLink}
          />
          <button
            className="tdsm-link-add-btn"
            onClick={handleLinkSubmit}
            disabled={addingLink || !linkInput.trim()}
          >
            {addingLink
              ? <FaSpinner className="tdsm-spinner" style={{ fontSize: '11px' }} />
              : 'Add'
            }
          </button>
        </div>
        {linkError && <div className="tdsm-link-error">{linkError}</div>}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', color: 'var(--td-text-tertiary)', gap: '8px', fontSize: '13px' }}>
            <FaSpinner className="tdsm-spinner" />
            Loading…
          </div>
        ) : attachments.length === 0 ? (
          <div className="tdsm-attachments-empty">No attachments yet</div>
        ) : (
          <div className="tdsm-attachment-list">
            {attachments.map((att: any, idx: number) => (
              <div key={att.id} className="tdsm-attachment-row">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tdsm-attachment-main"
                >
                  {att.kind === 'link'
                    ? <FaLink style={{ fontSize: '13px', color: 'var(--td-accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                    : <FaFileAlt style={{ fontSize: '13px', color: 'var(--td-accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                  }
                  <div className="tdsm-attachment-info">
                    <span className="tdsm-attachment-name">
                      {att.filename || att.url}
                      {idx === 0 && <span className="tdsm-badge-new">New</span>}
                    </span>
                    <span className="tdsm-attachment-meta">
                      {att.kind === 'file' && att.sizeBytes != null ? `${formatBytes(att.sizeBytes)} · ` : ''}
                      {att.uploadedBy?.name || 'Unknown'}
                      {att.uploadedAt ? ` · ${formatDate(att.uploadedAt)}` : ''}
                    </span>
                  </div>
                </a>
                <button
                  className="tdsm-attachment-delete"
                  onClick={() => setPendingDeleteId(att.id)}
                  title="Remove attachment"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove attachment"
        message="This will permanently remove the attachment. This cannot be undone."
        confirmText="Remove"
        type="danger"
        loading={deleting}
      />
    </>
  );
};

export default TaskAttachmentsList;
