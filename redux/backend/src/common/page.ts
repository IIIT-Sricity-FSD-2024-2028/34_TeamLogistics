import { BadRequestException } from '@nestjs/common';

export function paginate<T>(items: T[], rawPage: unknown = '1', rawLimit: unknown = '8') {
  const page = Number(rawPage), limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException('Page must be positive and page size must be between 1 and 100');
  }
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const currentPage = Math.min(page, totalPages);
  return { items: items.slice((currentPage - 1) * limit, currentPage * limit),
    currentPage, totalPages, pageSize: limit, totalItems: items.length };
}

type OperationalRow = {id: string; status: string; driver: string; type?: string; vehicle?: string; request?: string; requestTime?: string; tripId?: string; issueType?: string; issueDescription?: string};
const activeDeliveries = new Set(['requested', 'pending', 'approved', 'queued', 'assigned', 'accepted', 'picked up', 'in transit', 'attempt failed', 'returning', 'issue reported', 'blocked']);

export function operationalPage<T extends OperationalRow>(rows: T[], query: Record<string, unknown>) {
  const statusCounts: Record<string, number> = {};
  const base = rows.filter(row => {
    const status = row.status.toLowerCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    switch (query.view) {
      case 'active': return activeDeliveries.has(status);
      case 'driver-working': return ['accepted','picked up','in transit','issue reported','attempt failed','returning'].includes(status);
      case 'driver-open': return ['assigned','queued','pending','accepted','picked up','in transit','issue reported','attempt failed','returning'].includes(status);
      case 'completed': return ['delivered','completed'].includes(status);
      case 'history': return ['completed','delivered','returned'].includes(status);
      case 'issues': return status.includes('issue') || Boolean(row.issueType || row.issueDescription);
      default: return true;
    }
  });
  const fields = ['driver', 'vehicle', 'status', 'type'] as const;
  const value = (r: T, key: typeof fields[number]) => String(r[key] || (key === 'driver' ? 'Unassigned' : ''));
  const options = Object.fromEntries(fields.map((key) => [key, [...new Set(base.map((r) => value(r, key)).filter(Boolean))].sort()]));
  const term = String(query.search || '').trim().toLowerCase();
  const selected = base.filter((r) => (!term || [r.id, r.request, r.tripId].some((id) => id?.toLowerCase().includes(term))) &&
    fields.every((key) => !query[key] || query[key] === value(r, key)));
  if (query.view === 'active') selected.sort((a, b) => b.id.localeCompare(a.id, undefined, {numeric: true}));
  return {...paginate(selected, query.page, query.limit), options, statusCounts};
}

export function directoryPage<T extends {id:string; plate?:string; name?:string; status?:string; type?:string}>(rows:T[], query:Record<string,unknown>) {
  const term = String(query.search || '').toLowerCase().trim();
  const fields = ['type','status'] as const;
  const selected = rows.filter(row => fields.every(key => !query[key] || String(query[key]).toLowerCase() === row[key]?.toLowerCase()) &&
    (!term || [row.id,row.plate,row.name].some(value => value?.toLowerCase().includes(term))));
  const options = Object.fromEntries(fields.map(key => [key,[...new Set(rows.map(r=>r[key]).filter(Boolean))].sort()]));
  return {...paginate(selected,query.page,query.limit),options};
}
