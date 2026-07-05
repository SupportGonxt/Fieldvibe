// South African national ID validation + ID-type helpers.
// SA ID = 13 digits: YYMMDD (6) + gender (4) + citizenship (1) + race-legacy (1) + Luhn check (1).
// Validation is entry-time only — we store the number as-is, no schema change.

export type IdType = 'sa_id' | 'passport'

// Luhn checksum over all 13 digits (the SA Home Affairs check digit is a Luhn check digit).
function luhnValid(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48 // '0' = 48
    if (n < 0 || n > 9) return false
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

/** True if `raw` is a structurally valid SA ID number. */
export function isValidSaId(raw: string): boolean {
  return saIdError(raw) === null
}

/**
 * Returns a human-readable reason the SA ID is invalid, or null when valid.
 * Use this to drive inline field errors.
 */
export function saIdError(raw: string): string | null {
  const id = (raw || '').trim()
  if (!/^\d{13}$/.test(id)) return 'SA ID must be exactly 13 digits'

  const month = parseInt(id.slice(2, 4), 10)
  if (month < 1 || month > 12) return 'Invalid month in SA ID'

  const day = parseInt(id.slice(4, 6), 10)
  if (day < 1 || day > 31) return 'Invalid day in SA ID'

  const citizenship = id.charCodeAt(10) - 48
  if (citizenship !== 0 && citizenship !== 1) return 'Invalid citizenship digit in SA ID'

  if (!luhnValid(id)) return 'Invalid SA ID number (checksum failed)'
  return null
}

/** Basic passport sanity check for foreign customers: 6–12 alphanumeric chars. */
export function isValidPassport(raw: string): boolean {
  return /^[A-Za-z0-9]{6,12}$/.test((raw || '').trim())
}

/**
 * Validate an ID value against the chosen type. Returns an error reason or null.
 * SA ID failures hard-block submission; passports only require basic shape.
 */
export function idError(type: IdType, raw: string): string | null {
  const v = (raw || '').trim()
  if (!v) return null // emptiness is handled by required-field logic, not here
  if (type === 'passport') {
    return isValidPassport(v) ? null : 'Passport must be 6–12 letters/numbers'
  }
  return saIdError(v)
}

/**
 * Whether a goldrush company-question key represents a national ID field that
 * should get the SA-ID/passport capture treatment. Auto-detected by key, e.g.
 * `national_id`, `sa_id`, `id_number`, `owner_id_number`. Excludes the goldrush
 * player-id key (`goldrush_id`), which is a separate numeric field.
 */
export function isNationalIdKey(key: string): boolean {
  const k = (key || '').toLowerCase()
  if (k.includes('goldrush')) return false
  return /national_id|sa_id|saId|id_number|idnumber|identity_number/i.test(k)
}
