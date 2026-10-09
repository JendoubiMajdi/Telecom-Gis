import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AdminSummary,
  AdminUser,
  AuditPage,
  AuditRow,
  Role,
  fetchAdminSummary,
  fetchAdminUsers,
  changeUserRole,
  setUserActive,
  fetchAuditLog,
} from '../services/adminApi';
import styles from './AdminDashboard.module.css';

type Tab = 'users' | 'activity';

const ROLES: Role[] = ['admin', 'operator', 'viewer'];
const PAGE_SIZE = 20;

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.error || e?.message || fallback;

const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '—');

const show = (v: unknown): string => (v === null || v === undefined || v === '' ? '∅' : String(v));

// Human-readable label + colour class for each audit action
const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  'site.create':      { label: 'Site created',     cls: 'actionCreate' },
  'site.update':      { label: 'Site updated',     cls: 'actionUpdate' },
  'site.delete':      { label: 'Site deleted',     cls: 'actionDelete' },
  'user.role_change': { label: 'Role changed',     cls: 'actionUser' },
  'user.activate':    { label: 'User activated',   cls: 'actionCreate' },
  'user.deactivate':  { label: 'User deactivated', cls: 'actionDelete' },
  'task.create':      { label: 'Task created',     cls: 'actionCreate' },
  'task.status':      { label: 'Task status',      cls: 'actionUpdate' },
  'task.assign':      { label: 'Task reassigned',  cls: 'actionUser' },
  'task.delete':      { label: 'Task deleted',     cls: 'actionDelete' },
};

