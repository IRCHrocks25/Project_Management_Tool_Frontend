import React, { useState } from 'react';
import { authService } from '../services/auth.service';
import './Auth.css';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'password' | 'success';

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<string>('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[MODAL] handleEmailSubmit called with email:', email);
    setError('');
    setLoading(true);

    try {
      console.log('[MODAL] Calling authService.forgotPassword...');
      const response = await authService.forgotPassword(email);
      console.log('[MODAL] forgotPassword succeeded');
      
      // Check webhook status and redirect if email was sent
      if (response.webhookStatus) {
        if (response.webhookStatus.success) {
          const emailSent = response.webhookStatus.emailSent || 
                           response.webhookStatus.message?.includes('Email sent');
          
          if (emailSent) {
            setWebhookStatus('✅ Email sent successfully! Redirecting to OTP verification...');
            // Redirect to OTP step after showing success message
            setTimeout(() => {
              setStep('otp');
              setWebhookStatus(''); // Clear status when moving to next step
            }, 1500);
          } else {
            setWebhookStatus('✅ Webhook received! Status: ' + response.webhookStatus.status);
          }
        } else {
          setWebhookStatus('❌ Webhook failed: ' + (response.webhookStatus.error || response.webhookStatus.message));
        }
      } else {
        // Production backend doesn't have updated code - webhook might still be called but status not returned
        setWebhookStatus('⚠️ Webhook status not available - Production backend may not have updated code. Check Railway logs for webhook activity.');
        console.warn('[MODAL] Webhook status not in response. Full response:', response);
      }
    } catch (err: any) {
      console.error('[MODAL] Error in handleEmailSubmit:', err);
      console.error('[MODAL] Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('[MODAL] Verifying OTP...');
    console.log('[MODAL] Email being used:', email);
    console.log('[MODAL] OTP being verified:', otp);

    try {
      await authService.verifyOtp(email, otp);
      console.log('[MODAL] OTP verified successfully, moving to password step');
      setStep('password');
    } catch (err: any) {
      console.error('[MODAL] OTP verification failed:', err);
      console.error('[MODAL] Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      console.log('[MODAL] Resetting password...');
      console.log('[MODAL] Email being used:', email);
      await authService.resetPasswordWithOtp(email, password);
      console.log('[MODAL] Password reset successful');
      setStep('success');
    } catch (err: any) {
      console.error('[MODAL] Password reset failed:', err);
      console.error('[MODAL] Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="auth-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
        <div className="auth-card">
          <h1>Password Reset Successful</h1>
          <p className="auth-subtitle">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <button 
            onClick={onClose}
            className="btn-primary btn-full"
            style={{ marginTop: '1.5rem' }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <div className="auth-card">
        {step === 'email' && (
          <>
            <h1>Forgot Password</h1>
            <p className="auth-subtitle">Enter your email address and we'll send you an OTP to reset your password.</p>

            {error && <div className="error-message">{error}</div>}
            
            {webhookStatus && (
              <div style={{
                padding: '1rem',
                marginBottom: '1rem',
                borderRadius: '8px',
                backgroundColor: webhookStatus.includes('✅') ? '#d1fae5' : webhookStatus.includes('❌') ? '#fee2e2' : '#fef3c7',
                color: webhookStatus.includes('✅') ? '#065f46' : webhookStatus.includes('❌') ? '#991b1b' : '#92400e',
                border: `1px solid ${webhookStatus.includes('✅') ? '#10b981' : webhookStatus.includes('❌') ? '#ef4444' : '#f59e0b'}`,
                fontSize: '0.875rem',
                fontWeight: 500,
                textAlign: 'center'
              }}>
                {webhookStatus}
              </div>
            )}

            <form onSubmit={handleEmailSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>

            {webhookStatus && (
              <button 
                onClick={() => setStep('otp')}
                className="btn-primary btn-full"
                style={{ marginTop: '1rem' }}
              >
                Continue to OTP
              </button>
            )}
          </>
        )}

        {step === 'otp' && (
          <>
            <h1>Enter OTP</h1>
            <p className="auth-subtitle">We've sent a 6-digit OTP to your email. Please enter it below.</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleOtpSubmit}>
              <div className="form-group">
                <label htmlFor="otp">OTP Code</label>
                <input
                  type="text"
                  id="otp"
                  name="otp"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    setError('');
                  }}
                  required
                  placeholder="Enter 6-digit OTP"
                  autoFocus
                  maxLength={6}
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>

            <p className="auth-footer" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667eea',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                Resend OTP
              </button>
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <h1>Reset Password</h1>
            <p className="auth-subtitle">Enter your new password below.</p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="Enter new password"
                  autoFocus
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
          Remember your password?{' '}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
