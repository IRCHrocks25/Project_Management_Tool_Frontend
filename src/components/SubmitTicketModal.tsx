import React, { useState } from 'react';
import { FaTimes, FaBug, FaLightbulb } from 'react-icons/fa';
import { ticketService } from '../services/ticket.service';

interface SubmitTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  accentColor?: string;
}

const SubmitTicketModal: React.FC<SubmitTicketModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accentColor = '#8b5cf6',
}) => {
  const [type, setType] = useState<'bug' | 'improvement'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSubmitting(true);
    try {
      await ticketService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
      });
      setTitle('');
      setDescription('');
      setType('bug');
      onSuccess?.();
      onClose();
      alert('Ticket submitted! The AI department will review it.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setTitle('');
      setDescription('');
      setError('');
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '2rem',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: `${accentColor}10`,
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: 0,
              color: '#111827',
            }}
          >
            Submit Ticket
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
              color: '#6b7280',
            }}
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem 2rem' }}>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Report a bug or suggest an improvement. Tickets go directly to the AI department.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              Type
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setType('bug')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: `2px solid ${type === 'bug' ? accentColor : '#e5e7eb'}`,
                  borderRadius: '10px',
                  background: type === 'bug' ? `${accentColor}15` : 'white',
                  color: type === 'bug' ? accentColor : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <FaBug /> Bug
              </button>
              <button
                type="button"
                onClick={() => setType('improvement')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  border: `2px solid ${type === 'improvement' ? accentColor : '#e5e7eb'}`,
                  borderRadius: '10px',
                  background: type === 'improvement' ? `${accentColor}15` : 'white',
                  color: type === 'improvement' ? accentColor : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <FaLightbulb /> Improvement
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue or idea"
              maxLength={500}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = accentColor;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, steps to reproduce, or your suggestion..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = accentColor;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background: 'white',
                color: '#374151',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                background: submitting ? '#9ca3af' : accentColor,
                color: 'white',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitTicketModal;
