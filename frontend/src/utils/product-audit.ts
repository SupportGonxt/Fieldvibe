// The shape of a 'product_audit' custom-question answer.
//
// A store audit is captured across several wizard pages — store-level questions
// (rep visits, deliveries, biggest challenge), then a stock yes/no per product —
// but it is stored as ONE JSON value under the company's product_audit question
// key, so reports and the CSV export have a single place to read it from.
//
// Older visits (the first Diplomat pilot) stored a bare JSON array of per-product
// entries that carried the rep/delivery/challenge answers on every product. Those
// still parse: the array becomes `products` and is also kept verbatim on `legacy`
// so a report can show what was actually captured at the time.

export type YesNo = 'Yes' | 'No' | ''

export interface StoreAnswers {
  rep_visits: YesNo
  deliveries: YesNo
  // Asked when deliveries = No: how does the store get its stock instead?
  delivery_method: string
  // Asked when deliveries = Yes: what is delivered and how do the deliveries work?
  delivered_products: string
  biggest_challenge: string
  // Optional — delivery issues the store has with other products.
  other_delivery_issues: string
}

export interface StockEntry {
  product: string
  stock: 'Yes' | 'No'
  // Required when stock = No.
  why_not: string
}

export interface ProductAudit {
  store: StoreAnswers
  products: StockEntry[]
}

// A per-product entry from the retired one-page-per-product audit.
export interface LegacyProductEntry {
  product: string
  stock?: string
  why_not?: string
  similar?: string
  reps?: string
  reps_why_not?: string
  delivery?: string
  delivery_source?: string
  challenge?: string
  photo?: string
  comments?: string
}

export interface ParsedProductAudit extends ProductAudit {
  legacy: LegacyProductEntry[]
}

export const EMPTY_STORE_ANSWERS: StoreAnswers = {
  rep_visits: '',
  deliveries: '',
  delivery_method: '',
  delivered_products: '',
  biggest_challenge: '',
  other_delivery_issues: '',
}

const yesNo = (v: unknown): YesNo => (v === 'Yes' || v === 'No' ? v : '')
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function normalizeStore(raw: unknown): StoreAnswers {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    rep_visits: yesNo(r.rep_visits),
    deliveries: yesNo(r.deliveries),
    delivery_method: str(r.delivery_method),
    delivered_products: str(r.delivered_products),
    biggest_challenge: str(r.biggest_challenge),
    other_delivery_issues: str(r.other_delivery_issues),
  }
}

function normalizeProducts(raw: unknown): StockEntry[] {
  if (!Array.isArray(raw)) return []
  const out: StockEntry[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    if (typeof r.product !== 'string' || !r.product) continue
    if (r.stock !== 'Yes' && r.stock !== 'No') continue
    out.push({ product: r.product, stock: r.stock, why_not: str(r.why_not) })
  }
  return out
}

// Accepts the stored string, an already-parsed value, or nothing at all.
export function parseProductAudit(value: unknown): ParsedProductAudit {
  let parsed: unknown = value
  if (typeof value === 'string') {
    if (!value.trim()) parsed = null
    else {
      try { parsed = JSON.parse(value) } catch { parsed = null }
    }
  }
  if (Array.isArray(parsed)) {
    // Legacy per-product array
    const legacy = parsed.filter((e): e is LegacyProductEntry => !!e && typeof e === 'object' && typeof (e as LegacyProductEntry).product === 'string')
    return { store: { ...EMPTY_STORE_ANSWERS }, products: normalizeProducts(parsed), legacy }
  }
  if (parsed && typeof parsed === 'object') {
    const r = parsed as Record<string, unknown>
    return { store: normalizeStore(r.store), products: normalizeProducts(r.products), legacy: [] }
  }
  return { store: { ...EMPTY_STORE_ANSWERS }, products: [], legacy: [] }
}

export function serializeProductAudit(audit: ProductAudit): string {
  return JSON.stringify({ store: audit.store, products: audit.products })
}

// Every store-level question answered, including whichever delivery follow-up
// the deliveries answer opened. "Other delivery issues" is optional.
export function isStoreAnswersComplete(s: StoreAnswers | undefined): boolean {
  if (!s) return false
  if (!s.rep_visits || !s.deliveries) return false
  if (s.deliveries === 'No' && !s.delivery_method.trim()) return false
  if (s.deliveries === 'Yes' && !s.delivered_products.trim()) return false
  if (!s.biggest_challenge.trim()) return false
  return true
}

// Every configured product has a Yes/No, and every No says why.
export function isStockCheckComplete(products: string[], entries: StockEntry[]): boolean {
  if (products.length === 0) return false
  const byProduct = new Map(entries.map(e => [e.product, e]))
  return products.every(p => {
    const e = byProduct.get(p)
    if (!e) return false
    if (e.stock === 'No' && !e.why_not.trim()) return false
    return true
  })
}

export function isProductAuditComplete(products: string[], value: unknown): boolean {
  const audit = parseProductAudit(value)
  return isStoreAnswersComplete(audit.store) && isStockCheckComplete(products, audit.products)
}

export function stockSummary(entries: StockEntry[]): { stocked: number; notStocked: number } {
  let stocked = 0
  let notStocked = 0
  for (const e of entries) {
    if (e.stock === 'Yes') stocked++
    else notStocked++
  }
  return { stocked, notStocked }
}

// Product names configured on a product_audit question (field_options JSON array).
export function parseProductList(fieldOptions: string | string[] | null | undefined): string[] {
  if (Array.isArray(fieldOptions)) return fieldOptions.filter((p): p is string => typeof p === 'string' && !!p)
  if (!fieldOptions) return []
  try {
    const parsed = JSON.parse(fieldOptions)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string' && !!p) : []
  } catch {
    return []
  }
}
