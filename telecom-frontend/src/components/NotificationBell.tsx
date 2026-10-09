import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppNotification,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationApi';
import styles from './NotificationBell.module.css';

const POLL_MS = 20000; // check for new notifications every 20 seconds

const ICONS: Record<string, string> = {
  'site.create': '➕',
  'site.update': '✏️',
  'site.delete': '🗑️',
  'user.role_change': '🛡️',
  'user.registered': '👤',
  'task.assigned': '📋',
  'task.done': '✅',
  'task.blocked': '⛔',
  'task.comment': '💬',
  'task.updated': '🔄',
  'task.cancelled': '🚫',
};

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (document.visibilityState === 'hidden') return; // don't poll in background tabs
    try {
      const data = await fetchNotifications(15);
      setItems(data.items);
      setUnread(data.unreadCount);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Poll + refresh when the tab becomes visible / focused again
  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    const onWake = () => load();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [load]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    setOpen(o => !o);
    if (!open) load(); // fresh data every time it is opened
  };

  const handleItemClick = (n: AppNotification) => {
    setOpen(false);
    if (!n.isRead) {
      setItems(list => list.map(x => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread(u => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => load());
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = () => {
    setItems(list => list.map(x => ({ ...x, isRead: true })));
    setUnread(0);
    markAllNotificationsRead().catch(() => load());
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={toggle}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <span className={styles.bellIcon}>🔔</span>
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            {unread > 0 && (
              <button type="button" className={styles.markAll} onClick={handleMarkAll}>
                Mark all as read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {!loaded ? (
              <div className={styles.empty}>Loading…</div>
            ) : failed && items.length === 0 ? (
              <div className={styles.empty}>Couldn't load notifications. Retrying…</div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎉</div>
                You're all caught up
              </div>
            ) : (
              items.map(n => (
                <button
                  type="button"
                  key={n.id}
                  className={`${styles.item} ${n.isRead ? '' : styles.unread}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className={styles.icon}>{ICONS[n.type] ?? '🔔'}</span>
                  <span className={styles.body}>
                    <span className={styles.title}>{n.title}</span>
                    <span className={styles.message}>{n.message}</span>
                    <span className={styles.time}>{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && <span className={styles.dot} aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;