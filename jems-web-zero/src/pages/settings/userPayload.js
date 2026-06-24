const FK_FIELDS = ['position', 'main_dispatcher'];
const DATE_FIELDS = [];
const NUMBER_FIELDS = ['status', 'dispatcher_type', 'contract', 'percent', 'hours', 'carrier'];

export function buildUserPayload(form, isEdit = false) {
  const payload = { ...form };
  if (isEdit) delete payload.password;
  for (const f of FK_FIELDS) payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null;
  for (const f of DATE_FIELDS) payload[f] = payload[f] || null;
  for (const f of NUMBER_FIELDS) payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null;
  payload.start_hour = payload.start_hour || null;
  payload.end_hour = payload.end_hour || null;
  return payload;
}
