import { describe, it, expect } from 'vitest'
import { isWriteMethod, cacheKeyFor } from './offline-sync'

describe('isWriteMethod', () => {
  it('treats post/put/patch/delete as writes, get/head as reads', () => {
    expect(isWriteMethod('post')).toBe(true)
    expect(isWriteMethod('PUT')).toBe(true)
    expect(isWriteMethod('patch')).toBe(true)
    expect(isWriteMethod('DELETE')).toBe(true)
    expect(isWriteMethod('get')).toBe(false)
    expect(isWriteMethod('head')).toBe(false)
    expect(isWriteMethod(undefined)).toBe(false) // defaults to GET
  })
})

describe('cacheKeyFor', () => {
  it('builds a stable key from baseURL + url so write-through and read-fallback match', () => {
    expect(cacheKeyFor({ baseURL: '/api', url: '/field-ops/issues/mine' })).toBe('/api/field-ops/issues/mine')
  })

  it('folds query params into the key so different queries cache separately', () => {
    expect(cacheKeyFor({ baseURL: '/api', url: '/kpi/roster', params: { team: 'abc' } })).toBe(
      '/api/kpi/roster?team=abc'
    )
  })
})
