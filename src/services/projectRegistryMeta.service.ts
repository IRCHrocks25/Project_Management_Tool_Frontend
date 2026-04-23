export type ProjectRegistryDeliverables = {
  logo: boolean;
  smb: boolean;
  bb: boolean;
  sk: boolean;
};

export type ProjectRegistryMeta = {
  where?: string;
  packageLabel?: string;
  comments?: string;
  pmPriority?: '' | 'Hot Potato' | 'Normal';
  startDate?: string;
  finishDate?: string;
  deliverables?: ProjectRegistryDeliverables;
};

type RegistryMap = Record<string, ProjectRegistryMeta>;

const STORAGE_KEY = 'pmt.projectRegistryMeta.v1';

const DEFAULT_DELIVERABLES: ProjectRegistryDeliverables = {
  logo: false,
  smb: false,
  bb: false,
  sk: false,
};

function safeParse(raw: string | null): RegistryMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readMap(): RegistryMap {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeMap(next: RegistryMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const projectRegistryMetaService = {
  getAll(): RegistryMap {
    return readMap();
  },

  get(projectId: string): ProjectRegistryMeta {
    const map = readMap();
    const hit = map[projectId] || {};
    return {
      ...hit,
      deliverables: {
        ...DEFAULT_DELIVERABLES,
        ...(hit.deliverables || {}),
      },
    };
  },

  upsert(projectId: string, patch: Partial<ProjectRegistryMeta>): ProjectRegistryMeta {
    const map = readMap();
    const current = map[projectId] || {};
    const merged: ProjectRegistryMeta = {
      ...current,
      ...patch,
      deliverables: {
        ...DEFAULT_DELIVERABLES,
        ...(current.deliverables || {}),
        ...(patch.deliverables || {}),
      },
    };
    map[projectId] = merged;
    writeMap(map);
    return merged;
  },
};

