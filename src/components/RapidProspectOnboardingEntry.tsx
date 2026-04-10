import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clientUpdatesService } from '../services/client-updates.service';

const RapidProspectOnboardingEntry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isResolving, setIsResolving] = useState(true);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const envLink = process.env.REACT_APP_RAPID_PROSPECT_ONBOARDING_LINK || '';

  const envToken = useMemo(() => {
    const match = envLink.match(/\/client-updates\/forms\/([^/?#]+)/i);
    return match ? match[1] : '';
  }, [envLink]);

  const queryToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tokenOrUrl = (params.get('token') || params.get('link') || '').trim();
    if (!tokenOrUrl) return '';
    const match = tokenOrUrl.match(/\/client-updates\/forms\/([^/?#]+)/i);
    return match ? match[1] : tokenOrUrl;
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;

    const resolveAndOpenForm = async () => {
      setResolutionError(null);
      setIsResolving(true);

      const directToken = queryToken || envToken;
      if (directToken) {
        navigate(`/client-updates/forms/${encodeURIComponent(directToken)}`, { replace: true });
        return;
      }

      try {
        const latest = await clientUpdatesService.getLatestRapidProspectFormToken();
        if (!isMounted) return;

        if (latest?.publicToken) {
          navigate(`/client-updates/forms/${encodeURIComponent(latest.publicToken)}`, { replace: true });
          return;
        }

        setResolutionError('No onboarding form is published yet. Please contact the Katalyst team.');
      } catch (error) {
        if (!isMounted) return;
        setResolutionError('We could not open onboarding right now. Please try again in a moment.');
      } finally {
        if (isMounted) {
          setIsResolving(false);
        }
      }
    };

    resolveAndOpenForm();
    return () => {
      isMounted = false;
    };
  }, [envToken, navigate, queryToken]);

  return (
    <div style={{ minHeight: '100vh', background: '#0b1020', color: 'white', padding: '3rem 1rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, padding: '2rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Rapid Prospect Onboarding</h1>
        <p style={{ marginTop: 0, color: 'rgba(255,255,255,0.75)' }}>
          Opening your onboarding questionnaire...
        </p>
        {isResolving && (
          <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 0 }}>Please wait while we load your form.</p>
        )}
        {!isResolving && resolutionError && (
          <p style={{ color: '#fca5a5', marginBottom: 0 }}>{resolutionError}</p>
        )}
      </div>
    </div>
  );
};

export default RapidProspectOnboardingEntry;
