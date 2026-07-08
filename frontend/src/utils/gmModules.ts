// GM defaults to field-operations only; this flag unlocks the other modules.
const KEY = 'fieldvibe_gm_all_modules'

export function gmAllModulesEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setGmAllModules(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch { /* storage unavailable - flag stays off */ }
}
