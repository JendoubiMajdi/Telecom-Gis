import api from './api';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export interface Task {
  id: string;
  title: string;
  description: string | null;
  siteId: string | null;
  siteName: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  createdById: string;
  createdByName: string | null;
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  commentCount: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string | null;
  kind: 'comment' | 'status';
  body: string;
  createdAt: string;
}

export interface SitePick {
  id: number;
  site_name: string;
  region: string | null;
}

export interface NewTaskPayload {
  title: string;
  description?: string;
  siteId?: number | null;
  priority: TaskPriority;
  assigneeId: string;
  dueDate?: string | null;
}

export const fetchTasks = async (): Promise<Task[]> => (await api.get('/tasks')).data;

export const fetchTask = async (id: string): Promise<{ task: Task; comments: TaskComment[] }> =>
  (await api.get(`/tasks/${id}`)).data;

export const createTask = async (payload: NewTaskPayload): Promise<Task> =>
  (await api.post('/tasks', payload)).data;

export const updateTaskStatus = async (id: string, status: TaskStatus, note?: string): Promise<Task> =>
  (await api.patch(`/tasks/${id}/status`, { status, note })).data.task;

export const addTaskComment = async (id: string, body: string): Promise<TaskComment[]> =>
  (await api.post(`/tasks/${id}/comments`, { body })).data.comments;

export const reassignTask = async (id: string, assigneeId: string): Promise<Task> =>
  (await api.patch(`/tasks/${id}/assignee`, { assigneeId })).data.task;

export const deleteTask = async (id: string): Promise<void> => {
  await api.delete(`/tasks/${id}`);
};

export const searchTaskSites = async (q: string): Promise<SitePick[]> =>
  (await api.get('/tasks/sites', { params: { q } })).data;