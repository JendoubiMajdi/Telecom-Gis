import { Request, Response } from 'express';
import { AuthRequest } from '../models/AuthRequest';
import { logAudit } from '../services/audit.service';
import { notifyUsers } from '../services/notification.service';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  STATUS_LABELS,
  TaskPriority,
  TaskStatus,
  Task,
  UserBrief,
  getTaskById,
  listTasks,
  createTask,
  setTaskStatus,
  setTaskAssignee,
  deleteTask,
  addTaskComment,
  listTaskComments,
  getUserBrief,
  getSiteName,
  searchSites,
} from '../services/task.service';

// ── helpers ────────────────────────────────────────────────────────────────────
const isId = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v);

interface Actor { id: string; role: string; name: string }

const actorOf = async (req: Request): Promise<Actor> => {
  const r = req as AuthRequest;
  const id = String(r.userId);
  const brief = await getUserBrief(id);
  return { id, role: r.user?.role ?? 'viewer', name: brief?.fullName || brief?.email || r.user?.email || 'Someone' };
};

const personName = (u: { fullName?: string | null; email?: string | null } | null): string =>
  u?.fullName || u?.email || 'someone';

const canAccess = (task: Task, actor: Actor): boolean =>
  actor.role === 'admin' || task.assigneeId === actor.id;

const taskLink = (taskId: string): string => `/tasks?task=${taskId}`;

// An assignee must exist, be active, and be an operator or admin (viewers cannot do tasks).
const checkAssignee = async (id: unknown): Promise<{ user?: UserBrief; error?: string }> => {
  if ((typeof id !== 'string' && typeof id !== 'number') || !/^\d+$/.test(String(id))) {
    return { error: 'assigneeId is required' };
  }
  const user = await getUserBrief(String(id));
  if (!user) return { error: 'The selected user does not exist' };
  if (!user.isActive) return { error: 'The selected user is deactivated' };
  if (user.role !== 'operator' && user.role !== 'admin') {
    return { error: 'Tasks can only be assigned to operators or admins' };
  }
  return { user };
};

const fail = (res: Response, name: string, err: any): void => {
  console.error(`${name} error:`, err);
  res.status(500).json({ error: 'Internal server error', detail: err?.message });
};

// ── GET /api/tasks/sites?q=  (admin: site picker) ──────────────────────────────
export const searchSitesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    res.json(await searchSites(q));
  } catch (err) {
    fail(res, 'searchSites', err);
  }
};

// ── GET /api/tasks  (admin: all · operator: only their own) ────────────────────
export const listTasksHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = await actorOf(req);
    res.json(await listTasks(actor.role === 'admin' ? undefined : actor.id));
  } catch (err) {
    fail(res, 'listTasks', err);
  }
};

// ── GET /api/tasks/:id → { task, comments } ────────────────────────────────────
export const getTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!isId(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }

    const actor = await actorOf(req);
    const task = await getTaskById(id);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    if (!canAccess(task, actor)) { res.status(403).json({ error: 'This task is not assigned to you' }); return; }

    res.json({ task, comments: await listTaskComments(id) });
  } catch (err) {
    fail(res, 'getTask', err);
  }
};

