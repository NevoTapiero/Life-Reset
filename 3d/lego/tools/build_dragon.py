"""Generate rides/dragon.ldr: a brick-built dragon around the real Lego dragon head (24196).

Usage: python build_dragon.py ../rides/dragon.ldr
LDU: -Y up, front of the dragon = -Z, dragon's left = +X.
"""
import sys

I = "1 0 0 0 1 0 0 0 1"
RY90 = "0 0 1 0 1 0 -1 0 0"                      # long axis along Z
WING_L = "0 0.766 0.643 0 0.643 -0.766 -1 0 0"    # wing spans out to +X, tip raised 50 deg
WING_R = "0 -0.766 -0.643 0 0.643 -0.766 1 0 0"   # wing spans out to -X, tip raised 50 deg
BODY, BELLY, HORN = 320, 25, 297                  # Dark Red, Orange, Pearl Gold

lines = ["0 Ride - Dragon (brick-built, real Lego dragon head)", "0 Name: dragon.ldr"]


def p(color, x, y, z, rot, part):
    lines.append(f"1 {color} {x:g} {y:g} {z:g} {rot} {part}.dat")


lines.append("0 // legs")
for x in (-30, 30):
    for z in (-50, 50):
        p(BODY, x, -24, z, I, "3003")
        p(BODY, x, -48, z, I, "3003")
lines.append("0 // body: orange belly, dark red back, plates on top")
for z in (-60, -20, 20, 60):
    p(BELLY, 0, -72, z, I, "3001")
    p(BODY, 0, -96, z, I, "3001")
    p(BODY, 0, -104, z, I, "3020")
lines.append("0 // spine spikes")
for z in (-70, -30, 10, 50):
    p(HORN, 10, -128, z, I, "4589")
lines.append("0 // neck")
p(BODY, 0, -96, -100, I, "3003")
p(BODY, 0, -120, -100, I, "3003")
p(BODY, 0, -144, -120, I, "3003")
p(BODY, 0, -168, -120, I, "3003")
p(BODY, 0, -192, -120, I, "3003")
p(BODY, 0, -216, -140, I, "3003")
lines.append("0 // head")
p(BODY, 0, -222, -165, I, "24196p01")
p(BODY, 0, -222, -165, I, "24199")
lines.append("0 // tail (tapers down to the ground)")
p(BODY, 0, -72, 100, I, "3003")
p(BODY, 0, -72, 130, RY90, "3004")
p(BODY, 0, -48, 150, RY90, "3004")
p(BELLY, 0, -48, 170, RY90, "3040b")
lines.append("0 // wings")
p(BELLY, 117, -196, -10, WING_L, "30355")
p(BELLY, -117, -196, -10, WING_R, "30356")

open(sys.argv[1] if len(sys.argv) > 1 else "../rides/dragon.ldr", "w").write("\n".join(lines) + "\n")
print(len(lines), "lines")
