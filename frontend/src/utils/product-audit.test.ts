import { describe, it, expect } from 'vitest'
import {
  parseProductAudit, serializeProductAudit, isStoreAnswersComplete, isStockCheckComplete,
  isProductAuditComplete, stockSummary, parseProductList, EMPTY_STORE_ANSWERS,
} from './product-audit'

const PRODUCTS = ['Halls Cherry', 'Oreo Original', 'Stimorol Mint']

const completeStore = {
  rep_visits: 'Yes' as const,
  deliveries: 'Yes' as const,
  delivery_method: '',
  delivered_products: 'Halls and Oreo, weekly on Tuesdays',
  biggest_challenge: 'Slow-moving stock',
  other_delivery_issues: '',
}

describe('parseProductAudit', () => {
  it('returns an empty audit for nothing, blanks and garbage', () => {
    for (const v of [undefined, null, '', '   ', 'not json', 42]) {
      const a = parseProductAudit(v)
      expect(a.store).toEqual(EMPTY_STORE_ANSWERS)
      expect(a.products).toEqual([])
      expect(a.legacy).toEqual([])
    }
  })

  it('round-trips the object shape', () => {
    const json = serializeProductAudit({
      store: completeStore,
      products: [{ product: 'Halls Cherry', stock: 'Yes', why_not: '' }, { product: 'Oreo Original', stock: 'No', why_not: 'No demand' }],
    })
    const a = parseProductAudit(json)
    expect(a.store).toEqual(completeStore)
    expect(a.products).toHaveLength(2)
    expect(a.products[1]).toEqual({ product: 'Oreo Original', stock: 'No', why_not: 'No demand' })
    expect(a.legacy).toEqual([])
  })

  it('drops product entries without a valid Yes/No or name', () => {
    const a = parseProductAudit(JSON.stringify({ store: {}, products: [{ product: 'X', stock: 'Maybe' }, { stock: 'Yes' }, { product: 'Y', stock: 'Yes' }] }))
    expect(a.products).toEqual([{ product: 'Y', stock: 'Yes', why_not: '' }])
  })

  it('normalises unknown store values to blanks rather than throwing', () => {
    const a = parseProductAudit({ store: { rep_visits: 'yes', deliveries: 'No', delivery_method: 5 }, products: [] })
    expect(a.store.rep_visits).toBe('')
    expect(a.store.deliveries).toBe('No')
    expect(a.store.delivery_method).toBe('')
  })

  it('reads the legacy per-product array and keeps it on legacy', () => {
    const legacy = [
      { product: 'Halls Cherry', stock: 'Yes', reps: 'Yes', delivery: 'No', delivery_source: 'Cash & carry', challenge: 'Price', photo: 'https://x/p.jpg', comments: '' },
      { product: 'Oreo Original', stock: 'No', why_not: 'Too slow', photo: '' },
    ]
    const a = parseProductAudit(JSON.stringify(legacy))
    expect(a.products).toEqual([
      { product: 'Halls Cherry', stock: 'Yes', why_not: '' },
      { product: 'Oreo Original', stock: 'No', why_not: 'Too slow' },
    ])
    expect(a.legacy).toHaveLength(2)
    expect(a.legacy[0].delivery_source).toBe('Cash & carry')
    expect(a.store).toEqual(EMPTY_STORE_ANSWERS)
  })
})

describe('isStoreAnswersComplete', () => {
  it('needs both yes/no answers and the challenge', () => {
    expect(isStoreAnswersComplete(undefined)).toBe(false)
    expect(isStoreAnswersComplete(EMPTY_STORE_ANSWERS)).toBe(false)
    expect(isStoreAnswersComplete({ ...completeStore, biggest_challenge: '  ' })).toBe(false)
    expect(isStoreAnswersComplete({ ...completeStore, rep_visits: '' })).toBe(false)
    expect(isStoreAnswersComplete(completeStore)).toBe(true)
  })

  it('opens the right delivery follow-up', () => {
    expect(isStoreAnswersComplete({ ...completeStore, deliveries: 'Yes', delivered_products: '' })).toBe(false)
    expect(isStoreAnswersComplete({ ...completeStore, deliveries: 'No', delivery_method: '' })).toBe(false)
    expect(isStoreAnswersComplete({ ...completeStore, deliveries: 'No', delivery_method: 'Owner collects from wholesaler', delivered_products: '' })).toBe(true)
  })

  it('does not require other delivery issues', () => {
    expect(isStoreAnswersComplete({ ...completeStore, other_delivery_issues: '' })).toBe(true)
  })
})

describe('isStockCheckComplete', () => {
  it('needs every product answered and a reason for every No', () => {
    expect(isStockCheckComplete([], [])).toBe(false)
    expect(isStockCheckComplete(PRODUCTS, [])).toBe(false)
    expect(isStockCheckComplete(PRODUCTS, [
      { product: 'Halls Cherry', stock: 'Yes', why_not: '' },
      { product: 'Oreo Original', stock: 'Yes', why_not: '' },
    ])).toBe(false)
    expect(isStockCheckComplete(PRODUCTS, [
      { product: 'Halls Cherry', stock: 'Yes', why_not: '' },
      { product: 'Oreo Original', stock: 'No', why_not: '' },
      { product: 'Stimorol Mint', stock: 'Yes', why_not: '' },
    ])).toBe(false)
    expect(isStockCheckComplete(PRODUCTS, [
      { product: 'Halls Cherry', stock: 'Yes', why_not: '' },
      { product: 'Oreo Original', stock: 'No', why_not: 'Not listed by wholesaler' },
      { product: 'Stimorol Mint', stock: 'Yes', why_not: '' },
    ])).toBe(true)
  })

  it('ignores entries for products no longer on the list', () => {
    expect(isStockCheckComplete(['A'], [{ product: 'A', stock: 'Yes', why_not: '' }, { product: 'Z', stock: 'No', why_not: '' }])).toBe(true)
  })
})

describe('isProductAuditComplete', () => {
  it('is the conjunction of both pages', () => {
    const products = PRODUCTS.map(p => ({ product: p, stock: 'Yes' as const, why_not: '' }))
    expect(isProductAuditComplete(PRODUCTS, serializeProductAudit({ store: completeStore, products }))).toBe(true)
    expect(isProductAuditComplete(PRODUCTS, serializeProductAudit({ store: EMPTY_STORE_ANSWERS, products }))).toBe(false)
    expect(isProductAuditComplete(PRODUCTS, serializeProductAudit({ store: completeStore, products: products.slice(1) }))).toBe(false)
    expect(isProductAuditComplete(PRODUCTS, undefined)).toBe(false)
  })
})

describe('helpers', () => {
  it('stockSummary counts yes and no', () => {
    expect(stockSummary([
      { product: 'A', stock: 'Yes', why_not: '' }, { product: 'B', stock: 'No', why_not: 'x' }, { product: 'C', stock: 'Yes', why_not: '' },
    ])).toEqual({ stocked: 2, notStocked: 1 })
  })

  it('parseProductList reads a JSON array, an array, or nothing', () => {
    expect(parseProductList('["A","B"]')).toEqual(['A', 'B'])
    expect(parseProductList(['A', '', 'B'])).toEqual(['A', 'B'])
    expect(parseProductList(null)).toEqual([])
    expect(parseProductList('nope')).toEqual([])
    expect(parseProductList('{"a":1}')).toEqual([])
  })
})
