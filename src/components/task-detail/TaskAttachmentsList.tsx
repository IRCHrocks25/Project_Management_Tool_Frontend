import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaFileAlt, FaLink, FaSpinner, FaTrash, FaUpload, FaCheck, FaTimes } from 'react-icons/fa';
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
  const [isDragging, setIsDragging] = useState(false);

  // Pending file upload state — files are held here until confirmed
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [fileNote, setFileNote] = useState('');
  const [uploading, setUploading] = useState(false);

  // Link state
  const [linkInput, setLinkInput] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [linkError, setLinkError] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileNoteRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-focus the note field when files are staged
  useEffect(() => {
    if (pendingFiles) {
      setTimeout(() => fileNoteRef.current?.focus(), 50);
    }
  }, [pendingFiles]);

  const stageFiles = (files: File[]) => {
    if (files.length === 0) return;
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
    setPendingFiles(files);
    setFileNote('');
  };

  const confirmUpload = async () => {
    if (!pendingFiles || uploading) return;
    setUploading(true);
    try {
      await taskService.uploadAttachments(taskId, pendingFiles, fileNote);
      setPendingFiles(null);
      setFileNote('');
      await fetchAttachments();
    } catch {
      showToast('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    setPendingFiles(null);
    setFileNote('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.relatedTarget || !panelRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    stageFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    stageFiles(files);
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
      await taskService.addLinkAttachment(taskId, url, undefined, linkNote);
      setLinkInput('');
      setLinkNote('');
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

        {/* ── File drop zone or pending confirmation ── */}
        {pendingFiles ? (
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              padding: '10px 12px',
              background: 'rgba(76, 110, 245, 0.05)',
              border: '1px solid rgba(76, 110, 245, 0.2)',
              borderRadius: 'var(--td-radius-md)',
              marginBottom: '8px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--td-text-secondary)', marginBottom: '4px', fontWeight: 500 }}>
                {pendingFiles.length === 1
                  ? pendingFiles[0].name
                  : `${pendingFiles.length} files selected`}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--td-text-tertiary)' }}>
                {pendingFiles.map(f => formatBytes(f.size)).join(' · ')}
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--td-text-secondary)', marginBottom: '5px' }}>
                Note <span style={{ color: 'var(--td-text-tertiary)', fontWeight: 400 }}>(optional)</span>
              </div>
              <textarea
                ref={fileNoteRef}
                className="tdsm-desc-textarea"
                placeholder="Add a note about these files…"
                value={fileNote}
                onChange={e => setFileNote(e.target.value)}
                rows={2}
                style={{ minHeight: 'unset' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirmUpload(); }
                  if (e.key === 'Escape') cancelUpload();
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '7px' }}>
              <button
                className="tdsm-post-btn"
                onClick={confirmUpload}
                disabled={uploading}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {uploading
                  ? <><FaSpinner className="tdsm-spinner" style={{ fontSize: '10px' }} /> Uploading…</>
                  : <><FaCheck style={{ fontSize: '10px' }} /> Upload</>
                }
              </button>
              <button
                className="tdsm-btn-outline"
                onClick={cancelUpload}
                disabled={uploading}
                style={{ padding: '6px 12px' }}
              >
                <FaTimes style={{ fontSize: '10px' }} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`tdsm-drop-zone${isDragging ? ' dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <FaUpload style={{ fontSize: '16px' }} />
            <span>Drop files here or click to upload</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
          </div>
        )}

        {/* ── Link input ── */}
        {!pendingFiles && (
          <>
            <div className="tdsm-link-input-row">
              <input
                type="text"
                className="tdsm-link-text-input"
                placeholder="Paste a link (https://…)"
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); if (linkError) setLinkError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleLinkSubmit(); }}
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

            {linkInput.trim() && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--td-text-secondary)', marginBottom: '5px' }}>
                  Note <span style={{ color: 'var(--td-text-tertiary)', fontWeight: 400 }}>(optional)</span>
                </div>
                <textarea
                  className="tdsm-desc-textarea"
                  placeholder="Add a note about this link…"
                  value={linkNote}
                  onChange={e => setLinkNote(e.target.value)}
                  rows={2}
                  style={{ minHeight: 'unset' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleLinkSubmit(); }
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ── Attachment list ── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', color: 'var(--td-text-tertiary)', gap: '8px', fontSize: '13px' }}>
            <FaSpinner className="tdsm-spinner" />
            Loading…
          </div>
        ) : attachments.length === 0 ? (
          <div className="tdsm-attachments-empty">No attachments yet</div>
        ) : (
          <div className="tdsm-attachment-list">
            {attachments.map((att: any) => (
              <div key={att.id} className="tdsm-attachment-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                {att.note && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--td-text-secondary)',
                    background: 'var(--td-surface-sunken)',
                    border: '1px solid var(--td-border-default)',
                    borderRadius: 'var(--td-radius-sm)',
                    padding: '6px 9px',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {att.note}
                  </div>
                )}
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
