// One-click PDF export. Renders the document sheet to a high-res image and lays
// it onto an A4 page at full width (edge-to-edge sides, no margins, no stretch),
// bypassing the browser print dialog so printer hardware margins can't intrude.

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const safe = (s: string) => s.replace(/[^\w\s-]+/g, "").replace(/\s+/g, " ").trim();
const A4_WIDTH_PX = 794; // 210mm @ 96dpi — render at this so the doc reflows to A4 width
const A4_W = 210;
const A4_H = 297;

export async function exportSheetPdf(docLabel: string, guestName?: string): Promise<void> {
  const el = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!el) {
    window.print(); // fallback if the sheet isn't on screen
    return;
  }

  // Render the sheet at a fixed A4 width so it reflows the same every time,
  // regardless of the window size.
  const prevWidth = el.style.width;
  const prevMaxWidth = el.style.maxWidth;
  el.style.width = `${A4_WIDTH_PX}px`;
  el.style.maxWidth = `${A4_WIDTH_PX}px`;

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, {
      scale: 2.5, // crisp at print resolution
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: A4_WIDTH_PX + 160,
    });
  } finally {
    el.style.width = prevWidth;
    el.style.maxWidth = prevMaxWidth;
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Full page width → sides run edge-to-edge with no margin. Height keeps the
  // image's aspect ratio (no stretch). A document shorter than the page simply
  // has white below it, like any letter.
  const imgHmm = (canvas.height / canvas.width) * A4_W;
  if (imgHmm <= A4_H) {
    pdf.addImage(imgData, "JPEG", 0, 0, A4_W, imgHmm);
  } else {
    // Taller than one page (rare for a one-page doc): scale to fit the height.
    const w = (canvas.width / canvas.height) * A4_H;
    pdf.addImage(imgData, "JPEG", (A4_W - w) / 2, 0, w, A4_H);
  }

  const name = guestName ? ` - ${safe(guestName)}` : "";
  pdf.save(`Freedom Villa - ${docLabel}${name}.pdf`);
}
