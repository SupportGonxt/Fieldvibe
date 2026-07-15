import { describe, it, expect } from 'vitest'
import { rowsToCsv } from './downloadCsv'

describe('rowsToCsv', () => {
  it('escapes commas, quotes and newlines; nulls become empty', () => {
    const csv = rowsToCsv(['A', 'B'], [['a,b', 'say "hi"'], [null, 'line\nbreak']])
    expect(csv).toBe('\uFEFF' + 'A,B\n"a,b","say ""hi"""\n,"line\nbreak"')
  })
})
