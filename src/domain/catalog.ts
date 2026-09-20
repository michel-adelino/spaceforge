export type FurnitureKind =
  'sofa' | 'bed' | 'table' | 'chair' | 'wardrobe' | 'plant' | 'lamp' | 'picture' | 'carpet';
export type CatalogCategory = 'Furniture' | 'Decor';

export interface CatalogItem {
  kind: FurnitureKind;
  name: string;
  category: CatalogCategory;
  /** Default footprint / height in metres. */
  width: number;
  depth: number;
  height: number;
  /** Height of the object's base above the floor. */
  elevation: number;
  /** Snaps to walls and turns its back to them. */
  wallSnap: boolean;
  paintable: boolean;
  defaultMaterial: string;
}

export const CATALOG: readonly CatalogItem[] = [
  {
    kind: 'sofa',
    name: 'Sofa',
    category: 'Furniture',
    width: 2.2,
    depth: 0.95,
    height: 0.85,
    elevation: 0,
    wallSnap: true,
    paintable: true,
    defaultMaterial: 'gray-fabric',
  },
  {
    kind: 'bed',
    name: 'Bed',
    category: 'Furniture',
    width: 1.6,
    depth: 2.05,
    height: 1.0,
    elevation: 0,
    wallSnap: true,
    paintable: true,
    defaultMaterial: 'blue-fabric',
  },
  {
    kind: 'table',
    name: 'Table',
    category: 'Furniture',
    width: 1.6,
    depth: 0.9,
    height: 0.75,
    elevation: 0,
    wallSnap: false,
    paintable: true,
    defaultMaterial: 'oak',
  },
  {
    kind: 'chair',
    name: 'Chair',
    category: 'Furniture',
    width: 0.45,
    depth: 0.5,
    height: 0.9,
    elevation: 0,
    wallSnap: false,
    paintable: true,
    defaultMaterial: 'walnut',
  },
  {
    kind: 'wardrobe',
    name: 'Wardrobe',
    category: 'Furniture',
    width: 1.2,
    depth: 0.6,
    height: 2.1,
    elevation: 0,
    wallSnap: true,
    paintable: true,
    defaultMaterial: 'white',
  },
  {
    kind: 'plant',
    name: 'Plant',
    category: 'Decor',
    width: 0.45,
    depth: 0.45,
    height: 1.1,
    elevation: 0,
    wallSnap: false,
    paintable: true,
    defaultMaterial: 'terracotta',
  },
  {
    kind: 'lamp',
    name: 'Floor lamp',
    category: 'Decor',
    width: 0.4,
    depth: 0.4,
    height: 1.6,
    elevation: 0,
    wallSnap: false,
    paintable: false,
    defaultMaterial: 'black',
  },
  {
    kind: 'picture',
    name: 'Picture',
    category: 'Decor',
    width: 0.9,
    depth: 0.04,
    height: 0.6,
    elevation: 1.4,
    wallSnap: true,
    paintable: true,
    defaultMaterial: 'black',
  },
  {
    kind: 'carpet',
    name: 'Carpet',
    category: 'Decor',
    width: 2.4,
    depth: 1.6,
    height: 0.02,
    elevation: 0,
    wallSnap: false,
    paintable: true,
    defaultMaterial: 'sand-fabric',
  },
];

export function getCatalogItem(kind: FurnitureKind): CatalogItem {
  const item = CATALOG.find((c) => c.kind === kind);
  if (!item) throw new Error(`Unknown furniture kind: ${kind}`);
  return item;
}
