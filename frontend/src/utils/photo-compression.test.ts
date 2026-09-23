import { describe, it, expect, vi, beforeEach } from 'vitest'

// compressPhoto runs browser-image-compression, which needs a real canvas encoder.
// Stub it so these tests cover the decision this helper actually makes: what gets
// compressed on its way to being saved, what is left alone, and what happens when
// compression fails.
const compressMock = vi.hoisted(() => vi.fn())
vi.mock('browser-image-compression', () => ({ default: compressMock }))

const { compressImageFile } = await import('./photo-compression')

function file(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('compressImageFile', () => {
  beforeEach(() => {
    compressMock.mockReset()
    // Default: the compressor returns something meaningfully smaller.
    compressMock.mockImplementation(async () => file('out.jpg', 'image/jpeg', 200_000))
  })

  it('compresses a full-size camera photo', async () => {
    const out = await compressImageFile(file('IMG_1234.jpg', 'image/jpeg', 8_000_000))
    expect(compressMock).toHaveBeenCalledTimes(1)
    expect(out.size).toBe(200_000)
  })

  it('compresses a PNG screenshot even when it is already small', async () => {
    await compressImageFile(file('shot.png', 'image/png', 300_000))
    expect(compressMock).toHaveBeenCalledTimes(1)
  })

  it('leaves a JPEG that is already within budget alone, so it is not re-encoded twice', async () => {
    const input = file('already-compressed.jpg', 'image/jpeg', 400_000)
    expect(await compressImageFile(input)).toBe(input)
    expect(compressMock).not.toHaveBeenCalled()
  })

  it('passes a non-image through untouched — a PDF must not become a JPEG', async () => {
    const pdf = file('id-document.pdf', 'application/pdf', 5_000_000)
    expect(await compressImageFile(pdf)).toBe(pdf)
    expect(compressMock).not.toHaveBeenCalled()
  })

  it('keeps the original when compression fails, so a photo is never lost', async () => {
    compressMock.mockRejectedValue(new Error('boom'))
    const input = file('IMG_1234.jpg', 'image/jpeg', 8_000_000)
    expect(await compressImageFile(input)).toBe(input)
  })

  it('keeps the original when compression would make it bigger', async () => {
    compressMock.mockResolvedValue(file('bigger.jpg', 'image/jpeg', 9_000_000))
    const input = file('IMG_1234.jpg', 'image/jpeg', 8_000_000)
    expect(await compressImageFile(input)).toBe(input)
  })
})
