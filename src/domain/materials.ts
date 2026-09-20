export type TextureKind = 'planks' | 'marble' | 'concrete' | 'tiles';

export interface MaterialPreset {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  texture?: TextureKind;
}

const m = (
  id: string,
  name: string,
  color: string,
  roughness = 0.75,
  metalness = 0,
  texture?: TextureKind,
): MaterialPreset => ({
  id,
  name,
  color,
  roughness,
  metalness,
  texture,
});

export const MATERIALS: Record<string, MaterialPreset> = Object.fromEntries(
  [
    // furniture
    m('oak', 'Oak', '#c9a26b', 0.7),
    m('walnut', 'Walnut', '#6b4a33', 0.65),
    m('white', 'White', '#f2f2ef', 0.6),
    m('black', 'Black', '#23262c', 0.5),
    m('gray-fabric', 'Gray fabric', '#8b929c', 0.95),
    m('blue-fabric', 'Blue fabric', '#4d6a8c', 0.95),
    m('green-fabric', 'Green fabric', '#5e8a6a', 0.95),
    m('sand-fabric', 'Sand fabric', '#d8c7a5', 0.95),
    m('terracotta', 'Terracotta', '#b8613f', 0.85),
    m('marble', 'Marble', '#e9e9eb', 0.25, 0, 'marble'),
    m('concrete', 'Concrete', '#9c9c99', 0.9, 0, 'concrete'),
    // floors
    m('floor-oak', 'Oak planks', '#d6ad74', 0.6, 0, 'planks'),
    m('floor-walnut', 'Walnut planks', '#8a6243', 0.6, 0, 'planks'),
    m('floor-marble', 'Marble', '#efeeec', 0.2, 0, 'marble'),
    m('floor-concrete', 'Concrete', '#a5a5a1', 0.9, 0, 'concrete'),
    m('floor-tile', 'Grey tile', '#b9c0c6', 0.4, 0, 'tiles'),
    m('floor-white', 'White', '#f4f4f2', 0.8),
    // walls
    m('wall-white', 'White', '#f3f1ec', 0.92),
    m('wall-beige', 'Beige', '#e6d8c3', 0.92),
    m('wall-sage', 'Sage', '#b9c7b0', 0.92),
    m('wall-clay', 'Clay', '#c98c73', 0.92),
    m('wall-charcoal', 'Charcoal', '#4a4f59', 0.92),
  ].map((p) => [p.id, p]),
);

export const FURNITURE_MATERIALS = [
  'oak',
  'walnut',
  'white',
  'black',
  'gray-fabric',
  'blue-fabric',
  'green-fabric',
  'sand-fabric',
  'terracotta',
  'marble',
  'concrete',
];
export const FLOOR_MATERIALS = [
  'floor-oak',
  'floor-walnut',
  'floor-marble',
  'floor-concrete',
  'floor-tile',
  'floor-white',
];
export const WALL_MATERIALS = ['wall-white', 'wall-beige', 'wall-sage', 'wall-clay', 'wall-charcoal'];

export function getPreset(id: string): MaterialPreset {
  return MATERIALS[id] ?? MATERIALS.white;
}
