// One-click PDF export. Renders the document sheet to a high-res image, lays it
// onto an A4 portrait page at full width (edge-to-edge sides, no margins, no
// stretch), then lets the user choose where to save it via a native "Save As"
// dialog (desktop). On the web build it falls back to a normal download.

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./env";

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
    const filename = `Freedom Villa - ${docLabel}${name}.pdf`;

    if (isTauri()) {
      // Native Save As — the user picks the folder.
      const dataUri = pdf.output("datauristring");
      const b64 = dataUri.split("base64,")[1] || "";
      toast.textContent = "Choose where to save…";
      const saved = await invoke<boolean>("save_pdf", { defaultName: filename, dataB64: b64 });
      toast.remove();
      if (saved) showToast("PDF saved ✓", 3000);
    } else {
      pdf.save(filename); // web build → browser download
      toast.remove();
      showToast("PDF downloaded ✓", 3000);
    }
  } catch (err) {
    console.error("PDF export failed:", err);
    toast.remove();
    showToast("Couldn't generate the PDF — please try again", 3500);
  }
}
