import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArchive, FaCheckCircle, FaSpinner, FaFolderOpen, FaUser, FaChevronDown, FaSignOutAlt, FaCog, FaHome, FaFolder } from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
import UserAvatar from './UserAvatar';
import './Dashboard.css';

const Clients: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [projectsWithDeliverables, setProjectsWithDeliverables] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'done' | 'archive'>('active');
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.avatar-dropdown-container')) {
        setShowAvatarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load active projects (excludes archived by default)
      const activeProjectsData = await projectService.getAll();
      setProjects(activeProjectsData);

      // Load archived projects (with includeArchived=true)
      const archivedProjectsData = await projectService.getAllArchived();
      setArchivedProjects(archivedProjectsData);

      // Load deliverables for all projects
      const deliverablesMap: Record<string, any[]> = {};
      const allProjects = [...activeProjectsData, ...archivedProjectsData];
      
      for (const project of allProjects) {
        try {
          const deliverables = await deliverableService.getAll(project.id);
          deliverablesMap[project.id] = deliverables;
        } catch (error) {
          console.error(`Failed to load deliverables for project ${project.id}:`, error);
          deliverablesMap[project.id] = [];
        }
      }
      
      setProjectsWithDeliverables(deliverablesMap);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const getActiveProjects = () => {
    return projects.filter((p: any) => 
      !p.isArchived && 
      p.stage !== 'Ready to Close' && 
      p.stage !== 'Closed'
    );
  };

  const getDoneProjects = () => {
    return projects.filter((p: any) => 
      !p.isArchived && 
      p.stage === 'Ready to Close'
    );
  };

  const getArchivedProjects = () => {
    return archivedProjects;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Onboarding': '#f59e0b',
      'Copy': '#3b82f6',
      'Copy Revision': '#3b82f6',
      'Design': '#8b5cf6',
      'Design Revision': '#8b5cf6',
      'Dev': '#10b981',
      'AI Team': '#06b6d4',
      'Social Media Team': '#ec4899',
      'CRM': '#f97316',
      'SEO/GEO Team': '#14b8a6',
      'Ready to Close': '#6366f1',
      'Closed': '#6b7280',
    };
    return colors[stage] || '#6b7280';
  };

  const getClientTypeColor = (clientType: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      'ICON': { bg: '#fef3c7', color: '#92400e' },
      'STAR': { bg: '#dbeafe', color: '#1e40af' },
      'Katalyst': { bg: '#f3e8ff', color: '#6b21a8' },
      'Private': { bg: '#e5e7eb', color: '#374151' },
      'Premium': { bg: '#ede9fe', color: '#6b21a8' },
      'Powered-Up': { bg: '#f3e8ff', color: '#7c3aed' },
    };
    return colors[clientType] || { bg: '#e5e7eb', color: '#374151' };
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCurrentProcess = (projectId: string): string => {
    const deliverables = projectsWithDeliverables[projectId] || [];
    if (deliverables.length === 0) return 'Not yet started';

    // Map deliverable statuses to process stages
    const statusMap: Record<string, string> = {
      'Not Started': 'Not yet started',
      'In Progress': 'Owned/In Progress',
      'Ready for Review': 'For Approval',
      'Revision': 'Elliot Review',
      'Approved': 'Approved/Completed',
      'Client Review': 'Client Validation',
    };

    // Find the most advanced status
    const statusPriority: Record<string, number> = {
      'Not Started': 0,
      'In Progress': 1,
      'Ready for Review': 2,
      'Revision': 3,
      'Client Review': 4,
      'Approved': 5,
    };

    let maxPriority = -1;
    let currentStatus = 'Not yet started';

    deliverables.forEach((deliverable: any) => {
      const priority = statusPriority[deliverable.status] || 0;
      if (priority > maxPriority) {
        maxPriority = priority;
        currentStatus = statusMap[deliverable.status] || deliverable.status;
      }
    });

    return currentStatus;
  };

  const getProcessColor = (process: string) => {
    const colors: Record<string, string> = {
      'Not yet started': '#94a3b8',
      'Owned/In Progress': '#3b82f6',
      'For Approval': '#8b5cf6',
      'Elliot Review': '#f59e0b',
      'Approved/Completed': '#10b981',
      'QA Before Sending to Client': '#06b6d4',
      'Client Validation': '#6366f1',
    };
    return colors[process] || '#6b7280';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <FaSpinner className="spinner" style={{ fontSize: '2rem', color: '#6366f1' }} />
        </div>
      );
    }

    let projectsToShow: any[] = [];
    let emptyMessage = '';
    let emptyIcon = null;

    switch (activeTab) {
      case 'active':
        projectsToShow = getActiveProjects();
        emptyMessage = 'No active clients';
        emptyIcon = <FaFolderOpen style={{ fontSize: '3rem', opacity: 0.3 }} />;
        break;
      case 'done':
        projectsToShow = getDoneProjects();
        emptyMessage = 'No clients ready to close';
        emptyIcon = <FaCheckCircle style={{ fontSize: '3rem', opacity: 0.3 }} />;
        break;
      case 'archive':
        projectsToShow = getArchivedProjects();
        emptyMessage = 'No archived clients';
        emptyIcon = <FaArchive style={{ fontSize: '3rem', opacity: 0.3 }} />;
        break;
    }

    if (projectsToShow.length === 0) {
      return (
        <div style={{ 
          padding: '4rem', 
          textAlign: 'center', 
          color: '#64748b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {emptyIcon}
          <h3 style={{ margin: 0, color: '#94a3b8' }}>{emptyMessage}</h3>
        </div>
      );
    }

    return (
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f8fafc',
              borderBottom: '2px solid #e2e8f0'
            }}>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Client Name</th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Client Type</th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Stage</th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Process</th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Package</th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                fontWeight: '600',
                color: '#475569',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Priority</th>
              {activeTab === 'archive' && (
                <th style={{
                  padding: '1rem',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#475569',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Archived Date</th>
              )}
              {activeTab === 'done' && (
                <th style={{
                  padding: '1rem',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#475569',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Ready Since</th>
              )}
            </tr>
          </thead>
          <tbody>
            {projectsToShow.map((project, index) => {
              const stageColor = getStageColor(project.stage);
              const clientTypeStyle = getClientTypeColor(project.clientType);
              const currentProcess = getCurrentProcess(project.id);
              const processColor = getProcessColor(currentProcess);
              
              return (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: index < projectsToShow.length - 1 ? '1px solid #e2e8f0' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <td style={{
                    padding: '1rem',
                    color: '#1e293b',
                    fontWeight: '500',
                    fontSize: '0.9375rem'
                  }}>
                    {project.clientName}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        background: clientTypeStyle.bg,
                        color: clientTypeStyle.color
                      }}
                    >
                      {project.clientType}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        backgroundColor: `${stageColor}15`,
                        color: stageColor,
                        borderLeft: `3px solid ${stageColor}`
                      }}
                    >
                      {project.stage}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        backgroundColor: `${processColor}15`,
                        color: processColor,
                        borderLeft: `3px solid ${processColor}`
                      }}
                    >
                      {currentProcess}
                    </span>
                  </td>
                  <td style={{
                    padding: '1rem',
                    color: '#64748b',
                    fontSize: '0.875rem'
                  }}>
                    {project.package}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: project.priority === 'Urgent' ? '#fee2e2' :
                                        project.priority === 'High' ? '#fef3c7' :
                                        project.priority === 'Medium' ? '#dbeafe' : '#e5e7eb',
                        color: project.priority === 'Urgent' ? '#991b1b' :
                               project.priority === 'High' ? '#92400e' :
                               project.priority === 'Medium' ? '#1e40af' : '#374151'
                      }}
                    >
                      {project.priority}
                    </span>
                  </td>
                  {activeTab === 'archive' && (
                    <td style={{
                      padding: '1rem',
                      color: '#64748b',
                      fontSize: '0.875rem'
                    }}>
                      {formatDate(project.archivedAt)}
                    </td>
                  )}
                  {activeTab === 'done' && (
                    <td style={{
                      padding: '1rem',
                      color: '#64748b',
                      fontSize: '0.875rem'
                    }}>
                      {formatDate(project.updatedAt)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="dashboard premium-dashboard">
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <h2 className="nav-logo-premium" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            Katalyst PM
          </h2>
          <div className="nav-right">
            <button
              className="btn-secondary btn-secondary-premium"
              onClick={() => navigate('/dashboard')}
              style={{ marginRight: '0.75rem' }}
            >
              <FaHome className="btn-icon" />
              Dashboard
            </button>
            <button
              className="btn-secondary btn-secondary-premium"
              onClick={() => navigate('/clients')}
              style={{ 
                marginRight: '0.75rem',
                backgroundColor: '#6366f1',
                color: '#ffffff',
                borderColor: '#6366f1'
              }}
            >
              <FaFolder className="btn-icon" />
              Clients
            </button>
            <div className="avatar-dropdown-container" ref={dropdownRef}>
              <button
                className="avatar-button"
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
              >
                <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
                <FaChevronDown className="dropdown-chevron" />
              </button>
              {showAvatarDropdown && (
                <div className="avatar-dropdown">
                  <div className="dropdown-header">
                    <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
                    <div>
                      <div className="dropdown-name">{user?.name}</div>
                      <div className="dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/profile');
                    }}
                    className="dropdown-item"
                  >
                    <FaUser className="dropdown-icon" />
                    Profile
                  </button>
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/settings');
                    }}
                    className="dropdown-item"
                  >
                    <FaCog className="dropdown-icon" />
                    Settings
                  </button>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item">
                    <FaSignOutAlt className="dropdown-icon" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="dashboard-content premium-content">
        <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b' }}>
              Clients
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Manage your active, completed, and archived client projects
            </p>
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            borderBottom: '2px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => setActiveTab('active')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'active' ? '#6366f1' : '#64748b',
                borderBottom: activeTab === 'active' ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activeTab === 'active' ? '600' : '400',
                marginBottom: '-2px',
                transition: 'all 0.2s',
              }}
            >
              Active Clients ({getActiveProjects().length})
            </button>
            <button
              onClick={() => setActiveTab('done')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'done' ? '#6366f1' : '#64748b',
                borderBottom: activeTab === 'done' ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activeTab === 'done' ? '600' : '400',
                marginBottom: '-2px',
                transition: 'all 0.2s',
              }}
            >
              Done Clients ({getDoneProjects().length})
            </button>
            <button
              onClick={() => setActiveTab('archive')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'transparent',
                color: activeTab === 'archive' ? '#6366f1' : '#64748b',
                borderBottom: activeTab === 'archive' ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activeTab === 'archive' ? '600' : '400',
                marginBottom: '-2px',
                transition: 'all 0.2s',
              }}
            >
              Archive ({getArchivedProjects().length})
            </button>
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Clients;

