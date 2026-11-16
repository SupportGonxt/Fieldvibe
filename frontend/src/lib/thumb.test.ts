import { describe, it, expect } from 'vitest'
import { thumb } from './thumb'

describe('thumb', () => {
  it('adds width to upload URLs', () => {
    expect(thumb('https://api.x/api/uploads/photos/a.jpg', 160)).toBe('https://api.x/api/uploads/photos/a.jpg?w=160')
    expect(thumb('/api/uploads/a.jpg?v=1', 480)).toBe('/api/uploads/a.jpg?v=1&w=480')
  })
  it('leaves other URLs alone', () => {
    expect(thumb('data:image/jpeg;base64,abc', 160)).toBe('data:image/jpeg;base64,abc')
    expect(thumb('https://cdn.example.com/x.jpg', 160)).toBe('https://cdn.example.com/x.jpg')
    expect(thumb(null, 160)).toBeUndefined()
  })
})
