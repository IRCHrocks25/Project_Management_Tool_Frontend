import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaArrowLeft, FaEnvelope, FaUser, FaCalendarAlt } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import '../components/Dashboard.css';

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All Roles');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await authService.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only allow Project Managers and Founder/CEO to access this page
    const currentUser = authService.getUser();
    const allowed = currentUser?.role === 'Project Manager' || currentUser?.role === 'FOUNDER/CEO';
    if (!currentUser || !allowed) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setIsAuthorized(true);
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render until we've checked authorization
  if (isAuthorized === null) {
    return null;
  }

  // If not authorized, return null (redirect will happen)
  if (!isAuthorized) {
    return null;
  }

  const getFilteredUsers = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.role?.toLowerCase().includes(term)
      );
    }

    // Apply role filter
    if (roleFilter !== 'All Roles') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    return filtered;
  };

  const getRoleColor = (role: string) => {
    const roleColors: { [key: string]: string } = {
      'Project Manager': '#667eea',
      'Designer': '#8b5cf6',
      'Copy Writing': '#3b82f6',
      'Developer': '#10b981',
      'AI Developer': '#f59e0b',
      'Social Media': '#ec4899',
      'CRM': '#06b6d4',
      'SEO/GEO': '#6366f1',
    };
    return roleColors[role] || '#6b7280';
  };

  const filteredUsers = getFilteredUsers();
  const uniqueRoles = Array.from(new Set(users.map((u) => u.role))).sort();

  if (loading) {
    return (
      <div className="dashboard premium">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-cards">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard premium">
      <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '1rem',
              padding: '0.5rem 0',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <FaArrowLeft /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
              }}
            >
              <FaUsers />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
                Registered Users
              </h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Manage and view all registered users in the system
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none',
                background: 'white',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#667eea')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            >
              <option>All Roles</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    User
                  </th>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Email
                  </th>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Joined
                  </th>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Team Lead
                  </th>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Head PM
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: '3rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '0.875rem',
                      }}
                    >
                      No users found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userItem, index) => (
                    <tr
                      key={userItem.id}
                      style={{
                        borderBottom: index < filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                    >
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '1rem',
                              flexShrink: 0,
                            }}
                          >
                            {userItem.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>
                              {userItem.name}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                marginTop: '0.125rem',
                              }}
                            >
                              <FaUser style={{ fontSize: '0.625rem' }} />
                              ID: {userItem.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#374151',
                            fontSize: '0.875rem',
                          }}
                        >
                          <FaEnvelope style={{ color: '#9ca3af', fontSize: '0.875rem' }} />
                          {userItem.email}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <button
                          disabled={updatingUserId === userItem.id}
                          onClick={async () => {
                            try {
                              setUpdatingUserId(userItem.id);
                              const newValue = !userItem.isTeamLead;
                              const updated = await authService.setTeamLead(
                                userItem.id,
                                newValue
                              );
                              setUsers((prev) =>
                                prev.map((u) =>
                                  u.id === updated.id ? { ...u, ...updated } : u
                                )
                              );
                            } catch (error) {
                              console.error('Failed to update team lead status:', error);
                              alert('Failed to update team lead status. Please try again.');
                            } finally {
                              setUpdatingUserId(null);
                            }
                          }}
                          style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: '999px',
                            border: '1px solid',
                            borderColor: userItem.isTeamLead ? '#10b981' : '#e5e7eb',
                            background: userItem.isTeamLead ? '#ecfdf3' : 'white',
                            color: userItem.isTeamLead ? '#047857' : '#6b7280',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: updatingUserId === userItem.id ? 'not-allowed' : 'pointer',
                            minWidth: '90px',
                          }}
                        >
                          {userItem.isTeamLead ? 'Team Lead' : 'Make Lead'}
                        </button>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {userItem.role === 'Project Manager' ? (
                          <button
                            disabled={updatingUserId === userItem.id}
                            onClick={async () => {
                              try {
                                setUpdatingUserId(userItem.id);
                                const newValue = !userItem.isHeadPM;
                                const updated = await authService.setHeadPM(
                                  userItem.id,
                                  newValue
                                );
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.id === updated.id ? { ...u, ...updated } : u
                                  )
                                );
                              } catch (error: any) {
                                console.error('Failed to update Head PM status:', error);
                                alert(
                                  error?.response?.data?.message ||
                                    'Failed to update Head PM status. Only Project Managers can be Head PM.'
                                );
                              } finally {
                                setUpdatingUserId(null);
                              }
                            }}
                            style={{
                              padding: '0.375rem 0.75rem',
                              borderRadius: '999px',
                              border: '1px solid',
                              borderColor: userItem.isHeadPM ? '#6366f1' : '#e5e7eb',
                              background: userItem.isHeadPM ? '#eef2ff' : 'white',
                              color: userItem.isHeadPM ? '#4338ca' : '#6b7280',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: updatingUserId === userItem.id ? 'not-allowed' : 'pointer',
                              minWidth: '90px',
                            }}
                          >
                            {userItem.isHeadPM ? 'Head PM' : 'Make Head PM'}
                          </button>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            padding: '0.375rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            background: `${getRoleColor(userItem.role)}20`,
                            color: getRoleColor(userItem.role),
                            display: 'inline-block',
                          }}
                        >
                          {userItem.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#6b7280',
                            fontSize: '0.875rem',
                          }}
                        >
                          <FaCalendarAlt style={{ color: '#9ca3af', fontSize: '0.875rem' }} />
                          {new Date(userItem.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;

