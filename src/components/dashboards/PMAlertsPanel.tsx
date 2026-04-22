import React from 'react';
import { FaCalendarAlt, FaExclamationTriangle, FaBell, FaClock } from 'react-icons/fa';
import { MonthlyReminder } from '../../services/monthlyReminders.service';

export type PMTaskDueAlert = {
  taskId: string;
  projectId: string;
  taskTitle: string;
  projectName: string;
  daysLeft: number;
  dueDate: Date;
};

export type PMMonthlyReminderForm = {
  projectId: string;
  manualClientName: string;
  reminderDay: number;
  note: string;
};

type PMAlertsPanelProps = {
  taskDueAlerts: PMTaskDueAlert[];
  canManageMonthlyReminders: boolean;
  alertsTab: 'due' | 'monthly';
  setAlertsTab: (tab: 'due' | 'monthly') => void;
  showAllTaskDueAlerts: boolean;
  setShowAllTaskDueAlerts: (value: boolean) => void;
  monthlyReminders: MonthlyReminder[];
  monthlyReminderForm: PMMonthlyReminderForm;
  setMonthlyReminderForm: React.Dispatch<React.SetStateAction<PMMonthlyReminderForm>>;
  projectOptionsForMonthlyReminders: any[];
  savingMonthlyReminder: boolean;
  editingMonthlyReminderId: string | null;
  resetMonthlyReminderForm: () => void;
  handleSaveMonthlyReminder: () => void;
  loadingMonthlyReminders: boolean;
  handleEditMonthlyReminder: (item: MonthlyReminder) => void;
  handleDeleteMonthlyReminder: (id: string) => void;
  openTask: (projectId: string, taskId: string) => void;
  openProject: (projectId: string) => void;
  onCreateProjectClick: () => void;
};

// ---------- Severity helpers ----------
const getSeverity = (daysLeft: number) => {
  if (daysLeft <= 2) {
    return {
      label: 'CRITICAL',
      accent: '#dc2626',
      accentSoft: '#fef2f2',
      accentBorder: '#fecaca',
      text: '#7f1d1d',
    };
  }
  return {
    label: 'HIGH',
    accent: '#ea580c',
    accentSoft: '#fff7ed',
    accentBorder: '#fed7aa',
    text: '#9a3412',
  };
};

