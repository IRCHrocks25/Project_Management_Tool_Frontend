import React, { useMemo } from 'react';

const MORNING_MESSAGES = [
  'Rise and shine! Ready to make today productive?',
  'Good morning! Time to crush your goals.',
  'Fresh start—let\'s tackle those tasks.',
  'Morning! Your best work is ahead of you.',
];

const AFTERNOON_MESSAGES = [
  'Keep the momentum going!',
  'You\'re doing great—keep it up!',
  'Halfway there. Stay focused!',
  'Your progress today matters.',
];

const EVENING_MESSAGES = [
  'Wrapping up strong—finish what matters.',
  'Almost there. One more push!',
  'You\'ve got this. End the day on a high note.',
  'Great work today. Finish strong!',
];

const getGreeting = (): { salutation: string; message: string } => {
  const hour = new Date().getHours();
  const messages = hour < 12 ? MORNING_MESSAGES : hour < 17 ? AFTERNOON_MESSAGES : EVENING_MESSAGES;
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const message = messages[Math.floor(Math.random() * messages.length)];
  return { salutation, message };
};

interface UserGreetingProps {
  userName?: string;
  accentColor?: string;
  compact?: boolean;
}

const UserGreeting: React.FC<UserGreetingProps> = ({ userName, accentColor = '#667eea', compact = false }) => {
  const { salutation, message } = useMemo(() => getGreeting(), []);
  const displayName = userName?.trim() || 'there';

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          paddingLeft: '1.25rem',
          background: `linear-gradient(90deg, ${accentColor}0d 0%, transparent 100%)`,
          borderRadius: '12px',
          borderLeft: `4px solid ${accentColor}`,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          maxWidth: '100%',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: '#6b7280', fontWeight: 600 }}>{salutation}, </span>
          <span style={{ color: accentColor, fontWeight: 700 }}>{displayName}</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>!</span>
          <span style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.9375rem', marginLeft: '0.5rem' }}>
            {message}
          </span>
        </h1>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem 1.5rem',
        background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}15 100%)`,
        borderRadius: '12px',
        border: `1px solid ${accentColor}25`,
        marginBottom: '1.5rem',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#111827',
          letterSpacing: '-0.02em',
        }}
      >
        {salutation}, {displayName}!
      </h3>
      <p
        style={{
          margin: '0.25rem 0 0 0',
          fontSize: '0.9375rem',
          color: '#6b7280',
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
    </div>
  );
};

export default UserGreeting;
