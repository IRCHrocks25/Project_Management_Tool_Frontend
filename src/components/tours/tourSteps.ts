import { DriveStep } from 'driver.js';

const step = (element: string | undefined, title: string, description: string, side?: 'left' | 'right' | 'top' | 'bottom'): DriveStep => ({
  ...(element ? { element } : {}),
  popover: { title, description, ...(side ? { side } : {}) },
});

const assistantStep = step(
  '.aw-trigger',
  "Can't find something? Just ask",
  'Ask the assistant things like "where are the email logs?" or "who is the PM for this client?" It can take you to the page or do the job for you.',
  'left',
);
const replayStep = step(
  '[data-tour="replay"]',
  'See this again anytime',
  'Press Take a tour whenever you want a reminder of where things are.',
  'right',
);

/** Project Managers, Head PMs, team leads and Founders. Steps for things a role doesn't have are skipped. */
export const PM_TOUR_STEPS: DriveStep[] = [
  step(undefined, 'Welcome to the new layout', 'Nothing has been removed. Everything you used is still here, and this quick tour shows you where it moved.'),
  step('.app-sidebar-toggle', 'Your menu is here', 'On a phone, all the pages are inside this menu, including Kanban, Task inbox and All projects.', 'bottom'),
  step('.fa-root', 'Company analytics', 'Founders see company numbers first: task completion, project health and PM performance.', 'bottom'),
  step('.pm-metrics', 'Your key numbers', 'Total projects, tasks due today and waiting on client are still here, now with overdue tasks too. Click one to go to those items.', 'bottom'),
  step('.pm-overview-grid > :first-child', 'Your action queue', 'New: tasks that need a decision from you, most urgent first. Click one to deal with it.', 'top'),
  step('#pm-alerts', 'Alerts & Reminders', 'Due alerts, overdue tasks and monthly reminders now live on Overview. The bar at the top of every page tells you when something needs attention.', 'top'),
  step('[data-tour="nav-pipeline"]', 'Project pipeline', "New: see each client's work by department, with its next task, owner and due date.", 'right'),
  step('[data-tour="nav-kanban"]', 'Looking for Kanban?', 'It used to be a tab at the top. It is now here, and works exactly the same, including dragging projects between stages.', 'right'),
  step('[data-tour="nav-tasks"]', 'Looking for the Tasks tab?', 'It is now called Task inbox. All your filters and inline edits are still there.', 'right'),
  step('[data-tour="nav-approvals"]', 'Approvals', 'New: work under review in every department. Open a task to complete it or request changes.', 'right'),
  step('[data-tour="nav-list"]', 'Looking for the List tab?', 'It is now called All projects. Log Email, Mark Complete, Archive and PM changes are all still in there.', 'right'),
  step('[data-tour="nav-workload"]', 'Team workload', 'New: open and overdue tasks per person. Click someone to see their tasks.', 'right'),
  step('[data-tour="nav-activity"]', 'Activity', 'Your recent activity, plus shortcuts to the PM activity log, department activity log and completed projects.', 'right'),
  step('.pm-tuesday', 'Tuesday is still here', 'The hierarchy view is one click away, right where it was at the top.', 'bottom'),
  step('.avatar-button', 'Your account menu', 'Clients, Users, Completed Projects, Forum, Submit Ticket and the activity logs are all still in this menu.', 'bottom'),
  assistantStep,
  replayStep,
];

/** Department teams: Copy, Design, Dev, AI, Social, CRM and SEO/GEO. */
export const DEPARTMENT_TOUR_STEPS: DriveStep[] = [
  step(undefined, 'Welcome to the new layout', 'Nothing has been removed. All your tasks and actions are still here, and this quick tour shows you where they moved.'),
  step('.app-sidebar-toggle', 'Your menu is here', 'On a phone, My work, Board, Approvals and your other pages are inside this menu.', 'bottom'),
  step('.rd-stats', 'Your team at a glance', 'See what is waiting for approval, needs changes, is in progress or is done. Click a number to see those tasks.', 'bottom'),
  step('[data-tour="queue"]', 'Your work queue', 'All open work in one list. Click a task to see its details, what happens next, and buttons like Claim, Start and Send for review.', 'top'),
  step('[data-tour="view-switch"]', 'Prefer the Kanban board?', 'Switch to Board here and your columns are all there, including drag and drop. We remember your choice.', 'bottom'),
  step('[data-tour="nav-my"]', 'My work', 'Only the tasks assigned to you.', 'right'),
  step('[data-tour="nav-approvals"]', 'Approvals', "Your team's work that is waiting for a decision.", 'right'),
  step('[data-tour="nav-team"]', 'Team', 'See who is working on what, and click someone to see their tasks.', 'right'),
  step('.rd-rail', 'Priorities and deadlines', "Today's priorities, overdue and due-soon tasks, and how work is spread across stages.", 'left'),
  step('[data-tour="new-task"]', 'New task', 'Adding a task now lives here, at the top of every page.', 'bottom'),
  step('[data-tour="nav-timeline"]', 'Your other pages', 'My Timeline, My Projects, Forum and the rest are all in this menu.', 'right'),
  step('.rd-avatar-btn', 'Your account menu', 'Profile, Submit ticket and Log out are in here.', 'bottom'),
  assistantStep,
  replayStep,
];
