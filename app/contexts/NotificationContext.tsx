import React, { createContext, useState, useCallback } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export const NotificationContext = createContext<{
  notifications: Notification[];
  showNotification: (message: string, type?: Notification['type'], duration?: number) => void;
  hideNotification: (id: string) => void;
}>({
  notifications: [],
  showNotification: () => {},
  hideNotification: () => {},
});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (message: string, type: Notification['type'] = 'info', duration = 3000) => {
      const id = String(Date.now());
      const notification: Notification = { id, message, type, duration };
      
      setNotifications((prev) => [...prev, notification]);
      
      if (duration > 0) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
      }
    },
    []
  );

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, hideNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
