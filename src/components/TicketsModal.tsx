import React, { useState, useEffect } from 'react';
import { FaTimes, FaBug, FaLightbulb, FaSpinner } from 'react-icons/fa';
import { ticketService } from '../services/ticket.service';

interface TicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

const TicketsModal: React.FC<TicketsModalProps> = ({
  isOpen,
  onClose,
  accentColor = '#8b5cf6',
}) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTickets();
    }
  }, [isOpen]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await ticketService.getAll();
      setTickets(data || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await ticketService.updateStatus(ticketId, newStatus);
      await loadTickets();
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  if (!isOpen) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Live Tickets
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#6b7280',
            }}
          >
            <FaTimes />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              <FaSpinner style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem' }}>Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <p>No tickets yet.</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Bug reports and improvements submitted by the team will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '1rem 1.25rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: t.status === 'resolved' ? '#f9fafb' : 'white',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: t.type === 'bug' ? '#fef2f2' : '#eff6ff',
                            color: t.type === 'bug' ? '#b91c1c' : '#1d4ed8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {t.type === 'bug' ? <><FaBug /> Bug</> : <><FaLightbulb /> Improvement</>}
                        </span>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            background: t.status === 'resolved' ? '#d1fae5' : t.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
                            color: t.status === 'resolved' ? '#065f46' : t.status === 'in_progress' ? '#92400e' : '#374151',
                          }}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'pre-wrap' }}>
                          {t.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                        by {t.submittedBy?.name || 'Unknown'} · {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {t.status !== 'resolved' && (
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: `1px solid ${accentColor}`,
                          background: 'white',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TicketsModal;
