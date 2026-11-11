import { describe, expect, it } from 'vitest'
import { MAX_RASTER_PIXELS, MAX_RASTER_SIDE, rasterSize, treePrintMetrics } from './exportSizing'

describe('large image export sizing', () => {
  it('keeps the requested resolution for ordinary exports', () => {
    expect(rasterSize(1200, 800, 2)).toEqual({
      width: 2400,
      height: 1600,
      scale: 2,
      reduced: false,
    })
  })
  it('fits wide, tall, and dense trees without cropping or exceeding the pixel budget', () => {
    for (const [width, height] of [
      [100000, 2000],
      [2000, 100000],
      [40000, 40000],
    ]) {
      const size = rasterSize(width, height, 4)
      expect(size.reduced).toBe(true)
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(MAX_RASTER_SIDE)
      expect(size.width * size.height).toBeLessThanOrEqual(MAX_RASTER_PIXELS)
      expect(Math.abs(size.width - (size.height * width) / height)).toBeLessThanOrEqual(
        Math.max(1, width / height),
      )
    }
    expect(rasterSize(100000, 2000, 4).width).toBeGreaterThan(16384)
  })
  it('rejects invalid dimensions before allocating an image', () => {
    for (const [w, h, scale] of [
      [0, 10, 1],
      [10, -1, 1],
      [Infinity, 10, 1],
      [10, 10, NaN],
    ])
      expect(() => rasterSize(w, h, scale)).toThrow('positive finite')
  })
})

describe('proportional export decoration', () => {
  it('keeps small artwork at its original dimensions and margins', () => {
    expect(treePrintMetrics({ width: 760, height: 500 }, '', '')).toEqual({
      width: 760,
      height: 570,
      top: 35,
      decorationScale: 1,
    })
  })
  it('scales motifs with the shorter dimension and reserves extra tree margin', () => {
    const normal = treePrintMetrics({ width: 7600, height: 3000 }, 'Tree', '')
    const larger = treePrintMetrics({ width: 15200, height: 6195 }, 'Tree', '')
    expect(larger.decorationScale).toBeCloseTo(normal.decorationScale * 2)
    expect(normal.top).toBeGreaterThan(160)
    expect(normal.width).toBeGreaterThan(7600)
    expect(normal.height).toBeGreaterThan(3195)
    const bold = treePrintMetrics({ width: 7600, height: 3000 }, 'Tree', '', 2)
    expect(bold.decorationScale).toBe(normal.decorationScale * 2)
    expect(bold.top).toBeGreaterThan(normal.top)
  })
  it('keeps a readable border depth on extremely wide, shallow trees', () => {
    const metrics = treePrintMetrics({ width: 100000, height: 500 }, '', '')
    expect(metrics.decorationScale).toBeGreaterThanOrEqual(20)
    expect(metrics.top).toBeGreaterThan(35)
  })
})
