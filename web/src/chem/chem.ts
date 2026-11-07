// Chemistry in the browser with RDKit.js (BSD licence): read SMILES, draw 2D structures, find patterns.
// The 7 MB WebAssembly file is bundled with the app (works offline) and loaded only when a structure is shown.
import type { MainModule, Mol } from '@rdkit/rdkit'
import wasmUrl from '@rdkit/rdkit/RDKit_minimal.wasm?url'
import { useEffect, useState } from 'react'

let loading: Promise<MainModule> | null = null
export const loadRDKit = () =>
  (loading ??= import('@rdkit/rdkit').then((m) => m.default({ locateFile: () => wasmUrl })))

export function useRDKit(): MainModule | null {
  const [rdkit, setRDKit] = useState<MainModule | null>(null)
  useEffect(() => { loadRDKit().then(setRDKit) }, [])
  return rdkit
}

/** Run `use` with a parsed molecule and always free its memory afterwards (WebAssembly is not garbage-collected). */
export function withMol<T>(rdkit: MainModule, smiles: string, use: (mol: Mol) => T): T | null {
  const mol = rdkit.get_mol(smiles)
  try {
    return mol && mol.is_valid() ? use(mol) : null
  } finally {
    mol?.delete()
  }
}

const SYMBOL: Record<number, string> = {
  1: 'H', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 11: 'Na', 12: 'Mg', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl',
  19: 'K', 20: 'Ca', 26: 'Fe', 29: 'Cu', 30: 'Zn', 33: 'As', 34: 'Se', 35: 'Br', 53: 'I', 78: 'Pt', 79: 'Au',
}

/** Molecular formula in Hill order (C, H, then alphabetical), e.g. C20H24O2. */
export function formulaOf(mol: Mol): string {
  const json = JSON.parse(mol.get_json())
  const defaults = json.defaults.atom
  const counts: Record<string, number> = {}
  const add = (symbol: string, n: number) => { if (n) counts[symbol] = (counts[symbol] ?? 0) + n }
  for (const molecule of json.molecules) {
    for (const atom of molecule.atoms) {
      const z = atom.z ?? defaults.z
      add(SYMBOL[z] ?? `[${z}]`, 1)
      add('H', atom.impHs ?? defaults.impHs)
    }
  }
  const order = ['C', 'H', ...Object.keys(counts).filter((s) => s !== 'C' && s !== 'H').sort()]
  return order.filter((s) => counts[s]).map((s) => s + (counts[s] > 1 ? counts[s] : '')).join('')
}

/** Everything stored with a new structure. Returns null if the SMILES cannot be read. */
export function describe(rdkit: MainModule, smiles: string) {
  return withMol(rdkit, smiles, (mol) => ({
    canonical_smiles: mol.get_smiles(),
    canonicalizer: `RDKit.js ${rdkit.version()}`,
    molecular_formula: formulaOf(mol),
    molecular_weight: Math.round(JSON.parse(mol.get_descriptors()).amw * 100) / 100,
  }))
}

/** Atom indices matching a SMARTS pattern (e.g. "C#C" = a triple bond), or null if the pattern is invalid. */
export function matchPattern(rdkit: MainModule, smiles: string, smarts: string): number[] | null {
  const query = rdkit.get_qmol(smarts)
  if (!query || !query.is_valid()) { query?.delete(); return null }
  try {
    return withMol(rdkit, smiles, (mol) => {
      const matches: { atoms: number[] }[] = JSON.parse(mol.get_substruct_matches(query))
      return [...new Set(matches.flatMap((m) => m.atoms))]
    })
  } finally {
    query.delete()
  }
}

export type Drawing = {
  inner: string                         // RDKit's SVG content (without the white background)
  width: number
  height: number
  atoms: Map<number, { x: number; y: number }>  // drawing position of every atom
  bonds: [number, number][]
}

// shortcut: re-colouring by replacing RDKit's fixed colours in the SVG text; switch to RDKit drawing options
// (atomColourPalette / backgroundColour) if a future RDKit version changes these colours.
const DARK_THEME: [RegExp, string][] = [
  [/#000000/g, '#d7dae0'], [/#FF0000/g, '#e58a8a'], [/#0000FF/g, '#8aa8e5'], [/#33CCCC/g, '#7fd0d0'],
  [/#00CC00/g, '#8fd08f'], [/#CCCC00/g, '#d8c86a'], [/#FF7F00/g, '#e0a060'], [/#A01EEF/g, '#b88ae5'],
]

const numbers = (text: string) => (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

/** Draw a molecule and work out where each atom sits, from the class names RDKit puts on the drawing. */
export function draw(rdkit: MainModule, smiles: string, width: number, height: number): Drawing | null {
  const svg = withMol(rdkit, smiles, (mol) => mol.get_svg(width, height))
  if (!svg) return null
  const doc = new DOMParser().parseFromString(DARK_THEME.reduce((s, [from, to]) => s.replace(from, to), svg), 'image/svg+xml')
  doc.querySelector('rect')?.remove() // white background

  const pairsOf = (xy: number[]) => {
    const pairs: number[][] = []
    for (let i = 0; i + 1 < xy.length; i += 2) pairs.push([xy[i], xy[i + 1]])
    return pairs
  }
  const bondPoints = new Map<string, number[][]>() // "a,b" -> every point drawn for that bond
  const labels = new Map<number, number[][]>()
  doc.querySelectorAll('path[class]').forEach((path) => {
    const cls = path.getAttribute('class') ?? ''
    const pairs = pairsOf(numbers(path.getAttribute('d') ?? ''))
    const bond = cls.match(/^bond-\d+ atom-(\d+) atom-(\d+)$/)
    if (bond) {
      const key = `${bond[1]},${bond[2]}`
      bondPoints.set(key, [...(bondPoints.get(key) ?? []), ...pairs])
      return
    }
    const label = cls.match(/^atom-(\d+)$/) // the letters of a labelled atom such as O or N
    if (label) labels.set(Number(label[1]), [...(labels.get(Number(label[1])) ?? []), ...pairs])
  })

  // A bond's two outermost points are its two atoms. (Wedge and hash bonds are drawn as many small
  // pieces, so the first/last point of a single piece is not enough.) The first point drawn is atom a's end.
  const distance = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])
  const farthestFrom = (p: number[], pts: number[][]) => pts.reduce((best, q) => (distance(p, q) > distance(p, best) ? q : best))
  const points = new Map<number, number[][]>()
  const addPoint = (atom: number, p: number[]) => points.set(atom, [...(points.get(atom) ?? []), p])
  const bonds: [number, number][] = []
  bondPoints.forEach((pts, key) => {
    if (pts.length < 2) return
    const [a, b] = key.split(',').map(Number)
    const end2 = farthestFrom(pts[0], pts)
    const end1 = farthestFrom(end2, pts)
    const [nearA, nearB] = distance(end1, pts[0]) <= distance(end2, pts[0]) ? [end1, end2] : [end2, end1]
    addPoint(a, nearA)
    addPoint(b, nearB)
    bonds.push([a, b])
  })
  const center = (pts: number[][]) => ({
    x: (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2,
    y: (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2,
  })
  const atoms = new Map<number, { x: number; y: number }>()
  points.forEach((pts, atom) => atoms.set(atom, {
    x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  }))
  labels.forEach((pts, atom) => atoms.set(atom, center(pts))) // a letter's centre is more exact than bond ends
  if (atoms.size === 0) atoms.set(0, { x: width / 2, y: height / 2 }) // single atom, nothing to measure

  return { inner: doc.documentElement.innerHTML, width, height, atoms, bonds }
}
