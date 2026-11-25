import { useSession } from '../../auth/SessionContext';
import { useGetCurrentUserQuery } from '../../redux/businessClientApi';

const ROLE_LABELS = {
  superuser: 'Super User',
  'fleet-manager': 'Fleet Manager',
  'business-client': 'Business Client',
  driver: 'Driver',
};

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] || '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return `${first}${last}`.toLocaleUpperCase() || '?';
}

export function useBcCurrentUser() {
  const { session } = useSession();
  const query = useGetCurrentUserQuery(session?.userId, { skip: !session?.userId });
  const user = query.currentData || null;
  const loading = query.isLoading;
  const name = String(user?.name || '').trim();
  const clientName = user?.companyName || user?.company || user?.profileDetails?.companyName || user?.name || session?.name || '';
  const clientNames = [user?.name, user?.username, user?.companyName, user?.company, user?.profileDetails?.companyName]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase());
  return {
    loading, user, clientName, clientNames,
    error: !session?.userId || query.isError,
    errorMessage: !session?.userId ? 'No active session. Please log in again.' : query.error?.message || '',
    companyName: user ? clientName : loading ? 'Loading...' : 'Unavailable',
    name: user ? name : loading ? 'Loading...' : 'Unavailable',
    role: ROLE_LABELS[String(user?.role || '').trim().toLowerCase()] || user?.role || '',
    initials: user ? getInitials(name) : loading ? '...' : '?',
    refetch: query.refetch,
  };
}
