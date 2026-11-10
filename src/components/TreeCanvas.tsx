import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Maximize, MousePointer2, Focus } from 'lucide-react'
import type { Project, Expansion } from '../lib/types'
import { layoutTree } from '../lib/tree'
import { projectTheme } from '../lib/themes'
import { TreeNodes } from './Artwork'
export function TreeCanvas({
  project,
  selected,
  onSelect,
  onToggle,
  onViewport,
  onPrimary,
}: {
  project: Project
  selected?: string
  onSelect: (id: string) => void
  onToggle: (id: string, group: keyof Expansion) => void
  onViewport: (v: Project['viewport']) => void
  onPrimary: () => void
}) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 900, height: 700 }),
    [view, setView] = useState(project.viewport),
    drag = useRef<{
      x: number
      y: number
      vx: number
      vy: number
      targetId?: string
      moved: boolean
    } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const layout = useMemo(
      () => layoutTree(project),
      [project.dataset, project.expanded, project.primary, project.display],
    ),
    theme = projectTheme(project)
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setView(project.viewport)
  }, [project.viewport])
  useEffect(() => {
    const el = ref.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left - size.width / 2
      const py = e.clientY - rect.top - size.height / 2
      const delta = e.deltaY || e.deltaX
      const zoom = Math.max(0.01, Math.min(3, v.zoom * Math.exp(-delta * 0.006)))
      const next = {
        zoom,
        x: px - (px - v.x) * (zoom / v.zoom),
        y: py - (py - v.y) * (zoom / v.zoom),
      }
      viewRef.current = next
      setView(next)
      onViewport(next)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [onViewport, size])
  const commit = (next: typeof view) => {
    setView(next)
    onViewport(next)
  }
  const fitted = useMemo(() => {
    const zoom = Math.max(
      0.01,
      Math.min(1.2, (size.width - 48) / layout.width, (size.height - 210) / layout.height),
    )
    return {
      zoom,
      x: -(layout.minX + layout.width / 2) * zoom,
      y: -(layout.minY + layout.height / 2) * zoom + 25,
    }
  }, [layout, size])
  const fit = () => commit(fitted)
  return (
    <div className="tree-stage" ref={ref}>
      <button className="canvas-primary btn" onClick={onPrimary} title="Change primary person">
        <Focus size={14} /> Change primary
      </button>
      <svg
        className="tree-svg"
        aria-label="Interactive family tree. Scroll to zoom; drag the canvas to pan."
        onPointerDown={(e) => {
          if ((e.target as Element).closest('.branch-control')) return
          const targetId = (e.target as Element)
            .closest('[data-person-id]')
            ?.getAttribute('data-person-id')
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            vx: view.x,
            vy: view.y,
            targetId: targetId || undefined,
            moved: false,
          }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const start = drag.current
          if (start) {
            if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) start.moved = true
            const next = {
              ...viewRef.current,
              x: start.vx + e.clientX - start.x,
              y: start.vy + e.clientY - start.y,
            }
            viewRef.current = next
            setView(next)
          }
        }}
        onPointerUp={() => {
          const current = drag.current
          drag.current = null
          if (current?.targetId && !current.moved) onSelect(current.targetId)
          else if (current) {
            onViewport(viewRef.current)
          }
        }}
        onPointerCancel={() => {
          drag.current = null
          onViewport(viewRef.current)
        }}
      >
        <rect width={size.width} height={size.height} fill={theme.paper} />
        <g
          transform={`translate(${size.width / 2 + view.x} ${size.height / 2 + view.y}) scale(${view.zoom})`}
        >
          <TreeNodes
            project={project}
            layout={layout}
            theme={theme}
            selected={selected}
            onSelect={onSelect}
            onToggle={onToggle}
            interactive
          />
        </g>
      </svg>
      <div className="canvas-bottom">
        <span className="canvas-hint">
          <MousePointer2 size={13} />
          Scroll to zoom · Drag to explore · Click a person to edit
        </span>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            onClick={() => commit({ ...view, zoom: Math.max(0.01, view.zoom * 0.8) })}
          >
            <Minus size={16} />
          </button>
          <button
            className="zoom-value"
            aria-label="Reset zoom"
            onClick={() => commit({ ...view, zoom: 1 })}
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => commit({ ...view, zoom: Math.min(3, view.zoom * 1.25) })}
          >
            <Plus size={16} />
          </button>
          <span />
          <button aria-label="Fit tree to view" onClick={fit}>
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
