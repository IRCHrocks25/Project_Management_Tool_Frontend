import React, { useState, useEffect } from 'react';
import { FaQuestion } from 'react-icons/fa';

const FAQ_ITEMS: { question: string; url: string }[] = [
  { question: 'How to create a task as a team', url: 'https://www.loom.com/share/62b94ba3053844398be6de46fb1209e3' },
  { question: 'How to claim a task', url: 'https://www.loom.com/share/e8d50167948a40a3a3bbded35e831a9b' },
  { question: 'How to move tasks', url: 'https://www.loom.com/share/37509b36bfc041118fc9174b0041a157' },
];

const FAQHelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open FAQ"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          zIndex: 9998,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#4f46e5';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#6366f1';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <FaQuestion />
      </button>

      {open && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Close FAQ"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              zIndex: 9999,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="faq-title"
            style={{
              position: 'fixed',
              bottom: '5rem',
              right: '1.5rem',
              width: 'min(360px, calc(100vw - 3rem))',
              maxHeight: 'calc(100vh - 7rem)',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '0.5px solid #e2e8f0',
              zIndex: 10000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid #e2e8f0' }}>
              <h2 id="faq-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                FAQ
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Click a question to open the video guide.
              </p>
            </div>
            <div style={{ padding: '0.5rem', overflow: 'auto', flex: 1 }}>
              {FAQ_ITEMS.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    window.open(item.url, '_blank', 'noopener,noreferrer');
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.25rem',
                    fontSize: '0.875rem',
                    color: '#334155',
                    background: '#f8fafc',
                    border: '0.5px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e0e7ff';
                    e.currentTarget.style.color = '#4338ca';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  {item.question}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default FAQHelpButton;
