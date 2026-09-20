Put your .glb models here. Name them after the catalog item:

  sofa.glb  bed.glb  table.glb  chair.glb  wardrobe.glb
  plant.glb  lamp.glb  picture.glb  carpet.glb

Anything you leave out keeps its built-in procedural model. Reload the page after adding files.

Optional: models.json in this folder, e.g.

  {
    "sofa":  { "rotateY": 180 },
    "chair": { "rotateY": 90, "fit": "contain" },
    "table": { "file": "dining-table-v2.glb" }
  }

  rotateY  turn the model so its FRONT faces the same way as the procedural one (degrees)
  fit      "stretch" (default) fills the catalog size exactly, "contain" keeps the model's proportions
  file     use a different file name

The editor's "3D models" panel shows what loaded and can generate this file for you.
