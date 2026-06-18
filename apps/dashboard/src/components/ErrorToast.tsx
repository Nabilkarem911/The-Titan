import { useEffect } from 'react';
import { onApiError, ApiError } from '../api/client';
import { useNotifications } from '../contexts/NotificationContext';

export default function ErrorToast() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    onApiError((err) => {
      if (err instanceof ApiError && err.status === 401) return;
      addNotification({
        title: 'API Error',
        message: err.message,
        type: 'error',
      });
    });
  }, [addNotification]);

  return null;
}
