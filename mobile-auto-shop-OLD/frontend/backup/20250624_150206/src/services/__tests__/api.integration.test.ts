import { vi, test, expect } from 'vitest'
import api, { serviceAPI } from '../api'

test('serviceAPI.getAll retries on failure', async () => {
  const spy = vi.spyOn(api, 'get')
  spy.mockRejectedValueOnce(new Error('fail'))
  spy.mockResolvedValue({ data: [] })
  await serviceAPI.getAll()
  expect(spy).toHaveBeenCalledTimes(2)
})
