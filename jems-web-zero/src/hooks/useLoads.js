import { useState, useEffect, useCallback } from 'react';
import { loadsService } from '../services/loads';

export function useLoads(filters) {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await loadsService.list(filters);
      setLoads(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { loads, loading, error, refresh: fetch };
}
