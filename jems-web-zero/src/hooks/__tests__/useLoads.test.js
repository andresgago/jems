import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLoads } from '../useLoads'

vi.mock('../../services/loads', () => ({
  loadsService: {
    list: vi.fn(),
  },
}))

import { loadsService } from '../../services/loads'

describe('useLoads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses array API responses directly', async () => {
    loadsService.list.mockResolvedValue({ data: [{ id: 1, number: 'L-001' }] })

    const { result } = renderHook(() => useLoads({ status: '1' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loads).toEqual([{ id: 1, number: 'L-001' }])
    expect(result.current.count).toBe(1)
    expect(result.current.next).toBeNull()
    expect(result.current.previous).toBeNull()
    expect(loadsService.list).toHaveBeenCalledWith({ status: '1' })
  })

  it('uses results from paginated API responses', async () => {
    loadsService.list.mockResolvedValue({
      data: { results: [{ id: 2, number: 'L-002' }], count: 1 },
    })

    const { result } = renderHook(() => useLoads({ history: false }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loads).toEqual([{ id: 2, number: 'L-002' }])
    expect(result.current.count).toBe(1)
  })
})
