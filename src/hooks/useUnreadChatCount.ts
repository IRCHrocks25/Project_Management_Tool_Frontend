import { useState, useEffect, useCallback } from 'react';
import { chatService } from '../services/chat.service';
import { authService } from '../services/auth.service';

/**
 * Hook to fetch and maintain unread chat message count.
 * Refreshes on mount, when receiving new messages from others, and when refresh() is called.
 */
export function useUnreadChatCount() {
  const [count, setCount] = useState(0);
  const currentUser = authService.getUser();

  const refresh = useCallback(async () => {
    try {
      const c = await chatService.getUnreadCount();
      setCount(c);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    chatService.connectSocket();
    const unsub = chatService.onNewMessage((msg) => {
      if (msg.senderId !== currentUser?.id) {
        refresh();
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [refresh, currentUser?.id]);

  return [count, refresh] as const;
}
