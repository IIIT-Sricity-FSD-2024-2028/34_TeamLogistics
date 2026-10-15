const normalize = (status) => String(status || '').trim().toLowerCase();

export const isPendingTrip = (status) => ['assigned', 'queued', 'pending'].includes(normalize(status));
export const isInProgressTrip = (status) => ['accepted', 'picked up', 'in transit'].includes(normalize(status));
export const isReportedIssue = (status) => normalize(status) === 'issue reported';
export const isCompletedTrip = (status) => ['completed', 'delivered'].includes(normalize(status));
export const isOpenTrip = (status) => isPendingTrip(status) || isInProgressTrip(status);
