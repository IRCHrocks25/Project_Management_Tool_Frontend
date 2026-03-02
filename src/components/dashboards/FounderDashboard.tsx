import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartLine, FaUsers, FaProjectDiagram, FaExclamationTriangle, FaCheckCircle,
  FaClock, FaArrowUp, FaArrowDown, FaArrowRight, FaBell, FaSignOutAlt,
  FaUser, FaChevronDown, FaTasks, FaEnvelope,
  FaFire, FaTachometerAlt
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { clientUpdatesService } from '../../services/client-updates.service';
import '../Dashboard.css';

const FounderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [emailLogs, setEmailLogs] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadAllData();
    loadUnreadCount();
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsData, projectsData, tasksData, usersData] = await Promise.all([
        projectService.getStats(),
        projectService.getAll(),
        taskService.getAll(),
        authService.getAllUsers()
      ]);

      setStats(statsData);
      setProjects(projectsData);
      setTasks(tasksData);
      setUsers(usersData || []);

      // Load email logs for all projects
      const logsMap: Record<string, any[]> = {};
      await Promise.all(
        projectsData.slice(0, 50).map(async (project) => {
          try {
            const updates = await clientUpdatesService.getAllByProject(project.id);
            if (updates && updates.length > 0) {
              logsMap[project.id] = updates;
            }
          } catch (error) {
            // Silently fail
          }
        })
      );
      setEmailLogs(logsMap);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  // Calculate comprehensive metrics
  const metrics = useMemo(() => {
    if (!projects.length || !tasks.length) return null;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Project health
    const projectsByHealth = {
      healthy: projects.filter((p: any) => {
        const daysSinceUpdate = p.updatedAt ? (now - new Date(p.updatedAt).getTime()) / oneDay : 999;
        return daysSinceUpdate < 7 && p.stage !== 'Closed';
      }).length,
      needsAttention: projects.filter((p: any) => {
        const daysSinceUpdate = p.updatedAt ? (now - new Date(p.updatedAt).getTime()) / oneDay : 999;
        return daysSinceUpdate >= 7 && daysSinceUpdate < 14 && p.stage !== 'Closed';
      }).length,
      critical: projects.filter((p: any) => {
        const daysSinceUpdate = p.updatedAt ? (now - new Date(p.updatedAt).getTime()) / oneDay : 999;
        return daysSinceUpdate >= 14 && p.stage !== 'Closed';
      }).length,
    };

    // Task metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.isCompleted).length;
    const inProgressTasks = tasks.filter((t: any) => t.status === 'In Progress').length;
    const overdueTasks = tasks.filter((t: any) => {
      if (!t.dueDate || t.isCompleted) return false;
      return new Date(t.dueDate).getTime() < now;
    }).length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // PM performance
    const pms = users.filter((u: any) => u.role === 'Project Manager');
    const pmPerformance = pms.map((pm: any) => {
      const pmProjects = projects.filter((p: any) => p.pm?.id === pm.id || p.pmId === pm.id);
      const pmTasks = tasks.filter((t: any) => {
        const project = projects.find((p: any) => p.id === t.projectId);
        return project && (project.pm?.id === pm.id || project.pmId === pm.id);
      });
      const pmCompletedTasks = pmTasks.filter((t: any) => t.isCompleted).length;
      const pmTaskRate = pmTasks.length > 0 ? (pmCompletedTasks / pmTasks.length) * 100 : 0;

      // Calculate last activity
      let lastActivity = null;
      for (const project of pmProjects) {
        const projectLogs = emailLogs[project.id] || [];
        if (projectLogs.length > 0) {
          const lastLog = projectLogs[0];
          const logDate = new Date(lastLog.emailSentAt || lastLog.createdAt);
          if (!lastActivity || logDate > lastActivity) {
            lastActivity = logDate;
          }
        }
      }

      return {
        ...pm,
        projectCount: pmProjects.length,
        taskCount: pmTasks.length,
        completedTasks: pmCompletedTasks,
        completionRate: pmTaskRate,
        lastActivity,
        daysSinceActivity: lastActivity ? Math.floor((now - lastActivity.getTime()) / oneDay) : null
      };
    }).sort((a, b) => b.projectCount - a.projectCount);

    // Client type distribution
    const clientTypes = projects.reduce((acc: any, p: any) => {
      const type = p.clientType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Stage distribution
    const stageDistribution = projects.reduce((acc: any, p: any) => {
      const stage = p.stage || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});

    // Priority distribution
    const priorityDistribution = projects.reduce((acc: any, p: any) => {
      const priority = p.priority || 'Unassigned';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    // Comprehensive recent activity tracking (last 7 days)
    const recentActivities: Array<{
      id: string;
      project: string;
      projectId: string;
      user: string;
      userId?: string;
      userRole?: string;
      date: Date;
      type: 'task_created' | 'task_assigned' | 'task_status_change' | 'task_completed' | 'email_log' | 'project_update';
      description: string;
      icon: React.ReactNode;
      color: string;
      metadata?: any;
    }> = [];

    // Create user map for quick lookups
    const userMap = new Map<string, any>();
    users.forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u);
      }
    });

    // 1. Track task creation events
    for (const task of tasks) {
      if (!task.createdAt) continue;
      const taskDate = new Date(task.createdAt);
      const daysAgo = (now - taskDate.getTime()) / oneDay;
      if (daysAgo <= 7) {
        const project = projects.find((p: any) => p.id === task.projectId);
        const creatorId = (task as any).createdById || (task as any).createdBy?.id;
        const creator = creatorId ? userMap.get(creatorId) : null;
        const creatorName = creator?.name || (task as any).createdBy?.name || 'System';

        recentActivities.push({
          id: `task-created-${task.id}`,
          project: project?.clientName || 'Unknown Project',
          projectId: task.projectId,
          user: creatorName,
          userId: creatorId,
          userRole: creator?.role,
          date: taskDate,
          type: 'task_created',
          description: `Created task: "${task.title}"`,
          icon: <FaTasks />,
          color: '#667eea',
          metadata: { taskId: task.id, taskType: task.type }
        });
      }
    }

    // 2. Track task assignment/claiming events
    for (const task of tasks) {
      if (!task.assignedToId || !task.updatedAt) continue;
      const assignDate = new Date(task.updatedAt);
      const daysAgo = (now - assignDate.getTime()) / oneDay;
      
      // Only track if assignment happened in last 7 days and task was created before assignment
      if (daysAgo <= 7 && task.createdAt && new Date(task.createdAt) < assignDate) {
        const project = projects.find((p: any) => p.id === task.projectId);
        const assignee = userMap.get(task.assignedToId);
        const assigneeName = assignee?.name || 'Unknown User';

        recentActivities.push({
          id: `task-assigned-${task.id}-${task.updatedAt}`,
          project: project?.clientName || 'Unknown Project',
          projectId: task.projectId,
          user: assigneeName,
          userId: task.assignedToId,
          userRole: assignee?.role,
          date: assignDate,
          type: 'task_assigned',
          description: `Accepted/claimed task: "${task.title}"`,
          icon: <FaUser />,
          color: '#10b981',
          metadata: { taskId: task.id, taskType: task.type }
        });
      }
    }

    // 3. Track task status changes (excluding creation and assignment)
    for (const task of tasks) {
      if (!task.updatedAt || !task.status) continue;
      const updateDate = new Date(task.updatedAt);
      const daysAgo = (now - updateDate.getTime()) / oneDay;
      
      // Only track status changes in last 7 days
      if (daysAgo <= 7 && task.createdAt && new Date(task.createdAt) < updateDate) {
        const project = projects.find((p: any) => p.id === task.projectId);
        const updaterId = task.assignedToId || (task as any).updatedById || (task as any).updatedBy?.id;
        const updater = updaterId ? userMap.get(updaterId) : null;
        const updaterName = updater?.name || (task as any).updatedBy?.name || 'System';

        // Skip if this is just assignment (already tracked above)
        if (task.status === 'Todo' && task.assignedToId) continue;

        recentActivities.push({
          id: `task-status-${task.id}-${task.updatedAt}`,
          project: project?.clientName || 'Unknown Project',
          projectId: task.projectId,
          user: updaterName,
          userId: updaterId,
          userRole: updater?.role,
          date: updateDate,
          type: task.isCompleted ? 'task_completed' : 'task_status_change',
          description: task.isCompleted 
            ? `Completed task: "${task.title}"`
            : `Updated task status to "${task.status}": "${task.title}"`,
          icon: task.isCompleted ? <FaCheckCircle /> : <FaClock />,
          color: task.isCompleted ? '#10b981' : '#f59e0b',
          metadata: { taskId: task.id, status: task.status, taskType: task.type }
        });
      }
    }

    // 4. Track email log activities
    for (const [projectId, logs] of Object.entries(emailLogs)) {
      const project = projects.find((p: any) => p.id === projectId);
      for (const log of logs || []) {
        const logDate = new Date(log.emailSentAt || log.createdAt);
        const daysAgo = (now - logDate.getTime()) / oneDay;
        if (daysAgo <= 7) {
          const pmId = log.pmId || (log.pm as any)?.id;
          const pm = pmId ? userMap.get(pmId) : log.pm;
          const pmName = pm?.name || log.pm?.name || 'Unknown PM';

          recentActivities.push({
            id: `email-log-${projectId}-${log.id || logDate.getTime()}`,
            project: project?.clientName || 'Unknown Project',
            projectId,
            user: pmName,
            userId: pmId,
            userRole: pm?.role || 'Project Manager',
            date: logDate,
            type: 'email_log',
            description: log.notes ? `Email log: ${log.notes.substring(0, 60)}` : 'Email update sent',
            icon: <FaEnvelope />,
            color: '#3b82f6',
            metadata: { logId: log.id }
          });
        }
      }
    }

    // 5. Track project updates (stage changes, etc.)
    for (const project of projects) {
      if (!project.updatedAt) continue;
      const updateDate = new Date(project.updatedAt);
      const daysAgo = (now - updateDate.getTime()) / oneDay;
      
      // Only track if updated in last 7 days and has meaningful changes
      if (daysAgo <= 7 && project.createdAt && new Date(project.createdAt) < updateDate) {
        const pmId = project.pmId || project.pm?.id;
        const pm = pmId ? userMap.get(pmId) : project.pm;
        const pmName = pm?.name || project.pm?.name || 'System';

        recentActivities.push({
          id: `project-update-${project.id}-${project.updatedAt}`,
          project: project.clientName || 'Unknown Project',
          projectId: project.id,
          user: pmName,
          userId: pmId,
          userRole: pm?.role || 'Project Manager',
          date: updateDate,
          type: 'project_update',
          description: `Updated project stage to "${project.stage}"`,
          icon: <FaProjectDiagram />,
          color: '#8b5cf6',
          metadata: { stage: project.stage, priority: project.priority }
        });
      }
    }

    // Sort all activities by date (most recent first)
    recentActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Remove duplicates (same activity might be tracked multiple ways)
    const uniqueActivities = recentActivities.filter((activity, index, self) =>
      index === self.findIndex((a) => a.id === activity.id)
    );

    // Projects needing attention
    const needsAttention = projects.filter((p: any) => {
      const daysSinceUpdate = p.updatedAt ? (now - new Date(p.updatedAt).getTime()) / oneDay : 999;
      return daysSinceUpdate >= 7 && p.stage !== 'Closed';
    }).slice(0, 10);

    return {
      projectsByHealth,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate,
      pmPerformance,
      clientTypes,
      stageDistribution,
      priorityDistribution,
      recentActivities: uniqueActivities.slice(0, 50), // Show more activities
      needsAttention
    };
  }, [projects, tasks, users, emailLogs]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FaChartLine style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Loading Analytics...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard premium" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Navigation */}
      <nav style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
            <FaChartLine style={{ marginRight: '0.5rem', display: 'inline' }} />
            Katalyst PM - Executive Dashboard
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          >
            <FaArrowRight style={{ marginRight: '0.5rem' }} />
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/notifications')}
            style={{
              position: 'relative',
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              borderRadius: '8px'
            }}
          >
            <FaBell style={{ fontSize: '1.25rem' }} />
            {unreadNotifications > 0 && (
              <span style={{
                position: 'absolute',
                top: '0.25rem',
                right: '0.25rem',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 600
              }}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span>{user?.name}</span>
              <FaChevronDown style={{ fontSize: '0.75rem' }} />
            </button>
            {showAvatarDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                minWidth: '200px',
                overflow: 'hidden',
                zIndex: 1000
              }}>
                <button
                  onClick={() => {
                    setShowAvatarDropdown(false);
                    navigate('/profile');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: '#374151'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                >
                  <FaUser /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: '#ef4444'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                >
                  <FaSignOutAlt /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: '#111827',
            margin: '0 0 0.5rem 0'
          }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#64748b', margin: 0 }}>
            Executive overview of your company's performance and operations
          </p>
        </div>

        {/* Key Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <MetricCard
            icon={<FaProjectDiagram />}
            title="Total Projects"
            value={stats?.total || projects.length}
            subtitle={`${projects.filter((p: any) => p.stage !== 'Closed').length} active`}
            color="#667eea"
            trend={stats?.total ? 'up' : null}
          />
          <MetricCard
            icon={<FaTasks />}
            title="Total Tasks"
            value={metrics?.totalTasks || 0}
            subtitle={`${metrics?.completedTasks || 0} completed (${Math.round(metrics?.completionRate || 0)}%)`}
            color="#10b981"
            trend={(metrics?.completionRate ?? 0) > 70 ? 'up' : (metrics?.completionRate ?? 0) < 50 ? 'down' : null}
          />
          <MetricCard
            icon={<FaUsers />}
            title="Project Managers"
            value={users.filter((u: any) => u.role === 'Project Manager').length}
            subtitle={`${metrics?.pmPerformance?.filter((pm: any) => pm.projectCount > 0).length || 0} active`}
            color="#f59e0b"
          />
          <MetricCard
            icon={<FaExclamationTriangle />}
            title="Needs Attention"
            value={(metrics?.projectsByHealth?.needsAttention ?? 0) + (metrics?.projectsByHealth?.critical ?? 0)}
            subtitle={`${metrics?.projectsByHealth?.critical ?? 0} critical`}
            color="#ef4444"
            trend={(metrics?.projectsByHealth?.critical ?? 0) > 0 ? 'down' : null}
          />
        </div>

        {/* Project Health Dashboard */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              <FaTachometerAlt style={{ marginRight: '0.5rem', color: '#667eea' }} />
              Project Health Dashboard
            </h2>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '0.5rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              View All <FaArrowRight />
            </button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem'
          }}>
            <HealthCard
              title="Healthy"
              count={metrics?.projectsByHealth?.healthy || 0}
              color="#10b981"
              icon={<FaCheckCircle />}
            />
            <HealthCard
              title="Needs Attention"
              count={metrics?.projectsByHealth?.needsAttention || 0}
              color="#f59e0b"
              icon={<FaExclamationTriangle />}
            />
            <HealthCard
              title="Critical"
              count={metrics?.projectsByHealth?.critical || 0}
              color="#ef4444"
              icon={<FaFire />}
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* PM Performance */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 1.5rem 0' }}>
              <FaUsers style={{ marginRight: '0.5rem', color: '#667eea' }} />
              PM Performance
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {metrics?.pmPerformance?.slice(0, 5).map((pm: any, idx: number) => (
                <div
                  key={pm.id}
                  style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600
                      }}>
                        {pm.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{pm.name}</div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {pm.projectCount} project{pm.projectCount !== 1 ? 's' : ''} • {pm.taskCount} tasks
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: pm.completionRate >= 70 ? '#10b981' : pm.completionRate >= 50 ? '#f59e0b' : '#ef4444', fontSize: '1.25rem' }}>
                        {Math.round(pm.completionRate)}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>completion</div>
                    </div>
                  </div>
                  {pm.daysSinceActivity !== null && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                      Last activity: {pm.daysSinceActivity === 0 ? 'Today' : `${pm.daysSinceActivity} day${pm.daysSinceActivity !== 1 ? 's' : ''} ago`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Projects Needing Attention */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 1.5rem 0' }}>
              <FaExclamationTriangle style={{ marginRight: '0.5rem', color: '#ef4444' }} />
              Projects Needing Attention
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {metrics && metrics.needsAttention && metrics.needsAttention.length > 0 ? (
                metrics.needsAttention.map((project: any) => {
                  const daysSinceUpdate = project.updatedAt
                    ? Math.floor((Date.now() - new Date(project.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
                    : 999;
                  const isCritical = daysSinceUpdate >= 14;

                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{
                        padding: '1rem',
                        background: isCritical ? '#fef2f2' : '#fffbeb',
                        borderRadius: '12px',
                        border: `1px solid ${isCritical ? '#fecaca' : '#fde68a'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{project.clientName}</div>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: isCritical ? '#fee2e2' : '#fef3c7',
                          color: isCritical ? '#dc2626' : '#d97706'
                        }}>
                          {isCritical ? 'CRITICAL' : 'ATTENTION'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        {project.stage} • {project.priority || 'No priority'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        No update for {daysSinceUpdate} day{daysSinceUpdate !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <FaCheckCircle style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }} />
                  <p>All projects are up to date!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Distribution Charts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          <DistributionCard
            title="Projects by Stage"
            data={metrics?.stageDistribution || {}}
            color="#667eea"
          />
          <DistributionCard
            title="Projects by Client Type"
            data={metrics?.clientTypes || {}}
            color="#10b981"
          />
          <DistributionCard
            title="Projects by Priority"
            data={metrics?.priorityDistribution || {}}
            color="#f59e0b"
          />
        </div>

        {/* Recent Activity */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              <FaClock style={{ marginRight: '0.5rem', color: '#667eea' }} />
              Recent Activity (Last 7 Days)
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
              {metrics?.recentActivities?.length || 0} activities
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {metrics && metrics.recentActivities && metrics.recentActivities.length > 0 ? (
              metrics.recentActivities.map((activity: any, idx: number) => {
                const getActivityIcon = () => {
                  if (activity.icon) return activity.icon;
                  switch (activity.type) {
                    case 'task_created': return <FaTasks />;
                    case 'task_assigned': return <FaUser />;
                    case 'task_completed': return <FaCheckCircle />;
                    case 'task_status_change': return <FaClock />;
                    case 'email_log': return <FaEnvelope />;
                    case 'project_update': return <FaProjectDiagram />;
                    default: return <FaClock />;
                  }
                };

                const getActivityColor = () => {
                  if (activity.color) return activity.color;
                  switch (activity.type) {
                    case 'task_created': return '#667eea';
                    case 'task_assigned': return '#10b981';
                    case 'task_completed': return '#10b981';
                    case 'task_status_change': return '#f59e0b';
                    case 'email_log': return '#3b82f6';
                    case 'project_update': return '#8b5cf6';
                    default: return '#64748b';
                  }
                };

                const getActivityTypeLabel = () => {
                  switch (activity.type) {
                    case 'task_created': return 'Task Created';
                    case 'task_assigned': return 'Task Accepted';
                    case 'task_completed': return 'Task Completed';
                    case 'task_status_change': return 'Status Updated';
                    case 'email_log': return 'Email Log';
                    case 'project_update': return 'Project Updated';
                    default: return 'Activity';
                  }
                };

                const color = getActivityColor();
                const timeAgo = Math.floor((Date.now() - activity.date.getTime()) / (1000 * 60));
                const timeLabel = timeAgo < 60 
                  ? `${timeAgo}m ago`
                  : timeAgo < 1440
                  ? `${Math.floor(timeAgo / 60)}h ago`
                  : `${Math.floor(timeAgo / 1440)}d ago`;

                return (
                  <div
                    key={activity.id || idx}
                    onClick={() => activity.projectId && navigate(`/project/${activity.projectId}`)}
                    style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      cursor: activity.projectId ? 'pointer' : 'default',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (activity.projectId) {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = color;
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activity.projectId) {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: `${color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: color,
                      fontSize: '1.25rem',
                      flexShrink: 0
                    }}>
                      {getActivityIcon()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>
                          {activity.user}
                        </span>
                        {activity.userRole && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: activity.userRole === 'Project Manager' ? '#dbeafe' : '#f3f4f6',
                            color: activity.userRole === 'Project Manager' ? '#1e40af' : '#374151'
                          }}>
                            {activity.userRole}
                          </span>
                        )}
                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                          {activity.type === 'task_created' ? 'created' :
                           activity.type === 'task_assigned' ? 'accepted' :
                           activity.type === 'task_completed' ? 'completed' :
                           activity.type === 'task_status_change' ? 'updated' :
                           activity.type === 'email_log' ? 'sent email log for' :
                           'updated'}
                        </span>
                        <span style={{ fontWeight: 600, color: '#111827' }}>
                          {activity.project}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        {activity.description}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: `${color}15`,
                          color: color
                        }}>
                          {getActivityTypeLabel()}
                        </span>
                        {activity.metadata?.taskType && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: '#f3f4f6',
                            color: '#64748b'
                          }}>
                            {activity.metadata.taskType}
                          </span>
                        )}
                        {activity.metadata?.status && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            Status: {activity.metadata.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {timeLabel}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                        {activity.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                <FaClock style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }} />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: number | string;
  subtitle: string;
  color: string;
  trend?: 'up' | 'down' | null;
}> = ({ icon, title, value, subtitle, color, trend }) => {
  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      borderLeft: `4px solid ${color}`,
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          fontSize: '1.5rem'
        }}>
          {icon}
        </div>
        {trend && (
          <div style={{ color: trend === 'up' ? '#10b981' : '#ef4444' }}>
            {trend === 'up' ? <FaArrowUp /> : <FaArrowDown />}
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{subtitle}</div>
    </div>
  );
};

// Health Card Component
const HealthCard: React.FC<{
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}> = ({ title, count, color, icon }) => {
  return (
    <div style={{
      padding: '1.5rem',
      background: `${color}10`,
      borderRadius: '12px',
      border: `2px solid ${color}30`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2rem', color, marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>{count}</div>
      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{title}</div>
    </div>
  );
};

// Distribution Card Component
const DistributionCard: React.FC<{
  title: string;
  data: Record<string, number>;
  color: string;
}> = ({ title, data, color }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]), 1);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: '0 0 1rem 0' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {entries.slice(0, 5).map(([key, value]) => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{key}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{value}</span>
            </div>
            <div style={{
              height: '8px',
              background: '#e2e8f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(value / max) * 100}%`,
                background: color,
                borderRadius: '4px',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FounderDashboard;
