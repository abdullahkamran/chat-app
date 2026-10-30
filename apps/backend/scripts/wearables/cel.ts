import type { Shape } from './shapes';

/**
 * Cel-shaded art helpers. A part is a filled outline with its shading and details clipped
 * inside it, then the outline stroked on top so the edge stays crisp. Light comes from
 * screen right, so shading sits on the left of each part.
 */

export interface CelPaint {
  base: string;
  shade: string;
  line: string;
  /** Highlight; only fixed-colour art can have one (a multiply tint can't lighten). */
  light?: string;
}

/**
 * Greys for tintable art: the runtime multiplies them by the skin or variant colour, so
 * white becomes that colour and the greys become darker shades of it.
 */
export const GREY: CelPaint = { base: '#ffffff', shade: '#c2c2c2', line: '#545454' };
/** Skin: a warm shade, so shadows on every skin tone lean red rather than grey. */
export const SKIN: CelPaint = { base: '#ffffff', shade: '#e6c3b6', line: '#8a655b' };

export const LINE_W = 0.7;

export interface CelInner {
  /** Shadow areas, filled evenodd so a cut-out (a crescent) is one path. */
  shade?: string[];
  light?: string[];
  /** Fold, seam and strand lines in the outline colour. */
  lines?: string[];
  /** Anything else drawn inside the outline, in the part's own coordinates. */
  raw?: string;
  /** The edge to stroke, when not the whole outline: an open path leaves a side unlined. */
  edge?: string;
}

let nextId = 0;

/** A unique id for clip paths and masks; pieces are separate files but may hold several parts. */
export function uid(prefix: string): string {
  return `${prefix}${nextId++}`;
}

export function cel(outline: string, paint: CelPaint, inner: CelInner = {}, lineWidth = LINE_W): Shape {
  const id = uid('cel');
  const inside = [
    ...(inner.shade ?? []).map(d => `<path d="${d}" fill="${paint.shade}" fill-rule="evenodd"/>`),
    ...(paint.light ? (inner.light ?? []).map(d => `<path d="${d}" fill="${paint.light}" fill-rule="evenodd"/>`) : []),
    ...(inner.lines ?? []).map(d => strokeSvg(d, paint.line, lineWidth * 0.6)),
    inner.raw ?? '',
  ].join('');
  return {
    kind: 'raw',
    svg:
      `<defs><clipPath id="${id}"><path d="${outline}"/></clipPath></defs>` +
      `<path d="${outline}" fill="${paint.base}"/>` +
      (inside ? `<g clip-path="url(#${id})">${inside}</g>` : '') +
      strokeSvg(inner.edge ?? outline, paint.line, lineWidth),
  };
}

export function strokeSvg(d: string, color: string, width: number): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/**
 * A limb: rounded ends, `w0` wide at the joint (`y0`) tapering to `w1` at `y1`.
 * Negative lengths (y1 < y0) work for parts that point up.
 */
export function limbD(w0: number, w1: number, y0: number, y1: number): string {
  const a = w0 / 2;
  const b = w1 / 2;
  const s = y1 >= y0 ? 1 : -1;
  return `M ${-a} ${y0 + s * a} A ${a} ${a} 0 0 ${s > 0 ? 1 : 0} ${a} ${y0 + s * a} ` +
    `L ${b} ${y1 - s * b} A ${b} ${b} 0 0 ${s > 0 ? 1 : 0} ${-b} ${y1 - s * b} Z`;
}

/** The left part of a limb in shadow: `f` of each half-width, measured from the centre line. */
export function limbShade(w0: number, w1: number, y0: number, y1: number, f = 0.3): string {
  const lo = Math.min(y0, y1) - 10;
  const hi = Math.max(y0, y1) + 10;
  const x0 = (-w0 / 2) * f;
  const x1 = (-w1 / 2) * f;
  return `M -40 ${lo} L ${x0} ${lo} L ${x1} ${hi} L -40 ${hi} Z`;
}

/** Everything left of `x`, for shading wide parts like the torso. */
export function leftOf(x: number): string {
  return `M -40 -60 H ${x} V 60 H -40 Z`;
}

/** A disc's shadow: the disc minus a copy shifted up and right, leaving a crescent on the left. */
export function crescent(cx: number, cy: number, r: number, dx = 2.4, dy = -1.2): string {
  return `M -40 -60 H 40 V 60 H -40 Z ${circleD(cx + dx, cy + dy, r)}`;
}

/** A full circle as a path, so it can share an evenodd fill with a cut-out. */
export function circleD(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

export function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}
