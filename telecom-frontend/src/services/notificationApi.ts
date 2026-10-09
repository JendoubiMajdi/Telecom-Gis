import api from './api';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  items: AppNotification[];
}

export const fetchNotifications = async (limit = 15): Promise<NotificationsResponse> =>
  (await api.get('/notifications', { params: { limit } })).data;

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch('/notifications/read-all');
};