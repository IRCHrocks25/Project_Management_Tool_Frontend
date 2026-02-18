import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus } from 'react-icons/fa';
import { taskService } from '../services/task.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
import './AddTaskModal.css';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskType: string;
  onTaskAdded: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskType,
  onTaskAdded,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    deliverableId: '',
  });
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomDeliverableInput, setShowCustomDeliverableInput] = useState(false);
  const [customDeliverableName, setCustomDeliverableName] = useState('');

  const loadDeliverables = async () => {
    try {
      const projectDeliverables = await deliverableService.getAll(projectId);
      setDeliverables(projectDeliverables);
    } catch (error) {
      console.error('Failed to load deliverables:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        deliverableId: '',
      });
      setShowCustomDeliverableInput(false);
      setCustomDeliverableName('');
      loadDeliverables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

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
      const taskData: any = {
        projectId,
        title: formData.title,
        description: formData.description,
        type: taskType,
        status: 'Todo',
        isCompleted: false,
      };

      if (formData.dueDate) {
        taskData.dueDate = new Date(formData.dueDate);
      }

      // If a deliverable is associated (especially custom), automatically assign the task to the current user
      // UNLESS the user is a Project Manager (PMs don't own tasks)
      if (deliverableId && user?.id && user.role !== 'Project Manager' && user.role !== 'FOUNDER/CEO') {
        taskData.deliverableId = deliverableId;
        taskData.assignedToId = user.id;
      } else if (deliverableId) {
        taskData.deliverableId = deliverableId;
      }

      const createdTask = await taskService.create(taskData);
      console.log('[AddTaskModal] Created task:', createdTask);
      console.log('[AddTaskModal] Task deliverableId:', createdTask.deliverableId);
      console.log('[AddTaskModal] Task assignedToId:', createdTask.assignedToId);
      
      // If deliverable is associated but task wasn't assigned during creation, assign it now
      // (only if user is not a PM)
      if (deliverableId && user?.id && !createdTask.assignedToId && user.role !== 'Project Manager' && user.role !== 'FOUNDER/CEO') {
        console.log('[AddTaskModal] Assigning task to user:', user.id);
        await taskService.assign(createdTask.id, user.id);
      }
      
      onTaskAdded();
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Task</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-task-form">
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
              <FaPlus /> {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;

