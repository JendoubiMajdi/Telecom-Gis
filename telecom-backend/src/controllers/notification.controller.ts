import { Request, Response } from 'express';
import { AuthRequest } from '../models/AuthRequest';
import { listForUser, markRead, markAllRead } from '../services/notification.service';

const me = (req: Request): string => String((req as AuthRequest).userId);

// ── GET /api/notifications?limit=15 → { unreadCount, items } ───────────────────
export const listNotificationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 15, 1), 50);
    res.json(await listForUser(me(req), limit));
  } catch (err: any) {
    console.error('listNotifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications', detail: err?.message });
  }
};

// ── PATCH /api/notifications/:id/read ──────────────────────────────────────────
export const markReadHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!/^\d+$/.test(id)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }
    const ok = await markRead(id, me(req));
    if (!ok) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Marked as read' });
  } catch (err: any) {
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Failed to update notification', detail: err?.message });
  }
};

// ── PATCH /api/notifications/read-all ──────────────────────────────────────────
export const markAllReadHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await markAllRead(me(req));
    res.json({ message: 'All marked as read', updated });
  } catch (err: any) {
    console.error('markAllRead error:', err);
    res.status(500).json({ error: 'Failed to update notifications', detail: err?.message });
  }
};