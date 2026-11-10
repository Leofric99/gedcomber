import { useEffect, useRef } from 'react'
import { X, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Display } from '../lib/types'
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current!
    el.showModal()
    return () => el.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-header">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true">
        <span />
      </span>
    </label>
  )
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="control-section">
      <div className="section-heading">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
export function FormatControls({
  display,
  onChange,
  book = false,
}: {
  display: Display
  onChange: (v: Display) => void
  book?: boolean
}) {
  const set = <K extends keyof Display>(k: K, v: Display[K]) => onChange({ ...display, [k]: v })
  return (
    <>
      <Field label="Name style">
        <select
          value={display.names}
          onChange={(e) => set('names', e.target.value as Display['names'])}
        >
          <option value="full">Full name</option>
          <option value="short">First & last name</option>
          <option value="initials">Middle initials</option>
        </select>
      </Field>
      <Field label="Date format">
        <select
          value={display.dates}
          onChange={(e) => set('dates', e.target.value as Display['dates'])}
        >
          <option value="long">14 May 1942</option>
          <option value="ordinal">14th May 1942</option>
          <option value="numeric">14 05 1942</option>
          <option value="iso">1942-05-14</option>
          <option value="year">1942 (year only)</option>
          <option value="original">Original GEDCOM format</option>
        </select>
      </Field>
      <div className="toggle-group">
        <Toggle label="Photographs" checked={display.photos} onChange={(v) => set('photos', v)} />
        <Toggle label="Birth details" checked={display.birth} onChange={(v) => set('birth', v)} />
        <Toggle label="Death details" checked={display.death} onChange={(v) => set('death', v)} />
        <Toggle label="Locations" checked={display.places} onChange={(v) => set('places', v)} />
        <Toggle
          label="Occupation"
          checked={display.occupation}
          onChange={(v) => set('occupation', v)}
        />
        <Toggle
          label="Burial location"
          checked={display.burial}
          onChange={(v) => set('burial', v)}
        />
        <Toggle label="Custom notes" checked={display.notes} onChange={(v) => set('notes', v)} />
      </div>
      {book && (
        <p className="help">
          Book formatting is independent of the tree. Edit facts and stories in the person editor.
        </p>
      )}
    </>
  )
}
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className={`checkbox ${checked ? 'checked' : ''}`} aria-hidden="true">
      {checked && <Check size={12} />}
    </span>
  )
}
