import React, { useState, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaEnvelope, FaExclamationTriangle, FaChevronLeft, FaChevronRight, FaUser, FaCheck, FaEllipsisV } from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';

interface KanbanBoardProps {
  projects: any[];
  tasks?: any[];
  onUpdate: () => void;
  showAllDepartments?: boolean;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  /* ── Board wrapper ── */
  .kb-wrapper {
    --bg: #f4f6f9;
    --card-bg: #ffffff;
    --col-bg: #f0f2f5;
    --col-bg-drag: #e8edf5;
    --border: #e2e6ec;
    --border-strong: #cdd3db;
    --text-primary: #0f1923;
    --text-secondary: #4a5568;
    --text-muted: #94a3b8;
    --accent: #2563eb;
    --accent-light: #eff6ff;
    --success: #16a34a;
    --danger: #dc2626;
    --amber: #d97706;
    font-family: 'Instrument Sans', sans-serif;
    position: relative;
  }

  /* ── Hint bar ── */
  .kb-hint {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    margin-bottom: 14px;
    background: var(--accent-light);
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    font-size: 12px;
    color: #3b82f6;
    font-weight: 500;
  }
  .kb-hint-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* ── Scroll buttons ── */
  .kb-scroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    background: white;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.13s;
    font-size: 12px;
  }
  .kb-scroll-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
  .kb-scroll-left  { left: -17px; }
  .kb-scroll-right { right: -17px; }

  /* ── Board scroll container ── */
  .kb-board {
    overflow-x: auto;
    overflow-y: visible;
    padding-bottom: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  .kb-board::-webkit-scrollbar { height: 5px; }
  .kb-board::-webkit-scrollbar-track { background: transparent; }
  .kb-board::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 10px; }

  /* ── Stages row ── */
  .kb-stages {
    display: flex;
    gap: 12px;
    min-width: max-content;
    align-items: flex-start;
    padding: 2px 1px 4px;
  }

  /* ── Column ── */
  .kb-col {
    width: 256px;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--col-bg);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  .kb-col.drag-over {
    background: var(--col-bg-drag);
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  /* ── Column header ── */
  .kb-col-head {
    padding: 12px 14px 10px;
    border-bottom: 1px solid var(--border);
  }
  .kb-col-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .kb-col-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 0;
  }
  .kb-col-count {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 10px;
    background: white;
    border: 1px solid var(--border);
    color: var(--text-muted);
    min-width: 22px;
    text-align: center;
  }
  .kb-col.drag-over .kb-col-count {
    background: var(--accent-light);
    border-color: #bfdbfe;
    color: var(--accent);
  }
  .kb-sla-warn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--amber);
    background: #fffbeb;
    border: 1px solid #fde68a;
    padding: 2px 7px;
    border-radius: 10px;
  }

  /* ── Cards list ── */
  .kb-cards {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 80px;
  }

  /* ── Empty drop hint ── */
  .kb-empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    border: 1.5px dashed var(--border-strong);
    border-radius: 8px;
    font-size: 11.5px;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  /* ── Card ── */
  .kb-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 13px;
    cursor: pointer;
    transition: box-shadow 0.13s, transform 0.13s, border-color 0.13s;
    position: relative;
    animation: cardIn 0.2s ease both;
  }
  .kb-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    transform: translateY(-1px);
    border-color: var(--border-strong);
  }
  .kb-card.dragging { opacity: 0.45; transform: rotate(1.5deg) scale(0.98); }
  .kb-card.stuck    { border-left: 3px solid var(--amber); }
  .kb-card.overdue  { border-left: 3px solid var(--danger); }
  .kb-card.waiting-client { border-left: 3px solid #8b5cf6; }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Card rows ── */
  .kb-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 8px;
  }
  .kb-card-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }
  .kb-card-controls {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .kb-priority-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 3px;
  }

  .kb-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 9px;
  }
  .kb-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 700;
    color: white;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .kb-badge-pkg {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 600;
    background: #f1f5f9;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    white-space: nowrap;
  }

  .kb-card-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }
  .kb-meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }
  .kb-meta-icon { font-size: 10px; flex-shrink: 0; }

  .kb-card-signals {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .kb-signal {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    letter-spacing: 0.03em;
  }
  .kb-signal-waiting  { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
  .kb-signal-stuck    { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .kb-signal-overdue  { background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; }
  .kb-signal-rev      { background: #f0fdf4; color: #14532d; border: 1px solid #bbf7d0; }

  /* ── Card menu button ── */
  .kb-menu-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 5px;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }
  .kb-menu-btn:hover { background: var(--col-bg); color: var(--text-secondary); }

  /* ── Dropdown menu ── */
  .kb-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: white;
    border: 1px solid var(--border);
    border-radius: 9px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06);
    z-index: 100;
    min-width: 172px;
    overflow: hidden;
  }
  .kb-dropdown-item {
    width: 100%;
    padding: 9px 13px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: background 0.1s, color 0.1s;
    box-sizing: border-box;
  }
  .kb-dropdown-item:hover { background: #f0fdf4; color: var(--success); }

  /* ── Tooltip ── */
  .kb-tooltip {
    background: #0f1923;
    color: white;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 11.5px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .kb-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #0f1923;
  }

  /* ── Toast ── */
  .toast-notification {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    background: #0f1923;
    color: white;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 10px 20px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    z-index: 9999;
    pointer-events: none;
    white-space: nowrap;
  }
  .toast-notification.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, tasks = [], onUpdate, showAllDepartments = false }) => {
  const navigate = useNavigate();
  const user = authService.getUser();

  const [localProjects, setLocalProjects] = useState<any[]>(projects);
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map());
  const manuallyDraggedRef = useRef<Map<string, string>>(new Map());
  const doneFromColumnRef = useRef<Map<string, string>>(new Map());
  const previousProjectsRef = useRef<string>('');

  useEffect(() => {
    const projectsKey = JSON.stringify(projects.map((p: any) => ({ id: p.id, stage: p.stage })));
    if (projectsKey === previousProjectsRef.current) return;
    previousProjectsRef.current = projectsKey;
    doneFromColumnRef.current.clear();
    if (pendingUpdatesRef.current.size > 0) {
      setLocalProjects((prevLocal) => {
        const updatedProjects = projects.map((p: any) => {
          if (pendingUpdatesRef.current.has(p.id)) return pendingUpdatesRef.current.get(p.id);
          return p;
        });
        pendingUpdatesRef.current.forEach((pendingProject, id) => {
          if (!updatedProjects.find((p: any) => p.id === id)) updatedProjects.push(pendingProject);
        });
        return updatedProjects;
      });
    } else {
      setLocalProjects(projects);
    }
  }, [projects]);

  const getStagesForRole = (role: string) => {
    switch (role) {
      case 'Project Manager':
      case 'FOUNDER/CEO':
        return ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
      case 'Copy Writing': return ['Copy Writing'];
      case 'Designer': return ['Design'];
      case 'Developer': return ['Development'];
      case 'AI Developer': return ['AI Team'];
      case 'Social Media': return ['Social Media Team'];
      case 'CRM': return ['CRM'];
      case 'SEO/GEO': return ['SEO/GEO Team'];
      default:
        return ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
    }
  };

  const stages = useMemo(() => {
    if (showAllDepartments) return getStagesForRole('Project Manager');
    return getStagesForRole(user?.role || 'Project Manager');
  }, [user?.role, showAllDepartments]);

  const mapStageToDisplay = (internalStage: string): string => {
    if (internalStage === 'Copy' || internalStage === 'Copy Revision') return 'Copy Writing';
    if (internalStage === 'Design' || internalStage === 'Design Revision') return 'Design';
    if (internalStage === 'Dev') return 'Development';
    if (internalStage === 'Intake') return 'Onboarding';
    return internalStage;
  };

  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getProjectsByStage = (displayStage: string) => {
    if (tasks && tasks.length > 0) {
      const taskTypesForStage: string[] = [];
      if (displayStage === 'Copy Writing') taskTypesForStage.push('Copy');
      else if (displayStage === 'Design') taskTypesForStage.push('Design');
      else if (displayStage === 'Development') taskTypesForStage.push('Dev');
      else if (displayStage === 'AI Team') taskTypesForStage.push('AI');
      else if (displayStage === 'Social Media Team') taskTypesForStage.push('Social Media');
      else if (displayStage === 'CRM') taskTypesForStage.push('CRM');
      else if (displayStage === 'SEO/GEO Team') taskTypesForStage.push('SEO/GEO');
      else if (displayStage === 'Onboarding') taskTypesForStage.push('Onboarding');

      if (taskTypesForStage.length > 0) {
        const projectIdsWithActiveTasks = new Set(
          tasks.filter((t: any) => taskTypesForStage.includes(t.type) && !t.isCompleted && t.status !== 'Completed').map((t: any) => t.projectId)
        );
        const internalStagesForColumn: string[] = [];
        if (displayStage === 'Copy Writing') internalStagesForColumn.push('Copy', 'Copy Revision');
        else if (displayStage === 'Design') internalStagesForColumn.push('Design', 'Design Revision');
        else if (displayStage === 'Development') internalStagesForColumn.push('Dev');
        else if (displayStage === 'AI Team') internalStagesForColumn.push('AI Team');
        else if (displayStage === 'Social Media Team') internalStagesForColumn.push('Social Media Team');
        else if (displayStage === 'CRM') internalStagesForColumn.push('CRM');
        else if (displayStage === 'SEO/GEO Team') internalStagesForColumn.push('SEO/GEO Team');

        const filtered = localProjects.filter((p: any) => {
          if (doneFromColumnRef.current.get(p.id) === displayStage) return false;
          if (projectIdsWithActiveTasks.has(p.id)) return true;
          if (internalStagesForColumn.length > 0 && internalStagesForColumn.includes(p.stage)) return true;
          if (manuallyDraggedRef.current.get(p.id) === displayStage) return true;
          if (displayStage === 'CRM') {
            const allClientTypes = [p.clientType, ...(p.secondaryClientTypes ? (Array.isArray(p.secondaryClientTypes) ? p.secondaryClientTypes : p.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t)) : [])];
            const hasKatalyst = allClientTypes.some((type: string) => type === 'Katalyst' || type === 'KATALYST' || type?.toLowerCase() === 'katalyst');
            if (hasKatalyst || p.clientType === 'Premium' || p.clientType === 'Powered-Up') return true;
          }
          return false;
        });
        if (filtered.length === 0 && internalStagesForColumn.length > 0) {
          return localProjects.filter((p: any) => doneFromColumnRef.current.get(p.id) !== displayStage && internalStagesForColumn.includes(p.stage));
        }
        return filtered;
      }
      if (displayStage === 'Ready to Close') {
        return localProjects.filter((p) => doneFromColumnRef.current.get(p.id) !== displayStage && (p.stage === 'Ready to Close' || p.stage === 'Closed'));
      }
      if (displayStage === 'Onboarding') {
        const onboardingTaskProjects = new Set(tasks.filter((t: any) => t.type === 'Onboarding' && !t.isCompleted && t.status !== 'Completed').map((t: any) => t.projectId));
        const onboardingStageProjects = localProjects.filter((p) => p.stage === 'Onboarding' || p.stage === 'Intake');
        const combined = new Set([...Array.from(onboardingTaskProjects), ...onboardingStageProjects.map((p: any) => p.id)]);
        return localProjects.filter((p) => doneFromColumnRef.current.get(p.id) !== displayStage && combined.has(p.id));
      }
    }
    const internalStages: string[] = [];
    if (displayStage === 'Copy Writing') internalStages.push('Copy', 'Copy Revision');
    else if (displayStage === 'Design') internalStages.push('Design', 'Design Revision');
    else if (displayStage === 'Development') internalStages.push('Dev');
    else if (displayStage === 'AI Team') internalStages.push('AI Team');
    else if (displayStage === 'Social Media Team') internalStages.push('Social Media Team');
    else if (displayStage === 'CRM') internalStages.push('CRM');
    else if (displayStage === 'SEO/GEO Team') internalStages.push('SEO/GEO Team');
    else if (displayStage === 'Onboarding') {
      internalStages.push('Onboarding', 'Intake');
      const knownStages = ['Copy', 'Copy Revision', 'Design', 'Design Revision', 'Dev', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close', 'Closed'];
      const allProjectStages = Array.from(new Set(localProjects.map((p: any) => p.stage)));
      allProjectStages.forEach((stage: string) => { if (!knownStages.includes(stage) && !internalStages.includes(stage)) internalStages.push(stage); });
    } else if (displayStage === 'Ready to Close') {
      internalStages.push('Ready to Close', 'Closed');
    } else {
      internalStages.push(displayStage);
    }
    return localProjects.filter((p) => doneFromColumnRef.current.get(p.id) !== displayStage && internalStages.includes(p.stage));
  };

  const getDaysInStage = (project: any) => Math.ceil(Math.abs(Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const getDaysSinceEmail = (project: any) => {
    if (!project.lastEmailedAt) return null;
    return Math.ceil(Math.abs(Date.now() - new Date(project.lastEmailedAt).getTime()) / (1000 * 60 * 60 * 24));
  };
  const isStuck = (project: any) => getDaysInStage(project) > 7;
  const isWaitingOnClient = (project: any) => {
    const d = getDaysSinceEmail(project);
    return d !== null && d > 5 && (project.stage === 'Copy Revision' || project.stage === 'Design Revision');
  };
  const isOverdue = (project: any) => getDaysInStage(project) > 3 && ['Onboarding', 'Copy', 'Design', 'Dev'].includes(project.stage);

  const mapDisplayStageToInternal = (displayStage: string, currentStage?: string): string => {
    if (displayStage === 'Copy Writing') return currentStage === 'Copy Revision' ? 'Copy Revision' : 'Copy';
    if (displayStage === 'Design') return currentStage === 'Design Revision' ? 'Design Revision' : 'Design';
    if (displayStage === 'Development') return 'Dev';
    if (displayStage === 'Onboarding') return 'Onboarding';
    return displayStage;
  };

  const STAGE_ORDER = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
  const getNextStageForDisplay = (displayStage: string) => {
    const idx = STAGE_ORDER.indexOf(displayStage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
    const nextDisplay = STAGE_ORDER[idx + 1];
    return { displayStage: nextDisplay, internalStage: mapDisplayStageToInternal(nextDisplay) };
  };

  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [, setExclusionVersion] = useState(0);

  const getTaskTypesForDisplayStage = (displayStage: string): string[] => {
    const map: Record<string, string[]> = {
      'Copy Writing': ['Copy'], 'Design': ['Design'], 'Development': ['Dev'],
      'AI Team': ['AI'], 'Social Media Team': ['Social Media'], 'CRM': ['CRM'],
      'SEO/GEO Team': ['SEO/GEO'], 'Onboarding': ['Onboarding'],
    };
    return map[displayStage] || [];
  };

  const handleMarkDone = async (projectId: string, fromDisplayStage: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenCardMenuId(null);
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) return;
    doneFromColumnRef.current.set(projectId, fromDisplayStage);
    flushSync(() => setExclusionVersion((v) => v + 1));
    const next = getNextStageForDisplay(fromDisplayStage);
    if (!next) {
      try {
        await projectService.close(projectId);
        pendingUpdatesRef.current.delete(projectId);
        manuallyDraggedRef.current.set(projectId, 'Closed');
        flushSync(() => setLocalProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, stage: 'Closed' } : p)));
        showToast('Project marked as complete ✓');
        onUpdate();
      } catch (err) {
        doneFromColumnRef.current.delete(projectId);
        showToast('Failed to mark complete. Please try again.');
      }
      return;
    }
    const taskTypes = getTaskTypesForDisplayStage(fromDisplayStage);
    if (taskTypes.length > 0 && tasks.length > 0) {
      const tasksToComplete = tasks.filter((t: any) => t.projectId === projectId && taskTypes.includes(t.type) && !t.isCompleted);
      try { await Promise.all(tasksToComplete.map((t: any) => taskService.updateStatus(t.id, 'Completed', true))); } catch {}
    }
    try { await handleStageChange(projectId, next.displayStage); } catch { doneFromColumnRef.current.delete(projectId); }
  };

  const handleStageChange = async (projectId: string, displayStage: string) => {
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) return;
    const previousStage = project.stage;
    const internalStage = mapDisplayStageToInternal(displayStage, project?.stage);
    manuallyDraggedRef.current.set(projectId, displayStage);
    const updatedProject = { ...project, stage: internalStage, updatedAt: new Date().toISOString() };
    pendingUpdatesRef.current.set(projectId, updatedProject);
    flushSync(() => setLocalProjects((prev) => [...prev.map((p) => p.id === projectId ? updatedProject : p)]));
    showToast(`Moved to ${displayStage} ✓`);
    try {
      await projectService.updateStage(projectId, internalStage);
      pendingUpdatesRef.current.delete(projectId);
      onUpdate();
    } catch (error) {
      pendingUpdatesRef.current.delete(projectId);
      setLocalProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, stage: previousStage } : p));
      showToast(`Failed to move to ${displayStage}. Please try again.`);
      throw error;
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProject(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', projectId);
  };
  const handleDragEnd = () => { setDraggedProject(null); setDragOverColumn(null); };
  const handleDragOver = (e: React.DragEvent, stage: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColumn(stage); };
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = async (e: React.DragEvent, targetDisplayStage: string) => {
    e.preventDefault();
    const projectId = draggedProject || e.dataTransfer.getData('text/html');
    if (!projectId) { setDragOverColumn(null); return; }
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) { setDragOverColumn(null); return; }
    if (mapStageToDisplay(project.stage) === targetDisplayStage) { setDragOverColumn(null); return; }
    setDragOverColumn(null);
    await handleStageChange(projectId, targetDisplayStage);
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => document.body.removeChild(toast), 300); }, 2000);
  };

  const getClientTypeColor = (clientType: string) => {
    switch (clientType) {
      case 'ICON': return '#d97706';
      case 'STAR': return '#7c3aed';
      case 'Katalyst': return '#2563eb';
      case 'Private': return '#64748b';
      case 'Premium': return '#7c3aed';
      case 'Powered-Up': return '#7c3aed';
      default: return '#64748b';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return '#dc2626';
      case 'High': return '#ea580c';
      case 'Medium': return '#d97706';
      default: return '#cbd5e1';
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && localProjects.length > 0) {
      console.log('Kanban projects:', localProjects.map((p: any) => ({ name: p.clientName, stage: p.stage })));
    }
  }, [localProjects]);

  const [scrollState, setScrollState] = useState({ isScrolledLeft: false, isScrolledRight: true });
  const kanbanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!kanbanRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = kanbanRef.current;
      setScrollState({ isScrolledLeft: scrollLeft > 10, isScrolledRight: scrollLeft < scrollWidth - clientWidth - 10 });
    };
    const el = kanbanRef.current;
    if (el) { el.addEventListener('scroll', handleScroll); handleScroll(); }
    return () => { if (el) el.removeEventListener('scroll', handleScroll); };
  }, [stages]);

  const scrollLeft = () => kanbanRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  const scrollRight = () => kanbanRef.current?.scrollBy({ left: 280, behavior: 'smooth' });

  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openCardMenuId && !(e.target as Element).closest('.kb-menu-wrapper')) setOpenCardMenuId(null);
    };
    if (openCardMenuId) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openCardMenuId]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="kb-wrapper">
        {/* Hint */}
        <div className="kb-hint">
          <span className="kb-hint-dot" />
          Click a card to view details · Drag to move between stages · Use ⋯ to mark done
        </div>

        {/* Scroll buttons */}
        {scrollState.isScrolledLeft && (
          <button className="kb-scroll-btn kb-scroll-left" onClick={scrollLeft} aria-label="Scroll left">
            <FaChevronLeft />
          </button>
        )}
        {scrollState.isScrolledRight && (
          <button className="kb-scroll-btn kb-scroll-right" onClick={scrollRight} aria-label="Scroll right">
            <FaChevronRight />
          </button>
        )}

        {/* Board */}
        <div className="kb-board" ref={kanbanRef}>
          <div className="kb-stages">
            {stages.map((stage) => {
              const stageProjects = getProjectsByStage(stage);
              const overdueCount = stageProjects.filter((p: any) => isOverdue(p)).length;
              const isDragOver = dragOverColumn === stage;

              return (
                <div
                  key={stage}
                  className={`kb-col${isDragOver ? ' drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  {/* Column header */}
                  <div className="kb-col-head">
                    <div className="kb-col-title-row">
                      <h3 className="kb-col-title">{stage}</h3>
                      <span className="kb-col-count">{stageProjects.length}</span>
                    </div>
                    {overdueCount > 0 && (
                      <span className="kb-sla-warn">
                        <FaExclamationTriangle style={{ fontSize: 9 }} />
                        {overdueCount} overdue
                      </span>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="kb-cards">
                    {stageProjects.length === 0 ? (
                      <div className="kb-empty-hint">Drop here</div>
                    ) : (
                      stageProjects.map((project, idx) => {
                        const daysInStage = getDaysInStage(project);
                        const daysSinceEmail = getDaysSinceEmail(project);
                        const isDragging = draggedProject === project.id;

                        return (
                          <div
                            key={project.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, project.id)}
                            onDragEnd={handleDragEnd}
                            onMouseEnter={(e) => {
                              setHoveredProject(project.id);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
                            }}
                            onMouseLeave={() => setHoveredProject(null)}
                            className={`kb-card${isStuck(project) ? ' stuck' : ''}${isWaitingOnClient(project) ? ' waiting-client' : ''}${isOverdue(project) ? ' overdue' : ''}${isDragging ? ' dragging' : ''}`}
                            style={{ animationDelay: `${idx * 0.04}s` }}
                            onClick={() => { if (!isDragging) navigate(`/project/${project.id}`); }}
                          >
                            {/* Top row */}
                            <div className="kb-card-top">
                              <h4 className="kb-card-name">{project.clientName}</h4>
                              <div className="kb-card-controls">
                                <div className="kb-menu-wrapper" style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    className="kb-menu-btn"
                                    onClick={(e) => { e.stopPropagation(); setOpenCardMenuId((prev) => prev === project.id ? null : project.id); }}
                                  >
                                    <FaEllipsisV size={11} />
                                  </button>
                                  {openCardMenuId === project.id && (
                                    <div className="kb-dropdown" onClick={(e) => e.stopPropagation()}>
                                      {(() => {
                                        const next = getNextStageForDisplay(stage);
                                        return (
                                          <button
                                            type="button"
                                            className="kb-dropdown-item"
                                            onClick={(e) => handleMarkDone(project.id, stage, e)}
                                          >
                                            <FaCheck size={10} />
                                            {next ? `Done → ${next.displayStage}` : 'Mark as complete'}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                                <div
                                  className="kb-priority-dot"
                                  style={{ backgroundColor: getPriorityColor(project.priority) }}
                                  title={project.priority}
                                />
                              </div>
                            </div>

                            {/* Badges */}
                            <div className="kb-card-badges">
                              <span className="kb-badge" style={{ backgroundColor: getClientTypeColor(project.clientType) }}>
                                {project.clientType}
                              </span>
                              {project.package && project.package !== 'Standard' && (
                                <span className="kb-badge-pkg">{project.package}</span>
                              )}
                            </div>

                            {/* Meta */}
                            <div className="kb-card-meta">
                              <div className="kb-meta-item">
                                <FaClock className="kb-meta-icon" />
                                {daysInStage}d in stage
                              </div>
                              {project.pm?.name && (
                                <div className="kb-meta-item">
                                  <FaUser className="kb-meta-icon" />
                                  {project.pm.name}
                                </div>
                              )}
                              {daysSinceEmail !== null && (
                                <div className="kb-meta-item">
                                  <FaEnvelope className="kb-meta-icon" />
                                  Emailed {daysSinceEmail}d ago
                                </div>
                              )}
                            </div>

                            {/* Signals */}
                            {(isWaitingOnClient(project) || isStuck(project) || isOverdue(project) || project.copyRevisionCount > 0 || project.designRevisionCount > 0) && (
                              <div className="kb-card-signals">
                                {isWaitingOnClient(project) && (
                                  <span className="kb-signal kb-signal-waiting"><FaEnvelope size={8} /> Waiting on client</span>
                                )}
                                {isStuck(project) && (
                                  <span className="kb-signal kb-signal-stuck"><FaExclamationTriangle size={8} /> Stuck</span>
                                )}
                                {isOverdue(project) && !isStuck(project) && (
                                  <span className="kb-signal kb-signal-overdue"><FaClock size={8} /> Overdue</span>
                                )}
                                {project.copyRevisionCount > 0 && (
                                  <span className="kb-signal kb-signal-rev">Copy Rev: {project.copyRevisionCount}</span>
                                )}
                                {project.designRevisionCount > 0 && (
                                  <span className="kb-signal kb-signal-rev">Design Rev: {project.designRevisionCount}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tooltip */}
        {hoveredProject && tooltipPosition.x > 0 && (
          <div
            className="kb-tooltip"
            style={{
              position: 'fixed',
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%) translateY(-100%)',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            Click to view project
          </div>
        )}
      </div>
    </>
  );
};

export default KanbanBoard;