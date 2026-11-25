import { useGetNotificationsQuery as useGetSuNotificationsQuery, useMarkNotificationMutation as useMarkSuNotificationMutation, useMarkAllNotificationsReadMutation as useMarkAllSuNotificationsReadMutation, useDeleteNotificationMutation as useDeleteSuNotificationMutation } from '../redux/superuserApi';
import { useGetNotificationsQuery as useGetBcNotificationsQuery, useMarkNotificationMutation as useMarkBcNotificationMutation, useMarkAllNotificationsReadMutation as useMarkAllBcNotificationsReadMutation, useDeleteNotificationMutation as useDeleteBcNotificationMutation } from '../redux/businessClientApi';
import { useGetNotificationsQuery as useGetFmNotificationsQuery, useMarkNotificationMutation as useMarkFmNotificationMutation, useMarkAllNotificationsReadMutation as useMarkAllFmNotificationsReadMutation, useDeleteNotificationMutation as useDeleteFmNotificationMutation } from '../redux/fleetManagerApi';
import { useEffect, useRef, useState } from 'react';
import { Notifications } from '../api/namespaces';
import { useLiveSync } from '../hooks/useLiveSync';
import { usePageHeader } from '../hooks/usePageHeader';
import { useGetNotificationsQuery, useMarkNotificationMutation, useMarkAllNotificationsReadMutation, useDeleteNotificationMutation, EMPTY_LIST, queryError } from '../redux/driverApi';
import Pagination, { usePagination } from './Pagination';
import './NotificationInbox.css';