const PMAlertsPanel: React.FC<PMAlertsPanelProps> = ({
  taskDueAlerts,
  canManageMonthlyReminders,
  alertsTab,
  setAlertsTab,
  showAllTaskDueAlerts,
  setShowAllTaskDueAlerts,
  monthlyReminders,
  monthlyReminderForm,
  setMonthlyReminderForm,
  projectOptionsForMonthlyReminders,
  savingMonthlyReminder,
  editingMonthlyReminderId,
  resetMonthlyReminderForm,
  handleSaveMonthlyReminder,
  loadingMonthlyReminders,
  handleEditMonthlyReminder,
  handleDeleteMonthlyReminder,
  openTask,
  openProject,
  onCreateProjectClick,
}) => {
  if (taskDueAlerts.length === 0 && !canManageMonthlyReminders) {
    return null;
  }

  const criticalCount = taskDueAlerts.filter((t) => t.daysLeft <= 2).length;
  const highCount = taskDueAlerts.filter((t) => t.daysLeft > 2).length;

  return (
    <div
      style={{
        margin: '0 2rem 1rem',
        borderRadius: '16px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow:
          '0 1px 3px rgba(15, 23, 42, 0.04), 0 10px 30px -12px rgba(220, 38, 38, 0.22)',
        overflow: 'hidden',
        position: 'relative',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      {/* Keyframes: subtle but present — a breathing indicator, not a panel-wide alarm */}
      <style>{`
        @keyframes alertDotPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
        }
        @keyframes sheen {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .pm-alert-accent-bar {
          background: linear-gradient(
            90deg,
            #dc2626 0%,
            #dc2626 40%,
            #f97316 60%,
            #f97316 100%
          );
          background-size: 200% 100%;
          animation: sheen 6s linear infinite;
        }
        .pm-alert-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.25) !important;
        }
        .pm-ghost-btn:hover {
          background: #f1f5f9 !important;
        }
      `}</style>

      {/* Top accent bar */}
      <div
        className="pm-alert-accent-bar"
        style={{
          height: '3px',
          width: '100%',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1rem 1.25rem 0.85rem',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background:
                criticalCount > 0
                  ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                  : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: criticalCount > 0 ? '1px solid #fecaca' : '1px solid #fed7aa',
            }}
          >
            <FaExclamationTriangle
              style={{
                color: criticalCount > 0 ? '#dc2626' : '#ea580c',
                fontSize: '1rem',
              }}
            />
            {criticalCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#dc2626',
                  animation: 'alertDotPulse 1.6s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              Alerts & Reminders
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: '#64748b',
                marginTop: '2px',
                fontWeight: 500,
              }}
            >
              {taskDueAlerts.length > 0
                ? `${taskDueAlerts.length} task${
                    taskDueAlerts.length === 1 ? '' : 's'
                  } approaching deadline`
                : 'No urgent deadlines'}
            </div>
          </div>
        </div>

        {/* Severity summary chips */}
        {taskDueAlerts.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {criticalCount > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                }}
              >
                <FaClock style={{ fontSize: '0.65rem' }} />
                {criticalCount} Critical
              </div>
            )}
            {highCount > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#fff7ed',
                  color: '#9a3412',
                  border: '1px solid #fed7aa',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                }}
              >
                {highCount} High
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          padding: '0 1.25rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#fafbfc',
        }}
      >
        <button
          type="button"
          onClick={() => setAlertsTab('due')}
          style={{
            border: 'none',
            background: 'transparent',
            color: alertsTab === 'due' ? '#0f172a' : '#64748b',
            padding: '0.7rem 0.1rem',
            marginRight: '1.4rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            borderBottom:
              alertsTab === 'due' ? '2px solid #dc2626' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'color 0.15s ease',
          }}
        >
          <FaBell style={{ fontSize: '0.78rem' }} />
          Due Alerts
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              background: alertsTab === 'due' ? '#dc2626' : '#e2e8f0',
              color: alertsTab === 'due' ? '#fff' : '#475569',
              borderRadius: '999px',
              padding: '0.1rem 0.45rem',
              minWidth: '18px',
              textAlign: 'center',
            }}
          >
            {taskDueAlerts.length}
          </span>
        </button>

        {canManageMonthlyReminders && (
          <button
            type="button"
            onClick={() => setAlertsTab('monthly')}
            style={{
              border: 'none',
              background: 'transparent',
              color: alertsTab === 'monthly' ? '#0f172a' : '#64748b',
              padding: '0.7rem 0.1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderBottom:
                alertsTab === 'monthly' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s ease',
            }}
          >
            <FaCalendarAlt style={{ fontSize: '0.78rem' }} />
            Monthly Reminders
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: alertsTab === 'monthly' ? '#2563eb' : '#e2e8f0',
                color: alertsTab === 'monthly' ? '#fff' : '#475569',
                borderRadius: '999px',
                padding: '0.1rem 0.45rem',
                minWidth: '18px',
                textAlign: 'center',
              }}
            >
              {monthlyReminders.length}
            </span>
          </button>
        )}
      </div>

      {/* ================= DUE TAB ================= */}
      {alertsTab === 'due' && (
        <div style={{ padding: '0.9rem 1.25rem 1.1rem' }}>
          {taskDueAlerts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem 1rem',
                color: '#64748b',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              No tasks approaching deadline. You're all caught up.
            </div>
          ) : (
            <>
              {/* Legend */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.7rem',
                  color: '#64748b',
                  marginBottom: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      background: '#dc2626',
                    }}
                  />
                  1–2 DAYS
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      background: '#ea580c',
                    }}
                  />
                  3–5 DAYS
                </span>
              </div>

              {/* Alert grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '0.55rem',
                }}
              >
                {(showAllTaskDueAlerts ? taskDueAlerts : taskDueAlerts.slice(0, 10)).map(
                  (item) => {
                    const sev = getSeverity(item.daysLeft);
                    return (
                      <button
                        key={item.taskId}
                        type="button"
                        className="pm-alert-item"
                        onClick={() => openTask(item.projectId, item.taskId)}
                        title={`Due ${item.dueDate.toLocaleDateString()}`}
                        style={{
                          border: `1px solid ${sev.accentBorder}`,
                          borderLeft: `3px solid ${sev.accent}`,
                          borderRadius: '8px',
                          background: '#ffffff',
                          padding: '0.6rem 0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          textAlign: 'left',
                          transition:
                            'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {/* Days-left block */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: sev.accentSoft,
                            border: `1px solid ${sev.accentBorder}`,
                            borderRadius: '6px',
                            padding: '0.3rem 0.5rem',
                            minWidth: '42px',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: 900,
                              color: sev.accent,
                              lineHeight: 1,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {item.daysLeft}
                          </span>
                          <span
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 700,
                              color: sev.text,
                              letterSpacing: '0.06em',
                              marginTop: '1px',
                            }}
                          >
                            {item.daysLeft === 1 ? 'DAY' : 'DAYS'}
                          </span>
                        </div>

                        {/* Text block */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.25,
                            }}
                          >
                            {item.taskTitle}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                              fontWeight: 500,
                            }}
                          >
                            {item.projectName}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Show more / less */}
              {taskDueAlerts.length > 10 && (
                <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="pm-ghost-btn"
                    onClick={() => setShowAllTaskDueAlerts(!showAllTaskDueAlerts)}
                    style={{
                      fontSize: '0.76rem',
                      color: '#475569',
                      fontWeight: 700,
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {showAllTaskDueAlerts
                      ? 'Show less'
                      : `Show ${taskDueAlerts.length - 10} more`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================= MONTHLY TAB ================= */}
      {alertsTab === 'monthly' && canManageMonthlyReminders && (
        <div style={{ padding: '1rem 1.25rem 1.1rem' }}>
          {/* Form */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.9rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: '0.7rem',
              }}
            >
              {editingMonthlyReminderId ? 'Edit Reminder' : 'Add New Reminder'}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) 110px 2fr auto',
                gap: '0.6rem',
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: '0.3rem',
                    display: 'block',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Link Project
                </label>
                <select
                  value={monthlyReminderForm.projectId}
                  onChange={(e) =>
                    setMonthlyReminderForm((prev) => ({ ...prev, projectId: e.target.value }))
                  }
                  style={{
                    width: '100%',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.82rem',
                    background: '#fff',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Type client manually</option>
                  {projectOptionsForMonthlyReminders.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.clientName}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: '0.42rem' }}>
                  <button
                    type="button"
                    className="pm-ghost-btn"
                    onClick={onCreateProjectClick}
                    style={{
                      borderRadius: 6,
                      border: '1px dashed #93c5fd',
                      background: '#f8fbff',
                      color: '#1d4ed8',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.36rem 0.62rem',
                      cursor: 'pointer',
                    }}
                  >
                    + Create new project
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: '0.3rem',
                    display: 'block',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Day
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthlyReminderForm.reminderDay}
                  onChange={(e) =>
                    setMonthlyReminderForm((prev) => ({
                      ...prev,
                      reminderDay: Number(e.target.value || 1),
                    }))
                  }
                  style={{
                    width: '100%',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.82rem',
                    background: '#fff',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: '0.3rem',
                    display: 'block',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  {monthlyReminderForm.projectId ? 'Note' : 'Client & Note'}
                </label>
                {!monthlyReminderForm.projectId && (
                  <input
                    type="text"
                    placeholder="Client name"
                    value={monthlyReminderForm.manualClientName}
                    onChange={(e) =>
                      setMonthlyReminderForm((prev) => ({
                        ...prev,
                        manualClientName: e.target.value,
                      }))
                    }
                    style={{
                      width: '100%',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      padding: '0.5rem 0.6rem',
                      fontSize: '0.82rem',
                      background: '#fff',
                      color: '#0f172a',
                      marginBottom: '0.4rem',
                      fontFamily: 'inherit',
                    }}
                  />
                )}
                <textarea
                  placeholder="e.g. Monthly report — 10 articles + GA report"
                  value={monthlyReminderForm.note}
                  onChange={(e) =>
                    setMonthlyReminderForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                  rows={2}
                  style={{
                    width: '100%',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.82rem',
                    resize: 'vertical',
                    background: '#fff',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={handleSaveMonthlyReminder}
                  disabled={savingMonthlyReminder}
                  style={{
                    borderRadius: 7,
                    border: 'none',
                    background: savingMonthlyReminder ? '#93c5fd' : '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '0.55rem 0.9rem',
                    cursor: savingMonthlyReminder ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                >
                  {savingMonthlyReminder
                    ? 'Saving…'
                    : editingMonthlyReminderId
                    ? 'Update'
                    : 'Add'}
                </button>
                {editingMonthlyReminderId && (
                  <button
                    type="button"
                    onClick={resetMonthlyReminderForm}
                    style={{
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '0.55rem 0.8rem',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reminder list */}
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {loadingMonthlyReminders && (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#2563eb',
                  fontWeight: 600,
                  padding: '0.6rem',
                  textAlign: 'center',
                }}
              >
                Loading reminders…
              </div>
            )}

            {!loadingMonthlyReminders && monthlyReminders.length === 0 && (
              <div
                style={{
                  fontSize: '0.82rem',
                  color: '#64748b',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  padding: '1rem',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                No monthly reminders yet. Add one above to get started.
              </div>
            )}

            {!loadingMonthlyReminders &&
              monthlyReminders.map((item) => (
                <div
                  key={item.id}
                  className="pm-alert-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #e2e8f0',
                    borderLeft: '3px solid #2563eb',
                    background: '#fff',
                    borderRadius: '8px',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  {/* Day block */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '0.3rem 0.5rem',
                      minWidth: '42px',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        color: '#1d4ed8',
                        letterSpacing: '0.06em',
                      }}
                    >
                      DAY
                    </span>
                    <span
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        color: '#2563eb',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {item.reminderDay}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.25,
                      }}
                    >
                      {item.clientName}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}
                    >
                      {item.note}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    {item.projectId && (
                      <button
                        type="button"
                        onClick={() => openProject(item.projectId as string)}
                        style={{
                          borderRadius: 6,
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.38rem 0.6rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      className="pm-ghost-btn"
                      onClick={() => handleEditMonthlyReminder(item)}
                      style={{
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.38rem 0.6rem',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        fontFamily: 'inherit',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMonthlyReminder(item.id)}
                      style={{
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#b91c1c',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.38rem 0.6rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PMAlertsPanel;