// ── POST /api/tasks  (admin) ───────────────────────────────────────────────────
export const createTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, siteId, priority = 'medium', assigneeId, dueDate } = req.body;

    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      res.status(400).json({ error: 'Title must be between 3 and 120 characters' });
      return;
    }
    const cleanDesc = typeof description === 'string' && description.trim() ? description.trim() : null;
    if (cleanDesc && cleanDesc.length > 2000) {
      res.status(400).json({ error: 'Description is too long (max 2000 characters)' });
      return;
    }
    if (!TASK_PRIORITIES.includes(priority)) {
      res.status(400).json({ error: `priority must be one of: ${TASK_PRIORITIES.join(', ')}` });
      return;
    }
    let cleanDue: string | null = null;
    if (dueDate) {
      if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || isNaN(Date.parse(dueDate))) {
        res.status(400).json({ error: 'dueDate must look like YYYY-MM-DD' });
        return;
      }
      cleanDue = dueDate;
    }

    const { user: assignee, error } = await checkAssignee(assigneeId);
    if (!assignee) { res.status(400).json({ error }); return; }

    let siteName: string | null = null;
    let siteIdNum: number | null = null;
    if (siteId != null && siteId !== '') {
      siteIdNum = Number(siteId);
      if (!Number.isInteger(siteIdNum)) { res.status(400).json({ error: 'siteId must be a number' }); return; }
      siteName = await getSiteName(siteIdNum);
      if (!siteName) { res.status(400).json({ error: 'The selected site does not exist' }); return; }
    }

    const actor = await actorOf(req);
    const task = await createTask({
      title: cleanTitle,
      description: cleanDesc,
      siteId: siteIdNum,
      siteName,
      priority: priority as TaskPriority,
      assigneeId: assignee.id,
      createdBy: actor.id,
      dueDate: cleanDue,
    });

    await addTaskComment(task.id, actor.id, actor.name, 'status', `Task created and assigned to ${personName(assignee)}`);
    await logAudit(req, {
      action: 'task.create',
      entityType: 'task',
      entityId: task.id,
      details: { title: task.title, assignee: assignee.email, site_name: siteName, priority: task.priority },
    });

    if (assignee.id !== actor.id) {
      await notifyUsers([assignee.id], {
        type: 'task.assigned',
        title: 'New task assigned to you',
        message: `${actor.name} assigned you: "${task.title}"${siteName ? ` (${siteName})` : ''}${cleanDue ? ` — due ${cleanDue}` : ''}`,
        link: taskLink(task.id),
        entityType: 'task',
        entityId: task.id,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    fail(res, 'createTask', err);
  }
};

// ── PATCH /api/tasks/:id/status   body: { status, note? } ──────────────────────
export const updateStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!isId(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }

    const { status, note } = req.body;
    if (!TASK_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${TASK_STATUSES.join(', ')}` });
      return;
    }
    const next = status as TaskStatus;
    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (cleanNote.length > 500) { res.status(400).json({ error: 'Note is too long (max 500 characters)' }); return; }

    const actor = await actorOf(req);
    const task = await getTaskById(id);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    if (!canAccess(task, actor)) { res.status(403).json({ error: 'This task is not assigned to you' }); return; }

    if (actor.role !== 'admin' && next === 'todo') {
      res.status(400).json({ error: 'Only an admin can move a task back to "To do"' });
      return;
    }
    if (next === 'blocked' && cleanNote.length < 3) {
      res.status(400).json({ error: 'Please explain what is blocking this task' });
      return;
    }
    if (task.status === next) {
      res.json({ task, unchanged: true });
      return;
    }

    await setTaskStatus(id, next);
    await addTaskComment(
      id, actor.id, actor.name, 'status',
      `Status: ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[next]}${cleanNote ? ` — ${cleanNote}` : ''}`
    );
    await logAudit(req, {
      action: 'task.status',
      entityType: 'task',
      entityId: id,
      details: { title: task.title, from: task.status, to: next, note: cleanNote || null },
    });

    // Who should hear about it?
    const link = taskLink(id);
    if (actor.id === task.assigneeId) {
      // The operator reports back → tell the admin who created the task (done / blocked only)
      if ((next === 'done' || next === 'blocked') && task.createdById !== actor.id) {
        await notifyUsers([task.createdById], {
          type: next === 'done' ? 'task.done' : 'task.blocked',
          title: next === 'done' ? 'Task completed' : 'Task blocked',
          message: next === 'done'
            ? `${actor.name} completed "${task.title}"${cleanNote ? ` — ${cleanNote}` : ''}`
            : `${actor.name} is blocked on "${task.title}": ${cleanNote}`,
          link,
          entityType: 'task',
          entityId: id,
        });
      }
    } else {
      // An admin changed it → tell the assignee
      await notifyUsers([task.assigneeId], {
        type: 'task.updated',
        title: 'Task updated',
        message: `${actor.name} moved "${task.title}" to ${STATUS_LABELS[next]}${cleanNote ? ` — ${cleanNote}` : ''}`,
        link,
        entityType: 'task',
        entityId: id,
      });
    }

    res.json({ task: await getTaskById(id) });
  } catch (err) {
    fail(res, 'updateTaskStatus', err);
  }
};

// ── POST /api/tasks/:id/comments   body: { body } ──────────────────────────────
export const addCommentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!isId(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }

    const text = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (text.length < 1 || text.length > 1000) {
      res.status(400).json({ error: 'Comment must be between 1 and 1000 characters' });
      return;
    }

    const actor = await actorOf(req);
    const task = await getTaskById(id);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    if (!canAccess(task, actor)) { res.status(403).json({ error: 'This task is not assigned to you' }); return; }

    await addTaskComment(id, actor.id, actor.name, 'comment', text);

    // Tell the other side of the conversation
    const other = actor.id === task.assigneeId ? task.createdById : task.assigneeId;
    if (other && other !== actor.id) {
      await notifyUsers([other], {
        type: 'task.comment',
        title: 'New comment on a task',
        message: `${actor.name} on "${task.title}": ${text.length > 90 ? text.slice(0, 90) + '…' : text}`,
        link: taskLink(id),
        entityType: 'task',
        entityId: id,
      });
    }

    res.status(201).json({ comments: await listTaskComments(id) });
  } catch (err) {
    fail(res, 'addComment', err);
  }
};

// ── PATCH /api/tasks/:id/assignee   body: { assigneeId }  (admin) ──────────────
export const reassignHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!isId(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }

    const { user: next, error } = await checkAssignee(req.body.assigneeId);
    if (!next) { res.status(400).json({ error }); return; }

    const actor = await actorOf(req);
    const task = await getTaskById(id);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }
    if (task.assigneeId === next.id) { res.json({ task, unchanged: true }); return; }

    const previousId = task.assigneeId;
    await setTaskAssignee(id, next.id);
    await addTaskComment(id, actor.id, actor.name, 'status', `Reassigned from ${task.assigneeName ?? 'someone'} to ${personName(next)}`);
    await logAudit(req, {
      action: 'task.assign',
      entityType: 'task',
      entityId: id,
      details: { title: task.title, from: task.assigneeEmail, to: next.email },
    });

    if (next.id !== actor.id) {
      await notifyUsers([next.id], {
        type: 'task.assigned',
        title: 'New task assigned to you',
        message: `${actor.name} assigned you: "${task.title}"${task.siteName ? ` (${task.siteName})` : ''}`,
        link: taskLink(id),
        entityType: 'task',
        entityId: id,
      });
    }
    if (previousId !== actor.id) {
      await notifyUsers([previousId], {
        type: 'task.updated',
        title: 'Task reassigned',
        message: `"${task.title}" was reassigned to ${personName(next)}.`,
        link: null,
        entityType: 'task',
        entityId: id,
      });
    }

    res.json({ task: await getTaskById(id) });
  } catch (err) {
    fail(res, 'reassignTask', err);
  }
};

// ── DELETE /api/tasks/:id  (admin) ─────────────────────────────────────────────
export const deleteTaskHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!isId(id)) { res.status(400).json({ error: 'Invalid task id' }); return; }

    const actor = await actorOf(req);
    const task = await getTaskById(id);
    if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

    await deleteTask(id);
    await logAudit(req, {
      action: 'task.delete',
      entityType: 'task',
      entityId: id,
      details: { title: task.title, assignee: task.assigneeEmail },
    });

    if (task.assigneeId !== actor.id) {
      await notifyUsers([task.assigneeId], {
        type: 'task.cancelled',
        title: 'Task cancelled',
        message: `${actor.name} cancelled the task "${task.title}".`,
        link: null,
        entityType: 'task',
        entityId: id,
      });
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    fail(res, 'deleteTask', err);
  }
};