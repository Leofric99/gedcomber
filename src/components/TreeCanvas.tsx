import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Maximize, MousePointer2, ChevronDown } from 'lucide-react'
import type { Project, Expansion } from '../lib/types'
import { layoutTree } from '../lib/tree'
import { projectTheme } from '../lib/themes'
import { Ornament, TreeNodes } from './Artwork'
import { personName } from '../lib/format'
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
    drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
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
      if (e.ctrlKey || e.metaKey) {
        const next = {
          ...v,
          zoom: Math.max(0.12, Math.min(3, v.zoom * Math.exp(-e.deltaY * 0.008))),
        }
        setView(next)
        onViewport(next)
      } else {
        const next = { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }
        setView(next)
        onViewport(next)
      }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [onViewport])
  const commit = (next: typeof view) => {
    setView(next)
    onViewport(next)
  }
  const fit = () => {
    const zoom = Math.max(
      0.12,
      Math.min(1.2, (size.width - 100) / layout.width, (size.height - 190) / layout.height),
    )
    commit({
      zoom,
      x: -(layout.minX + layout.width / 2) * zoom,
      y: -(layout.minY + layout.height / 2) * zoom + 40,
    })
  }
  const rootHeight = layout.nodes.find((n) => n.id === project.primary)?.height ?? 100
  return (
    <div className="tree-stage" ref={ref}>
      <div className="canvas-heading">
        <div>
          <span className="eyebrow">FAMILY TREE</span>
          <button className="primary-picker" onClick={onPrimary}>
            {personName(project.dataset.people[project.primary], 'short')}
            <ChevronDown size={14} />
          </button>
        </div>
        <span className="canvas-count">
          {layout.nodes.length} of {Object.keys(project.dataset.people).length} people visible
        </span>
      </div>
      <svg
        className="tree-svg"
        aria-label="Interactive family tree. Drag the canvas to pan; use controls to zoom."
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[role="button"]')) return
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setView((v) => ({
              ...v,
              x: drag.current!.vx + e.clientX - drag.current!.x,
              y: drag.current!.vy + e.clientY - drag.current!.y,
            }))
        }}
        onPointerUp={() => {
          if (drag.current) {
            drag.current = null
            onViewport(viewRef.current)
          }
        }}
        onPointerCancel={() => {
          drag.current = null
          onViewport(viewRef.current)
        }}
      >
        <rect
          x="24"
          y="78"
          width={Math.max(0, size.width - 48)}
          height={Math.max(0, size.height - 150)}
          rx="3"
          fill={theme.paper}
          stroke="#0000000c"
        />
        <svg
          x="25"
          y="79"
          width={Math.max(0, size.width - 50)}
          height={Math.max(0, size.height - 152)}
          overflow="hidden"
        >
          <Ornament theme={theme} width={size.width - 50} height={size.height - 152} />
        </svg>
        <text
          x={size.width / 2}
          y="139"
          textAnchor="middle"
          fontFamily={theme.font}
          fontSize="28"
          fill={theme.ink}
        >
          {project.title}
        </text>
        <text
          x={size.width / 2}
          y="161"
          textAnchor="middle"
          fontFamily="Inter"
          fontSize="9"
          letterSpacing="2"
          fill={theme.accent}
        >
          {project.subtitle}
        </text>
        <g
          transform={`translate(${size.width / 2 + view.x} ${size.height / 2 + view.y + 35}) scale(${view.zoom}) translate(0 ${-rootHeight / 2})`}
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
          Drag to explore · Click a person to edit
        </span>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            onClick={() => commit({ ...view, zoom: Math.max(0.12, view.zoom * 0.8) })}
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
