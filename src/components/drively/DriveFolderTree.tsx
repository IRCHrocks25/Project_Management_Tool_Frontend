/**
 * A lazy, collapsible folder tree for the Drively sidebar — the Google-Drive-style
 * "My Drive" outline. Each node loads its own sub-folders the first time it opens,
 * so we never fetch the whole tree up front. The folder you're currently in is
 * highlighted and its ancestors auto-expand.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriveItem, drivelyService } from '../../services/drively.service';
import Icon from '../hub/ui/Icon';
import FileIcon from './FileIcon';

/** One folder node. `depth` only drives the indent. */
const TreeNode: React.FC<{
  folder: DriveItem;
  depth: number;
  activeId?: string;
  expanded: Set<string>;
  childrenOf: Record<string, DriveItem[] | undefined>;
  loading: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  onDropItem: (itemId: string, folder: DriveItem) => void;
}> = ({ folder, depth, activeId, expanded, childrenOf, loading, onToggle, onNavigate, onDropItem }) => {
  const [dropOver, setDropOver] = useState(false);
  const isOpen = expanded.has(folder.id);
  const kids = childrenOf[folder.id];
  const isActive = activeId === folder.id;
  // We don't know if a folder has sub-folders until it's opened once, so always
  // offer the chevron; opening an empty one simply shows nothing.
  return (
    <li>
      <div
        className={`drv-tree-row${isActive ? ' drv-tree-on' : ''}${dropOver ? ' drv-tree-drop' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onDragOver={(e) => {
          if (folder.isOwner && e.dataTransfer.types.includes('application/x-drively-item')) {
            e.preventDefault();
            setDropOver(true);
          }
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('application/x-drively-item');
          setDropOver(false);
          if (id && folder.isOwner) {
            e.preventDefault();
            e.stopPropagation();
            onDropItem(id, folder);
          }
        }}
      >
        <button
          type="button"
          className={`drv-tree-twist${isOpen ? ' open' : ''}`}
          aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          aria-expanded={isOpen}
          onClick={() => onToggle(folder.id)}
        >
          <Icon name="chev" size={13} />
        </button>
        <button type="button" className="drv-tree-link" onClick={() => onNavigate(folder.id)} title={folder.name}>
          <FileIcon kind="folder" size={16} />
          <span>{folder.name}</span>
        </button>
      </div>
      {isOpen && (
        <ul className="drv-tree-kids">
          {loading.has(folder.id) && !kids && <li className="drv-tree-muted" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>Loading…</li>}
          {kids && kids.length === 0 && <li className="drv-tree-muted" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>No sub-folders</li>}
          {kids?.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              activeId={activeId}
              expanded={expanded}
              childrenOf={childrenOf}
              loading={loading}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onDropItem={onDropItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

/**
 * @param activeId        the folder currently open in the main view (highlighted)
 * @param activePath      ancestors of the active folder, so we can auto-expand to it
 * @param reloadKey       bump to refetch (e.g. after a folder is created/moved/renamed)
 * @param onMoveInto      move an item into a folder via drag-drop (reuses the page's handler)
 */
const DriveFolderTree: React.FC<{
  activeId?: string;
  activePath?: { id: string; name: string }[];
  reloadKey?: number;
  onMoveInto?: (itemId: string, folder: DriveItem) => void;
}> = ({ activeId, activePath, reloadKey, onMoveInto }) => {
  const navigate = useNavigate();
  const [roots, setRoots] = useState<DriveItem[] | null>(null);
  const [childrenOf, setChildrenOf] = useState<Record<string, DriveItem[] | undefined>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const loadedRef = useRef<Set<string>>(new Set());

  const onlyFolders = (items: DriveItem[]) => items.filter((i) => i.kind === 'folder');

  const loadRoots = useCallback(async () => {
    setError(false);
    try {
      setRoots(onlyFolders(await drivelyService.list({ view: 'mine' })));
    } catch {
      setError(true);
      setRoots([]);
    }
  }, []);

  const loadChildren = useCallback(async (id: string) => {
    if (loadedRef.current.has(id)) return;
    loadedRef.current.add(id);
    setLoading((s) => new Set(s).add(id));
    try {
      const kids = onlyFolders(await drivelyService.list({ view: 'mine', parentId: id }));
      setChildrenOf((c) => ({ ...c, [id]: kids }));
    } catch {
      loadedRef.current.delete(id); // let it retry next open
    } finally {
      setLoading((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Refetch roots, and drop cached children, whenever the tree is told to reload.
  useEffect(() => {
    loadedRef.current = new Set();
    setChildrenOf({});
    loadRoots();
  }, [loadRoots, reloadKey]);

  // Auto-expand down to the folder you're viewing so it's visible in the tree.
  useEffect(() => {
    const ids = [...(activePath?.map((p) => p.id) || []), ...(activeId ? [activeId] : [])];
    if (ids.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    ids.forEach((id) => void loadChildren(id));
  }, [activeId, activePath, loadChildren]);

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        void loadChildren(id);
      }
      return next;
    });
  };

  const onNavigate = (id: string) => navigate(`/drively/folders/${id}`);

  if (roots === null) return <div className="drv-tree-muted drv-tree-pad">Loading folders…</div>;
  if (error) {
    return (
      <div className="drv-tree-pad">
        <button type="button" className="drv-tree-muted drv-tree-retry" onClick={loadRoots}>Couldn't load folders — retry</button>
      </div>
    );
  }
  if (roots.length === 0) return <div className="drv-tree-muted drv-tree-pad">No folders yet</div>;

  return (
    <ul className="drv-tree" aria-label="Folder tree">
      {roots.map((folder) => (
        <TreeNode
          key={folder.id}
          folder={folder}
          depth={0}
          activeId={activeId}
          expanded={expanded}
          childrenOf={childrenOf}
          loading={loading}
          onToggle={onToggle}
          onNavigate={onNavigate}
          onDropItem={onMoveInto || (() => undefined)}
        />
      ))}
    </ul>
  );
};

export default DriveFolderTree;
