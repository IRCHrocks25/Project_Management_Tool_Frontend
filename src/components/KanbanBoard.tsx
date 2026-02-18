import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaClock, FaEnvelope, FaExclamationTriangle, FaCheckCircle, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { authService } from '../services/auth.service';
import './KanbanBoard.css';

interface KanbanBoardProps {
  projects: any[];
  tasks?: any[]; // Optional: all tasks for multi-column view
  onUpdate: () => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, tasks = [], onUpdate }) => {
  const navigate = useNavigate();
  const user = authService.getUser();
  
  // Local state for optimistic updates
  const [localProjects, setLocalProjects] = useState<any[]>(projects);
  
  // Sync localProjects when projects prop changes
  useEffect(() => {
    setLocalProjects(projects);
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
  
  const stages = getStagesForRole(user?.role || 'Project Manager');
  
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
  const [isDragging, setIsDragging] = useState(false);

  const getProjectsByStage = (displayStage: string) => {
    // If tasks are provided, show projects based on active tasks (multi-column view)
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
      if (taskTypesForStage.length > 0) {
        const projectIdsWithActiveTasks = new Set(
          tasks
            .filter((t: any) => 
              taskTypesForStage.includes(t.type) && 
              !t.isCompleted &&
              (t.status !== 'Completed')
            )
            .map((t: any) => t.projectId)
        );
        
        return localProjects.filter((p) => projectIdsWithActiveTasks.has(p.id));
      }
      
      // For "Ready to Close" and other special stages, use stage-based logic
      if (displayStage === 'Ready to Close') {
        return localProjects.filter((p) => 
          p.stage === 'Ready to Close' || p.stage === 'Closed'
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
    
    const filtered = localProjects.filter((p) => internalStages.includes(p.stage));
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

  const handleStageChange = async (projectId: string, displayStage: string) => {
    const project = localProjects.find((p) => p.id === projectId);
    if (!project) return;
    
    const previousStage = project.stage;
    const internalStage = mapDisplayStageToInternal(displayStage, project?.stage);
    
    // Optimistic update: Update UI immediately
    setLocalProjects((prevProjects) =>
      prevProjects.map((p) =>
        p.id === projectId ? { ...p, stage: internalStage, updatedAt: new Date().toISOString() } : p
      )
    );
    
    showToast(`Moved to ${displayStage} ✓`);
    
    // Then update backend
    try {
      console.log('[Kanban] Updating project stage:', { projectId, displayStage, internalStage });
      const updatedProject = await projectService.updateStage(projectId, internalStage);
      console.log('[Kanban] Stage updated successfully:', updatedProject);
      // Refresh from server to ensure consistency
      onUpdate();
    } catch (error) {
      console.error('[Kanban] Failed to update stage:', error);
      // Revert optimistic update on error
      setLocalProjects((prevProjects) =>
        prevProjects.map((p) =>
          p.id === projectId ? { ...p, stage: previousStage } : p
        )
      );
      showToast(`Failed to move to ${displayStage}. Please try again.`);
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setIsDragging(true);
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
    setIsDragging(false);
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

  // Debug: Log all projects and their stages
  useEffect(() => {
    if (localProjects.length > 0) {
      console.log('All projects in KanbanBoard:', localProjects.map((p: any) => ({ 
        name: p.clientName, 
        stage: p.stage 
      })));
      console.log('Display stages:', stages);
    }
  }, [localProjects, stages]);

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

  return (
    <div className="kanban-board-wrapper">
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
                  const daysInStage = getDaysInStage(project);
                  const daysSinceEmail = getDaysSinceEmail(project);
                  const isDragging = draggedProject === project.id;
                  
                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, project.id)}
                      onDragEnd={handleDragEnd}
                      className={`kanban-card premium-card draggable ${isStuck(project) ? 'stuck' : ''} ${isWaitingOnClient(project) ? 'waiting-client' : ''} ${isOverdue(project) ? 'overdue' : ''} ${draggedProject === project.id ? 'dragging' : ''}`}
                      onClick={(e) => {
                        if (!isDragging) {
                          navigate(`/project/${project.id}`);
                        }
                      }}
                    >
                      {/* Top Row */}
                      <div className="card-top-row">
                        <h4 className="card-client-name">{project.clientName}</h4>
                        <div 
                          className="priority-dot"
                          style={{ backgroundColor: getPriorityColor(project.priority) }}
                          title={project.priority}
                        ></div>
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
    </div>
  );
};

export default KanbanBoard;
