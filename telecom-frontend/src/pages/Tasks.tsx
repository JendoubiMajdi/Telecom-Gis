import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AdminUser, fetchAdminUsers } from '../services/adminApi';
import {
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  SitePick,
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_LABELS,
  fetchTasks,
  fetchTask,
  createTask,
  updateTaskStatus,
  addTaskComment,
  reassignTask,
  deleteTask,
  searchTaskSites,
} from '../services/tasksApi';
import styles from './Tasks.module.css';

// ── helpers ────────────────────────────────────────────────────────────────────
type Flash = (type: 'ok' | 'error', text: string) => void;

interface NewTaskPrefill {
  title?: string;
  description?: string;
  siteId?: number;
  siteName?: string;
}

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.error || e?.message || fallback;

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isOverdue = (t: Task): boolean => !!t.dueDate && t.status !== 'done' && t.dueDate < todayStr();

const fmtDue = (due: string): string =>
  new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const fmtTime = (iso: string): string => new Date(iso).toLocaleString();

const initials = (name: string | null): string =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const sortTasks = (a: Task, b: Task): number => {
  const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (p !== 0) return p;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return b.createdAt.localeCompare(a.createdAt);
};

const priorityClass = (p: TaskPriority): string =>
  ({ low: styles.pLow, medium: styles.pMedium, high: styles.pHigh, critical: styles.pCritical }[p]);

// ── Task card (module level on purpose: components must not be defined inside others) ──
// It is a <div role="button"> instead of a <button> because Firefox cannot drag buttons.
interface TaskCardProps {
  task: Task;
  showAssignee: boolean;
  isDragging: boolean;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, showAssignee, isDragging, onOpen, onDragStart, onDragEnd }) => (
  <div
    role="button"
    tabIndex={0}
    draggable
    aria-label={`${task.title}. Press Enter to open, or drag it to another column to change its status.`}
    className={`${styles.card} ${priorityClass(task.priority)} ${isDragging ? styles.dragging : ''}`}
    onClick={() => onOpen(task.id)}
    onKeyDown={e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(task.id);
      }
    }}
    onDragStart={e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      onDragStart(task.id);
    }}
    onDragEnd={onDragEnd}
  >
    <div className={styles.cardTop}>
      <span className={`${styles.priority} ${priorityClass(task.priority)}`}>{PRIORITY_LABELS[task.priority]}</span>
      {isOverdue(task) && <span className={styles.overdue}>Overdue</span>}
    </div>
    <div className={styles.cardTitle}>{task.title}</div>
    {task.siteName && <div className={styles.cardSite}>📍 {task.siteName}</div>}
    <div className={styles.cardBottom}>
      {showAssignee ? (
        <span className={styles.assignee} title={task.assigneeEmail ?? ''}>
          <span className={styles.avatar}>{initials(task.assigneeName)}</span>
          {task.assigneeName ?? 'Unassigned'}
        </span>
      ) : (
        <span />
      )}
      <span className={styles.cardMeta}>
        {task.dueDate && <span className={isOverdue(task) ? styles.dueLate : ''}>🗓 {fmtDue(task.dueDate)}</span>}
        {task.commentCount > 0 && <span>💬 {task.commentCount}</span>}
      </span>
    </div>
  </div>
);

// ── Task detail (modal) ────────────────────────────────────────────────────────
interface TaskDetailProps {
  taskId: string;
  isAdmin: boolean;
  staff: AdminUser[];
  onClose: () => void;
  onChanged: (t: Task) => void;
  onDeleted: (id: string) => void;
  flash: Flash;
}

