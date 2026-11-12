/**
 * Generates placeholder art for room items in the catalog that have no image yet, until
 * real art is drawn.
 *
 *   pnpm --filter @chat-app/backend art:items
 *
 * Writes apps/mobile/assets/<assetUrl> for every ITEMS_CATALOG entry whose file is
 * missing. Existing files are never touched, so real art dropped in at the same path
 * stays. Each new path still needs a require() in apps/mobile/constants/avatarAssets.ts.
 *
 * Shapes match how the Skia engine fits item images (geometry.ts itemRect): a floor item
 * is an isometric box exactly filling its footprint rect, a wall item a panel along the
 * wall, and floorings and wallpapers flat seamless textures the engine tiles across the
 * floor and walls (TEXTURE_PX_PER_CELL pixels per cell).
 *
 * To redraw floorings or wallpapers after changing their patterns, delete their files first.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { ItemPlacement } from '@chat-app/shared-types';

import { ITEMS_CATALOG } from '../src/catalog/items.catalog';

const ASSETS_DIR = join(__dirname, '..', '..', 'mobile', 'assets');
/** Paths the mobile asset map aliases to another file (Test Floor's typo), so they need no art. */
const ALIASED = new Set(['items/floorings/test-tv.png']);

/** apps/mobile/constants/grid.ts */
const TILE_W = 80;
const TILE_H = 40;
/** Pixels per content pixel, so placeholders stay sharp on high-density screens. */
const K = 2;
/** apps/mobile/constants/grid.ts: texture pixels per floor or wall cell side. */
const TEXTURE_PX_PER_CELL = 128;

/** Art colours per category. Art data, not app UI. */
const CATEGORY_COLORS: Record<string, string> = {
    Furniture: '#c8915a',
    Decor: '#7a9cc6',
    Lighting: '#f2c94c',
    Plants: '#5fae5f',
    Seasonal: '#e8803a',
};
const FALLBACK_COLOR = '#9a9a9a';
const LABEL = '#1a1a1a';
const OUTLINE = 'rgba(0,0,0,0.35)';

/** Mixes a #rrggbb colour towards black (f < 0) or white (f > 0). */
function shade(hex: string, f: number): string {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
    return `rgb(${r},${g},${b})`;
}

function escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function label(text: string, x: number, y: number, maxWidth: number): string {
    const size = Math.max(9 * K, Math.min(14 * K, (maxWidth / Math.max(text.length, 1)) * 1.8));
    return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${LABEL}">${escapeXml(text)}</text>`;
}

