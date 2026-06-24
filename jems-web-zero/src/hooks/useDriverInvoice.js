import { useState, useEffect } from 'react';
import { driverInvoicesService } from '../services/accounting';

export function useDriverInvoice(id) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    driverInvoicesService.get(id)
      .then(({ data }) => { if (!cancelled) setInvoice(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, tick]);

  return { invoice, loading, error, refresh: () => setTick((t) => t + 1) };
}
