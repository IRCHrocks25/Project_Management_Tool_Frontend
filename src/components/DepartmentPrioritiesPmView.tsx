import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaFlag, FaSignOutAlt } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { taskService } from '../services/task.service';
import {
  departmentProjectFocusService,
  DepartmentProjectFocusRow,
} from '../services/departmentProjectFocus.service';
import './Dashboard.css';

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DEPT_TABS: { key: string; label: string }[] = [
  { key: 'Copy', label: 'Copy' },
  { key: 'Design', label: 'Design' },
  { key: 'Dev', label: 'Development' },
  { key: 'AI', label: 'AI' },
  { key: 'Social Media', label: 'Social Media' },
  { key: 'CRM', label: 'CRM' },
  { key: 'SEO/GEO', label: 'SEO/GEO' },
  { key: 'Onboarding', label: 'Onboarding' },
  { key: 'General', label: 'General' },
];

const DepartmentPrioritiesPmView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const allowed = user?.role === 'Project Manager' || user?.isHeadPM;

  const [focusDate, setFocusDate] = useState(() => ymdLocal(new Date()));
  const [activeDept, setActiveDept] = useState(DEPT_TABS[0].key);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [rows, setRows] = useState<DepartmentProjectFocusRow[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingPins, setLoadingPins] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const data = await taskService.getAll(undefined, undefined, { all: true, taskType: activeDept });
      setAllTasks((data || []).filter((t: any) => !t.isArchived));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  }, [activeDept]);

  const loadPins = useCallback(async () => {
    if (!allowed) return;
    try {
      setLoadingPins(true);
      const data = await departmentProjectFocusService.getByDateAndDepartment(focusDate, activeDept);
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoadingPins(false);
    }
  }, [allowed, focusDate, activeDept]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const pmRows = useMemo(() => rows.filter((r) => r.source !== 'override'), [rows]);
  const overrideRows = useMemo(() => rows.filter((r) => r.source === 'override'), [rows]);

  const tasksForModal = useMemo(() => {
    return [...allTasks].sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''))
    );
  }, [allTasks]);

  const handleSavePmPins = async () => {
    const orderedIds = tasksForModal
      .filter((t: any) => selectedIds.includes(t.id))
      .map((t: any) => t.id);
    try {
      setSaving(true);
      const next = await departmentProjectFocusService.savePmPins(focusDate, activeDept, orderedIds);
      setRows(next);
      setShowModal(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save PM priorities.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    authService.logout();
    navigate('/login');
  };

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="dashboard-container premium-dashboard" style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <header className="dashboard-header premium-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div
          className="header-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '960px',
            margin: '0 auto',
            padding: '0 2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate('/pm-dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              <FaArrowLeft /> PM Dashboard
            </button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaFlag color="#6366f1" /> Department priorities
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{user?.name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '0.4rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              <FaSignOutAlt /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 2rem 3rem' }}>
        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.55 }}>
          Set the <strong>canonical</strong> client priorities each department sees on their dashboard for the selected day.
          Department <strong>team leads</strong> can add optional &quot;team add-ons&quot; on their own dashboard — those never replace your list here.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Date
            <input
              type="date"
              value={focusDate}
              onChange={(e) => setFocusDate(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          </label>
          <button
            type="button"
            onClick={() => loadPins()}
            disabled={loadingPins}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: 'white',
              cursor: loadingPins ? 'wait' : 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedIds(pmRows.map((r) => r.taskId).filter(Boolean) as string[]);
              setShowModal(true);
            }}
            disabled={loadingTasks}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: '#6366f1',
              color: 'white',
              fontWeight: 600,
              cursor: loadingTasks ? 'not-allowed' : 'pointer',
            }}
          >
            Edit PM priorities
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {DEPT_TABS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDept(d.key)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                border: activeDept === d.key ? '2px solid #6366f1' : '1px solid #e2e8f0',
                background: activeDept === d.key ? '#eef2ff' : 'white',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: activeDept === d.key ? 600 : 500,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {loadingPins ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>PM priorities ({activeDept})</h2>
              {pmRows.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>None for this date. Use Edit PM priorities.</p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', fontSize: '0.875rem' }}>
                  {pmRows.map((r) => (
                    <li key={r.id} style={{ marginBottom: '0.35rem' }}>
                      {r.taskTitle || 'Task'} <span style={{ color: '#94a3b8' }}>({r.clientName || 'Project'})</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>
                Team add-ons (set by team lead on dept dashboard)
              </h2>
              {overrideRows.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>None.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', fontSize: '0.875rem' }}>
                  {overrideRows.map((r) => (
                    <li key={r.id} style={{ marginBottom: '0.35rem' }}>
                      {r.taskTitle || 'Task'} <span style={{ color: '#94a3b8' }}>({r.clientName || 'Project'})</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem',
          }}
          onClick={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>PM priorities — {activeDept}</h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Date {focusDate}. Choose exact tasks for this department. Team add-ons are managed separately by each team lead.
              </p>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {tasksForModal.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>No tasks loaded for this department.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {tasksForModal.map((t: any) => (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.5rem 0.65rem',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                          )
                        }
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.title || 'Untitled task'}</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        ({t.project?.clientName || 'Project'})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowModal(false)}
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePmPins}
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: saving ? '#9ca3af' : '#6366f1',
                  color: 'white',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentPrioritiesPmView;