function svg(w: number, h: number, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

const pts = (points: number[][]) => points.map(p => p.join(',')).join(' ');

/** An isometric box over the item's footprint: grid x runs down-right, y down-left. */
function floorBox(name: string, dims: { x: number; y: number; z: number }, color: string): string {
    const hx = TILE_W / 2 * K, hy = TILE_H / 2 * K, zh = dims.z * TILE_H * K;
    const w = (dims.x + dims.y) * hx;
    const h = (dims.x + dims.y) * hy + zh;
    const back = [dims.y * hx, 0];
    const right = [back[0] + dims.x * hx, dims.x * hy];
    const left = [back[0] - dims.y * hx, dims.y * hy];
    const front = [right[0] - dims.y * hx, right[1] + dims.y * hy];
    const down = (p: number[]) => [p[0], p[1] + zh];
    const faces = [
        `<polygon points="${pts([left, front, down(front), down(left)])}" fill="${shade(color, -0.2)}" stroke="${OUTLINE}" stroke-width="${K}"/>`,
        `<polygon points="${pts([front, right, down(right), down(front)])}" fill="${shade(color, -0.35)}" stroke="${OUTLINE}" stroke-width="${K}"/>`,
        `<polygon points="${pts([back, right, front, left])}" fill="${shade(color, 0.15)}" stroke="${OUTLINE}" stroke-width="${K}"/>`,
    ];
    return svg(w, h, faces.join('') + label(name, w / 2, zh > 0 ? h * 0.6 : h / 2, w * 0.95));
}

/** A panel along the wall, rising towards the back like the floor's x axis. */
function wallPanel(name: string, dims: { x: number; z: number }, color: string): string {
    const hx = TILE_W / 2 * K, hy = TILE_H / 2 * K, zh = dims.z * TILE_H * K;
    const w = dims.x * hx;
    const h = dims.x * hy + zh;
    const panel = [[0, 0], [w, dims.x * hy], [w, h], [0, zh]];
    const body = `<polygon points="${pts(panel)}" fill="${shade(color, 0.1)}" stroke="${OUTLINE}" stroke-width="${2 * K}"/>`;
    return svg(w, h, body + label(name, w / 2, h / 2, w * 0.9));
}

/**
 * Flooring tiles: flat, seamless textures the engine repeats across the floor along the grid's
 * axes (Backdrop.tsx). Each is `cells` floor cells wide (u, along grid x) and tall (v, along
 * grid y), drawn in cell units, so its edges must line up with the next copy: strokes are
 * drawn as rects starting at the line, never centred on a tile edge.
 */
const FLOOR_PATTERNS: Record<string, { cells: [number, number]; draw: () => string }> = {
    'Wood Planks Floor': {
        // Boards half a cell wide, three cells long, joints staggered over three rows.
        cells: [3, 1.5],
        draw: () => {
            const out = [`<rect width="3" height="1.5" fill="#b5835a"/>`];
            for (let row = 0; row < 3; row++) {
                const v = row * 0.5;
                out.push(`<rect x="0" y="${v}" width="3" height="0.04" fill="#7a5536"/>`);
                out.push(`<rect x="${row}" y="${v}" width="0.04" height="0.5" fill="#7a5536"/>`);
            }
            return out.join('');
        },
    },
    'Checkerboard Floor': {
        cells: [2, 2],
        draw: () => `<rect width="2" height="2" fill="#f2f2f2"/>`
            + `<rect x="1" y="0" width="1" height="1" fill="#222222"/><rect x="0" y="1" width="1" height="1" fill="#222222"/>`,
    },
    'Carpet Floor': {
        cells: [4, 4],
        draw: () => {
            const out = [`<rect width="4" height="4" fill="#9c3d4a"/>`];
            for (let i = 0; i < 64; i++) {
                out.push(`<circle cx="${(i * 2.93) % 4}" cy="${(i * 1.51) % 4}" r="0.03" fill="#7d2f3a"/>`);
            }
            return out.join('');
        },
    },
    'Tile Floor': {
        cells: [1, 1],
        draw: () => `<rect width="1" height="1" fill="#dfe6ea"/>`
            + `<rect width="1" height="0.05" fill="#a9b4ba"/><rect width="0.05" height="1" fill="#a9b4ba"/>`,
    },
    'Concrete Floor': {
        cells: [4, 4],
        draw: () => {
            const out = [`<rect width="4" height="4" fill="#9b9d9e"/>`];
            for (let i = 0; i < 48; i++) {
                out.push(`<circle cx="${(i * 2.07) % 4}" cy="${(i * 1.17) % 4}" r="0.04" fill="#7f8182"/>`);
            }
            return out.join('');
        },
    },
    'Grass Floor': {
        // Mown stripes, one cell wide, running along grid y.
        cells: [2, 2],
        draw: () => `<rect width="2" height="2" fill="#5fa04e"/><rect x="0" y="0" width="1" height="2" fill="#6db35b"/>`,
    },
};

function flooring(name: string): string {
    const pattern = FLOOR_PATTERNS[name] ?? { cells: [1, 1] as [number, number], draw: () => `<rect width="1" height="1" fill="${FALLBACK_COLOR}"/>` };
    const [cw, ch] = pattern.cells;
    return svg(cw * TEXTURE_PX_PER_CELL, ch * TEXTURE_PX_PER_CELL,
        `<g transform="scale(${TEXTURE_PX_PER_CELL})">${pattern.draw()}</g>`);
}

/**
 * Wallpaper patterns on a 640×384 sheet (10 × 6 wall cells at 64 px), drawn at
 * TEXTURE_PX_PER_CELL / 64 scale. Like floorings they are seamless and the engine tiles them
 * along and up the wall.
 */
const WALL_PATTERNS: Record<string, () => string> = {
    'Brick Wallpaper': () => {
        const out = [`<rect width="640" height="384" fill="#d9d2c5"/>`];
        for (let row = 0; row < 16; row++) {
            for (let x = row % 2 ? -32 : 0; x < 640; x += 64) {
                out.push(`<rect x="${x + 2}" y="${row * 24 + 2}" width="60" height="20" fill="#a4523a"/>`);
            }
        }
        return out.join('');
    },
    'Striped Wallpaper': () => {
        const out = [`<rect width="640" height="384" fill="#f4e9d0"/>`];
        for (let x = 0; x < 640; x += 64) out.push(`<rect x="${x}" width="32" height="384" fill="#3f6b5c"/>`);
        return out.join('');
    },
    'Wood Panel Wallpaper': () => {
        const out = [`<rect width="640" height="384" fill="#8a5a3b"/>`];
        for (let x = 0; x < 640; x += 40) out.push(`<rect x="${x}" width="3" height="384" fill="#5e3c27"/>`);
        return out.join('');
    },
    'Cream Wallpaper': () => `<rect width="640" height="384" fill="#efe6d2"/>`,
    'Sage Wallpaper': () => `<rect width="640" height="384" fill="#a9bfa1"/>`,
    'Blush Wallpaper': () => `<rect width="640" height="384" fill="#e8b9b5"/>`,
    'Charcoal Wallpaper': () => `<rect width="640" height="384" fill="#3a3c40"/>`,
    'Starry Night Wallpaper': () => {
        const out = [`<rect width="640" height="384" fill="#1d2550"/>`];
        for (let i = 0; i < 90; i++) {
            out.push(`<circle cx="${(i * 97.3) % 640}" cy="${(i * 53.9) % 384}" r="${1 + (i % 3)}" fill="#fff6b0"/>`);
        }
        return out.join('');
    },
};

function wallpaper(name: string): string {
    const pattern = (WALL_PATTERNS[name] ?? (() => `<rect width="640" height="384" fill="${FALLBACK_COLOR}"/>`))();
    const k = TEXTURE_PX_PER_CELL / 64;
    return svg(640 * k, 384 * k, `<g transform="scale(${k})">${pattern}</g>`);
}

async function main() {
    let written = 0;
    for (const item of ITEMS_CATALOG) {
        const out = join(ASSETS_DIR, item.assetUrl);
        if (ALIASED.has(item.assetUrl) || existsSync(out)) continue;

        const color = CATEGORY_COLORS[item.category] ?? FALLBACK_COLOR;
        const art =
            item.category === 'Floorings' ? flooring(item.name)
            : item.category === 'Wallpapers' ? wallpaper(item.name)
            : item.placement === ItemPlacement.WALL ? wallPanel(item.name, item.dimensions, color)
            : floorBox(item.name, item.dimensions, color);

        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, await sharp(Buffer.from(art)).png().toBuffer());
        console.log(`wrote ${item.assetUrl}`);
        written++;
    }
    console.log(`${written} placeholders written, ${ITEMS_CATALOG.length - written} items already have art`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
