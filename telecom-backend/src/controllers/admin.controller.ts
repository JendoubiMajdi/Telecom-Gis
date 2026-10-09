import { Request, Response } from 'express';
import { AuthRequest } from '../models/AuthRequest';
import { getAuditLog, logAudit } from '../services/audit.service';
import { notifyUsers } from '../services/notification.service';
import {
  ROLES,
  Role,
  listUsers,
  getUserById,
  setUserRole,
  setUserActive,
  countActiveAdmins,
  getAdminSummary,
} from '../services/admin.service';

const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as string[]).includes(v);
const actorId = (req: Request): string => String((req as AuthRequest).userId);

// ── GET /api/admin/summary ─────────────────────────────────────────────────────
export const summaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getAdminSummary());
  } catch (err: any) {
    console.error('adminSummary error:', err);
    res.status(500).json({ error: 'Failed to load summary', detail: err?.message });
  }
};

// ── GET /api/admin/users ───────────────────────────────────────────────────────
export const listUsersHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await listUsers());
  } catch (err: any) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to load users', detail: err?.message });
  }
};

// ── PATCH /api/admin/users/:id/role   body: { role } ───────────────────────────
export const updateUserRoleHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { role } = req.body;

    if (!isRole(role)) {
      res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
      return;
    }
    if (id === actorId(req)) {
      res.status(400).json({ error: 'You cannot change your own role' });
      return;
    }

    const target = await getUserById(id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.role === role) {
      res.json({ message: 'No change', user: target });
      return;
    }
    if (target.role === 'admin' && target.isActive && (await countActiveAdmins()) <= 1) {
      res.status(400).json({ error: 'Cannot demote the last active administrator' });
      return;
    }

    const updated = await setUserRole(id, role);
    await logAudit(req, {
      action: 'user.role_change',
      entityType: 'user',
      entityId: id,
      details: { email: target.email, from: target.role, to: role },
    });

    await notifyUsers([id], {
      type: 'user.role_change',
      title: 'Your role was changed',
      message: `An administrator changed your role from ${target.role} to ${role}. Refresh the page to update your menu.`,
      link: null,
      entityType: 'user',
      entityId: id,
    });

    res.json({ message: 'Role updated', user: updated });
  } catch (err: any) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ error: 'Failed to update role', detail: err?.message });
  }
};

// ── PATCH /api/admin/users/:id/active   body: { active: boolean } ──────────────
export const updateUserActiveHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'active must be true or false' });
      return;
    }
    if (id === actorId(req)) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }

    const target = await getUserById(id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.isActive === active) {
      res.json({ message: 'No change', user: target });
      return;
    }
    if (!active && target.role === 'admin' && (await countActiveAdmins()) <= 1) {
      res.status(400).json({ error: 'Cannot deactivate the last active administrator' });
      return;
    }

    const updated = await setUserActive(id, active);
    await logAudit(req, {
      action: active ? 'user.activate' : 'user.deactivate',
      entityType: 'user',
      entityId: id,
      details: { email: target.email },
    });

    res.json({ message: active ? 'User activated' : 'User deactivated', user: updated });
  } catch (err: any) {
    console.error('updateUserActive error:', err);
    res.status(500).json({ error: 'Failed to update user', detail: err?.message });
  }
};

// ── GET /api/admin/audit?limit=50&offset=0&user=a@b.c&action=site ──────────────
export const auditLogHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const userEmail = (req.query.user as string) || undefined;
    const action    = (req.query.action as string) || undefined;

    const data = await getAuditLog({ limit, offset, userEmail, action });
    res.json({ ...data, limit, offset });
  } catch (err: any) {
    console.error('auditLog error:', err);
    res.status(500).json({ error: 'Failed to load audit log', detail: err?.message });
  }
};