const TaskDetail: React.FC<TaskDetailProps> = ({ taskId, isAdmin, staff, onClose, onChanged, onDeleted, flash }) => {
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [reassignTo, setReassignTo] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchTask(taskId);
      setTask(data.task);
      setComments(data.comments);
    } catch (e) {
      flash('error', errMsg(e, 'Could not load this task'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, flash, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changeStatus = async (status: TaskStatus) => {
    if (!task || task.status === status) return;
    if (status === 'blocked' && note.trim().length < 3) {
      setFormError('Please explain what is blocking this task (write it in the note box).');
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const updated = await updateTaskStatus(task.id, status, note.trim() || undefined);
      setNote('');
      onChanged(updated);
      flash('ok', `Task moved to "${STATUS_LABELS[status]}"`);
      await load();
    } catch (e) {
      setFormError(errMsg(e, 'Could not change the status'));
    } finally {
      setBusy(false);
    }
  };

  const postComment = async () => {
    if (!task || !note.trim()) return;
    setFormError('');
    setBusy(true);
    try {
      setComments(await addTaskComment(task.id, note.trim()));
      setNote('');
      load();
    } catch (e) {
      setFormError(errMsg(e, 'Could not post the note'));
    } finally {
      setBusy(false);
    }
  };

  const doReassign = async () => {
    if (!task || !reassignTo) return;
    const target = staff.find(s => s.id === reassignTo);
    if (!window.confirm(`Reassign this task to ${target?.fullName ?? 'this user'}?`)) return;
    setBusy(true);
    try {
      const updated = await reassignTask(task.id, reassignTo);
      setReassignTo('');
      onChanged(updated);
      flash('ok', `Task reassigned to ${target?.fullName ?? 'the new assignee'}`);
      await load();
    } catch (e) {
      setFormError(errMsg(e, 'Could not reassign the task'));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!task) return;
    if (!window.confirm(`Delete the task "${task.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      onDeleted(task.id);
      flash('ok', 'Task deleted');
      onClose();
    } catch (e) {
      setFormError(errMsg(e, 'Could not delete the task'));
      setBusy(false);
    }
  };

  const allowedStatuses: TaskStatus[] = isAdmin ? STATUS_ORDER : ['in_progress', 'blocked', 'done'];

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Task details">
        {loading || !task ? (
          <div className={styles.modalLoading}>Loading task…</div>
        ) : (
          <>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalBadges}>
                  <span className={`${styles.priority} ${priorityClass(task.priority)}`}>{PRIORITY_LABELS[task.priority]}</span>
                  <span className={`${styles.statusBadge} ${styles[`s_${task.status}`]}`}>{STATUS_LABELS[task.status]}</span>
                  {isOverdue(task) && <span className={styles.overdue}>Overdue</span>}
                </div>
                <h2 className={styles.modalTitle}>{task.title}</h2>
              </div>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.metaGrid}>
                <div><span className={styles.metaLabel}>Assigned to</span>{task.assigneeName ?? '—'}</div>
                <div><span className={styles.metaLabel}>Created by</span>{task.createdByName ?? '—'}</div>
                <div><span className={styles.metaLabel}>Due date</span>{task.dueDate ? fmtDue(task.dueDate) : 'No due date'}</div>
                <div><span className={styles.metaLabel}>Created</span>{fmtTime(task.createdAt)}</div>
                {task.completedAt && <div><span className={styles.metaLabel}>Completed</span>{fmtTime(task.completedAt)}</div>}
                {task.siteName && (
                  <div>
                    <span className={styles.metaLabel}>Site</span>
                    <span>{task.siteName}</span>{' '}
                    {task.siteId && (
                      <button type="button" className={styles.linkBtn} onClick={() => navigate(`/map?site=${task.siteId}`)}>
                        Open on map →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {task.description && <p className={styles.description}>{task.description}</p>}

              {/* Status + note */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Update status</div>
                <div className={styles.statusRow}>
                  {allowedStatuses.map(s => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy || task.status === s}
                      className={`${styles.statusBtn} ${styles[`s_${s}`]} ${task.status === s ? styles.statusCurrent : ''}`}
                      onClick={() => changeStatus(s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Add a note (required when blocking a task)…"
                  value={note}
                  maxLength={500}
                  onChange={e => setNote(e.target.value)}
                />
                <div className={styles.noteActions}>
                  <button type="button" className={styles.btn} disabled={busy || !note.trim()} onClick={postComment}>
                    Post note only
                  </button>
                </div>
                {formError && <div className={styles.formError}>{formError}</div>}
              </div>

              {/* History */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>History &amp; notes</div>
                {comments.length === 0 ? (
                  <div className={styles.muted}>Nothing yet.</div>
                ) : (
                  <ul className={styles.timeline}>
                    {comments.map(c => (
                      <li key={c.id} className={c.kind === 'status' ? styles.tlStatus : styles.tlComment}>
                        <div className={styles.tlHead}>
                          <strong>{c.userName ?? 'Someone'}</strong>
                          <span className={styles.muted}>{fmtTime(c.createdAt)}</span>
                        </div>
                        <div className={styles.tlBody}>{c.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Admin tools */}
              {isAdmin && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Admin</div>
                  <div className={styles.adminRow}>
                    <select className={styles.input} value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                      <option value="">Reassign to…</option>
                      {staff.filter(s => s.id !== task.assigneeId).map(s => (
                        <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>
                      ))}
                    </select>
                    <button type="button" className={styles.btn} disabled={busy || !reassignTo} onClick={doReassign}>
                      Reassign
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={doDelete}>
                      Delete task
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── New task (modal) ───────────────────────────────────────────────────────────
interface NewTaskModalProps {
  staff: AdminUser[];
  prefill: NewTaskPrefill | null;
  onClose: () => void;
  onCreated: (t: Task) => void;
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ staff, prefill, onClose, onCreated }) => {
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [site, setSite] = useState<{ id: number; name: string } | null>(
    prefill?.siteId ? { id: prefill.siteId, name: prefill.siteName ?? `Site #${prefill.siteId}` } : null
  );
  const [siteQuery, setSiteQuery] = useState('');
  const [siteResults, setSiteResults] = useState<SitePick[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Site search (debounced)
  useEffect(() => {
    const q = siteQuery.trim();
    if (q.length < 2) {
      setSiteResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      searchTaskSites(q).then(setSiteResults).catch(() => setSiteResults([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [siteQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (title.trim().length < 3) { setError('Please give the task a title (at least 3 characters).'); return; }
    if (!assigneeId) { setError('Please choose who this task is assigned to.'); return; }
    setSaving(true);
    try {
      const created = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        siteId: site?.id ?? null,
        priority,
        assigneeId,
        dueDate: dueDate || null,
      });
      onCreated(created);
    } catch (err) {
      setError(errMsg(err, 'Could not create the task'));
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={styles.modal} onSubmit={submit} role="dialog" aria-modal="true" aria-label="New task">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>New task</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span>Title *</span>
            <input className={styles.input} value={title} maxLength={120} placeholder="e.g. Restore inactive cells on SFX2105"
                   onChange={e => setTitle(e.target.value)} autoFocus />
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea className={styles.textarea} rows={4} value={description} maxLength={2000}
                      placeholder="What exactly should be done?" onChange={e => setDescription(e.target.value)} />
          </label>

          <div className={styles.field}>
            <span>Site (optional)</span>
            {site ? (
              <div className={styles.sitePicked}>
                📍 {site.name}
                <button type="button" className={styles.linkBtn} onClick={() => setSite(null)}>change</button>
              </div>
            ) : (
              <div className={styles.siteSearch}>
                <input className={styles.input} value={siteQuery} placeholder="Search a site by name or region…"
                       onChange={e => setSiteQuery(e.target.value)} />
                {siteResults.length > 0 && (
                  <ul className={styles.siteResults}>
                    {siteResults.map(s => (
                      <li key={s.id}>
                        <button type="button" onClick={() => { setSite({ id: s.id, name: s.site_name }); setSiteQuery(''); setSiteResults([]); }}>
                          <strong>{s.site_name}</strong> <span className={styles.muted}>{s.region || 'no region'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className={styles.row3}>
            <label className={styles.field}>
              <span>Assign to *</span>
              <select className={styles.input} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Choose…</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.role})</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Priority</span>
              <select className={styles.input} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Due date</span>
              <input className={styles.input} type="date" value={dueDate} min={todayStr()} onChange={e => setDueDate(e.target.value)} />
            </label>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
              {saving ? 'Creating…' : 'Create & assign'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Block reason (asked when a card is dropped on "Blocked") ───────────────────
const BlockReasonModal: React.FC<{
  title: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}> = ({ title, onCancel, onConfirm }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 3) {
      setError('Please explain what is blocking this task.');
      return;
    }
    onConfirm(note.trim());
  };

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <form className={`${styles.modal} ${styles.modalSmall}`} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Why is it blocked?">
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalBadges}>
              <span className={`${styles.statusBadge} ${styles.s_blocked}`}>Blocked</span>
            </div>
            <h2 className={styles.modalTitle}>What is blocking this task?</h2>
            <div className={styles.muted}>{title}</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className={styles.modalBody}>
          <textarea
            className={styles.textarea}
            rows={3}
            autoFocus
            maxLength={500}
            placeholder="e.g. Waiting for roof access, spare part not delivered…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          {error && <div className={styles.formError}>{error}</div>}
          <div className={styles.formActions}>
            <button type="button" className={styles.btn} onClick={onCancel}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Mark as blocked</button>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────
const Tasks: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<NewTaskPrefill | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [blockDrop, setBlockDrop] = useState<Task | null>(null);

  const noticeTimer = useRef<number | undefined>(undefined);
  const flash: Flash = useCallback((type, text) => {
    setNotice({ type, text });
    // restart the timer, so an older message can never remove a newer one early
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setTasks(await fetchTasks());
    } catch (e) {
      if (!silent) flash('error', errMsg(e, 'Could not load tasks'));
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the board fresh (the 🔔 bell tells you when something happens)
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  // Admin: who can receive tasks
  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminUsers()
      .then(list => setStaff(list.filter(u => u.isActive && (u.role === 'operator' || u.role === 'admin'))))
      .catch(() => { /* the form will simply have no people to choose */ });
  }, [isAdmin]);

  // Deep link from a notification: /tasks?task=ID
  const taskParam = params.get('task');
  useEffect(() => {
    if (!taskParam) return;
    setOpenId(taskParam);
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  }, [taskParam, params, setParams]);

  // Coming from the map ("Create task" button): open the form pre-filled
  useEffect(() => {
    const draft = (location.state as { newTask?: NewTaskPrefill } | null)?.newTask;
    if (draft && isAdmin) {
      setPrefill(draft);
      setNewOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, isAdmin, navigate]);

  const closeDetail = useCallback(() => setOpenId(null), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.siteName ?? '').toLowerCase().includes(q) ||
        (t.assigneeName ?? '').toLowerCase().includes(q)
      );
    });
  }, [tasks, search, assigneeFilter]);

  const columns = useMemo(() => {
    const byStatus: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    visible.forEach(t => byStatus[t.status].push(t));
    STATUS_ORDER.forEach(s => byStatus[s].sort(sortTasks));
    return byStatus;
  }, [visible]);

  const stats = useMemo(() => ({
    open: tasks.filter(t => t.status !== 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  const replaceTask = (updated: Task) => setTasks(list => list.map(t => (t.id === updated.id ? updated : t)));

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  // Operators can move their tasks to In progress / Blocked / Done.
  // Only admins can move a task back to "To do" (same rule as the server).
  const canMoveTo = (status: TaskStatus): boolean => isAdmin || status !== 'todo';

  const moveTask = async (task: Task, status: TaskStatus, note?: string) => {
    // Optimistic: the card jumps immediately, and goes back if the server refuses.
    setTasks(list => list.map(t => (t.id === task.id ? { ...t, status } : t)));
    try {
      const updated = await updateTaskStatus(task.id, status, note);
      setTasks(list => list.map(t => (t.id === updated.id ? updated : t)));
      flash('ok', `"${task.title}" moved to ${STATUS_LABELS[status]}`);
    } catch (e) {
      setTasks(list => list.map(t => (t.id === task.id ? task : t)));
      flash('error', errMsg(e, 'Could not move the task'));
    }
  };

  const handleDrop = (status: TaskStatus) => {
    const task = tasks.find(t => t.id === draggingId);
    setDraggingId(null);
    setOverCol(null);
    if (!task || task.status === status || !canMoveTo(status)) return;
    if (status === 'blocked') {
      setBlockDrop(task);          // ask why first
      return;
    }
    void moveTask(task, status);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isAdmin ? 'Tasks' : 'My tasks'}</h1>
          <p className={styles.subtitle}>
            {isAdmin
              ? 'Assign work to operators and follow its progress.'
              : 'Work assigned to you. Update the status and leave a note when something changes.'}
          </p>
        </div>
        {isAdmin && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPrefill(null); setNewOpen(true); }}>
            ＋ New task
          </button>
        )}
      </div>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search tasks, sites, people…" value={search} onChange={e => setSearch(e.target.value)} />
        {isAdmin && (
          <select className={styles.input} value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
            <option value="all">Everyone</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        )}
        <div className={styles.stats}>
          <span><strong>{stats.open}</strong> open</span>
          <span className={stats.blocked ? styles.statWarn : ''}><strong>{stats.blocked}</strong> blocked</span>
          <span className={stats.overdue ? styles.statBad : ''}><strong>{stats.overdue}</strong> overdue</span>
        </div>
        <button className={styles.btn} onClick={() => load()}>↻ Refresh</button>
      </div>

      {!loading && tasks.length > 0 && (
        <div className={styles.hint}>
          💡 Drag a card to another column to change its status
          {isAdmin ? '.' : ' (In progress, Blocked or Done).'}
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          {isAdmin ? 'No tasks yet. Create the first one with “New task”.' : 'Nothing is assigned to you right now.'}
        </div>
      ) : (
        <div className={styles.board}>
          {STATUS_ORDER.map(s => (
            <section
              key={s}
              className={[
                styles.column,
                styles[`s_${s}`],
                draggingId ? (canMoveTo(s) ? styles.dropOk : styles.dropDeny) : '',
                overCol === s ? styles.dropOver : '',
              ].join(' ')}
              onDragOver={e => {
                if (!draggingId || !canMoveTo(s)) return;   // not allowed → browser shows the "no drop" cursor
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overCol !== s) setOverCol(s);
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => (c === s ? null : c));
              }}
              onDrop={e => {
                e.preventDefault();
                handleDrop(s);
              }}
            >
              <header className={`${styles.columnHeader} ${styles[`s_${s}`]}`}>
                <span>{STATUS_LABELS[s]}</span>
                {draggingId && !canMoveTo(s)
                  ? <span className={styles.lockHint}>🔒 admins only</span>
                  : <span className={styles.count}>{columns[s].length}</span>}
              </header>
              <div className={styles.columnBody}>
                {columns[s].length === 0 ? (
                  <div className={styles.columnEmpty}>—</div>
                ) : (
                  columns[s].map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      showAssignee={isAdmin}
                      isDragging={draggingId === t.id}
                      onOpen={setOpenId}
                      onDragStart={setDraggingId}
                      onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {openId && (
        <TaskDetail
          taskId={openId}
          isAdmin={isAdmin}
          staff={staff}
          onClose={closeDetail}
          onChanged={replaceTask}
          onDeleted={id => setTasks(list => list.filter(t => t.id !== id))}
          flash={flash}
        />
      )}

      {blockDrop && (
        <BlockReasonModal
          title={blockDrop.title}
          onCancel={() => setBlockDrop(null)}
          onConfirm={note => {
            const task = blockDrop;
            setBlockDrop(null);
            void moveTask(task, 'blocked', note);
          }}
        />
      )}

      {newOpen && (
        <NewTaskModal
          staff={staff}
          prefill={prefill}
          onClose={() => setNewOpen(false)}
          onCreated={t => {
            setNewOpen(false);
            setTasks(list => [t, ...list]);
            flash('ok', `Task assigned to ${t.assigneeName ?? 'the operator'} — they have been notified`);
          }}
        />
      )}
    </div>
  );
};

export default Tasks;