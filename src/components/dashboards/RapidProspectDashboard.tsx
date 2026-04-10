import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaCheckCircle,
  FaExternalLinkAlt,
  FaFlagCheckered,
  FaLayerGroup,
  FaLock,
  FaPlus,
  FaSpinner,
  FaSyncAlt,
  FaTimes,
  FaUserTie,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../services/project.service';
import { authService } from '../../services/auth.service';
import {
  clientUpdatesService,
  ClientUpdate,
  ClientUpdateForm,
  FormSubmission,
  SubmissionResponse,
} from '../../services/client-updates.service';
import { getRapidProspectOnboardingTemplateBlocks } from '../../constants/rapidProspectOnboardingTemplate';

const PHASES = [
  'Payment Confirmed',
  'Welcome + Call Booking',
  'Onboarding Call',
  'Credential Collection',
  'Follow-Up Call',
  'Soft Launch',
  'Background QA Monitoring',
  'Full Go-Live',
];

const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Blocked'];
const RAPID_PROSPECT_CLIENT_TYPE = 'Rapid Prospect';
const RAPID_PROSPECT_DEFAULT_PACKAGE = 'Starter';
const RAPID_PROSPECT_DEFAULT_PRIORITY = 'Medium';
const CLIPBOARD_TIMEOUT_MS = 1200;
const CREDENTIAL_MILESTONE_KEY = 'credentialCollection';

interface ProfileFormBundle {
  update: ClientUpdate;
  form: ClientUpdateForm;
  submissions: FormSubmission[];
}

interface SavedCredentialNote {
  text: string;
  savedAt: string;
}

const RapidProspectDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [notesByProject, setNotesByProject] = useState<Record<string, string>>({});
  const [generatingFormFor, setGeneratingFormFor] = useState<string | null>(null);
  const [onboardingFormLinks, setOnboardingFormLinks] = useState<Record<string, string>>({});
  const [creatingClient, setCreatingClient] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [profileForms, setProfileForms] = useState<ProfileFormBundle[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'profile' | 'credentials' | 'responses' | 'activity'>('profile');
  const [credentialsDraft, setCredentialsDraft] = useState('');
  const [savedCredentialNotes, setSavedCredentialNotes] = useState<SavedCredentialNote[]>([]);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    clientName: '',
    targetCloseMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    notes: '',
    pmId: user?.id || '',
    autoGenerateForm: true,
  });

  const copyToClipboardSafely = async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard?.writeText) {
      return false;
    }

    try {
      const copied = await Promise.race<boolean>([
        navigator.clipboard.writeText(text).then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), CLIPBOARD_TIMEOUT_MS);
        }),
      ]);
      return copied;
    } catch {
      return false;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [rapidProspects, allUsers] = await Promise.all([
        projectService.getRapidProspects(),
        authService.getAllUsers(),
      ]);
      setProjects(rapidProspects || []);
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Failed to load rapid prospect data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.onboardingPhaseStatus === 'In Progress').length;
    const blocked = projects.filter((p) => p.onboardingPhaseStatus === 'Blocked').length;
    const readyForGoLive = projects.filter((p) => p.onboardingPhase === 'Background QA Monitoring').length;
    return { total, inProgress, blocked, readyForGoLive };
  }, [projects]);

  const projectsByPhase = useMemo(() => {
    const grouped: Record<string, any[]> = PHASES.reduce((acc, phase) => {
      acc[phase] = [];
      return acc;
    }, {} as Record<string, any[]>);

    projects.forEach((project) => {
      const phase = PHASES.includes(project.onboardingPhase) ? project.onboardingPhase : 'Welcome + Call Booking';
      grouped[phase].push(project);
    });

    return grouped;
  }, [projects]);

  const phaseCounts = useMemo(() => {
    return PHASES.reduce((acc, phase) => {
      acc[phase] = projectsByPhase[phase]?.length || 0;
      return acc;
    }, {} as Record<string, number>);
  }, [projectsByPhase]);

  const phaseColumnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const totalProfileResponses = useMemo(
    () => profileForms.reduce((acc, f) => acc + f.submissions.length, 0),
    [profileForms],
  );

  const profileActivity = useMemo(() => {
    if (!selectedProject) return [];
    const items: Array<{ label: string; value?: string; at?: string }> = [];
    if (selectedProject.createdAt) {
      items.push({ label: 'Client created', at: selectedProject.createdAt });
    }
    if (selectedProject.onboardingStartedAt) {
      items.push({ label: 'Onboarding started', at: selectedProject.onboardingStartedAt });
    }
    if (selectedProject.onboardingCompletedAt) {
      items.push({ label: 'Onboarding completed', at: selectedProject.onboardingCompletedAt });
    }
    const milestones = selectedProject.onboardingMilestones || {};
    Object.keys(milestones).forEach((key) => {
      const milestone = milestones[key];
      if (milestone?.completedAt || milestone?.notes) {
        items.push({
          label: `Milestone updated: ${key}`,
          value: milestone?.notes || undefined,
          at: milestone?.completedAt || selectedProject.updatedAt,
        });
      }
    });
    profileForms.forEach((bundle) => {
      items.push({
        label: 'Onboarding form generated',
        at: bundle.form.createdAt,
      });
      bundle.submissions.forEach((submission) => {
        items.push({
          label: `Form submitted by ${submission.clientName || 'client'}`,
          value: submission.clientEmail || undefined,
          at: submission.submittedAt,
        });
      });
    });
    return items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  }, [selectedProject, profileForms]);

  const updateProjectLocal = (projectId: string, patch: Record<string, any>) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
  };

  const persistPhaseUpdate = async (projectId: string, payload: any) => {
    try {
      setSavingProjectId(projectId);
      const updated = await projectService.updateOnboardingPhase(projectId, payload);
      updateProjectLocal(projectId, updated);
      if (typeof payload?.notes === 'string' && payload.notes.trim()) {
        setNotesByProject((prev) => ({ ...prev, [projectId]: '' }));
      }
    } catch (error) {
      console.error('Failed to update onboarding phase:', error);
      alert('Failed to update onboarding phase. Please try again.');
    } finally {
      setSavingProjectId(null);
    }
  };

  const getBlockTextById = (blocks: any[], blockId: string): string => {
    for (const block of blocks || []) {
      if (block?.id === blockId) {
        const text = block?.content || block?.text;
        return typeof text === 'string' && text.trim() ? text.trim() : blockId;
      }
      if (block?.layout?.blocks?.length) {
        const nested = getBlockTextById(block.layout.blocks, blockId);
        if (nested) return nested;
      }
    }
    return blockId;
  };

  const openProjectProfile = async (project: any) => {
    setSelectedProject(project);
    setProfileTab('profile');
    setProfileForms([]);
    setProfileError(null);
    setProfileLoading(true);
    const initialCredentialNote = project?.onboardingMilestones?.[CREDENTIAL_MILESTONE_KEY]?.notes?.trim() || '';
    setCredentialsDraft('');
    setSavedCredentialNotes(
      initialCredentialNote
        ? [{ text: initialCredentialNote, savedAt: project?.updatedAt || new Date().toISOString() }]
        : [],
    );

    try {
      const updates = await clientUpdatesService.getAllByProject(project.id);
      const formsWithUpdate = updates.flatMap((update) =>
        (update.forms || []).map((form) => ({ update, form })),
      );
      const uniqueByFormId = Array.from(
        new Map(formsWithUpdate.map((item) => [item.form.id, item])).values(),
      );
      const bundles = await Promise.all(
        uniqueByFormId.map(async ({ update, form }) => {
          try {
            const submissions = await clientUpdatesService.getFormSubmissions(form.id);
            return { update, form, submissions };
          } catch {
            return { update, form, submissions: [] };
          }
        }),
      );
      bundles.sort(
        (a, b) =>
          new Date(b.form.updatedAt || b.form.createdAt).getTime() -
          new Date(a.form.updatedAt || a.form.createdAt).getTime(),
      );
      setProfileForms(bundles);
    } catch (error) {
      console.error('Failed loading project profile data:', error);
      setProfileError('Could not load client profile details.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProjectProfile = () => {
    setSelectedProject(null);
    setProfileTab('profile');
    setProfileForms([]);
    setProfileError(null);
    setCredentialsDraft('');
    setSavedCredentialNotes([]);
  };

  const saveCredentialNotes = async () => {
    if (!selectedProject) return;
    const noteToSave = credentialsDraft.trim();
    if (!noteToSave) {
      alert('Please add credentials notes first.');
      return;
    }
    try {
      setSavingCredentials(true);
      const updated = await projectService.updateOnboardingPhase(selectedProject.id, {
        milestoneKey: CREDENTIAL_MILESTONE_KEY,
        notes: noteToSave,
      });
      updateProjectLocal(selectedProject.id, updated);
      setSelectedProject(updated);
      setCredentialsDraft('');
      setSavedCredentialNotes((prev) => [{ text: noteToSave, savedAt: new Date().toISOString() }, ...prev]);
      alert('Credentials notes saved.');
    } catch (error) {
      console.error('Failed saving credentials notes:', error);
      alert('Failed to save credentials notes. Please try again.');
    } finally {
      setSavingCredentials(false);
    }
  };

  const getUserNameById = (id?: string) => {
    if (!id) return 'Unassigned';
    const found = users.find((u) => u.id === id);
    return found?.name || 'Unassigned';
  };

  const generateClientFacingOnboardingForm = async (projectId: string) => {
    try {
      setGeneratingFormFor(projectId);
      const update = await clientUpdatesService.create(projectId, 'Rapid Prospect self-onboarding form generated');
      const blocks = getRapidProspectOnboardingTemplateBlocks();
      const form = await clientUpdatesService.createForm(update.id, blocks);
      const published = await clientUpdatesService.publishForm(form.id);
      const publicUrl = `${window.location.origin}/rapid-prospect-onboarding?token=${encodeURIComponent(published.publicToken)}`;
      setOnboardingFormLinks((prev) => ({ ...prev, [projectId]: publicUrl }));
      const copied = await copyToClipboardSafely(publicUrl);
      alert(copied ? 'Client onboarding form created and link copied.' : 'Client onboarding form created. Use "Open Client Form" to copy/share the URL.');
    } catch (error) {
      console.error('Failed to generate onboarding form:', error);
      alert('Failed to generate onboarding form. Please try again.');
    } finally {
      setGeneratingFormFor(null);
    }
  };

  const pmUsers = users.filter((u) => u.role === 'Project Manager');
  const canReassignPm = user?.role === 'FOUNDER/CEO' || user?.isHeadPM;

  const handleCreateRapidProspectClient = async () => {
    const clientName = newClientForm.clientName.trim();
    if (!clientName) {
      alert('Client name is required.');
      return;
    }
    if (!newClientForm.pmId) {
      alert('Please select a Project Manager.');
      return;
    }

    try {
      setCreatingClient(true);
      const created = await projectService.create({
        clientName,
        clientType: RAPID_PROSPECT_CLIENT_TYPE,
        package: RAPID_PROSPECT_DEFAULT_PACKAGE,
        priority: RAPID_PROSPECT_DEFAULT_PRIORITY,
        targetCloseMonth: newClientForm.targetCloseMonth,
        notes: newClientForm.notes,
        pmId: newClientForm.pmId,
      });

      if (newClientForm.autoGenerateForm) {
        const update = await clientUpdatesService.create(created.id, 'Rapid Prospect self-onboarding form generated');
        const blocks = getRapidProspectOnboardingTemplateBlocks();
        const form = await clientUpdatesService.createForm(update.id, blocks);
        const published = await clientUpdatesService.publishForm(form.id);
        const publicUrl = `${window.location.origin}/rapid-prospect-onboarding?token=${encodeURIComponent(published.publicToken)}`;
        setOnboardingFormLinks((prev) => ({ ...prev, [created.id]: publicUrl }));
        const copied = await copyToClipboardSafely(publicUrl);
        alert(copied ? 'New Rapid Prospect client created and onboarding link copied.' : 'New Rapid Prospect client created. Use "Open Client Form" on the client card to share link.');
      } else {
        alert('New Rapid Prospect client created.');
      }

      setNewClientForm((prev) => ({
        ...prev,
        clientName: '',
        notes: '',
      }));
      await loadData();
    } catch (error: any) {
      console.error('Failed to create Rapid Prospect client:', error);
      alert(error?.response?.data?.message || 'Failed to create Rapid Prospect client.');
    } finally {
      setCreatingClient(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', color: '#64748b' }}>
        <FaSpinner style={{ animation: 'spin 1s linear infinite', marginRight: '0.6rem' }} />
        Loading Rapid Prospect workspace...
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '0.6rem 0.7rem',
    fontSize: '0.88rem',
    color: '#0f172a',
    background: '#fff',
  };

  const subtleButton: React.CSSProperties = {
    border: '1px solid #cbd5e1',
    background: 'white',
    borderRadius: 10,
    padding: '0.5rem 0.8rem',
    cursor: 'pointer',
    fontWeight: 600,
    color: '#0f172a',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      <aside
        style={{
          width: 290,
          background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
          color: 'white',
          padding: '1.1rem 0.85rem',
          borderRight: '1px solid rgba(148,163,184,0.2)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '0.6rem 0.6rem 0.9rem 0.6rem', borderBottom: '1px solid rgba(148,163,184,0.22)', marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Rapid Prospect</div>
          <div style={{ marginTop: '0.3rem', color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>
            Onboarding control center
          </div>
          <button
            onClick={loadData}
            style={{
              marginTop: '0.7rem',
              width: '100%',
              border: '1px solid rgba(148,163,184,0.45)',
              background: 'rgba(148,163,184,0.12)',
              borderRadius: 10,
              color: '#e2e8f0',
              fontWeight: 600,
              padding: '0.5rem 0.65rem',
              cursor: 'pointer',
            }}
          >
            <FaSyncAlt style={{ marginRight: 6 }} />
            Refresh Board
          </button>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <MetricCard title="Rapid Prospects" value={metrics.total} icon={<FaLayerGroup />} tone="#38bdf8" dark />
          <MetricCard title="In Progress" value={metrics.inProgress} icon={<FaSpinner />} tone="#60a5fa" dark />
          <MetricCard title="Blocked" value={metrics.blocked} icon={<FaFlagCheckered />} tone="#f87171" dark />
          <MetricCard title="Ready for Go-Live" value={metrics.readyForGoLive} icon={<FaCheckCircle />} tone="#34d399" dark />
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, margin: '0.3rem 0 0.5rem 0.2rem', letterSpacing: '0.04em' }}>
          PHASE COLUMNS
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {PHASES.map((phase) => (
            <button
              key={phase}
              onClick={() => phaseColumnRefs.current[phase]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })}
              style={{
                textAlign: 'left',
                border: '1px solid rgba(148,163,184,0.32)',
                background: 'rgba(148,163,184,0.08)',
                color: '#e2e8f0',
                borderRadius: 10,
                padding: '0.45rem 0.55rem',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.76rem',
              }}
              title={phase}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase}</span>
              <span style={{ background: 'rgba(56,189,248,0.2)', color: '#7dd3fc', borderRadius: 999, padding: '0.05rem 0.4rem', fontWeight: 700 }}>
                {phaseCounts[phase] || 0}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, padding: '1.1rem 1.2rem 1.3rem 1.2rem', overflow: 'hidden' }}>
        <div
          style={{
            ...panelStyle,
            marginBottom: '0.9rem',
            padding: '1.05rem 1.2rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f766e 100%)',
            borderColor: 'transparent',
            color: 'white',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>Rapid Prospect Pipeline</h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'rgba(255,255,255,0.82)', fontSize: '0.86rem' }}>
            Each column represents the current onboarding phase for each client.
          </p>
        </div>

        <div style={{ ...panelStyle, marginBottom: '0.9rem', padding: '0.9rem 0.95rem 1rem 0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem', fontWeight: 800, color: '#0f172a' }}>
            <FaPlus style={{ color: '#0369a1' }} />
            Create New Rapid Prospect Client
          </div>
          <div style={{ marginBottom: '0.42rem', fontSize: '0.83rem', color: '#0f766e' }}>
            Client Type: <strong>{RAPID_PROSPECT_CLIENT_TYPE}</strong> (auto)
          </div>
          <div style={{ marginBottom: '0.65rem', fontSize: '0.82rem', color: '#64748b' }}>
            Package: <strong>{RAPID_PROSPECT_DEFAULT_PACKAGE}</strong> (auto) | Priority: <strong>{RAPID_PROSPECT_DEFAULT_PRIORITY}</strong> (auto)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.55rem', marginBottom: '0.55rem' }}>
            <input
              value={newClientForm.clientName}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, clientName: e.target.value }))}
              placeholder="Client name"
              style={inputStyle}
            />
            <input
              type="month"
              value={newClientForm.targetCloseMonth}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, targetCloseMonth: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.55rem', alignItems: 'center' }}>
            <input
              value={newClientForm.notes}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes (optional)"
              style={inputStyle}
            />
            <select
              value={newClientForm.pmId}
              onChange={(e) => setNewClientForm((prev) => ({ ...prev, pmId: e.target.value }))}
              disabled={!canReassignPm}
              style={inputStyle}
            >
              <option value="">Assign PM</option>
              {pmUsers.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: '0.83rem' }}>
              <input
                type="checkbox"
                checked={newClientForm.autoGenerateForm}
                onChange={(e) => setNewClientForm((prev) => ({ ...prev, autoGenerateForm: e.target.checked }))}
              />
              Auto-generate form
            </label>
          </div>
          <div style={{ marginTop: '0.7rem' }}>
            <button
              onClick={handleCreateRapidProspectClient}
              disabled={creatingClient}
              style={{
                border: 'none',
                background: creatingClient ? '#94a3b8' : '#0284c7',
                color: 'white',
                borderRadius: 10,
                padding: '0.53rem 0.82rem',
                cursor: creatingClient ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.83rem',
                boxShadow: creatingClient ? 'none' : '0 6px 16px rgba(2, 132, 199, 0.3)',
              }}
            >
              {creatingClient ? 'Creating...' : 'Create Rapid Prospect Client'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 12, padding: '0.72rem 0.88rem', fontSize: '0.84rem' }}>
          Drag your attention through phases left-to-right. Each card shows who owns it, status, and actions for form + phase updates.
        </div>

        {projects.length === 0 ? (
          <div style={{ ...panelStyle, padding: '1.2rem', color: '#475569' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>No Rapid Prospect clients yet</div>
            <div style={{ marginBottom: '0.4rem', fontSize: '0.87rem' }}>
              Create a client from the panel above, then they will appear in phase columns.
            </div>
            <button
              onClick={() => navigate('/pm-dashboard')}
              style={{ ...subtleButton, marginTop: '0.75rem' }}
            >
              Go to PM Dashboard
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '0.8rem',
              alignItems: 'start',
            }}
          >
            {PHASES.map((phase) => {
              const phaseProjects = projectsByPhase[phase] || [];
              return (
                <div
                  key={phase}
                  ref={(el) => {
                    phaseColumnRefs.current[phase] = el;
                  }}
                  style={{
                    minHeight: 390,
                    maxHeight: 'calc(100vh - 320px)',
                    background: '#e2e8f0',
                    border: '1px solid #cbd5e1',
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '0.7rem 0.75rem', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem' }}>{phase}</div>
                    <div style={{ marginTop: '0.2rem', color: '#64748b', fontSize: '0.77rem' }}>
                      {phaseProjects.length} client{phaseProjects.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem', display: 'grid', gap: '0.6rem', overflowY: 'auto' }}>
                    {phaseProjects.length === 0 ? (
                      <div style={{ border: '1px dashed #94a3b8', borderRadius: 10, background: '#f8fafc', color: '#64748b', fontSize: '0.79rem', padding: '0.7rem' }}>
                        No clients in this phase.
                      </div>
                    ) : (
                      phaseProjects.map((project) => {
                        const saving = savingProjectId === project.id;
                        return (
                          <div
                            key={project.id}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('button, a, input, select, textarea, label, option')) {
                                return;
                              }
                              openProjectProfile(project);
                            }}
                            style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 12, padding: '0.7rem', cursor: 'pointer' }}
                            title="Open client profile"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{project.clientName}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                  <FaUserTie style={{ marginRight: 4 }} />
                                  {project.pm?.name || 'Unassigned'} | {project.stage}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.7rem', background: '#eef2ff', color: '#3730a3', padding: '0.2rem 0.45rem', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {project.onboardingPhaseStatus || 'In Progress'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginTop: '0.55rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => generateClientFacingOnboardingForm(project.id)}
                                disabled={generatingFormFor === project.id}
                                style={{
                                  border: 'none',
                                  background: generatingFormFor === project.id ? '#94a3b8' : '#0284c7',
                                  color: 'white',
                                  borderRadius: 9,
                                  padding: '0.4rem 0.55rem',
                                  cursor: generatingFormFor === project.id ? 'not-allowed' : 'pointer',
                                  fontWeight: 600,
                                  fontSize: '0.74rem',
                                }}
                              >
                                {generatingFormFor === project.id ? 'Generating...' : 'Generate Form'}
                              </button>
                              {onboardingFormLinks[project.id] && (
                                <a
                                  href={onboardingFormLinks[project.id]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#0369a1', fontSize: '0.74rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                                >
                                  <FaExternalLinkAlt style={{ fontSize: '0.68rem' }} />
                                  Open Form
                                </a>
                              )}
                            </div>

                            <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.55rem' }}>
                              <select
                                value={project.onboardingPhase || 'Welcome + Call Booking'}
                                onChange={(e) => persistPhaseUpdate(project.id, { phase: e.target.value, status: project.onboardingPhaseStatus || 'In Progress' })}
                                disabled={saving}
                                style={{ ...inputStyle, fontSize: '0.79rem', padding: '0.48rem 0.55rem' }}
                              >
                                {PHASES.map((phaseOption) => (
                                  <option key={phaseOption} value={phaseOption}>
                                    {phaseOption}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={project.onboardingPhaseStatus || 'In Progress'}
                                onChange={(e) => persistPhaseUpdate(project.id, { status: e.target.value, notes: notesByProject[project.id] || '' })}
                                disabled={saving}
                                style={{ ...inputStyle, fontSize: '0.79rem', padding: '0.48rem 0.55rem' }}
                              >
                                {STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.5rem' }}>
                              <button
                                onClick={() =>
                                  persistPhaseUpdate(project.id, {
                                    markCurrentMilestoneComplete: true,
                                    status: 'Completed',
                                    notes: notesByProject[project.id] || '',
                                  })
                                }
                                disabled={saving}
                                style={{ ...subtleButton, padding: '0.45rem 0.45rem', fontSize: '0.74rem', borderRadius: 9 }}
                              >
                                <FaCheckCircle style={{ marginRight: 4 }} />
                                Complete
                              </button>
                              <button
                                onClick={() =>
                                  persistPhaseUpdate(project.id, {
                                    advanceToNextPhase: true,
                                    status: 'In Progress',
                                    notes: notesByProject[project.id] || '',
                                  })
                                }
                                disabled={saving}
                                style={{ ...subtleButton, padding: '0.45rem 0.45rem', fontSize: '0.74rem', borderRadius: 9 }}
                              >
                                Advance
                              </button>
                            </div>

                            <textarea
                              placeholder="Phase note..."
                              value={notesByProject[project.id] || ''}
                              onChange={(e) => setNotesByProject((prev) => ({ ...prev, [project.id]: e.target.value }))}
                              rows={2}
                              style={{ ...inputStyle, width: '100%', marginTop: '0.52rem', resize: 'vertical', minHeight: 54, fontSize: '0.78rem', padding: '0.45rem 0.55rem' }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {selectedProject && (
        <>
          <div
            onClick={closeProjectProfile}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              zIndex: 1090,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 540,
              maxWidth: '100%',
              background: '#ffffff',
              borderLeft: '1px solid #dbe4ef',
              boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.2)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1rem 1rem 0.85rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{selectedProject.clientName}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                    <FaUserTie style={{ marginRight: 5 }} />
                    PM: {selectedProject.pm?.name || 'Unassigned'} | Phase: {selectedProject.onboardingPhase || 'Welcome + Call Booking'}
                  </div>
                </div>
                <button onClick={closeProjectProfile} style={{ border: '1px solid #cbd5e1', background: 'white', borderRadius: 8, cursor: 'pointer', width: 32, height: 32 }}>
                  <FaTimes />
                </button>
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #e2e8f0', padding: '0.6rem 1rem', display: 'flex', gap: '0.45rem', background: '#f8fafc' }}>
              {[
                { id: 'profile', label: 'Profile' },
                { id: 'credentials', label: 'Credentials' },
                { id: 'responses', label: 'Form Responses' },
                { id: 'activity', label: 'Activity Log' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProfileTab(tab.id as 'profile' | 'credentials' | 'responses' | 'activity')}
                  style={{
                    border: profileTab === tab.id ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: profileTab === tab.id ? '#e0f2fe' : 'white',
                    color: profileTab === tab.id ? '#0c4a6e' : '#334155',
                    borderRadius: 9,
                    padding: '0.4rem 0.55rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.95rem 1rem 1.1rem 1rem' }}>
              {profileTab === 'profile' && (
                <div style={{ border: '1px solid #dbe4ef', borderRadius: 12, padding: '0.8rem', background: 'white' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem' }}>Client Profile</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <ProfileField label="Client" value={selectedProject.clientName || '-'} />
                    <ProfileField label="Client Type" value={selectedProject.clientType || RAPID_PROSPECT_CLIENT_TYPE} />
                    <ProfileField label="Package" value={selectedProject.package || RAPID_PROSPECT_DEFAULT_PACKAGE} />
                    <ProfileField label="Priority" value={selectedProject.priority || RAPID_PROSPECT_DEFAULT_PRIORITY} />
                    <ProfileField label="Stage" value={selectedProject.stage || '-'} />
                    <ProfileField label="Phase" value={selectedProject.onboardingPhase || '-'} />
                    <ProfileField label="Phase Status" value={selectedProject.onboardingPhaseStatus || '-'} />
                    <ProfileField label="Target Month" value={selectedProject.targetCloseMonth || '-'} />
                    <ProfileField label="PM" value={selectedProject.pm?.name || getUserNameById(selectedProject.pmId)} />
                    <ProfileField label="Onboarding Manager" value={getUserNameById(selectedProject.onboardingManagerId)} />
                    <ProfileField label="Automation Specialist" value={getUserNameById(selectedProject.automationSpecialistId)} />
                    <ProfileField label="QA Specialist" value={getUserNameById(selectedProject.qaSpecialistId)} />
                  </div>
                  <div style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: '#64748b' }}>
                    Created: {selectedProject.createdAt ? new Date(selectedProject.createdAt).toLocaleString() : '-'}
                  </div>
                </div>
              )}

              {profileTab === 'credentials' && (
                <div style={{ border: '1px solid #dbe4ef', borderRadius: 12, padding: '0.8rem', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    <FaLock style={{ color: '#0369a1' }} />
                    Credentials / Access Notes
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Store platform logins, handoff notes, and access details for the credential collection phase.
                  </div>
                  <textarea
                    value={credentialsDraft}
                    onChange={(e) => setCredentialsDraft(e.target.value)}
                    placeholder="Example: CRM login, social account owner, domain host, 2FA steps..."
                    rows={8}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '0.6rem 0.65rem', fontSize: '0.83rem', resize: 'vertical' }}
                  />
                  <div style={{ marginTop: '0.55rem' }}>
                    <button
                      onClick={saveCredentialNotes}
                      disabled={savingCredentials}
                      style={{
                        border: 'none',
                        background: savingCredentials ? '#94a3b8' : '#0284c7',
                        color: 'white',
                        borderRadius: 9,
                        padding: '0.5rem 0.75rem',
                        cursor: savingCredentials ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      {savingCredentials ? 'Saving...' : 'Save Credentials Notes'}
                    </button>
                  </div>
                  {savedCredentialNotes.length > 0 && (
                    <div style={{ marginTop: '0.7rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                        Saved Credentials Notes
                      </div>
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {savedCredentialNotes.map((item, idx) => (
                          <div key={`${item.savedAt}-${idx}`} style={{ border: '1px solid #dbe4ef', borderRadius: 9, padding: '0.45rem 0.55rem', background: 'white' }}>
                            <div style={{ color: '#0f172a', fontSize: '0.79rem', whiteSpace: 'pre-wrap' }}>{item.text}</div>
                            <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                              {new Date(item.savedAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'responses' && (
                <div style={{ border: '1px solid #dbe4ef', borderRadius: 12, padding: '0.8rem', background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>Onboarding Form Responses</div>
                    <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {totalProfileResponses} total response(s)
                    </span>
                  </div>

                  {profileLoading ? (
                    <div style={{ color: '#64748b', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                      Loading profile...
                    </div>
                  ) : profileError ? (
                    <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{profileError}</div>
                  ) : profileForms.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No onboarding forms found for this client yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.7rem' }}>
                      {profileForms.map((bundle) => {
                        const formUrl = `${window.location.origin}/rapid-prospect-onboarding?token=${encodeURIComponent(bundle.form.publicToken)}`;
                        return (
                          <div key={bundle.form.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.65rem 0.7rem', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.82rem' }}>
                                  Form from update {new Date(bundle.update.createdAt).toLocaleDateString()}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                                  {bundle.submissions.length} response(s)
                                </div>
                              </div>
                              <a href={formUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontSize: '0.76rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                <FaExternalLinkAlt style={{ marginRight: 4, fontSize: '0.68rem' }} />
                                Open Form
                              </a>
                            </div>

                            {bundle.submissions.length > 0 && (
                              <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.5rem' }}>
                                {bundle.submissions.map((submission) => (
                                  <div key={submission.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem 0.55rem' }}>
                                    <div style={{ fontSize: '0.73rem', color: '#64748b', marginBottom: '0.35rem' }}>
                                      {submission.clientName || 'Unknown'} {submission.clientEmail ? `(${submission.clientEmail})` : ''} - {new Date(submission.submittedAt).toLocaleString()}
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.35rem' }}>
                                      {submission.responses.map((response: SubmissionResponse, idx: number) => (
                                        <div key={`${submission.id}-${response.blockId}-${idx}`} style={{ fontSize: '0.76rem', color: '#0f172a' }}>
                                          <strong>{getBlockTextById(bundle.form.blocks, response.blockId)}:</strong>{' '}
                                          {response.text?.trim() ? (
                                            <span>{response.text}</span>
                                          ) : response.imageUrls?.length ? (
                                            <span>{response.imageUrls.length} image(s) uploaded</span>
                                          ) : (
                                            <span style={{ color: '#94a3b8' }}>No answer</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'activity' && (
                <div style={{ border: '1px solid #dbe4ef', borderRadius: 12, padding: '0.8rem', background: 'white' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>Activity Log</div>
                  {profileActivity.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No activity entries yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {profileActivity.map((entry, idx) => (
                        <div key={`${entry.label}-${idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 9, padding: '0.5rem 0.55rem', background: '#f8fafc' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.79rem' }}>{entry.label}</div>
                          {entry.value && <div style={{ color: '#334155', fontSize: '0.76rem', marginTop: '0.2rem' }}>{entry.value}</div>}
                          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                            {entry.at ? new Date(entry.at).toLocaleString() : 'No timestamp'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: number; icon: React.ReactNode; tone: string; dark?: boolean }> = ({ title, value, icon, tone, dark = false }) => (
  <div style={{ background: dark ? 'rgba(148,163,184,0.08)' : 'white', border: dark ? '1px solid rgba(148,163,184,0.26)' : '1px solid #e2e8f0', borderRadius: 12, padding: '0.65rem 0.75rem', boxShadow: dark ? 'none' : '0 6px 16px rgba(15, 23, 42, 0.05)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ color: dark ? '#cbd5e1' : '#64748b', fontSize: '0.76rem', fontWeight: 600 }}>{title}</div>
      <div style={{ color: tone, fontSize: '0.92rem' }}>{icon}</div>
    </div>
    <div style={{ color: dark ? 'white' : '#0f172a', fontSize: '1.25rem', fontWeight: 800, marginTop: '0.16rem' }}>{value}</div>
  </div>
);

const ProfileField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 9, padding: '0.45rem 0.5rem', background: '#f8fafc' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '0.8rem', color: '#0f172a', marginTop: '0.15rem', fontWeight: 600 }}>{value || '-'}</div>
  </div>
);

export default RapidProspectDashboard;
