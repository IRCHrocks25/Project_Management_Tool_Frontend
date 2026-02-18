import React, { useState } from 'react';
import { projectService } from '../services/project.service';
import { authService } from '../services/auth.service';
import './CreateProjectModal.css';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onSuccess }) => {
  const user = authService.getUser();
  const [formData, setFormData] = useState({
    clientName: '',
    clientType: 'ICON',
    package: 'Standard',
    priority: 'Medium',
    targetCloseMonth: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientTypes = [
    { value: 'ICON', label: 'ICON', color: '#fbbf24' },
    { value: 'STAR', label: 'STAR', color: '#94a3b8' },
    { value: 'Katalyst', label: 'Katalyst', color: '#667eea' },
    { value: 'Private', label: 'Private', color: '#64748b' },
  ];

  const packages = ['Starter', 'Standard', 'Premium', 'ICON Package', 'Custom'];
  
  const allDeliverables = [
    'Logo',
    'Brand Book',
    'Landing Page',
    'Copy of Landing Page',
    'Speaker Kit',
    'Social Banners',
    'Other',
  ];
  
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>(['Logo', 'Brand Book']);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: newValue,
    });
    
    // Reset selected deliverables when switching away from Custom
    if (e.target.name === 'package' && newValue !== 'Custom') {
      setSelectedDeliverables(['Logo', 'Brand Book']);
    }
    
    setError('');
  };

  const toggleDeliverable = (deliverable: string) => {
    if (selectedDeliverables.includes(deliverable)) {
      setSelectedDeliverables(selectedDeliverables.filter(d => d !== deliverable));
    } else {
      setSelectedDeliverables([...selectedDeliverables, deliverable]);
    }
  };

  const getIncludedDeliverables = () => {
    // If Custom package, return selected deliverables
    if (formData.package === 'Custom') {
      return selectedDeliverables;
    }
    
    // Otherwise, use standard logic
    const deliverables: string[] = ['Logo', 'Brand Book'];
    
    if (formData.clientType === 'ICON') {
      deliverables.push('Speaker Kit');
    }
    
    if (formData.package === 'Premium' || formData.package === 'ICON Package') {
      deliverables.push('Landing Page');
    }
    
    if (formData.package !== 'Starter') {
      deliverables.push('Social Banners');
    }
    
    return deliverables;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate custom deliverables
    if (formData.package === 'Custom' && selectedDeliverables.length === 0) {
      setError('Please select at least one deliverable for Custom package');
      return;
    }
    
    setLoading(true);

    try {
      await projectService.create({
        ...formData,
        pmId: user?.id,
        customDeliverables: formData.package === 'Custom' ? selectedDeliverables : undefined,
      });
      
      // Show confetti effect (simple version)
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="create-project-form">
          <div className="form-row">
            <div className="form-group">
              <label>Client Name</label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                required
                placeholder="Enter client name"
              />
            </div>

            <div className="form-group">
              <label>Target Close Month</label>
              <input
                type="month"
                name="targetCloseMonth"
                value={formData.targetCloseMonth}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Client Type</label>
            <div className="client-type-grid">
              {clientTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`client-type-card ${formData.clientType === type.value ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, clientType: type.value })}
                  style={{ borderColor: formData.clientType === type.value ? type.color : '#e2e8f0' }}
                >
                  <div className="client-type-badge" style={{ backgroundColor: type.color }}>
                    {type.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Package</label>
              <select name="package" value={formData.package} onChange={handleChange} required>
                {packages.map((pkg) => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Included Deliverables</label>
            {formData.package === 'Custom' ? (
              <div className="custom-deliverables-selector">
                <p className="deliverables-hint">Select the deliverables to include in this project:</p>
                <div className="deliverables-checkbox-grid">
                  {allDeliverables.map((deliverable) => {
                    const isChecked = selectedDeliverables.includes(deliverable);
                    return (
                      <label 
                        key={deliverable} 
                        className={`deliverable-checkbox-label ${isChecked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDeliverable(deliverable)}
                          className="deliverable-checkbox"
                        />
                        <span className="deliverable-checkbox-text">{deliverable}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedDeliverables.length === 0 && (
                  <p className="error-hint" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Please select at least one deliverable
                  </p>
                )}
              </div>
            ) : (
              <div className="deliverables-preview">
                {getIncludedDeliverables().map((deliverable) => (
                  <span key={deliverable} className="deliverable-badge">
                    {deliverable}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes or requirements..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;

