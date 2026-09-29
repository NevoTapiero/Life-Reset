"""Blender script: build + render a character's level lineup from the generated .ldr files.

Normally used through render_cli.py (headless, one level per run). It can also be exec'd in
Blender's Scripting tab with LEGO_DIR set to this repo's 3d/lego folder.
Needs: the LDraw parts library (SL_LDRAW_DIR, default ~/ldraw) and the
ldr_tools_blender add-on (0.5.1+, Blender 5.1).
"""
import json
import math
import os
import re
from pathlib import Path

import bpy
from mathutils import Vector

LEGO = Path(globals().get("LEGO_DIR") or os.environ.get("SL_LEGO_DIR") or Path.cwd().parent)
LDRAW = os.environ.get("SL_LDRAW_DIR", str(Path.home() / "ldraw"))
CHARACTER = globals().get("CHARACTER", "warrior")
SCALE = 0.01                    # importer default: 1 LDU = 0.01 m
PLATE_TOP = 0.0                 # every level stands on z = 0
LEVEL_SPACING = 7.0             # metres between level stands
FOOT_HEIGHT = 0.085             # foot area of the legs that the Shoes slot paints

COLORS = json.loads((LEGO / "catalog" / "slots.json").read_text())["ldraw_colors"]


def ldconfig_rgb():
    """LDraw colour code -> linear RGB, read from LDConfig.ldr."""
    out = {}
    for ln in open(os.path.join(LDRAW, "LDConfig.ldr"), encoding="utf-8", errors="ignore"):
        m = re.search(r"CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})", ln)
        if m:
            h = m.group(2)
            srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            out[int(m.group(1))] = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)
    return out


RGB = ldconfig_rgb()


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if c.name not in [x.name for x in parent.children]:
        parent.children.link(c)
    for o in list(c.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return c


def find_layer(col, lc=None):
    lc = lc or bpy.context.view_layer.layer_collection
    if lc.collection == col:
        return lc
    for ch in lc.children:
        r = find_layer(col, ch)
        if r:
            return r


def import_ldr(path, col):
    bpy.context.view_layer.active_layer_collection = find_layer(col)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.importldr(filepath=str(path), ldraw_path=LDRAW, stud_type="Logo4",
                                   primitive_resolution="High", add_gap_between_parts=True)
    new = [o for o in bpy.data.objects if o not in before]
    root = [o for o in new if o.parent is None][0]
    return root, new


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def place(root, objs, x, y=0.0, turn_deg=0.0):
    """Turn an imported model about its vertical axis, centre it on (x, y) and stand it on the plate."""
    root.rotation_euler.z = math.radians(turn_deg)
    lo, hi = bounds(objs)
    root.location += Vector((x - (lo.x + hi.x) / 2, y - (lo.y + hi.y) / 2, PLATE_TOP - lo.z))


def shoes_material(color_name, finish):
    name = f"Shoes {color_name} {finish}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*RGB[COLORS[color_name]], 1)
    metal = finish in ("gold", "steel", "iron")
    b.inputs["Metallic"].default_value = 0.7 if metal else 0.0
    b.inputs["Roughness"].default_value = {"gold": 0.35, "steel": 0.35, "iron": 0.5}.get(finish, 0.4)
    return m


def paint_shoes(objs, color_name, finish):
    legs = [o for o in objs if o.type == "MESH" and o.name.startswith("3815")]
    for o in legs:
        o.data = o.data.copy()                        # own mesh, so other levels keep their shoes
        mw = o.matrix_world
        zmin = min((mw @ v.co).z for v in o.data.vertices)
        o.data.materials.append(shoes_material(color_name, finish))
        idx = len(o.data.materials) - 1
        for poly in o.data.polygons:
            if (mw @ poly.center).z < zmin + FOOT_HEIGHT:
                poly.material_index = idx


def build_level(lv, x0, parent):
    col = collection(f"{CHARACTER.title()}_L{lv['level']}_{lv['title']}", parent)
    plate_root, plate = import_ldr(LEGO / "rides" / "_stand_plate.ldr", col)
    place(plate_root, plate, x0)
    lo, hi = bounds(plate)
    plate_root.location.z -= hi.z - lo.z - 0.017    # sink plate so its studs' base is z=0
    root, fig = import_ldr(LEGO / "ldr" / f"{CHARACTER}_L{lv['level']}.ldr", col)
    place(root, fig, x0 - 1.9, -0.6)
    paint_shoes(fig, lv["shoes"]["color"], lv["shoes"]["finish"])
    rroot, ride = import_ldr(LEGO / "rides" / lv["ride"]["file"], col)
    place(rroot, ride, x0, 0.1, turn_deg=lv["ride"].get("turn", -70))  # default: side-on, head toward the character
    lo, _ = bounds(ride)
    rroot.location.x += (x0 - 1.0) - lo.x                # ride starts just right of the character
    return col


def hex_linear(h):
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def setup_stage():
    """Camera, three area lights and a teal backdrop, created if the file does not have them."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "AgX"
    stage = bpy.data.collections.get("Stage") or bpy.data.collections.new("Stage")
    if stage.name not in [c.name for c in sc.collection.children]:
        sc.collection.children.link(stage)
    if not sc.camera:
        cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
        stage.objects.link(cam)
        sc.camera = cam
    for name, size, colour in (("PBR_Key", 3.0, (1, 1, 1)), ("PBR_Fill", 3.5, (0.75, 0.85, 1.0)),
                               ("PBR_Rim", 2.0, (1.0, 0.55, 0.2))):
        if not bpy.data.objects.get(name):
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
            light.data.size, light.data.color = size, colour
            stage.objects.link(light)
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (*hex_linear("155a70"), 1)


def export_glb(col, path):
    """Export the character + ride of one level (no display plate) as a .glb for the web app."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in col.all_objects:
        o.select_set(not o.name.startswith("3811"))
    # Draco-compressed (load with three.js DRACOLoader): the dragon alone is ~17 MB uncompressed.
    bpy.ops.export_scene.gltf(filepath=str(path), use_selection=True, export_apply=True, export_format="GLB",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)


def render_level(col, path, width=1600, height=1100):
    """Frame everything in the level (except the plate) and render a still."""
    setup_stage()
    sc = bpy.context.scene
    objs = [o for o in col.all_objects if o.type == "MESH" and not o.name.startswith("3811")]
    lo, hi = bounds(objs)
    centre = (lo + hi) / 2
    size = max(hi.x - lo.x, (hi.z - lo.z) * 1.45)
    cam = sc.camera
    cam.data.lens = 50
    cam.location = centre + Vector((0.32, -1.0, 0.36)).normalized() * size * 1.7
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    for name, off in (("PBR_Key", (2.2, -2.8, 3.2)), ("PBR_Fill", (-2.8, -2.2, 1.6)), ("PBR_Rim", (-1.4, 3.0, 2.8))):
        light = bpy.data.objects.get(name)
        if light:
            k = max(1.0, size / 2.5)
            light.location = centre + Vector(off) * k
            light.data.energy = {"PBR_Key": 700, "PBR_Fill": 300, "PBR_Rim": 700}[name] * k * k
            light.rotation_euler = (centre - light.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    data = json.loads((LEGO / "characters" / CHARACTER / "levels.json").read_text())
    top = collection(f"Lego_{CHARACTER.title()}_Levels")
    for i, lv in enumerate(data["levels"]):
        build_level(lv, i * LEVEL_SPACING, top)
    return top


if globals().get("RUN_MAIN", True):
    main()
