import { afterEach, describe, expect, it, vi } from 'vitest'
import { rasterize } from './exports'

afterEach(() => vi.unstubAllGlobals())

function exportBrowser(maxSide: number) {
  const viewports: Record<string, string>[] = []
  const canvases: { width: number; height: number; getContext: () => unknown }[] = []
  const draw = vi.fn()
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString() {
        const attrs = { viewBox: '0 0 100000 2000' } as Record<string, string>
        viewports.push(attrs)
        return {
          attrs,
          documentElement: {
            setAttribute: (name: string, value: string) => {
              attrs[name] = value
            },
          },
        }
      }
    },
  )
  vi.stubGlobal(
    'XMLSerializer',
    class {
      serializeToString(doc: { attrs: Record<string, string> }) {
        return JSON.stringify(doc.attrs)
      }
    },
  )
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void
      set src(_url: string) {
        this.onload?.()
      }
    },
  )
  const revoked = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: revoked })
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          getImageData: () => {
            if (Math.max(canvas.width, canvas.height) > maxSide)
              throw new Error('Allocation failed')
          },
          drawImage: draw,
        }),
      }
      canvases.push(canvas)
      return canvas
    },
  })
  return { viewports, canvases, draw, revoked }
}

describe('large tree rendering', () => {
  it('resizes the SVG viewport before rendering while retaining its full viewBox', async () => {
    const browser = exportBrowser(32760)
    const canvas = await rasterize('<svg/>', 100000, 2000, 4)
    expect(canvas.width).toBe(32760)
    expect(browser.viewports[0]).toEqual({
      width: '32760',
      height: String(canvas.height),
      viewBox: '0 0 100000 2000',
    })
    expect(browser.draw).toHaveBeenCalledWith(expect.anything(), 0, 0, canvas.width, canvas.height)
    expect(browser.revoked).toHaveBeenCalledOnce()
  })
  it('retries smaller images on constrained devices and releases failed canvases', async () => {
    const browser = exportBrowser(4096)
    const canvas = await rasterize('<svg/>', 16000, 800, 1)
    expect(canvas.width).toBe(4000)
    expect(canvas.height).toBe(200)
    expect(
      browser.canvases.slice(0, -1).every((canvas) => canvas.width === 0 && canvas.height === 0),
    ).toBe(true)
    expect(browser.revoked).toHaveBeenCalledTimes(3)
  })
  it('reports a rendering failure after bounded retries and cleans up', async () => {
    const browser = exportBrowser(0)
    await expect(rasterize('<svg/>', 16000, 800, 1)).rejects.toThrow('Unable to render this image')
    expect(browser.revoked).toHaveBeenCalledTimes(4)
    expect(browser.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true)
  })
})
