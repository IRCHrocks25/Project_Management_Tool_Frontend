import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './BoardSwitch.css';

const TEAM_BOARD_PATH_KEY = 'boards.teamBoardPath';
const TEAM_VIEW_KEY = 'roleDashboard.viewMode';

const read = (key: string): string | null => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Without storage the switch still works; team members fall back to /dashboard.
  }
};

/** Where this person's team Board lives. PMs and founders only have one if they came from a department. */
function teamBoardPath(role: string | undefined): string | null {
  const remembered = read(TEAM_BOARD_PATH_KEY);
  if (remembered) return remembered;
  return role === 'Project Manager' || role === 'FOUNDER/CEO' ? null : '/dashboard';
}

interface Props {
  active: 'board' | 'boards';
  role?: string;
}

/** Moves between the team Board and the project Boards page. */
const BoardSwitch: React.FC<Props> = ({ active, role }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const backPath = active === 'boards' ? teamBoardPath(role) : null;
  if (active === 'boards' && !backPath) return null;

  const goToBoard = () => {
    if (active === 'board' || !backPath) return;
    write(TEAM_VIEW_KEY, 'kanban'); // Opens the team page on its Board section
    navigate(backPath);
  };
  const goToBoards = () => {
    if (active === 'boards') return;
    write(TEAM_BOARD_PATH_KEY, pathname);
    navigate('/boards');
  };

  return (
    <div className="board-switch" role="group" aria-label="Switch between Board and Boards">
      <button type="button" aria-pressed={active === 'board'} onClick={goToBoard}>Board</button>
      <button type="button" aria-pressed={active === 'boards'} onClick={goToBoards}>Boards</button>
    </div>
  );
};

export default BoardSwitch;
