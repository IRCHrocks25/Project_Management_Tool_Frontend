import { BoardProject, BoardDeliverable, BoardTask } from '../../services/boardView.service';

// Discriminated union for the recursive table model. The TanStack table
// treats each variant uniformly via `getSubRows`.

export interface ProjectRow {
  kind: 'project';
  data: BoardProject;
  subRows: TuesdayRow[];
}

export interface DeliverableRow {
  kind: 'deliverable';
  data: BoardDeliverable;
  projectId: string;
  subRows: TuesdayRow[];
}

export interface TaskRow {
  kind: 'task';
  data: BoardTask;
  projectId: string;
  deliverableId: string;
  subRows?: undefined;
}

export type TuesdayRow = ProjectRow | DeliverableRow | TaskRow;

export function buildRows(projects: BoardProject[]): TuesdayRow[] {
  return projects.map((p) => ({
    kind: 'project',
    data: p,
    subRows: p.deliverables.map((d) => ({
      kind: 'deliverable',
      data: d,
      projectId: p.id,
      subRows: d.tasks.map((t) => ({
        kind: 'task',
        data: t,
        projectId: p.id,
        deliverableId: d.id,
      } as TaskRow)),
    } as DeliverableRow)),
  } as ProjectRow));
}

// Stable TanStack row IDs. The synthetic '__unassigned__' deliverable
// repeats across projects, so we prefix with the project id to keep IDs
// unique across the tree.
export function rowId(row: TuesdayRow): string {
  if (row.kind === 'project') return `p:${row.data.id}`;
  if (row.kind === 'deliverable') return `d:${row.projectId}:${row.data.id}`;
  return `t:${row.data.id}`;
}

export function getRowSubRows(row: TuesdayRow): TuesdayRow[] | undefined {
  return row.kind === 'task' ? undefined : row.subRows;
}

// Count of orphan tasks under a project (tasks under the synthetic
// '__unassigned__' deliverable). Used by NameCell to surface the data
// quality issue at L1 without expansion.
export function unassignedCountFor(p: BoardProject): number {
  const bucket = p.deliverables.find((d) => d.id === '__unassigned__');
  return bucket ? bucket.tasks.length : 0;
}
