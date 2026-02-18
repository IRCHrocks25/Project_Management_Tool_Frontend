import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaTrash } from 'react-icons/fa';
import { taskService } from '../services/task.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
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
      loadDeliverables();
    }
  }, [isOpen, task, projectId]);

  const loadDeliverables = async () => {
    try {
      const projectDeliverables = await deliverableService.getAll(projectId);
      setDeliverables(projectDeliverables);
    } catch (error) {
      console.error('Failed to load deliverables:', error);
    }
  };

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

      const user = authService.getUser();
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

      await taskService.update(task.id, updateData);
      
      // If a deliverable is associated (especially custom), assign it to the current user if:
      // 1. Task is not assigned, AND
      // 2. User is not a Project Manager (PMs don't own tasks)
      if (deliverableId && user?.id && !task.assignedToId && user.role !== 'Project Manager' && user.role !== 'FOUNDER/CEO') {
        await taskService.assign(task.id, user.id);
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

