import React, { useState, useEffect } from 'react';
import { FaTimes, FaGoogleDrive, FaLink, FaFigma, FaGlobe } from 'react-icons/fa';
import './SendForReviewModal.css';

interface SendForReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (fileLink: string, deliverableType: string, deliverableId?: string) => void;
  taskTitle: string;
  projectDeliverables?: Array<{ id: string; type: string; customType?: string; status: string }>;
  loading?: boolean;
  isDesignTask?: boolean; // New prop to indicate if this is for design team
  isDevTask?: boolean; // New prop to indicate if this is for dev team
  taskDeliverableId?: string; // If task is already assigned to a deliverable
}

const SendForReviewModal: React.FC<SendForReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  taskTitle,
  projectDeliverables = [],
  loading = false,
  isDesignTask = false,
  isDevTask = false,
  taskDeliverableId,
}) => {
  const [fileLink, setFileLink] = useState('');
  const [linkType, setLinkType] = useState<'drive' | 'figma' | 'preview' | 'generic'>(isDevTask ? 'preview' : 'drive');
  const [deliverableType, setDeliverableType] = useState('');
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string>('');
  const [error, setError] = useState('');

  // Find the deliverable if task is already assigned to one
  const assignedDeliverable = taskDeliverableId 
    ? projectDeliverables.find((d: any) => d.id === taskDeliverableId)
    : null;

  // Auto-set deliverable if task is already assigned
  useEffect(() => {
    if (assignedDeliverable && isOpen) {
      setDeliverableType(assignedDeliverable.type);
      setSelectedDeliverableId(assignedDeliverable.id);
    } else if (!assignedDeliverable && isOpen) {
      // Reset if no assigned deliverable
      setDeliverableType('');
      setSelectedDeliverableId('');
    }
  }, [assignedDeliverable, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fileLink.trim()) {
      if (isDevTask) {
        setError('Please enter a preview/deployment URL');
      } else if (linkType === 'figma') {
        setError('Please enter a Figma link');
      } else if (linkType === 'drive') {
        setError('Please enter a Google Drive link');
      } else {
        setError('Please enter a valid link');
      }
      return;
    }

    if (!deliverableType && !assignedDeliverable) {
      setError('Please select a deliverable type');
      return;
    }

    // Validation based on link type
    if (isDevTask) {
      // For dev tasks, accept any valid URL (preview/deployment link)
      try {
        new URL(fileLink);
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    } else if (linkType === 'drive') {
      if (!fileLink.includes('drive.google.com') && !fileLink.includes('docs.google.com')) {
        setError('Please enter a valid Google Drive link');
        return;
      }
    } else if (linkType === 'figma') {
      if (!fileLink.includes('figma.com')) {
        setError('Please enter a valid Figma link');
        return;
      }
    } else if (linkType === 'generic') {
      // Accept any valid URL
      try {
        new URL(fileLink);
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    // Use assigned deliverable if task is already assigned, otherwise use selected one
    const finalDeliverableType = assignedDeliverable ? assignedDeliverable.type : deliverableType;
    const finalDeliverableId = assignedDeliverable ? assignedDeliverable.id : (selectedDeliverableId || undefined);
    onSubmit(fileLink.trim(), finalDeliverableType, finalDeliverableId);
    setFileLink('');
    setLinkType(isDevTask ? 'preview' : 'drive');
    setDeliverableType('');
    setSelectedDeliverableId('');
  };

  const handleClose = () => {
    setFileLink('');
    setLinkType(isDevTask ? 'preview' : 'drive');
    setDeliverableType('');
    setSelectedDeliverableId('');
    setError('');
    onClose();
  };

  // Show all deliverables from the project, including custom ones
  // For design tasks: show design-related + custom deliverables
  // For copy tasks: show copy-related + custom deliverables  
  // For dev tasks: show Landing Page + custom deliverables
  const relevantDeliverables = isDevTask
    ? projectDeliverables.filter((d: any) => 
        d.type === 'Landing Page' || (d.type === 'Other' && d.customType)
      )
    : isDesignTask
    ? projectDeliverables.filter((d: any) => 
        ['Logo', 'Social Banners', 'Speaker Kit', 'Brand Book', 'Landing Page'].includes(d.type) || 
        (d.type === 'Other' && d.customType)
      )
    : projectDeliverables.filter((d: any) => 
        ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type) || 
        (d.type === 'Other' && d.customType)
      );
  
  // Sort deliverables: standard types first, then custom ones
  const sortedDeliverables = [...relevantDeliverables].sort((a: any, b: any) => {
    if (a.customType && !b.customType) return 1;
    if (!a.customType && b.customType) return -1;
    return (a.customType || a.type).localeCompare(b.customType || b.type);
  });

  return (
    <div className="send-review-modal-overlay" onClick={handleClose}>
      <div className="send-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="send-review-modal-header">
          <div>
            <h2>Send for Review</h2>
            <p className="modal-subtitle">
              {isDevTask 
                ? `Attach preview/deployment URL for ${taskTitle}`
                : `Attach ${isDesignTask ? 'Figma or Google Drive' : 'Google Drive'} link for ${taskTitle}`
              }
            </p>
          </div>
          <button className="close-button" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="send-review-form">
          <div className="form-group-review">
            <label>
              <FaGoogleDrive className="label-icon" />
              Deliverable Type
            </label>
            {assignedDeliverable ? (
              // Show read-only deliverable name if task is already assigned
              <div style={{
                padding: '0.875rem 1rem',
                border: '1.5px solid #e5e7eb',
                borderRadius: '8px',
                background: '#f9fafb',
                color: '#111827',
                fontWeight: 500,
                fontSize: '1rem'
              }}>
                {assignedDeliverable.customType || assignedDeliverable.type}
              </div>
            ) : (
              // Show dropdown if task is not assigned to a deliverable
              <>
                <select
                  value={deliverableType}
                  onChange={(e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const deliverableId = selectedOption.getAttribute('data-deliverable-id') || '';
                    setDeliverableType(e.target.value);
                    setSelectedDeliverableId(deliverableId);
                    setError('');
                  }}
                  className="deliverable-select"
                  required
                >
                  <option value="">Select deliverable type...</option>
                  {sortedDeliverables.map((deliverable: any) => {
                    const displayName = deliverable.customType || deliverable.type;
                    // For backend compatibility: use the enum type value (for custom deliverables, type is 'Other')
                    const value = deliverable.type; // Always use the enum type
                    return (
                      <option 
                        key={deliverable.id} 
                        value={value} 
                        data-deliverable-id={deliverable.id}
                      >
                        {displayName}
                      </option>
                    );
                  })}
                </select>
                <p className="input-hint">
                  Select which deliverable this {isDesignTask ? 'design' : 'copy'} is for. The link will be attached to this deliverable.
                </p>
              </>
            )}
          </div>

          <div className="form-group-review">
            <label>
              {isDevTask ? (
                <FaGlobe className="label-icon" />
              ) : isDesignTask ? (
                <FaFigma className="label-icon" />
              ) : (
                <FaLink className="label-icon" />
              )}
              Link Type
            </label>
            <div className="link-type-selector">
              {isDevTask ? (
                <div className="link-type-info" style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: 600 }}>
                  <FaGlobe />
                  <span>Preview/Deployment URL</span>
                </div>
              ) : isDesignTask ? (
                <>
                  <button
                    type="button"
                    className={`link-type-btn ${linkType === 'figma' ? 'active' : ''}`}
                    onClick={() => {
                      setLinkType('figma');
                      setError('');
                    }}
                  >
                    <FaFigma /> Figma
                  </button>
                  <button
                    type="button"
                    className={`link-type-btn ${linkType === 'drive' ? 'active' : ''}`}
                    onClick={() => {
                      setLinkType('drive');
                      setError('');
                    }}
                  >
                    <FaGoogleDrive /> Google Drive
                  </button>
                  <button
                    type="button"
                    className={`link-type-btn ${linkType === 'generic' ? 'active' : ''}`}
                    onClick={() => {
                      setLinkType('generic');
                      setError('');
                    }}
                  >
                    <FaLink /> Other Link
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`link-type-btn ${linkType === 'drive' ? 'active' : ''}`}
                    onClick={() => {
                      setLinkType('drive');
                      setError('');
                    }}
                  >
                    <FaGoogleDrive /> Google Drive
                  </button>
                  <button
                    type="button"
                    className={`link-type-btn ${linkType === 'generic' ? 'active' : ''}`}
                    onClick={() => {
                      setLinkType('generic');
                      setError('');
                    }}
                  >
                    <FaLink /> Other Link
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-group-review">
            <label>
              {isDevTask ? (
                <FaGlobe className="label-icon" />
              ) : linkType === 'figma' ? (
                <FaFigma className="label-icon" />
              ) : linkType === 'generic' ? (
                <FaLink className="label-icon" />
              ) : (
                <FaGoogleDrive className="label-icon" />
              )}
              {isDevTask
                ? 'Preview/Deployment URL'
                : linkType === 'figma'
                ? 'Figma Link'
                : linkType === 'drive'
                ? 'Google Drive Link'
                : 'Link'}
            </label>
            <div className="input-wrapper">
              <FaLink className="input-icon" />
              <input
                type="url"
                value={fileLink}
                onChange={(e) => {
                  setFileLink(e.target.value);
                  setError('');
                }}
                placeholder={
                  isDevTask
                    ? 'https://example.com or https://preview.example.com'
                    : linkType === 'figma'
                    ? 'https://www.figma.com/file/...'
                    : linkType === 'drive'
                    ? 'https://drive.google.com/file/d/...'
                    : 'https://your-link-here.com/...'
                }
                className="drive-link-input"
                required
                autoFocus
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <p className="input-hint">
              {isDevTask
                ? 'Paste the preview or deployment URL for the landing page. This will be visible to the PM and added to client files.'
                : linkType === 'figma'
                ? `Paste the Figma link to your ${isDesignTask ? 'design' : 'asset'} files. This will be visible to the PM and added to client files.`
                : linkType === 'drive'
                ? `Paste the Google Drive link to your ${isDesignTask ? 'design' : 'copy'} files. This will be visible to the PM and added to client files.`
                : 'Paste any valid URL (Loom, GitHub, Notion, etc.). This will be visible to the PM and added to client files.'}
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={handleClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" className="btn-submit-review" disabled={loading}>
              {loading ? 'Sending...' : 'Send for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendForReviewModal;

