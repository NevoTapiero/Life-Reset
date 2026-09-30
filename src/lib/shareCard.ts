// "Share my card": draws the collectible minifig card as a 1080x1350 PNG in
// the browser (card colours, studs, the minifig SVG from the page, name and
// level) and hands it to the phone's share sheet, or downloads it.

import { CARD_COLORS } from "@/components/MinifigCard";

type CardInfo = { character: string | null; level: number; name: string; title: string; svg: SVGSVGElement; invite?: string | null };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function svgImage(svg: SVGSVGElement, height: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("height", String(height));
  clone.setAttribute("width", String((height * vb.width) / vb.height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    // onload rather than decode(): decode() on SVG is flaky in some browsers
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error("minifig image"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function shareCard(info: CardInfo): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "failed";
  const [top, bottom] = CARD_COLORS[info.character ?? "warrior"] ?? CARD_COLORS.warrior;
  const brick = getComputedStyle(document.body).getPropertyValue("--font-brick").trim() || "sans-serif";
  const body = getComputedStyle(document.body).getPropertyValue("--font-body").trim() || "sans-serif";

  // the card: colour gradient with a faint stud grid
  const g = ctx.createLinearGradient(0, 0, 200, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  for (let y = 30; y < H; y += 60) for (let x = 30; x < W; x += 60) {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // spotlight
  const spot = ctx.createRadialGradient(W / 2, 560, 20, W / 2, 560, 460);
  spot.addColorStop(0, "rgba(255,255,255,0.35)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // brand tag, top left
  ctx.save();
  ctx.translate(70, 70);
  ctx.rotate(-0.05);
  ctx.fillStyle = "#8a1206";
  roundRect(ctx, 0, 10, 330, 120, 26);
  ctx.fill();
  ctx.fillStyle = "#c91a09";
  roundRect(ctx, 0, 0, 330, 120, 26);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 30px ${brick}`;
  ctx.fillText("SOLO LEVELING", 28, 50);
  ctx.fillStyle = "#f2cd37";
  ctx.font = `700 44px ${brick}`;
  ctx.fillText("MINIFIGURES", 26, 98);
  ctx.restore();

  // level badge, top right
  ctx.fillStyle = "#c6d1dc";
  ctx.beginPath();
  ctx.arc(W - 140, 140, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(W - 140, 130, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#f2cd37";
  ctx.stroke();
  ctx.fillStyle = "#5d6b77";
  ctx.textAlign = "center";
  ctx.font = `700 26px ${brick}`;
  ctx.fillText("LV", W - 140, 104);
  ctx.fillStyle = "#1b2a34";
  ctx.font = `700 76px ${brick}`;
  ctx.fillText(String(info.level), W - 140, 172);

  // the minifig
  const fig = await svgImage(info.svg, 760);
  ctx.drawImage(fig, (W - fig.width) / 2, 230, fig.width, fig.height);

  // nameplate
  ctx.fillStyle = "#c6d1dc";
  roundRect(ctx, 60, H - 290, W - 120, 220, 40);
  ctx.fill();
  ctx.fillStyle = "#fff";
  roundRect(ctx, 60, H - 300, W - 120, 220, 40);
  ctx.fill();
  ctx.fillStyle = "#1b2a34";
  ctx.font = `700 84px ${brick}`;
  ctx.fillText(info.name, W / 2, H - 185, W - 180);
  ctx.fillStyle = "#5d6b77";
  ctx.font = `800 40px ${body}`;
  ctx.fillText(info.title, W / 2, H - 120, W - 180);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `${info.name}-minifig.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "My LEGO minifig",
        text: info.invite ? `${info.name}, ${info.title}. Come build in my town: ${info.invite}` : `${info.name}, ${info.title}`,
      });
      return "shared";
    } catch (e) {
      // closed the share sheet: nothing to say
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // anything else (iOS drops the tap after the slow drawing): save it instead
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
