import type { Layout } from './tree'

export const MAX_RASTER_SIDE = 32760
export const MAX_RASTER_PIXELS = 64000000

export function rasterSize(width: number, height: number, requestedScale: number) {
  if (![width, height, requestedScale].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('The export dimensions must be positive finite numbers.')
  const scale = Math.min(
    requestedScale,
    MAX_RASTER_SIDE / width,
    MAX_RASTER_SIDE / height,
    Math.sqrt(MAX_RASTER_PIXELS / width / height),
  )
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
    reduced: scale < requestedScale,
  }
}

export function treePrintMetrics(
  layout: Pick<Layout, 'width' | 'height'>,
  title: string,
  subtitle: string,
  decorationSize = 1,
) {
  const baseWidth = Math.max(760, layout.width)
  const baseTop = title || subtitle ? 160 : 35
  const baseHeight = layout.height + baseTop + 35
  // Bound the visual width of the border as well as its depth: panoramic trees
  // need readable motifs all along their edges when the entire export is fit.
  const decorationScale =
    Math.max(1, Math.min(baseWidth, baseHeight) / 760, baseWidth / 5000) * decorationSize
  const inset = Math.max(0, decorationScale - 1) * 200
  return {
    width: baseWidth + inset * 2,
    height: baseHeight + inset * 2,
    top: baseTop + inset,
    decorationScale,
  }
}
