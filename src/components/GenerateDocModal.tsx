import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadDocStatus, type GuestStayRow } from "../db";
import { setActiveBookingId } from "../lib/activeBooking";
import { fmtDate, nightsBetween } from "../lib/pricing";

type Tone = "teal" | "green" | "grey";
const CHIP: Record<Tone, string> = {
  teal: "text-fv-accent-deep bg-fv-accent-soft border-fv-accent-soft-border",
  green: "text-[#3F8F5B] bg-[#EEF6EE] border-[#C5DEC2]",
  grey: "text-[#7A8790] bg-[#F2F5F5] border-[#E1E7E9]",
};

interface DocDef {
  key: string;
  label: string;
  route: string;
  desc: string;
  tracked: boolean; // tracked in doc_status (vs. personalize_status on the booking)
}

const DOCS: DocDef[] = [
  { key: "quotation", label: "Quotation", route: "/quotation", desc: "Price offer to send the guest", tracked: true },
  { key: "invoice", label: "Invoice", route: "/invoice", desc: "Request payment of the balance", tracked: true },
  { key: "receipt", label: "Receipt", route: "/receipt", desc: "Confirm a payment received", tracked: true },
  { key: "personalization", label: "Personalization", route: "/personalization", desc: "Collect arrival & bedding details", tracked: false },
  { key: "instructions", label: "Villa Instructions", route: "/instructions", desc: "Pre-arrival guest guide", tracked: true },
];

interface TrackStatus {
  sent_at: string | null;
  pdf_saved_at: string | null;
}

/** Guest-first hub: pick which document to generate for a saved booking. */
export function GenerateDocModal({ row, onClose }: { row: GuestStayRow; onClose: () => void }) {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<Record<string, TrackStatus | null>>({});

  useEffect(() => {
    (async () => {
      const tracked = DOCS.filter((d) => d.tracked);
      const results = await Promise.all(tracked.map((d) => loadDocStatus(row.id, d.key)));
      const map: Record<string, TrackStatus | null> = {};
      tracked.forEach((d, i) => {
        map[d.key] = results[i];
      });
      setStatuses(map);
    })();
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (route: string) => {
    setActiveBookingId(row.id);
    navigate(route);
  };

  const statusFor = (d: DocDef): { tone: Tone; text: string } => {
    if (!d.tracked) {
      return row.personalize_status === "Received"
        ? { tone: "green", text: "Received" }
        : { tone: "grey", text: "Pending" };
    }
    const s = statuses[d.key];
    if (s?.sent_at) return { tone: "green", text: `Sent ${fmtDate(s.sent_at.slice(0, 10))}` };
    if (s?.pdf_saved_at) return { tone: "teal", text: "PDF saved" };
    return { tone: "grey", text: "Not started" };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,40,46,0.42)] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] w-full max-w-[520px] shadow-[0_24px_60px_rgba(20,40,46,0.32)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-5 border-b border-[#EEF1F1]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-[2.5px] uppercase text-fv-accent-deep mb-1.5">
                Generate document
              </div>
              <div className="text-[21px] font-medium text-fv-ink leading-tight truncate">
                {row.guest_name}
              </div>
              <div className="text-[12.5px] text-[#9AA7AE] mt-1">
                {fmtDate(row.check_in)} → {fmtDate(row.check_out)} · {nightsBetween(row.check_in, row.check_out)} nights
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[22px] leading-none text-[#B8C5C5] hover:text-fv-ink flex-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          {DOCS.map((d) => {
            const s = statusFor(d);
            return (
              <button
                key={d.key}
                onClick={() => pick(d.route)}
                className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-lg hover:bg-[#F4FBFB] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-fv-ink">{d.label}</div>
                  <div className="text-[12.5px] text-[#9AA7AE] mt-0.5">{d.desc}</div>
                </div>
                <span className={`inline-block text-[11px] font-semibold tracking-[0.4px] rounded-full px-2.5 py-1 border flex-none ${CHIP[s.tone]}`}>
                  {s.text}
                </span>
                <span className="text-[#C3CFCF] group-hover:text-fv-accent-deep flex-none text-[16px]">→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
