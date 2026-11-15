export type PhotoBounds = { x: number; y: number; width: number; height: number }
export type BookPicture = PhotoBounds & {
  src: string
  frame: PhotoBounds
  captionLines: string[]
  number: number
  ruleY: number
}
export type StoryRegion = PhotoBounds
export const storyFont = 'Georgia'
export const editorialArrangements = [
  'gallery-right',
  'gallery-left',
  'feature',
  'alternating',
] as const
export const oneImageArrangements = [
  ...editorialArrangements.slice(0, 3),
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

export function editorialArrangement(layout: string): (typeof editorialArrangements)[number] {
  if (editorialArrangements.includes(layout as (typeof editorialArrangements)[number]))
    return layout as (typeof editorialArrangements)[number]
  if (['banner', 'top-pair', 'bottom-pair'].includes(layout)) return 'feature'
  if (layout.includes('left') && layout !== 'left') return 'alternating'
  if (layout.includes('right') && layout !== 'right') return 'alternating'
  return layout === 'left' ? 'gallery-left' : 'gallery-right'
}

export function composeBookBody(
  area: PhotoBounds,
  photos: { src: string; ratio: number; caption: string }[],
  arrangement: string,
  fontSize: number,
  wrap: (text: string, width: number, font: string) => string[],
): { pictures: BookPicture[]; regions: StoryRegion[]; composition: string } {
  const { x, y, width, height } = area
  const gap = 32
  const pictures: BookPicture[] = []
  const columns = (box: PhotoBounds): StoryRegion[] =>
    box.width >= 620
      ? [0, 1].map((i) => ({
          ...box,
          x: box.x + i * ((box.width - gap) / 2 + gap),
          width: (box.width - gap) / 2,
        }))
      : [box]
  if (!photos.length) return { pictures, regions: columns(area), composition: 'Reading' }
  const figure = (i: number, box: PhotoBounds) => {
    const photo = photos[i]
    const captionLines = photo.caption.trim()
      ? wrap(photo.caption.trim(), box.width - 28, '11px Inter')
      : []
    const captionHeight = captionLines.length ? 30 + captionLines.length * 15 : 0
    const maxHeight = Math.max(12, box.height - captionHeight)
    const imageWidth = Math.min(box.width, maxHeight * photo.ratio)
    const imageHeight = imageWidth / photo.ratio
    const imageX = box.x + (box.width - imageWidth) / 2
    pictures.push({
      src: photo.src,
      x: imageX,
      y: box.y,
      width: imageWidth,
      height: imageHeight,
      frame: { ...box, height: imageHeight + captionHeight },
      captionLines,
      number: i + 1,
      ruleY: box.y + imageHeight + 10,
    })
  }
  let style = editorialArrangement(arrangement)
  if (
    photos.length === 1 &&
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(arrangement)
  ) {
    const corner = arrangement as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    const photoWidth = width * 0.36
    const photoHeight = Math.min(height * 0.3, Math.max(96, width * 0.25))
    const left = corner.endsWith('left')
    const top = corner.startsWith('top')
    const photoX = left ? x : x + width - photoWidth
    const photoY = top ? y : y + height - photoHeight
    figure(0, { x: photoX, y: photoY, width: photoWidth, height: photoHeight })
    const sideWidth = width - photoWidth - gap
    const regions = top
      ? [
          { x: left ? photoX + photoWidth + gap : x, y, width: sideWidth, height: photoHeight },
          { x, y: y + photoHeight + gap, width, height: Math.max(0, height - photoHeight - gap) },
        ]
      : [
          { x, y, width, height: Math.max(0, height - photoHeight - gap) },
          { x: left ? photoX + photoWidth + gap : x, y: photoY, width: sideWidth, height: photoHeight },
        ]
    const labels = {
      'top-left': 'Top left photograph',
      'top-right': 'Top right photograph',
      'bottom-left': 'Bottom left photograph',
      'bottom-right': 'Bottom right photograph',
    }
    return { pictures, regions, composition: labels[corner] }
  }
  // Narrow pages benefit from a generous photograph above the story instead of a thin text rail.
  if (width < 400 && style !== 'feature') style = 'feature'
  const minimumText = fontSize * 1.6 * 3
  if (style === 'feature' && photos.length === 1 && photos[0].ratio < 1.6 && width >= 520) {
    const photoWidth = (width - gap) * 0.56
    figure(0, { x, y, width: photoWidth, height })
    return {
      pictures,
      regions: [{ x: x + photoWidth + gap, y, width: width - photoWidth - gap, height }],
      composition: 'Portrait feature',
    }
  }
  if (style === 'feature') {
    let photoHeight = Math.max(48, Math.min(height * 0.58, height - minimumText - 28))
    const sum = photos.reduce((total, photo) => total + Math.max(0.55, Math.min(2, photo.ratio)), 0)
    const widths = photos.map(
      (photo) =>
        ((width - (photos.length - 1) * 24) * Math.max(0.55, Math.min(2, photo.ratio))) / sum,
    )
    const minimumPhotoHeight = Math.max(
      ...photos.map(
        (photo, i) =>
          54 +
          (photo.caption.trim()
            ? wrap(photo.caption.trim(), widths[i] - 28, '11px Inter').length * 15
            : 0),
      ),
    )
    if (minimumPhotoHeight > height)
      return { pictures: [], regions: columns(area), composition: 'Reading' }
    photoHeight = Math.min(height, Math.max(photoHeight, minimumPhotoHeight))
    let photoX = x
    photos.forEach((photo, i) => {
      const slotWidth =
        ((width - (photos.length - 1) * 24) * Math.max(0.55, Math.min(2, photo.ratio))) / sum
      figure(i, { x: photoX, y, width: slotWidth, height: photoHeight })
      photoX += slotWidth + 24
    })
    const end = Math.max(...pictures.map((p) => p.frame.y + p.frame.height)) + 26
    return {
      pictures,
      regions: columns({ x, y: end, width, height: Math.max(0, y + height - end) }),
      composition: photos.length === 2 ? 'Paired photographs' : 'Opening photograph',
    }
  }
  const railWidth = (width - gap) * 0.46
  const railHeight = (height - (photos.length - 1) * 30) / photos.length
  if (
    photos.some(
      (photo) =>
        54 +
          (photo.caption.trim()
            ? wrap(photo.caption.trim(), railWidth - 28, '11px Inter').length * 15
            : 0) >
        railHeight,
    )
  )
    return composeBookBody(area, photos, 'feature', fontSize, wrap)
  if (style === 'alternating' && photos.length === 2) {
    const rowHeight = (height - 30) / 2
    const photoWidth = (width - gap) * 0.46
    figure(0, { x, y, width: photoWidth, height: rowHeight })
    figure(1, {
      x: x + width - photoWidth,
      y: y + rowHeight + 30,
      width: photoWidth,
      height: rowHeight,
    })
    return {
      pictures,
      regions: [
        { x: x + photoWidth + gap, y, width: width - photoWidth - gap, height: rowHeight },
        { x, y: y + rowHeight + 30, width: width - photoWidth - gap, height: rowHeight },
      ],
      composition: 'Two moments',
    }
  }
  const onLeft = style === 'gallery-left' || style === 'alternating'
  const photoWidth = (width - gap) * 0.46
  const rowHeight = (height - (photos.length - 1) * 30) / photos.length
  photos.forEach((_, i) =>
    figure(i, {
      x: onLeft ? x : x + width - photoWidth,
      y: y + i * (rowHeight + 30),
      width: photoWidth,
      height: rowHeight,
    }),
  )
  return {
    pictures,
    regions: [{ x: onLeft ? x + photoWidth + gap : x, y, width: width - photoWidth - gap, height }],
    composition: onLeft ? 'Photographs & story' : 'Story & photographs',
  }
}
