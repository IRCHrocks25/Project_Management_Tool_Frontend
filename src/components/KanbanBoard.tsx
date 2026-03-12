import React, { useState, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaEnvelope, FaExclamationTriangle, FaChevronLeft, FaChevronRight, FaUser, FaCheck, FaEllipsisV } from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';
import './KanbanBoard.css';

interface KanbanBoardProps {
  projects: any[];
  tasks?: any[]; // Optional: all tasks for multi-column view
  onUpdate: () => void;
  /** When true, show all department columns (for heads viewing PM dashboard) */
  showAllDepartments?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, tasks = [], onUpdate, showAllDepartments = false }) => {
  const navigate = useNavigate();
  const user = authService.getUser();
  
  // Local state for optimistic updates
  const [localProjects, setLocalProjects] = useState<any[]>(projects);
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map());
  // Track manually dragged projects (projectId -> targetStage) to show them even without tasks
  const manuallyDraggedRef = useRef<Map<string, string>>(new Map());
  // When "Done" is clicked, exclude project from source column until refetch (handles task-based columns)
  const doneFromColumnRef = useRef<Map<string, string>>(new Map());
  // Track previous projects to prevent infinite loops
  const previousProjectsRef = useRef<string>('');
  
  // Sync localProjects when projects prop changes, but preserve pending updates
  useEffect(() => {
    // Create a stable reference key from projects to detect actual changes
    const projectsKey = JSON.stringify(projects.map((p: any) => ({ id: p.id, stage: p.stage })));
    
    // Only update if projects actually changed (not just reference)
    if (projectsKey === previousProjectsRef.current) {
      return;
    }
    
    previousProjectsRef.current = projectsKey;
    // Clear done-from-column exclusions after refetch (data is fresh)
    doneFromColumnRef.current.clear();

    if (pendingUpdatesRef.current.size > 0) {
      // Merge server data with pending optimistic updates
      setLocalProjects((prevLocal) => {
        const updatedProjects = projects.map((p: any) => {
          // If this project has a pending update, use the optimistic version
          if (pendingUpdatesRef.current.has(p.id)) {
            return pendingUpdatesRef.current.get(p.id);
          }
          return p;
        });
        // Also include any pending projects that might not be in the server response yet
        pendingUpdatesRef.current.forEach((pendingProject, id) => {
          if (!updatedProjects.find((p: any) => p.id === id)) {
            updatedProjects.push(pendingProject);
          }
        });
        return updatedProjects;
      });
    } else {
      // No pending updates, just sync normally
      setLocalProjects(projects);
    }
  }, [projects]);
  
  // Define simplified stages per department
  const getStagesForRole = (role: string) => {
    switch (role) {
      case 'Project Manager':
      case 'FOUNDER/CEO':
        return ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
      case 'Copy Writing':
        return ['Copy Writing'];
      case 'Designer':
        return ['Design'];
      case 'Developer':
        return ['Development'];
      case 'AI Developer':
        return ['AI Team'];
      case 'Social Media':
        return ['Social Media Team'];
      case 'CRM':
        return ['CRM'];
      case 'SEO/GEO':
        return ['SEO/GEO Team'];
      default:
        return ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
    }
  };
  
  const stages = useMemo(() => {
    if (showAllDepartments) {
      return getStagesForRole('Project Manager');
    }
    return getStagesForRole(user?.role || 'Project Manager');
  }, [user?.role, showAllDepartments]);
  
  // Map internal stage names to display stages
  const mapStageToDisplay = (internalStage: string): string => {
    if (internalStage === 'Copy' || internalStage === 'Copy Revision') {
      return 'Copy Writing';
    }
    if (internalStage === 'Design' || internalStage === 'Design Revision') {
      return 'Design';
    }
    if (internalStage === 'Dev') {
      return 'Development';
    }
    if (internalStage === 'Intake') {
      return 'Onboarding';
    }
    if (internalStage === 'AI Team') {
      return 'AI Team';
    }
    if (internalStage === 'Social Media Team') {
      return 'Social Media Team';
    }
    if (internalStage === 'CRM') {
      return 'CRM';
    }
    if (internalStage === 'SEO/GEO Team') {
      return 'SEO/GEO Team';
    }
    return internalStage;
  };
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getProjectsByStage = (displayStage: string) => {
    // Use task-based filtering when tasks are provided (allows projects to appear in multiple columns)
    // This allows projects with tasks in different departments to appear across multiple columns
    // A project with Copy tasks appears in Copy Writing, Design tasks in Design, etc.
    // BUT always fall back to stage-based filtering to ensure projects show up even without tasks
    if (tasks && tasks.length > 0) {
      // Map display stage to task types
      const taskTypesForStage: string[] = [];
      if (displayStage === 'Copy Writing') {
        taskTypesForStage.push('Copy');
      } else if (displayStage === 'Design') {
        taskTypesForStage.push('Design');
      } else if (displayStage === 'Development') {
        taskTypesForStage.push('Dev');
      } else if (displayStage === 'AI Team') {
        taskTypesForStage.push('AI');
      } else if (displayStage === 'Social Media Team') {
        taskTypesForStage.push('Social Media');
      } else if (displayStage === 'CRM') {
        taskTypesForStage.push('CRM');
      } else if (displayStage === 'SEO/GEO Team') {
        taskTypesForStage.push('SEO/GEO');
      } else if (displayStage === 'Onboarding') {
        taskTypesForStage.push('Onboarding');
      }
      
      // For task-based columns, show projects with active (non-completed) tasks of that type
      // OR projects whose stage matches this column's stage (for manual stage changes)
      // This allows projects to appear in MULTIPLE columns if they have tasks of different types
      // AND also appear in a column if manually moved to that stage
      if (taskTypesForStage.length > 0) {
        // For task-based columns, show projects that have active tasks of that type
        // OR projects that were manually dragged to this column (even if they don't have tasks yet)
        const projectIdsWithActiveTasks = new Set(
          tasks
            .filter((t: any) => 
              taskTypesForStage.includes(t.type) && 
              !t.isCompleted &&
              (t.status !== 'Completed')
            )
            .map((t: any) => t.projectId)
        );
        
        // Map display stage to internal stages (for checking project stages)
        const internalStagesForColumn: string[] = [];
        if (displayStage === 'Copy Writing') {
          internalStagesForColumn.push('Copy', 'Copy Revision');
        } else if (displayStage === 'Design') {
          internalStagesForColumn.push('Design', 'Design Revision');
        } else if (displayStage === 'Development') {
          internalStagesForColumn.push('Dev');
        } else if (displayStage === 'AI Team') {
          internalStagesForColumn.push('AI Team');
        } else if (displayStage === 'Social Media Team') {
          internalStagesForColumn.push('Social Media Team');
        } else if (displayStage === 'CRM') {
          internalStagesForColumn.push('CRM');
        } else if (displayStage === 'SEO/GEO Team') {
          internalStagesForColumn.push('SEO/GEO Team');
        }
        
        // Return projects that have tasks of this type OR have a stage that matches this column
        // This ensures projects show up based on their stage even if they don't have tasks yet
        // For CRM column, also show projects with Katalyst client type (primary or secondary)
        const filtered = localProjects.filter((p: any) => {
          // Exclude projects that were just marked "Done" from this column (removes immediately)
          if (doneFromColumnRef.current.get(p.id) === displayStage) {
            return false;
          }
          // Show if it has tasks of this type
          if (projectIdsWithActiveTasks.has(p.id)) {
            return true;
          }
          
          // Show if project stage matches this column (primary way to show projects without tasks)
          // This is the KEY fallback - always check stage even when tasks are provided
          const stageMatches = internalStagesForColumn.length > 0 && internalStagesForColumn.includes(p.stage);
          if (stageMatches) {
            return true;
          }
          
          // Show if it was manually dragged to this column
          const wasManuallyDragged = manuallyDraggedRef.current.get(p.id) === displayStage;
          if (wasManuallyDragged) {
            return true;
          }
          
          // For CRM column, also show projects with Katalyst, Premium, or Powered-Up client type
          if (displayStage === 'CRM') {
            const allClientTypes = [
              p.clientType,
              ...(p.secondaryClientTypes 
                ? (Array.isArray(p.secondaryClientTypes) 
                    ? p.secondaryClientTypes 
                    : p.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t))
                : [])
            ];
            const hasKatalyst = allClientTypes.some((type: string) => 
              type === 'Katalyst' || type === 'KATALYST' || type?.toLowerCase() === 'katalyst'
            );
            // Include projects with Katalyst (primary or secondary), Premium, or Powered-Up
            if (hasKatalyst || p.clientType === 'Premium' || p.clientType === 'Powered-Up') {
              return true;
            }
          }
          
          return false;
        });
        
        // CRITICAL FALLBACK: If no projects found with task-based filtering, 
        // fall back to pure stage-based filtering to ensure projects always show up
        if (filtered.length === 0 && internalStagesForColumn.length > 0) {
          return localProjects.filter((p: any) =>
            doneFromColumnRef.current.get(p.id) !== displayStage && internalStagesForColumn.includes(p.stage)
          );
        }
        
        return filtered;
      }
      
      // For "Ready to Close" stage, use stage-based logic
      if (displayStage === 'Ready to Close') {
        return localProjects.filter((p) => 
          doneFromColumnRef.current.get(p.id) !== displayStage &&
          (p.stage === 'Ready to Close' || p.stage === 'Closed')
        );
      }
      
      // For Onboarding, combine task-based and stage-based logic
      if (displayStage === 'Onboarding') {
        // Get projects with Onboarding tasks
        const onboardingTaskProjects = new Set(
          tasks
            .filter((t: any) => 
              t.type === 'Onboarding' && 
              !t.isCompleted &&
              (t.status !== 'Completed')
            )
            .map((t: any) => t.projectId)
        );
        
        // Also include projects that are in Onboarding/Intake stage (even without tasks)
        const onboardingStageProjects = localProjects.filter((p) => 
          p.stage === 'Onboarding' || p.stage === 'Intake'
        );
        
        // Combine both: projects with onboarding tasks OR in onboarding stage
        const combined = new Set([
          ...Array.from(onboardingTaskProjects),
          ...onboardingStageProjects.map((p: any) => p.id)
        ]);
        
        return localProjects.filter((p) =>
          doneFromColumnRef.current.get(p.id) !== displayStage && combined.has(p.id)
        );
      }
    }
    
    // Fallback to original stage-based logic if no tasks provided
    const internalStages: string[] = [];
    if (displayStage === 'Copy Writing') {
      internalStages.push('Copy', 'Copy Revision');
    } else if (displayStage === 'Design') {
      internalStages.push('Design', 'Design Revision');
    } else if (displayStage === 'Development') {
      internalStages.push('Dev');
    } else if (displayStage === 'AI Team') {
      internalStages.push('AI Team');
    } else if (displayStage === 'Social Media Team') {
      internalStages.push('Social Media Team');
    } else if (displayStage === 'CRM') {
      internalStages.push('CRM');
    } else if (displayStage === 'SEO/GEO Team') {
      internalStages.push('SEO/GEO Team');
    } else if (displayStage === 'Onboarding') {
      internalStages.push('Onboarding', 'Intake');
      const knownStages = ['Copy', 'Copy Revision', 'Design', 'Design Revision', 'Dev', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close', 'Closed'];
      const allProjectStages = Array.from(new Set(localProjects.map((p: any) => p.stage)));
      allProjectStages.forEach((stage: string) => {
        if (!knownStages.includes(stage) && !internalStages.includes(stage)) {
          internalStages.push(stage);
        }
      });
    } else if (displayStage === 'Ready to Close') {
      internalStages.push('Ready to Close', 'Closed');
    } else {
      internalStages.push(displayStage);
    }
    
    const filtered = localProjects.filter((p) =>
      doneFromColumnRef.current.get(p.id) !== displayStage && internalStages.includes(p.stage)
    );
    return filtered;
  };

  const getDaysInStage = (project: any) => {
    const updatedAt = new Date(project.updatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysSinceEmail = (project: any) => {
    if (!project.lastEmailedAt) return null;
    const lastEmail = new Date(project.lastEmailedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastEmail.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isStuck = (project: any) => {
    const daysInStage = getDaysInStage(project);
    return daysInStage > 7;
  };

  const isWaitingOnClient = (project: any) => {
    const daysSinceEmail = getDaysSinceEmail(project);
    return daysSinceEmail !== null && daysSinceEmail > 5 && 
           (project.stage === 'Copy Revision' || project.stage === 'Design Revision');
  };

  const isOverdue = (project: any) => {
    const daysInStage = getDaysInStage(project);
    return daysInStage > 3 && ['Onboarding', 'Copy', 'Design', 'Dev'].includes(project.stage);
  };

  const mapDisplayStageToInternal = (displayStage: string, currentStage?: string): string => {
    // Map display stage names to internal stage names
    if (displayStage === 'Copy Writing') {
      // If already in Copy Revision, keep it; otherwise set to Copy
      return currentStage === 'Copy Revision' ? 'Copy Revision' : 'Copy';
    }
    if (displayStage === 'Design') {
      // If already in Design Revision, keep it; otherwise set to Design
      return currentStage === 'Design Revision' ? 'Design Revision' : 'Design';
    }
    if (displayStage === 'Development') {
      return 'Dev';
    }
    if (displayStage === 'Onboarding') {
      return 'Onboarding';
    }
    if (displayStage === 'AI Team') {
      return 'AI Team';
    }
    if (displayStage === 'Social Media Team') {
      return 'Social Media Team';
    }
    if (displayStage === 'CRM') {
      return 'CRM';
    }
    if (displayStage === 'SEO/GEO Team') {
      return 'SEO/GEO Team';
    }
    return displayStage;
  };

  // Stage progression: when "Done" is clicked, move to next column
  const STAGE_ORDER = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
  const getNextStageForDisplay = (displayStage: string): { displayStage: string; internalStage: string } | null => {
    const idx = STAGE_ORDER.indexOf(displayStage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
    const nextDisplay = STAGE_ORDER[idx + 1];
    const internalStage = mapDisplayStageToInternal(nextDisplay);
    return { displayStage: nextDisplay, internalStage };
  };

  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);
  const [, setExclusionVersion] = useState(0);

  const getTaskTypesForDisplayStage = (displayStage: string): string[] => {
    const map: Record<string, string[]> = {
      'Copy Writing': ['Copy'],
      'Design': ['Design'],
      'Development': ['Dev'],
      'AI Team': ['AI'],
      'Social Media Team': ['Social Media'],
      'CRM': ['CRM'],
      'SEO/GEO Team': ['SEO/GEO'],
      'Onboarding': ['Onboarding'],
    };
    return map[displayStage] || [];
  };

  const handleMarkDone = async (projectId: string, fromDisplayStage: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenCardMenuId(null);
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) return;

    // Exclude from source column immediately so card disappears
    doneFromColumnRef.current.set(projectId, fromDisplayStage);
    flushSync(() => setExclusionVersion((v) => v + 1));

    const next = getNextStageForDisplay(fromDisplayStage);
    if (!next) {
      // Ready to Close → mark project as Closed/Complete
      try {
        await projectService.close(projectId);
        pendingUpdatesRef.current.delete(projectId);
        manuallyDraggedRef.current.set(projectId, 'Closed');
        flushSync(() => {
          setLocalProjects((prev) =>
            prev.map((p) => (p.id === projectId ? { ...p, stage: 'Closed' } : p))
          );
        });
        showToast('Project marked as complete ✓');
        onUpdate();
      } catch (err) {
        console.error('Failed to close project:', err);
        doneFromColumnRef.current.delete(projectId);
        showToast('Failed to mark complete. Please try again.');
      }
      return;
    }

    // Complete tasks of this column's type so project stays removed after refetch
    const taskTypes = getTaskTypesForDisplayStage(fromDisplayStage);
    if (taskTypes.length > 0 && tasks.length > 0) {
      const tasksToComplete = tasks.filter(
        (t: any) => t.projectId === projectId && taskTypes.includes(t.type) && !t.isCompleted
      );
      try {
        await Promise.all(
          tasksToComplete.map((t: any) =>
            taskService.updateStatus(t.id, 'Completed', true)
          )
        );
      } catch (taskErr) {
        console.error('Failed to complete tasks:', taskErr);
        // Continue with stage change; doneFromColumnRef will hide until refetch
      }
    }

    try {
      await handleStageChange(projectId, next.displayStage);
    } catch {
      doneFromColumnRef.current.delete(projectId);
      throw new Error('Stage update failed');
    }
  };

  const handleStageChange = async (projectId: string, displayStage: string) => {
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) return;
    
    const previousStage = project.stage;
    const internalStage = mapDisplayStageToInternal(displayStage, project?.stage);
    
    // Track that this project was manually dragged to this stage
    manuallyDraggedRef.current.set(projectId, displayStage);
    
    // Create updated project object
    const updatedProject = { ...project, stage: internalStage, updatedAt: new Date().toISOString() };
    
    // Store in pending updates ref immediately
    pendingUpdatesRef.current.set(projectId, updatedProject);
    
    // Optimistic update: Update UI immediately using flushSync to force synchronous render
    flushSync(() => {
      setLocalProjects((prevProjects) => {
        const updated = prevProjects.map((p) =>
          p.id === projectId ? updatedProject : p
        );
        // Force immediate re-render by returning new array reference
        return [...updated];
      });
    });
    
    showToast(`Moved to ${displayStage} ✓`);
    
    // Then update backend
    try {
      console.log('[Kanban] Updating project stage:', { projectId, displayStage, internalStage });
      await projectService.updateStage(projectId, internalStage);
      console.log('[Kanban] Stage updated successfully');
      
      // Remove from pending updates after successful backend update
      pendingUpdatesRef.current.delete(projectId);
      
      // Refresh from server to ensure consistency
      onUpdate();
    } catch (error) {
      console.error('[Kanban] Failed to update stage:', error);
      
      // Remove from pending updates
      pendingUpdatesRef.current.delete(projectId);
      
      // Revert optimistic update on error
      setLocalProjects((prevProjects) =>
        prevProjects.map((p) =>
          p.id === projectId ? { ...p, stage: previousStage } : p
        )
      );
      showToast(`Failed to move to ${displayStage}. Please try again.`);
      throw error;
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProject(projectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', projectId);
    
    // Make the card semi-transparent while dragging
    const target = e.target as HTMLElement;
    if (target.classList.contains('premium-card')) {
      target.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('premium-card')) {
      target.style.opacity = '1';
    }
    setDraggedProject(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(stage);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDisplayStage: string) => {
    e.preventDefault();
    const projectId = draggedProject || e.dataTransfer.getData('text/html');
    
    if (!projectId) {
      setDragOverColumn(null);
      return;
    }

    const project = localProjects.find((p) => p.id === projectId);
    if (!project) {
      setDragOverColumn(null);
      return;
    }

    // Check if project is already in this display stage (considering revision stages)
    const currentDisplayStage = mapStageToDisplay(project.stage);
    if (currentDisplayStage === targetDisplayStage) {
      setDragOverColumn(null);
      return;
    }

    setDragOverColumn(null);
    // This will update the UI immediately via optimistic update
    await handleStageChange(projectId, targetDisplayStage);
  };

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  };

  const getClientTypeColor = (clientType: string) => {
    switch (clientType) {
      case 'ICON': return '#fbbf24'; // Gold
      case 'STAR': return '#a855f7'; // Purple
      case 'Katalyst': return '#667eea'; // Blue
      case 'Private': return '#64748b'; // Grey
      case 'Premium': return '#8b5cf6'; // Purple
      case 'Powered-Up': return '#a855f7'; // Purple
      default: return '#64748b'; // Grey
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return '#dc2626';
      case 'High': return '#ea580c';
      case 'Medium': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Debug: Log all projects and their stages (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && localProjects.length > 0) {
      console.log('All projects in KanbanBoard:', localProjects.map((p: any) => ({ 
        name: p.clientName, 
        stage: p.stage 
      })));
      console.log('Display stages:', stages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localProjects.length]); // Only depend on length to prevent excessive logging

  // Handle scroll indicators
  const [scrollState, setScrollState] = useState({ isScrolledLeft: false, isScrolledRight: true });
  const kanbanRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!kanbanRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = kanbanRef.current;
      const isScrolledLeft = scrollLeft > 10;
      const isScrolledRight = scrollLeft < scrollWidth - clientWidth - 10;
      
      setScrollState({ isScrolledLeft, isScrolledRight });
      
      // Update classes for fade effects
      if (isScrolledLeft) {
        kanbanRef.current.classList.add('scrolled-left');
      } else {
        kanbanRef.current.classList.remove('scrolled-left');
      }
      
      if (isScrolledRight) {
        kanbanRef.current.classList.add('scrolled-right');
      } else {
        kanbanRef.current.classList.remove('scrolled-right');
      }
    };

    const kanbanElement = kanbanRef.current;
    if (kanbanElement) {
      kanbanElement.addEventListener('scroll', handleScroll);
      handleScroll(); // Check initial state
    }

    return () => {
      if (kanbanElement) {
        kanbanElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [stages]);

  const scrollLeft = () => {
    if (kanbanRef.current) {
      kanbanRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (kanbanRef.current) {
      kanbanRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  // Close card menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openCardMenuId && !(e.target as Element).closest('.card-done-menu-wrapper')) {
        setOpenCardMenuId(null);
      }
    };
    if (openCardMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openCardMenuId]);

  return (
    <div className="kanban-board-wrapper">
      <div className="kanban-instructions">
        <span className="instruction-icon">💡</span>
        <span>Click on any project card to view details • Drag cards to move between stages • Use ⋯ menu to mark Done for this stage</span>
      </div>
      {scrollState.isScrolledLeft && (
        <button 
          className="kanban-scroll-button kanban-scroll-left" 
          onClick={scrollLeft}
          aria-label="Scroll left"
        >
          <FaChevronLeft />
        </button>
      )}
      <div className="kanban-board premium-kanban" ref={kanbanRef}>
        <div className="kanban-stages premium-stages">
        {stages.map((stage) => {
          const stageProjects = getProjectsByStage(stage);
          const overdueCount = stageProjects.filter((p: any) => isOverdue(p)).length;
          const isDragOver = dragOverColumn === stage;
          
          return (
            <div 
              key={stage} 
              className={`kanban-column premium-column ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="column-header premium-column-header">
                <div className="column-title-row">
                  <h3 className="column-title">{stage}</h3>
                  <span className="column-count premium-count">{stageProjects.length}</span>
                </div>
                {overdueCount > 0 && (
                  <span className="sla-warning">
                    ⚠️ {overdueCount} {overdueCount === 1 ? 'overdue' : 'overdue'}
                  </span>
                )}
              </div>
              <div className="column-cards premium-cards">
                {stageProjects.map((project) => {
                  const columnDisplayStage = stage;
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
                        setTooltipPosition({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10
                        });
                      }}
                      onMouseLeave={() => setHoveredProject(null)}
                      className={`kanban-card premium-card draggable ${isStuck(project) ? 'stuck' : ''} ${isWaitingOnClient(project) ? 'waiting-client' : ''} ${isOverdue(project) ? 'overdue' : ''} ${draggedProject === project.id ? 'dragging' : ''}`}
                      onClick={(e) => {
                        if (!isDragging) {
                          navigate(`/project/${project.id}`);
                        }
                      }}
                      title="Click to view project details"
                    >
                      {/* Top Row */}
                      <div className="card-top-row">
                        <h4 className="card-client-name">{project.clientName}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <div 
                            className="card-done-menu-wrapper"
                            style={{ position: 'relative' }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCardMenuId((prev) => (prev === project.id ? null : project.id));
                              }}
                              title="Mark done for this stage"
                              style={{
                                padding: '0.25rem',
                                border: 'none',
                                background: 'transparent',
                                color: '#64748b',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.color = '#475569';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#64748b';
                              }}
                            >
                              <FaEllipsisV size={12} />
                            </button>
                            {openCardMenuId === project.id && (
                              <div
                                className="card-done-dropdown"
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '0.25rem',
                                  background: 'white',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  border: '1px solid #e2e8f0',
                                  zIndex: 50,
                                  minWidth: '180px',
                                  overflow: 'hidden'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(() => {
                                  const next = getNextStageForDisplay(columnDisplayStage);
                                  return next ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleMarkDone(project.id, columnDisplayStage, e)}
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem 0.75rem',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#334155'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#f0fdf4';
                                        e.currentTarget.style.color = '#15803d';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#334155';
                                      }}
                                    >
                                      <FaCheck size={12} />
                                      Done → {next.displayStage}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => handleMarkDone(project.id, columnDisplayStage, e)}
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem 0.75rem',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: '#334155'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#f0fdf4';
                                        e.currentTarget.style.color = '#15803d';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#334155';
                                      }}
                                    >
                                      <FaCheck size={12} />
                                      Mark as complete
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          <div 
                            className="priority-dot"
                            style={{ backgroundColor: getPriorityColor(project.priority) }}
                            title={project.priority}
                          ></div>
                        </div>
                      </div>

                      {/* Second Row - Badges */}
                      <div className="card-badges-row">
                        <span
                          className="client-type-badge premium-badge"
                          style={{ backgroundColor: getClientTypeColor(project.clientType) }}
                        >
                          {project.clientType}
                        </span>
                        {project.package && project.package !== 'Standard' && (
                          <span className="package-badge premium-badge">
                            {project.package}
                          </span>
                        )}
                      </div>

                      {/* Third Row - Meta Info */}
                      <div className="card-meta-row">
                        <div className="meta-item">
                          <FaClock className="meta-icon" />
                          <span>{daysInStage} {daysInStage === 1 ? 'day' : 'days'} in stage</span>
                        </div>
                        {project.pm?.name && (
                          <div className="meta-item">
                            <FaUser className="meta-icon" />
                            <span>PM: {project.pm.name}</span>
                          </div>
                        )}
                        {daysSinceEmail !== null && (
                          <div className="meta-item">
                            <FaEnvelope className="meta-icon" />
                            <span>Last emailed: {daysSinceEmail}d ago</span>
                          </div>
                        )}
                      </div>

                      {/* Premium Signals Row */}
                      <div className="card-signals-row">
                        {isWaitingOnClient(project) && (
                          <span className="signal-badge waiting-signal">
                            <FaEnvelope /> Waiting on Client
                          </span>
                        )}
                        {isStuck(project) && (
                          <span className="signal-badge stuck-signal">
                            <FaExclamationTriangle /> Stuck
                          </span>
                        )}
                        {isOverdue(project) && !isStuck(project) && (
                          <span className="signal-badge overdue-signal">
                            <FaClock /> Overdue
                          </span>
                        )}
                        {project.copyRevisionCount > 0 && (
                          <span className="revision-badge premium-revision">
                            Copy Rev: {project.copyRevisionCount}
                          </span>
                        )}
                        {project.designRevisionCount > 0 && (
                          <span className="revision-badge premium-revision">
                            Design Rev: {project.designRevisionCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stageProjects.length === 0 && (
                  <div className="empty-column-hint">
                    Drop projects here
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      {scrollState.isScrolledRight && (
        <button 
          className="kanban-scroll-button kanban-scroll-right" 
          onClick={scrollRight}
          aria-label="Scroll right"
        >
          <FaChevronRight />
        </button>
      )}
      {hoveredProject && tooltipPosition.x > 0 && (
        <div 
          className="kanban-card-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          Click to view project
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
