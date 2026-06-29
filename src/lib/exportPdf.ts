// One-click PDF export. Renders the document sheet to a high-res image and lays
// it onto an A4 portrait page at full width (edge-to-edge sides, no margins, no
// stretch), bypassing the browser print dialog so printer hardware margins can't
// add white edges. A toast confirms the save (the file lands in Downloads).

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const safe = (s: string) => s.replace(/[^\w\s-]+/g, "").replace(/\s+/g, " ").trim();
const A4_W = 210;
const A4_H = 297;

function showToast(msg: string, ms = 0): HTMLElement {
  const d = document.createElement("div");
  d.textContent = msg;
  d.style.cssText =
    "position:fixed;bottom:28px;right:28px;background:#1b3a5b;color:#fff;" +
    "font:600 13px/1.2 ui-sans-serif,system-ui,sans-serif;padding:12px 18px;border-radius:10px;" +
    "z-index:99999;box-shadow:0 8px 28px rgba(27,58,91,.28)";
  document.body.appendChild(d);
  if (ms) setTimeout(() => d.remove(), ms);
  return d;
}

export async function exportSheetPdf(docLabel: string, guestName?: string): Promise<void> {
  const el = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!el) {
    window.print();
    return;
  }

  const toast = showToast("Generating PDF…");
  try {
    const canvas = await html2canvas(el, {
      scale: 3, // crisp at print resolution
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Full page width → sides run edge-to-edge with no margin. Natural height
    // (no stretch); a document shorter than the page just has white below it.
    const imgHmm = (canvas.height / canvas.width) * A4_W;
    if (imgHmm <= A4_H) {
      pdf.addImage(imgData, "JPEG", 0, 0, A4_W, imgHmm);
    } else {
      const w = (canvas.width / canvas.height) * A4_H;
      pdf.addImage(imgData, "JPEG", (A4_W - w) / 2, 0, w, A4_H);
    }

    const name = guestName ? ` - ${safe(guestName)}` : "";
    pdf.save(`Freedom Villa - ${docLabel}${name}.pdf`);

    toast.remove();
    showToast("Saved to your Downloads folder ✓", 3000);
  } catch (err) {
    console.error("PDF export failed:", err);
    toast.remove();
    showToast("Couldn't generate the PDF — please try again", 3500);
  }
}
