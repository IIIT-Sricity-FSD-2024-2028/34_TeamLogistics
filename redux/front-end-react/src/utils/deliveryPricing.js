export function deliveryAmount(record) {
  const value = record?.pricing?.total ?? record?.amount ?? 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatDeliveryPrice(record) {
  return `₹${deliveryAmount(record).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
