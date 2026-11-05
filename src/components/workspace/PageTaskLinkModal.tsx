/** "Link to a task" from the slash menu: search tasks, pick one, and the page gets a link to it. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hubErrorMessage } from '../../services/hub.service';
import { TaskSearchResult, workspaceService } from '../../services/workspace.service';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';

const PageTaskLinkModal: React.FC<{ onPick: (task: TaskSearchResult) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TaskSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const term = q.trim();

  const search = useCallback(async (value: string) => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await workspaceService.searchTasks(value);
      if (mine === seq.current) setResults(rows);
    } catch (err) {
      if (mine === seq.current) setError(hubErrorMessage(err, "Couldn't search tasks."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!term) {
      seq.current++; // drop any answer still on its way
      setResults(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    const t = setTimeout(() => search(term), 250);
    return () => clearTimeout(t);
  }, [term, search]);

  return (
    <Modal title="Link to a task" description="The task's title is added to the page as a link." onClose={onClose}>
      <form
        className="ws-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (results && results.length) onPick(results[0]);
        }}
      >
        <div className="ws-search ws-search-full">
          <Icon name="search" />
          <input
            className="hub-inp"
            type="search"
            data-autofocus
            placeholder="Search tasks by title"
            aria-label="Search tasks by title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </form>
      <div className="ws-task-results" aria-busy={loading}>
        {error ? (
          <EmptyState icon="alert" title="Couldn't search" text={error} actionLabel="Try again" actionIcon="refresh" onAction={() => search(term)} />
        ) : !term ? (
          <p className="ws-task-hint">Type part of a task's title.</p>
        ) : results === null || (loading && !results.length) ? (
          <p className="ws-task-hint" role="status">
            <span className="hub-spin" /> Searching…
          </p>
        ) : !results.length ? (
          <p className="ws-task-hint">No tasks match "{term}".</p>
        ) : (
          results.map((task) => (
            <button key={task.id} type="button" className="ws-task-row" onClick={() => onPick(task)}>
              <b>{task.title}</b>
              <span>{task.projectName}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
};

export default PageTaskLinkModal;
