"""Build, render and export one level without opening the Blender window (light on the PC).

Usage (run from this tools/ folder):
  blender -b --python render_cli.py -- warrior 5
Writes ../renders/<character>_L<n>.png and ../glb/<character>_L<n>.glb, then quits.
One level per run on purpose: rendering everything in one go crashed a PC before.
"""
import sys
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
character, level = args[0], int(args[1])
lego = Path(__file__).resolve().parent.parent
g = {"RUN_MAIN": False, "CHARACTER": character, "LEGO_DIR": str(lego)}
exec((lego / "tools" / "blender_levels.py").read_text(), g)

for o in list(bpy.data.objects):                              # start from an empty scene
    if o.type != "CAMERA" and not o.name.startswith("PBR_"):
        bpy.data.objects.remove(o, do_unlink=True)
for lc in bpy.context.view_layer.layer_collection.children:   # hide older experiments in the file
    lc.exclude = lc.collection.name != "Stage"
bpy.context.scene.eevee.taa_render_samples = 32              # light render

data = g["json"].loads((lego / "characters" / character / "levels.json").read_text())
lv = next(x for x in data["levels"] if x["level"] == level)
top = g["collection"](f"Lego_{character.title()}_Levels")
col = g["build_level"](lv, 0.0, top)
g["render_level"](col, lego / "renders" / f"{character}_L{level}.png", 1400, 960)
g["export_glb"](col, lego / "glb" / f"{character}_L{level}.glb")
print("RENDERED", character, level)
