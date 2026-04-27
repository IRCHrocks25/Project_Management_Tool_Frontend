import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaTrash } from 'react-icons/fa';
import { taskService } from '../services/task.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
import { clientUpdatesService } from '../services/client-updates.service';
import { filterUsersByDepartment } from '../utils/roleMapping';
import './EditTaskModal.css';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  projectId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  projectId,
  onUpdate,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    deliverableId: '',
  });
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCustomDeliverableInput, setShowCustomDeliverableInput] = useState(false);
  const [customDeliverableName, setCustomDeliverableName] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>(['']);
  const [attachmentFileUrls, setAttachmentFileUrls] = useState<string[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const handleImageUpload = async (file: File): Promise<string> => {
    // Reuse same backend/webp → Cloudinary pipeline as other components
    const url = await clientUpdatesService.uploadImage(file, projectId);
    return url;
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await authService.getAllUsers?.();
        if (users) {
          setAllUsers(users);
        }
      } catch (error) {
        console.error('Failed to load users for edit task modal:', error);
      }
    };
    loadUsers();
  }, []);

  const loadDeliverables = async () => {
    try {
      const projectDeliverables = await deliverableService.getAll(projectId);
      setDeliverables(projectDeliverables);
    } catch (error) {
      console.error('Failed to load deliverables:', error);
    }
  };

  useEffect(() => {
    if (isOpen && task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        deliverableId: task.deliverableId || '',
      });
      setShowCustomDeliverableInput(false);
      setCustomDeliverableName('');
      setAssignedToId(task.assignedToId || '');
      setDepartment(task.department || '');
      setAttachmentLinks(['']);
      setAttachmentFileUrls(task.fileUrl ? [task.fileUrl] : []);
      loadDeliverables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task, projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (e.target.name === 'deliverableId') {
      if (value === 'custom') {
        setShowCustomDeliverableInput(true);
        setFormData({
          ...formData,
          deliverableId: '',
        });
      } else {
        setShowCustomDeliverableInput(false);
        setCustomDeliverableName('');
        setFormData({
          ...formData,
          [e.target.name]: value,
        });
      }
    } else {
      setFormData({
        ...formData,
        [e.target.name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    setLoading(true);
    try {
      let deliverableId = formData.deliverableId;

      // If custom deliverable is being created
      if (showCustomDeliverableInput && customDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          projectId,
          'Other',
          customDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        // Reload deliverables to include the new one
        await loadDeliverables();
      }

      const updateData: any = {
        title: formData.title,
        description: formData.description,
      };

      if (formData.dueDate) {
        updateData.dueDate = new Date(formData.dueDate);
      }

      if (deliverableId) {
        updateData.deliverableId = deliverableId;
      }

      // Handle attachments: append links/files to description, keep first as fileUrl
      const links = attachmentLinks.filter((link) => link.trim() !== '');
      const allAttachmentUrls = [...links, ...attachmentFileUrls];
      if (allAttachmentUrls.length > 0) {
        const attachmentsBlock =
          '\n\n--- Attachments ---\n' + allAttachmentUrls.join('\n');
        updateData.description = (updateData.description || '') + attachmentsBlock;
        updateData.fileUrl = allAttachmentUrls[0];
      }

      await taskService.update(task.id, updateData);

      // Handle owner assignment changes
      if (assignedToId && assignedToId !== task.assignedToId) {
        await taskService.assign(task.id, assignedToId);
      } else if (!assignedToId && task.assignedToId) {
        // Try to unassign if backend supports assigning to empty string
        try {
          await taskService.assign(task.id, '');
        } catch (err) {
          console.warn('Unassign not supported by backend:', err);
        }
      }
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    setLoading(true);
    try {
      await taskService.delete(task.id);
      onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task. Please try again.');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Task</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="delete-confirm">
            <h3>Delete Task?</h3>
            <p>Are you sure you want to delete "{task.title}"? This action cannot be undone.</p>
            <div className="delete-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="edit-task-form">
            <div className="form-group">
              <label htmlFor="title">Task Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Enter task title"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Enter task description"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="deliverableId">Associate with Deliverable (Optional)</label>
              <select
                id="deliverableId"
                name="deliverableId"
                value={showCustomDeliverableInput ? 'custom' : formData.deliverableId}
                onChange={handleChange}
              >
                <option value="">None</option>
                {deliverables.map((deliverable) => (
                  <option key={deliverable.id} value={deliverable.id}>
                    {deliverable.customType || deliverable.type}
                  </option>
                ))}
                <option value="custom">➕ Add Custom Deliverable</option>
              </select>
              {showCustomDeliverableInput && (
                <div className="custom-deliverable-input">
                  <input
                    type="text"
                    placeholder="Enter custom deliverable name (e.g., Email Templates, Social Media Posts)"
                    value={customDeliverableName}
                    onChange={(e) => setCustomDeliverableName(e.target.value)}
                    className="custom-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-remove-custom"
                    onClick={() => {
                      setShowCustomDeliverableInput(false);
                      setCustomDeliverableName('');
                      setFormData({ ...formData, deliverableId: '' });
                    }}
                    title="Cancel custom deliverable"
                  >
                    <FaTimes />
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="department">Department (for owner filtering)</label>
              <select
                id="department"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  // Clear owner if it no longer matches department
                  setAssignedToId('');
                }}
              >
                <option value="">All Departments</option>
                <option value="Design">Design</option>
                <option value="Copy Writing">Copy Writing</option>
                <option value="Development">Development</option>
                <option value="AI Team">AI Team</option>
                <option value="Social Media Team">Social Media Team</option>
                <option value="CRM">CRM</option>
                <option value="SEO/GEO Team">SEO/GEO Team</option>
                <option value="Onboarding">Onboarding</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignedTo">Owner (Assignee)</label>
              <select
                id="assignedTo"
                name="assignedToId"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {/*
KNOWN ISSUE: filterUsersByDepartment shows all users instead of filtering
by department in this specific modal. AssigneePicker (in task-detail/) uses
the same util correctly, so the bug is specific to how this modal calls it
or to its state. Not worth investigating further — EditTaskModal is being
replaced by Full Edit mode inside TaskDetailSideModal in Chunk 6, at which
point this code is removed. Affected users: anyone using "Edit Task" from
the project board sees all users in the assignee dropdown regardless of
selected department. Workaround: scroll to find the right user, or use
inline assignee editing in TaskDetailSideModal which works correctly.
*/}
                {filterUsersByDepartment(allUsers, department)
                  .map((user: any) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>Links (Optional)</label>
              {attachmentLinks.map((link, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="url"
                    className="form-input"
                    value={link}
                    onChange={(e) => {
                      const updated = [...attachmentLinks];
                      updated[index] = e.target.value;
                      setAttachmentLinks(updated);
                    }}
                    placeholder="Paste a URL (Google Drive, Loom, Figma, etc.)"
                  />
                  {attachmentLinks.length > 1 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const updated = attachmentLinks.filter((_, i) => i !== index);
                        setAttachmentLinks(updated.length ? updated : ['']);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAttachmentLinks([...attachmentLinks, ''])}
              >
                + Add Another Link
              </button>
            </div>

            <div className="form-group">
              <label>Files (Optional)</label>
              <input
                type="file"
                multiple
                className="form-input"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  try {
                    setUploadingAttachments(true);
                    const uploaded: string[] = [];
                    for (const file of files) {
                      const url = await handleImageUpload(file as File);
                      uploaded.push(url);
                    }
                    setAttachmentFileUrls((prev) => [...prev, ...uploaded]);
                  } catch (error) {
                    console.error('Failed to upload attachments:', error);
                    alert('Failed to upload file(s). Please try again.');
                  } finally {
                    setUploadingAttachments(false);
                  }
                }}
              />
              {uploadingAttachments && (
                <small style={{ color: '#64748b' }}>Uploading attachments...</small>
              )}
              {attachmentFileUrls.length > 0 && !uploadingAttachments && (
                <small style={{ color: '#16a34a' }}>
                  {attachmentFileUrls.length} file(s) uploaded ✓
                </small>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                <FaTrash /> Delete Task
              </button>
              <div className="action-buttons">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  <FaSave /> {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditTaskModal;