const describe = (row: AuditRow): string => {
  const d = row.details ?? {};
  switch (row.action) {
    case 'site.create':
      return `${d.site_name ?? ''} · ${d.technology ?? ''} · ${d.region || 'no region'}`;
    case 'site.update': {
      const changes = (d.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
      const parts = Object.entries(changes).map(([k, v]) => `${k}: ${show(v.from)} → ${show(v.to)}`);
      return `${d.site_name ?? 'Site'} — ${parts.length ? parts.join(', ') : 'no field changed'}`;
    }
    case 'site.delete':
      return `${d.site_name ?? ''} (${d.cells_deleted ?? 0} cells removed)`;
    case 'user.role_change':
      return `${d.email ?? ''}: ${d.from} → ${d.to}`;
    case 'user.activate':
    case 'user.deactivate':
      return `${d.email ?? ''}`;
    case 'task.create':
      return `${d.title ?? ''} → ${d.assignee ?? ''}${d.site_name ? ` · ${d.site_name}` : ''}`;
    case 'task.status':
      return `${d.title ?? ''}: ${d.from} → ${d.to}${d.note ? ` — ${d.note}` : ''}`;
    case 'task.assign':
      return `${d.title ?? ''}: ${d.from ?? '?'} → ${d.to ?? '?'}`;
    case 'task.delete':
      return `${d.title ?? ''} (was assigned to ${d.assignee ?? '?'})`;
    default:
      return Object.keys(d).length ? JSON.stringify(d) : '';
  }
};

const AdminDashboard: React.FC = () => {
  const { user: me } = useAuth();

  const [tab, setTab] = useState<Tab>('users');
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // ── Summary + users ──────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── Activity log ─────────────────────────────────────────────────────────────
  const [audit, setAudit] = useState<AuditPage | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [userInput, setUserInput] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const flash = useCallback((type: 'ok' | 'error', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchAdminSummary());
    } catch (e) {
      flash('error', errMsg(e, 'Failed to load summary'));
    }
  }, [flash]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      setUsers(await fetchAdminUsers());
    } catch (e) {
      flash('error', errMsg(e, 'Failed to load users'));
    } finally {
      setUsersLoading(false);
    }
  }, [flash]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      setAudit(
        await fetchAuditLog({
          limit: PAGE_SIZE,
          offset,
          action: actionFilter || undefined,
          user: userFilter || undefined,
        })
      );
    } catch (e) {
      flash('error', errMsg(e, 'Failed to load activity log'));
    } finally {
      setAuditLoading(false);
    }
  }, [offset, actionFilter, userFilter, flash]);

  useEffect(() => {
    loadSummary();
    loadUsers();
  }, [loadSummary, loadUsers]);

  useEffect(() => {
    if (tab === 'activity') loadAudit();
  }, [tab, loadAudit]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const replaceUser = (updated: AdminUser) =>
    setUsers(list => list.map(u => (u.id === updated.id ? updated : u)));

  const handleRoleChange = async (u: AdminUser, role: Role) => {
    if (role === u.role) return;
    if (!window.confirm(`Change ${u.email} from "${u.role}" to "${role}"?`)) return;
    setBusyId(u.id);
    try {
      replaceUser(await changeUserRole(u.id, role));
      flash('ok', `${u.email} is now ${role}`);
      loadSummary();
    } catch (e) {
      flash('error', errMsg(e, 'Could not change role'));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (u: AdminUser) => {
    const next = !u.isActive;
    const question = next
      ? `Re-activate ${u.email}?`
      : `Deactivate ${u.email}? They will be signed out and cannot log in until re-activated.`;
    if (!window.confirm(question)) return;
    setBusyId(u.id);
    try {
      replaceUser(await setUserActive(u.id, next));
      flash('ok', `${u.email} ${next ? 'activated' : 'deactivated'}`);
      loadSummary();
    } catch (e) {
      flash('error', errMsg(e, 'Could not update user'));
    } finally {
      setBusyId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q));
  }, [users, search]);

  const applyUserFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setUserFilter(userInput.trim());
  };

  const total = audit?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Administration</h1>
        <p className={styles.subtitle}>Manage users and roles, and review everything that changed in the network.</p>
      </div>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</div>}

      {/* Summary cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>Users</div>
          <div className={styles.cardValue}>{summary?.users.total ?? '…'}</div>
          <div className={styles.cardSub}>
            {summary ? `${summary.users.active} active · ${summary.users.inactive} deactivated` : ' '}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Roles</div>
          <div className={styles.chips}>
            {ROLES.map(r => (
              <span key={r} className={styles.chip}>
                {r} <strong>{summary?.users.byRole[r] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Activity (last 24 h)</div>
          <div className={styles.cardValue}>{summary?.activity.last24h ?? '…'}</div>
          <div className={styles.cardSub}>{summary ? `${summary.activity.last7d} in the last 7 days` : ' '}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Most active (7 days)</div>
          {summary && summary.activity.topUsers.length > 0 ? (
            <ul className={styles.topList}>
              {summary.activity.topUsers.slice(0, 3).map(t => (
                <li key={t.email}>
                  <span>{t.email}</span>
                  <strong>{t.actions}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.cardSub}>No activity yet</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`}
          onClick={() => setTab('users')}
        >
          👥 Users
        </button>
        <button
          className={`${styles.tab} ${tab === 'activity' ? styles.tabActive : ''}`}
          onClick={() => setTab('activity')}
        >
          📜 Activity log
        </button>
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className={styles.muted}>{filteredUsers.length} user(s)</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th>Last login</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={7} className={styles.empty}>Loading users…</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className={styles.empty}>No users found</td></tr>
                ) : (
                  filteredUsers.map(u => {
                    const isMe = String(u.id) === String(me?.id);
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} className={!u.isActive ? styles.rowInactive : ''}>
                        <td>
                          <div className={styles.userName}>
                            {u.fullName} {isMe && <span className={styles.youTag}>you</span>}
                          </div>
                          <div className={styles.userEmail}>{u.email}</div>
                        </td>
                        <td>
                          <select
                            className={styles.roleSelect}
                            value={u.role}
                            disabled={isMe || busy}
                            title={isMe ? "You can't change your own role" : 'Change role'}
                            onChange={e => handleRoleChange(u, e.target.value as Role)}
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${u.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td>{u.twoFactorEnabled ? '🔒 On' : <span className={styles.muted}>Off</span>}</td>
                        <td className={styles.muted}>{fmt(u.lastLoginAt)}</td>
                        <td className={styles.muted}>{fmt(u.createdAt)}</td>
                        <td>
                          <button
                            className={`${styles.btn} ${u.isActive ? styles.btnDanger : styles.btnSuccess}`}
                            disabled={isMe || busy}
                            title={isMe ? "You can't deactivate your own account" : ''}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Activity tab ──────────────────────────────────────────────────────── */}
      {tab === 'activity' && (
        <div className={styles.panel}>
          <form className={styles.toolbar} onSubmit={applyUserFilter}>
            <select
              className={styles.select}
              value={actionFilter}
              onChange={e => { setOffset(0); setActionFilter(e.target.value); }}
            >
              <option value="">All activity</option>
              <option value="site">Site changes</option>
              <option value="user">User management</option>
              <option value="task">Tasks</option>
            </select>
            <input
              className={styles.searchInput}
              placeholder="Filter by user email…"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
            />
            <button className={styles.btn} type="submit">Apply</button>
            {(userFilter || actionFilter) && (
              <button
                className={styles.btn}
                type="button"
                onClick={() => { setUserInput(''); setUserFilter(''); setActionFilter(''); setOffset(0); }}
              >
                Clear
              </button>
            )}
            <button className={styles.btn} type="button" onClick={loadAudit}>↻ Refresh</button>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading && !audit ? (
                  <tr><td colSpan={5} className={styles.empty}>Loading activity…</td></tr>
                ) : !audit || audit.rows.length === 0 ? (
                  <tr><td colSpan={5} className={styles.empty}>No activity recorded yet</td></tr>
                ) : (
                  audit.rows.map(r => {
                    const meta = ACTION_LABELS[r.action] ?? { label: r.action, cls: 'actionUser' };
                    return (
                      <tr key={r.id}>
                        <td className={styles.muted}>{fmt(r.created_at)}</td>
                        <td>
                          <div className={styles.userEmail}>{r.user_email ?? 'system'}</div>
                          {r.user_role && <div className={styles.muted}>{r.user_role}</div>}
                        </td>
                        <td>
                          <span className={`${styles.actionBadge} ${styles[meta.cls]}`}>{meta.label}</span>
                        </td>
                        <td className={styles.muted}>
                          {r.entity_type ? `${r.entity_type} #${r.entity_id ?? ''}` : '—'}
                        </td>
                        <td className={styles.details}>{describe(r)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <span className={styles.muted}>
              {total === 0 ? 'No entries' : `Showing ${from}–${to} of ${total}`}
            </span>
            <div>
              <button
                className={styles.btn}
                disabled={offset === 0 || auditLoading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                ← Previous
              </button>
              <button
                className={styles.btn}
                disabled={offset + PAGE_SIZE >= total || auditLoading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;