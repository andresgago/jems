import { useEffect, useState } from 'react';
import { usersService } from '../services/users';

export function useUsers(params = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    usersService.list(params)
      .then(({ data }) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : data.results || []);
      })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [JSON.stringify(params), tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading, error, reload: () => setTick((t) => t + 1) };
}