function Glyph({ kind = 'bell' }) {
  const paths = {
    bell: 'M18 8a6 6 0 0 0-12 0v5l-2 4h16l-2-4V8M10 21h4',
    check: 'm5 12 4 4L19 6',
    alert: 'M12 8v5m0 4h.01M10 3 2 18h20L14 3h-4Z',
    package: 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    refresh: 'M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.bell} /></svg>;
}

function category(notification) {
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (/issue|blocked|reject|failed|delay|overdue|expir|suspend/.test(text)) return 'attention';
  if (/payment|invoice|payout|earning/.test(text)) return 'finance';
  if (/trip|deliver|driver|dispatch|assign|picked|transit/.test(text)) return 'delivery';
  return 'system';
}

function timestamp(notification) {
  const date = new Date(notification.createdAt || notification.updatedAt);
  if (Number.isNaN(date.getTime())) return notification.time || 'Time unavailable';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationInbox(props) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  async function load({ background = false } = {}) {
    const version = ++requestVersion.current;
    if (!background) setLoading(true);
    try {
      const data = await Notifications.getAll();
      if (version !== requestVersion.current) return;
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      if (version === requestVersion.current) setError(err.message || 'Unable to load notifications.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => { requestVersion.current += 1; };
  }, []);
  useLiveSync(load);

  return <NotificationInboxView {...props} rows={rows} loading={loading} error={error} load={load} />;
}

function NotificationInboxView({
  description,
  variant = 'default',
  showInlineHeader = false,
  activityLabel = 'All portal activity',
  attentionLabel = 'Priority alerts',
  panelDescription = description,
  rows, loading, error: loadError, load: reload, remote,
  notifications = Notifications,
}) {
  const [localFilter, setLocalFilter] = useState('all');
  const [localSearch, setLocalSearch] = useState('');
  const { filter, setFilter, search, setSearch } = remote || { filter: localFilter, setFilter: setLocalFilter, search: localSearch, setSearch: setLocalSearch };
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [actionError, setError] = useState('');
  const error = actionError || loadError;

  async function load(options) {
    setError('');
    try {
      await reload(options);
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
    }
  }

  async function action(key, operation, message) {
    if (busy) return;
    setBusy(key);
    setFeedback('');
    setError('');
    try {
      await operation();
      await reload({ background: true });
      setFeedback(message);
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'The action failed. Please retry.');
    } finally {
      setBusy('');
    }
  }

  const allCount = remote?.data?.counts?.total ?? rows.length;
  const unread = remote?.data?.counts?.unread ?? rows.filter((notification) => !notification.read).length;
  const attention = remote?.data?.counts?.attention ?? rows.filter((notification) => category(notification) === 'attention').length;
  const visible = rows.filter((notification) => {
    if (filter === 'unread' && notification.read) return false;
    if (filter === 'read' && !notification.read) return false;
    if (filter === 'attention' && category(notification) !== 'attention') return false;
    return `${notification.title} ${notification.message}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const localPages = usePagination(visible, { resetKey: `${filter}|${search}` });
  const notificationPages = remote ? { ...remote.data, pageItems: rows, setPage: remote.setPage } : localPages;
  const tabs = [['all', 'All activity', allCount], ['unread', 'Unread', unread], ['read', 'Read', allCount - unread], ['attention', 'Needs attention', attention]];
  const usesFleetTheme = variant === 'fleet-manager';

  return (
    <section className={`ds-inbox${usesFleetTheme ? ' ds-inbox--fleet' : ''}`} aria-label="Notification inbox">
      {(!usesFleetTheme || showInlineHeader) && (
        <header className="ds-inbox__header">
          <div><span className="ds-inbox__eyebrow">ACTIVITY CENTER</span><h1>Notifications<span className="ds-inbox__count">{unread} unread</span></h1><p>{description}</p></div>
          {!usesFleetTheme && <button className="ds-inbox__primary" disabled={Boolean(busy) || !unread || loading} onClick={() => action('all', () => notifications.markAllRead(), 'All notifications marked as read.')}><Glyph kind="check" />{busy === 'all' ? 'Updating...' : 'Mark all as read'}</button>}
        </header>
      )}

      {usesFleetTheme ? (
        <div className="stats ds-inbox__fleet-summary">
          <div className="stat"><h3>Total Notifications</h3><div className="v yellow">{allCount}</div><div className="s">{activityLabel}</div></div>
          <div className="stat"><h3>Unread</h3><div className="v yellow">{unread}</div><div className="s">Awaiting review</div></div>
          <div className="stat"><h3>Needs Attention</h3><div className="v red">{attention}</div><div className="s">{attentionLabel}</div></div>
        </div>
      ) : (
        <div className="ds-inbox__summary">
          <div><span className="ds-inbox__summary-icon"><Glyph /></span><div><strong>{unread}</strong><span>Unread updates</span></div></div>
          <div><span className="ds-inbox__summary-icon ds-inbox__summary-icon--alert"><Glyph kind="alert" /></span><div><strong>{attention}</strong><span>Needs attention</span></div></div>
          <div><span className="ds-inbox__summary-icon ds-inbox__summary-icon--neutral"><Glyph kind="package" /></span><div><strong>{allCount}</strong><span>Total activity</span></div></div>
        </div>
      )}

      <div className={`ds-inbox__panel${usesFleetTheme ? ' panel' : ''}`}>
        {usesFleetTheme && (
          <div className="panel-head">
            <div>
              <div className="panel-title">Notification Activity</div>
              <div className="ds-inbox__panel-subtitle">{panelDescription}</div>
            </div>
            <span className={`pill ${unread ? 'pill-yellow' : 'pill-green'}`}>{unread ? `${unread} unread` : 'All caught up'}</span>
          </div>
        )}

        <div className="ds-inbox__toolbar">
          {usesFleetTheme ? (
            <>
              <div className="toolbar-left">
                <label className="search-sm ds-inbox__fleet-search"><Glyph kind="search" /><input aria-label="Search notifications" placeholder="Search notifications..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <select className="filter-select" aria-label="Filter notifications" value={filter} onChange={(event) => setFilter(event.target.value)}>
                  {tabs.map(([key, label, count]) => <option key={key} value={key}>{label} ({count})</option>)}
                </select>
              </div>
              <div className="toolbar-right">
                <button className="btn btn-ghost btn-square" type="button" aria-label="Refresh notifications" title="Refresh notifications" disabled={loading || Boolean(busy)} onClick={() => load({ background: true })}><Glyph kind="refresh" /></button>
                <button className="btn btn-yellow" type="button" disabled={Boolean(busy) || !unread || loading} onClick={() => action('all', () => notifications.markAllRead(), 'All notifications marked as read.')}><Glyph kind="check" />{busy === 'all' ? 'Updating...' : 'Mark all as read'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="ds-inbox__tabs" role="group" aria-label="Filter notifications">{tabs.map(([key, label, count]) => <button key={key} aria-pressed={filter === key} className={filter === key ? 'is-selected' : ''} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>)}</div>
              <div className="ds-inbox__tools"><label className="ds-inbox__search"><Glyph kind="search" /><input aria-label="Search notifications" placeholder="Search activity..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="ds-inbox__icon-button" aria-label="Refresh notifications" disabled={loading || Boolean(busy)} onClick={() => load({ background: true })}><Glyph kind="refresh" /></button></div>
            </>
          )}
        </div>

        {error && <div className="ds-inbox__error" role="alert">{error}<button onClick={() => load({ background: true })}>Retry</button></div>}
        <div className="ds-inbox__feedback" role="status" aria-live="polite">{feedback}</div>
        {loading && !rows.length ? <div className="ds-inbox__empty"><Glyph /><h2>Loading your activity</h2><p>Fetching notifications...</p></div>
          : !visible.length ? <div className="ds-inbox__empty"><Glyph kind="check" /><h2>{search ? 'No matching activity' : filter === 'unread' ? "You're all caught up" : 'Nothing here yet'}</h2><p>{search ? 'Try a different search or filter.' : 'Updates will appear here as actions happen across your portals.'}</p></div>
          : <div className="ds-inbox__list">{notificationPages.pageItems.map((notification) => {
            const type = category(notification);
            return <article key={notification.id} className={`ds-inbox__item${notification.read ? '' : ' is-unread'}`}>
              <div className={`ds-inbox__event-icon ds-inbox__event-icon--${type}`}><Glyph kind={type === 'attention' ? 'alert' : type === 'delivery' ? 'package' : type === 'finance' ? 'check' : 'bell'} /></div>
              <div className="ds-inbox__body"><div className="ds-inbox__title"><h2>{notification.title || 'Notification'}</h2>{!notification.read && <span className="ds-inbox__dot" aria-label="Unread" />}</div><p>{notification.message}</p><div className="ds-inbox__meta"><span>{type === 'attention' ? 'Needs attention' : type === 'finance' ? 'Payments & earnings' : type === 'delivery' ? 'Delivery activity' : 'Platform update'}</span><time dateTime={notification.createdAt}>{timestamp(notification)}</time></div></div>
              <div className="ds-inbox__actions"><button className="ds-inbox__read" disabled={Boolean(busy)} onClick={() => action(notification.id, () => notifications.markOne(notification.id, !notification.read), notification.read ? 'Marked as unread.' : 'Marked as read.')}>{busy === notification.id ? 'Updating...' : notification.read ? 'Mark unread' : 'Mark read'}</button><button className="ds-inbox__icon-button" disabled={Boolean(busy)} aria-label={`Delete notification: ${notification.title}`} onClick={() => setDeleteId(notification.id)}><Glyph kind="trash" /></button></div>
              {deleteId === notification.id && <div className="ds-inbox__confirm"><span>Remove this notification from your inbox?</span><button onClick={() => setDeleteId(null)} disabled={Boolean(busy)}>Cancel</button><button className="ds-inbox__danger" disabled={Boolean(busy)} onClick={() => action(`delete-${notification.id}`, () => notifications.delete(notification.id), 'Notification removed.')}>{busy ? 'Removing...' : 'Remove'}</button></div>}
            </article>;
          })}</div>}
        <Pagination {...notificationPages} onPageChange={notificationPages.setPage} itemLabel="notifications" />
        <footer className="ds-inbox__footer"><span>{notificationPages.totalItems ?? 0} of {allCount} notifications</span><span>Activity is saved to your account</span></footer>
      </div>
    </section>
  );
}

function PortalInbox({ description, ...inboxProps }) {
  usePageHeader('Notifications', description);
  return <NotificationInbox description={description} {...inboxProps} />;
}
function useInboxPage(useInboxQuery) {
  const [params, setParams] = useState({ page: 1, limit: 8, search: '', filter: 'all' });
  const query = useInboxQuery(params);
  const change = (values) => setParams((previous) => ({ ...previous, ...values }));
  return { query, data: query.currentData, ...params, setPage: (page) => change({ page }),
    setFilter: (filter) => change({ filter, page: 1 }), setSearch: (search) => change({ search, page: 1 }) };
}

export function DriverNotifications() {
  const description = 'Your assignments, delivery updates, and earnings in one place.';
  usePageHeader('Notifications', description);
  const remote = useInboxPage(useGetNotificationsQuery);
  const { query } = remote;
  const [markOne] = useMarkNotificationMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [remove] = useDeleteNotificationMutation();
  const notifications = {
    markOne: (id, read) => markOne({ id, read }).unwrap(),
    markAllRead: () => markAllRead().unwrap(),
    delete: (id) => remove(id).unwrap(),
  };
  return <NotificationInboxView description={description} variant="fleet-manager" activityLabel="All driver activity" attentionLabel="Priority driver alerts"
    remote={remote} rows={remote.data?.items || EMPTY_LIST} loading={query.isFetching} error={queryError(query)} load={() => query.refetch().unwrap()} notifications={notifications} />;
}
export function SuNotifications() {
  const description = 'Keep an eye on dispatch, delivery progress, and platform activity.';
  usePageHeader('Notifications', description);
  const remote = useInboxPage(useGetSuNotificationsQuery);
  const { query } = remote;
  const [markOne] = useMarkSuNotificationMutation();
  const [markAllRead] = useMarkAllSuNotificationsReadMutation();
  const [remove] = useDeleteSuNotificationMutation();
  const notifications = {
    markOne: (id, read) => markOne({ id, read }).unwrap(),
    markAllRead: () => markAllRead().unwrap(),
    delete: (id) => remove(id).unwrap(),
  };
  return <NotificationInboxView description={description} variant="fleet-manager" activityLabel="All platform activity" attentionLabel="Priority platform alerts"
    remote={remote} rows={remote.data?.items || EMPTY_LIST} loading={query.isFetching} error={queryError(query)} load={() => query.refetch().unwrap()} notifications={notifications} />;
}
export function FmNotifications() {
  const description = 'Stay on top of driver updates, dispatch, and fleet alerts.';
  usePageHeader('Notifications', description);
  const remote = useInboxPage(useGetFmNotificationsQuery);
  const { query } = remote;
  const [markOne] = useMarkFmNotificationMutation();
  const [markAllRead] = useMarkAllFmNotificationsReadMutation();
  const [remove] = useDeleteFmNotificationMutation();
  const notifications = {
    markOne: (id, read) => markOne({ id, read }).unwrap(),
    markAllRead: () => markAllRead().unwrap(),
    delete: (id) => remove(id).unwrap(),
  };
  return <NotificationInboxView description={description} variant="fleet-manager" activityLabel="All fleet activity" attentionLabel="Priority fleet alerts"
    remote={remote} rows={remote.data?.items || EMPTY_LIST} loading={query.isFetching} error={query.error?.message || ''} load={() => query.refetch().unwrap()} notifications={notifications} />;
}
export function BcNotifications() {
  const remote = useInboxPage(useGetBcNotificationsQuery);
  const { query } = remote;
  const [markOne] = useMarkBcNotificationMutation();
  const [markAllRead] = useMarkAllBcNotificationsReadMutation();
  const [remove] = useDeleteBcNotificationMutation();
  const notifications = {
    markOne: (id, read) => markOne({ id, read }).unwrap(),
    markAllRead: () => markAllRead().unwrap(),
    delete: (id) => remove(id).unwrap(),
  };
  return <NotificationInboxView description="Follow your deliveries, invoices, and payment updates." variant="fleet-manager" showInlineHeader activityLabel="All delivery activity" attentionLabel="Priority delivery alerts"
    remote={remote} rows={remote.data?.items || EMPTY_LIST} loading={query.isFetching} error={queryError(query)} load={() => query.refetch().unwrap()} notifications={notifications} />;
}
