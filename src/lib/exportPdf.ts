// One-click PDF export. Renders the document sheet to a high-res image and
// drops it into a PDF page sized to the sheet — zero margins, edge-to-edge,
// no browser print dialog (so "Microsoft Print to PDF" margins can't intrude).

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

const safe = (s: string) => s.replace(/[^\w\s-]+/g, "").replace(/\s+/g, " ").trim();

export async function exportSheetPdf(docLabel: string, guestName?: string): Promise<void> {
  const el = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!el) {
    window.print(); // fallback if the sheet isn't on screen
    return;
  }

  const canvas = await html2canvas(el, {
    scale: 3, // crisp text at print resolution
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const wmm = 210; // A4 width
  const hmm = (canvas.height / canvas.width) * wmm;

  const pdf = new jsPDF({ unit: "mm", format: [wmm, hmm], orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "JPEG", 0, 0, pw, ph);

  const name = guestName ? ` - ${safe(guestName)}` : "";
  pdf.save(`Freedom Villa - ${docLabel}${name}.pdf`);
}
