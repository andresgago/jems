import { useCallback, useEffect, useState } from 'react'
import { brokersService } from '../services/brokers'

export function useBroker(id) {
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    brokersService
      .get(id)
      .then((r) => setItem(r.data))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  return { item, loading, reload: load }
}
