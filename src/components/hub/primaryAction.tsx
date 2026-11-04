/**
 * Primary header action for product tabs.
 *
 * The product page header shows one contextual primary button ("Post update", "Create ticket", …).
 * The active tab owns it: call `usePrimaryAction` inside the tab component and the header renders
 * the button; it disappears when the tab unmounts. Tabs keep the plain props
 * `{ product: ProductDetail; onChanged: () => void }`.
 *
 *   const [creating, setCreating] = useState(false);
 *   usePrimaryAction({ label: 'Create ticket', icon: 'plus', onClick: () => setCreating(true) });
 *   // render {creating && <CreateTicketModal … />} inside the tab
 *
 * Pass `null` to show no button (e.g. while the tab can't act). `disabled` + `title` are supported.
 * The latest `onClick` is always used, so inline closures are fine.
 */
import React, { createContext, useContext, useEffect, useRef } from 'react';
import type { IconName } from './ui/Icon';

export interface PrimaryAction {
  label: string;
  icon?: IconName;
  onClick: () => void;
  disabled?: boolean;
  /** Tooltip, e.g. why it is disabled. */
  title?: string;
}

type Setter = (action: PrimaryAction | null) => void;

export const PrimaryActionContext = createContext<Setter | null>(null);

export function usePrimaryAction(action: PrimaryAction | null) {
  const set = useContext(PrimaryActionContext);
  const clickRef = useRef<(() => void) | undefined>(action?.onClick);
  clickRef.current = action?.onClick;

  const label = action?.label;
  const icon = action?.icon;
  const disabled = action?.disabled;
  const title = action?.title;
  const present = !!action;

  useEffect(() => {
    if (!set) return;
    set(present ? { label: label || '', icon, disabled, title, onClick: () => clickRef.current?.() } : null);
  }, [set, present, label, icon, disabled, title]);

  useEffect(() => () => set?.(null), [set]);
}

export const PrimaryActionProvider: React.FC<{ value: Setter; children: React.ReactNode }> = ({ value, children }) => (
  <PrimaryActionContext.Provider value={value}>{children}</PrimaryActionContext.Provider>
);
