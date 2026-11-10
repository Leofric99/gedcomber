import { useEffect, useRef, useState } from 'react'
import type { Person } from '../lib/types'

type Crop = NonNullable<Person['photoCrop']>
export function PhotoFramer({
  source,
  initial,
  onApply,
  onCancel,
  onError,
}: {
  source: string
  initial?: Crop
  onApply: (photo: string, crop: Crop) => void
  onCancel: () => void
  onError: (message: string) => void
}) {
  const [crop, setCrop] = useState<Crop>(initial ?? { zoom: 1, x: 0, y: 0 })
  const [image, setImage] = useState<HTMLImageElement>()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setImage(img)
    img.onerror = () => onError('Could not open this photograph.')
    img.src = source
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [source, onError])
  const draw = (target: HTMLCanvasElement) => {
    if (!image) return
    const size = target.width
    const scale = Math.max(size / image.width, size / image.height) * crop.zoom
    const width = image.width * scale,
      height = image.height * scale
    const ctx = target.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(
      image,
      (-(width - size) * (crop.x + 1)) / 2,
      (-(height - size) * (crop.y + 1)) / 2,
      width,
      height,
    )
  }
  useEffect(() => {
    if (canvas.current) draw(canvas.current)
  }, [image, crop])
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  return (
    <div className="photo-framer">
      <p className="help">Drag the photograph to frame the face, or use the position sliders.</p>
      <canvas
        ref={canvas}
        width={600}
        height={600}
        aria-label="Photograph framing preview"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, crop }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const start = drag.current
          if (!start || !image) return
          const size = e.currentTarget.getBoundingClientRect().width
          const scale = Math.max(size / image.width, size / image.height) * start.crop.zoom
          const dx = image.width * scale - size,
            dy = image.height * scale - size
          setCrop({
            ...start.crop,
            x: dx > 0.01 ? clamp(start.crop.x - (2 * (e.clientX - start.x)) / dx) : 0,
            y: dy > 0.01 ? clamp(start.crop.y - (2 * (e.clientY - start.y)) / dy) : 0,
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      />
      {(['zoom', 'x', 'y'] as const).map((key) => (
        <label key={key}>
          {key === 'zoom' ? 'Zoom' : key === 'x' ? 'Horizontal position' : 'Vertical position'}
          <input
            type="range"
            min={key === 'zoom' ? 1 : -1}
            max={key === 'zoom' ? 5 : 1}
            step="0.01"
            value={crop[key]}
            onChange={(e) => setCrop({ ...crop, [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="person-actions">
        <button
          className="btn btn-primary"
          disabled={!image}
          onClick={() => {
            if (!canvas.current) return
            draw(canvas.current)
            onApply(canvas.current.toDataURL('image/jpeg', 0.92), crop)
          }}
        >
          Apply framing
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
