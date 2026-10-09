import api from './api';

// ── Types ──────────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'operator' | 'viewer';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminSummary {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<Role, number>;
  };
  activity: {
    last24h: number;
    last7d: number;
    topUsers: Array<{ email: string; actions: number }>;
  };
}

export interface AuditRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditPage {
  total: number;
  rows: AuditRow[];
  limit: number;
  offset: number;
}

// ── API calls (all admin-only on the server) ───────────────────────────────────
export const fetchAdminSummary = async (): Promise<AdminSummary> =>
  (await api.get('/admin/summary')).data;

export const fetchAdminUsers = async (): Promise<AdminUser[]> =>
  (await api.get('/admin/users')).data;

export const changeUserRole = async (id: string, role: Role): Promise<AdminUser> =>
  (await api.patch(`/admin/users/${id}/role`, { role })).data.user;

export const setUserActive = async (id: string, active: boolean): Promise<AdminUser> =>
  (await api.patch(`/admin/users/${id}/active`, { active })).data.user;

export const fetchAuditLog = async (params: {
  limit: number;
  offset: number;
  user?: string;
  action?: string;
}): Promise<AuditPage> => (await api.get('/admin/audit', { params })).data;