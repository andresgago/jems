import { useState, useEffect } from 'react';
import { driverInvoicesService } from '../services/accounting';

export function useDriverInvoices(params) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    driverInvoicesService.list(params)
      .then(({ data }) => {
        if (!cancelled) setInvoices(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { invoices, loading, error, refresh: () => setTick((t) => t + 1) };
}
