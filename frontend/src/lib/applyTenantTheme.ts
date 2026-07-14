// Runtime tenant theming (spec §1.3): one validated hex re-skins the app.
// Derived tokens (-strong/-soft) are color-mix() on --color-primary in tokens.css,
// so they follow automatically.
const HEX = /^#[0-9a-fA-F]{6}$/

export function applyTenantTheme(theme?: { primaryColor?: string }): void {
  const hex = theme?.primaryColor
  if (!hex || !HEX.test(hex)) return

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const root = document.documentElement
  root.style.setProperty('--color-primary', hex)
  root.style.setProperty('--color-primary-rgb', `${r} ${g} ${b}`)

  // Contrast guard: relative luminance vs near-black --color-on-primary (#04110A).
  // If the tenant color is dark (3:1 fails against near-black text), flip text to white.
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // on-primary #04110A luminance ≈ 0.005; contrast = (L+0.05)/(0.005+0.05) — needs ≥ 3
  if ((L + 0.05) / 0.055 < 3) {
    root.style.setProperty('--color-on-primary', '#FFFFFF')
  }

  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = hex
}
