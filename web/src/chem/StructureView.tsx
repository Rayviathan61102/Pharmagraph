// A 2D structure drawn from SMILES, with glowing highlighted groups and (optionally) a line from each
// glow to its explanation.
import { useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { draw, useRDKit } from './chem'

export type Highlight = { id: string; atom_indices: number[]; note: string; color: string }

export const GLOW_COLORS = ['#e0b050', '#5fd0d0', '#d070c0', '#70d090', '#6fa0ff', '#e07a5f']

type Props = {
  smiles: string
  highlights?: Highlight[]
  width?: number
  height?: number
  showNotes?: boolean               // leader lines and note text around the molecule
  pinned?: string[]                 // features that glow until clicked again (others glow only on hover)
  selection?: number[]              // atoms picked while editing (shown with rings)
  onAtomClick?: (atom: number) => void
  onDoubleClick?: () => void
  label?: string
}

/** Split a note into short lines so it fits beside the molecule. */
function wrap(text: string, max = 24): string[] {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word
    else lines.push(word)
  }
  return lines
}

export function StructureView({ smiles, highlights = [], width = 420, height = 300, showNotes = false,
  pinned = [], selection, onAtomClick, onDoubleClick, label }: Props) {
  const rdkit = useRDKit()
  const glowId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState<string[]>([]) // features whose atoms are under the mouse
  const drawing = useMemo(() => (rdkit ? draw(rdkit, smiles, width, height) : null), [rdkit, smiles, width, height])

  if (!rdkit) return <div className="structure-loading muted">Loading chemistry tools…</div>
  if (!drawing) return <p className="error">This SMILES could not be read.</p>
  const at = (i: number) => drawing.atoms.get(i)

  // Frame the molecule itself (not RDKit's whole canvas), leaving room around it for the notes.
  const xs = [...drawing.atoms.values()].map((p) => p.x)
  const ys = [...drawing.atoms.values()].map((p) => p.y)
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  const [padX, padY] = showNotes ? [235, 95] : [24, 24]
  const viewBox = [box.minX - padX, box.minY - padY, box.maxX - box.minX + 2 * padX, box.maxY - box.minY + 2 * padY]

  /** The mouse position in drawing coordinates. */
  const pointOf = (e: MouseEvent<SVGSVGElement>) => {
    const point = svgRef.current!.createSVGPoint()
    point.x = e.clientX
    point.y = e.clientY
    return point.matrixTransform(svgRef.current!.getScreenCTM()!.inverse())
  }
  /** The atom under the mouse, or -1. */
  const atomUnder = (p: { x: number; y: number }) => {
    let best = -1
    let bestDistance = 22
    drawing.atoms.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < bestDistance) { best = i; bestDistance = d }
    })
    return best
  }
  /** Distance from p to the line segment a–b (so pointing at the middle of a bond counts too). */
  const toSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const [vx, vy] = [b.x - a.x, b.y - a.y]
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)))
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
  }
  const click = (e: MouseEvent<SVGSVGElement>) => {
    const atom = onAtomClick ? atomUnder(pointOf(e)) : -1
    if (atom >= 0) onAtomClick!(atom)
  }
  const hover = (e: MouseEvent<SVGSVGElement>) => {
    const p = pointOf(e)
    const atom = atomUnder(p)
    const ids = highlights.filter((h) => {
      if (h.atom_indices.includes(atom)) return true
      const inside = new Set(h.atom_indices)
      return drawing.bonds.some(([a, b]) => inside.has(a) && inside.has(b) && toSegment(p, at(a)!, at(b)!) < 12)
    }).map((h) => h.id)
    if (ids.join() !== hovered.join()) setHovered(ids)
  }
  // A feature glows (and shows its note) while hovered, or while pinned by clicking its text.
  const visible = highlights.filter((h) => pinned.includes(h.id) || hovered.includes(h.id))

  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
  const half = { x: (box.maxX - box.minX) / 2 + 35, y: (box.maxY - box.minY) / 2 + 30 }
  const notes = showNotes ? visible.map((h) => {
    const pts = h.atom_indices.map(at).filter((p): p is { x: number; y: number } => !!p)
    if (pts.length === 0) return null
    const glow = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
    let dx = glow.x - center.x
    let dy = glow.y - center.y
    const length = Math.hypot(dx, dy)
    if (length < 1) { dx = 0; dy = -1 } else { dx /= length; dy /= length }
    // Follow the direction from the molecule's centre through the glow until just outside the drawing.
    const t = Math.min(dx ? half.x / Math.abs(dx) : Infinity, dy ? half.y / Math.abs(dy) : Infinity)
    const end = { x: center.x + dx * t, y: center.y + dy * t }
    const anchor: 'start' | 'end' | 'middle' = dx > 0.35 ? 'start' : dx < -0.35 ? 'end' : 'middle'
    const lines = wrap(h.note)
    const firstLineY = dy < -0.35 ? end.y - (lines.length - 1) * 14 - 6 : end.y + (dy > 0.35 ? 14 : 4)
    return { h, glow, end, anchor, lines, firstLineY }
  }) : []

  return (
    <svg ref={svgRef} className={`structure${onAtomClick ? ' picking' : ''}`} role="img"
      aria-label={label ?? `Chemical structure ${smiles}`}
      viewBox={viewBox.join(' ')}
      onClick={click} onDoubleClick={onDoubleClick} onMouseMove={hover} onMouseLeave={() => setHovered([])}>
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {/* glows go underneath the drawing */}
      {visible.map((h) => {
        const inside = new Set(h.atom_indices)
        return (
          <g key={h.id} filter={`url(#${glowId})`} opacity={0.85}>
            {drawing.bonds.filter(([a, b]) => inside.has(a) && inside.has(b)).map(([a, b]) => (
              <line key={`${a}-${b}`} x1={at(a)!.x} y1={at(a)!.y} x2={at(b)!.x} y2={at(b)!.y}
                stroke={h.color} strokeWidth={14} strokeLinecap="round" />
            ))}
            {h.atom_indices.map((i) => at(i) && <circle key={i} cx={at(i)!.x} cy={at(i)!.y} r={11} fill={h.color} />)}
          </g>
        )
      })}
      <g dangerouslySetInnerHTML={{ __html: drawing.inner }} />
      {selection?.map((i) => at(i) && (
        <circle key={i} cx={at(i)!.x} cy={at(i)!.y} r={9} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="3 2" />
      ))}
      {notes.map((n) => n && (
        <g key={n.h.id} className="structure-note">
          <line x1={n.glow.x} y1={n.glow.y} x2={n.end.x} y2={n.end.y} stroke={n.h.color} strokeWidth={1.4} />
          <circle cx={n.glow.x} cy={n.glow.y} r={3} fill={n.h.color} />
          <text x={n.end.x + (n.anchor === 'start' ? 4 : n.anchor === 'end' ? -4 : 0)} y={n.firstLineY}
            textAnchor={n.anchor} fill={n.h.color} fontSize={12}>
            {n.lines.map((line, i) => <tspan key={i} x={n.end.x + (n.anchor === 'start' ? 4 : n.anchor === 'end' ? -4 : 0)} dy={i ? 14 : 0}>{line}</tspan>)}
          </text>
        </g>
      ))}
    </svg>
  )
}
