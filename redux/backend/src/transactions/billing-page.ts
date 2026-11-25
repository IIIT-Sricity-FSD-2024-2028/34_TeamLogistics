import { paginate } from '../common/page';
import { paise, rupees } from '../common/money';

type BillingRow = {id:string; status:string; amount:number; createdAt?:string; date?:string; invoiceId?:string; deliveryId?:string; totalAmount?:number; total?:number};
export function billingPage<T extends BillingRow>(rows: T[], query: Record<string, unknown>) {
  const sorted = [...rows].sort((a,b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
  const groups = {open:{count:0,amount:0},review:{count:0,amount:0},paid:{count:0,amount:0}};
  let firstOpenId: string | undefined;
  for (const row of sorted) {
    const status = String(row.status || '').toLowerCase();
    if (['reversed','refunded','cancelled','partially refunded'].includes(status)) continue;
    const group = ['paid','completed','approved','payment received','received'].includes(status) ? 'paid' :
      ['pending','under review','review'].includes(status) ? 'review' : 'open';
    if (group === 'open') firstOpenId ||= row.id;
    groups[group].count++;
    groups[group].amount += paise(row.totalAmount ?? row.total ?? row.amount ?? 0);
  }
  for (const group of Object.values(groups)) group.amount = rupees(group.amount);
  const term = String(query.search || '').trim().toLowerCase();
  const filtered = sorted.filter(r => (!query.status || r.status === query.status) && (!term ||
    [r.id,r.invoiceId,r.deliveryId].some(id => id?.toLowerCase().includes(term))));
  return {...paginate(filtered,query.page,query.limit), options:{status:[...new Set(rows.map(r=>r.status).filter(Boolean))].sort()},
    summary:{...groups, count:rows.length, firstOpenId}};
}
