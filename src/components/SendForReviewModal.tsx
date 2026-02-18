import React, { useState } from 'react';
import { FaTimes, FaGoogleDrive, FaLink, FaFigma, FaGlobe } from 'react-icons/fa';
import './SendForReviewModal.css';

interface SendForReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (fileLink: string, deliverableType: string) => void;
  taskTitle: string;
  projectDeliverables?: Array<{ id: string; type: string; status: string }>;
  loading?: boolean;
  isDesignTask?: boolean; // New prop to indicate if this is for design team
  isDevTask?: boolean; // New prop to indicate if this is for dev team
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
}) => {
  const [fileLink, setFileLink] = useState('');
  const [linkType, setLinkType] = useState<'drive' | 'figma' | 'preview'>(isDevTask ? 'preview' : 'drive');
  const [deliverableType, setDeliverableType] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fileLink.trim()) {
      if (isDevTask) {
        setError('Please enter a preview/deployment URL');
      } else {
        setError(`Please enter a ${linkType === 'figma' ? 'Figma' : 'Google Drive'} link`);
      }
      return;
    }

    if (!deliverableType) {
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
    }

    onSubmit(fileLink.trim(), deliverableType);
    setFileLink('');
    setLinkType(isDevTask ? 'preview' : 'drive');
    setDeliverableType('');
  };

  const handleClose = () => {
    setFileLink('');
    setLinkType(isDevTask ? 'preview' : 'drive');
    setDeliverableType('');
    setError('');
    onClose();
  };

  // Filter deliverables based on task type
  const relevantDeliverables = isDevTask
    ? projectDeliverables.filter((d: any) => 
        ['Landing Page'].includes(d.type)
      )
    : isDesignTask
    ? projectDeliverables.filter((d: any) => 
        ['Logo', 'Social Banners', 'Speaker Kit', 'Brand Book', 'Landing Page'].includes(d.type)
      )
    : projectDeliverables.filter((d: any) => 
        ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type)
      );

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
            <select
              value={deliverableType}
              onChange={(e) => {
                setDeliverableType(e.target.value);
                setError('');
              }}
              className="deliverable-select"
              required
            >
              <option value="">Select deliverable type...</option>
              {relevantDeliverables.map((deliverable: any) => (
                <option key={deliverable.id} value={deliverable.type}>
                  {deliverable.type}
                </option>
              ))}
            </select>
            <p className="input-hint">
              Select which deliverable this {isDesignTask ? 'design' : 'copy'} is for. The link will be attached to this deliverable.
            </p>
          </div>

          {(isDesignTask || isDevTask) && (
            <div className="form-group-review">
              <label>
                {isDevTask ? (
                  <FaGlobe className="label-icon" />
                ) : (
                  <FaFigma className="label-icon" />
                )}
                Link Type
              </label>
              <div className="link-type-selector">
                {isDevTask ? (
                  <div className="link-type-info" style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: 600 }}>
                    <FaGlobe />
                    <span>Preview/Deployment URL</span>
                  </div>
                ) : (
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
                  </>
                )}
              </div>
            </div>
          )}

          <div className="form-group-review">
            <label>
              {isDevTask ? (
                <FaGlobe className="label-icon" />
              ) : linkType === 'figma' ? (
                <FaFigma className="label-icon" />
              ) : (
                <FaGoogleDrive className="label-icon" />
              )}
              {isDevTask ? 'Preview/Deployment URL' : linkType === 'figma' ? 'Figma' : 'Google Drive'} Link
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
                    : 'https://drive.google.com/file/d/...'
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
                : `Paste the ${linkType === 'figma' ? 'Figma' : 'Google Drive'} link to your ${isDesignTask ? 'design' : 'copy'} files. This will be visible to the PM and added to client files.`
              }
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

