import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadGuestStays,
  loadFxRates,
  setBookingCancelled,
  type GuestStayRow,
  type FxRate,
} from "../db";
import { setActiveBookingId } from "../lib/activeBooking";
import { makeFormatter, nightsBetween, fmtDate } from "../lib/pricing";
import { PageTitle } from "../components/ui";

type ChipTone = "teal" | "green" | "amber" | "grey";

const CHIP: Record<ChipTone, string> = {
  teal: "text-fv-accent-deep bg-fv-accent-soft border-fv-accent-soft-border",
  green: "text-[#3F8F5B] bg-[#EEF6EE] border-[#C5DEC2]",
  amber: "text-[#B7841F] bg-[#FDF6E8] border-[#EAD9A8]",
  grey: "text-[#7A8790] bg-[#F2F5F5] border-[#E1E7E9]",
};

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return (
    <span className={`inline-block text-[11px] font-semibold tracking-[0.4px] rounded-full px-2.5 py-1 border ${CHIP[tone]}`}>
      {children}
    </span>
  );
}

/** Invoice state is derived from what's actually been paid. */
function invoiceChip(grandTotal: number, paid: number): { tone: ChipTone; text: string } {
  if (grandTotal > 0 && paid >= grandTotal) return { tone: "green", text: "Paid" };
  if (paid > 0) return { tone: "amber", text: "Part-paid" };
  return { tone: "grey", text: "Due" };
}

function personalizeChip(status: string): { tone: ChipTone; text: string } {
  return status === "Received"
    ? { tone: "green", text: "Received" }
    : { tone: "grey", text: "Pending" };
}

export function GuestsStay() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GuestStayRow[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const [r, fx] = await Promise.all([loadGuestStays(), loadFxRates()]);
    setRows(r);
    setFxRates(fx);
    setLoaded(true);
  };
  useEffect(() => {
    reload();
  }, []);

  const openGuest = (id: number) => {
    setActiveBookingId(id);
    navigate("/quotation");
  };
  const toggleCancel = async (e: React.MouseEvent, id: number, cancelled: boolean) => {
    e.stopPropagation();
    await setBookingCancelled(id, !cancelled);
    reload();
  };

  return (
    <div className="max-w-[1180px] mx-auto">
      <PageTitle
        eyebrow="Pipeline"
        title="Guests Stay"
        subtitle="Every saved inquiry. Click a guest to load their documents."
      />

      {loaded && rows.length === 0 ? (
        <div className="fv-card p-10 text-center">
          <p className="text-[15px] text-[#6B7780] mb-5">
            No inquiries saved yet. Create one on the New Inquiry screen.
          </p>
          <button className="btn-accent" onClick={() => navigate("/inquiry")}>
            Go to New Inquiry
          </button>
        </div>
      ) : (
        <div className="fv-card overflow-hidden">
          {/* header */}
          <div className="grid grid-cols-[1.6fr_1.4fr_0.6fr_1fr_1fr_1fr_84px] gap-3.5 px-6 py-4 bg-[#FAFCFC] border-b border-[#EEF1F1]">
            <Col>Guest</Col>
            <Col>Stay dates</Col>
            <Col className="text-center">Pax</Col>
            <Col className="text-center">Quote</Col>
            <Col className="text-center">Invoice</Col>
            <Col className="text-center">Personalize</Col>
            <Col />
          </div>

          {rows.map((r) => {
            const fmt = makeFormatter(r.currency || "AUD", fxRates);
            const nights = nightsBetween(r.check_in, r.check_out);
            const inv = invoiceChip(r.grand_total, r.amount_paid);
            const pers = personalizeChip(r.personalize_status);
            const quoteSent = !!r.quote_sent_at;
            const cancelled = r.status === "Cancelled";
            return (
              <div
                key={r.id}
                onClick={() => !cancelled && openGuest(r.id)}
                className={`grid grid-cols-[1.6fr_1.4fr_0.6fr_1fr_1fr_1fr_84px] gap-3.5 items-center px-6 py-[17px] border-b border-[#F0F4F4] transition-colors ${
                  cancelled ? "bg-[#FBFCFC] opacity-60" : "cursor-pointer hover:bg-[#FAFDFD]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[15px] font-semibold text-fv-ink ${cancelled ? "line-through" : ""}`}>
                      {r.guest_name}
                    </span>
                    {cancelled && (
                      <span className="text-[9.5px] font-bold tracking-[0.6px] uppercase text-[#B5503A] bg-[#FBEEEA] border border-[#E8C3B6] rounded-full px-2 py-0.5">
                        Cancelled
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[#9AA7AE] mt-0.5">
                    {fmt(r.grand_total)}
                    {r.country ? ` · ${r.country}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[13.5px] text-[#3F4B55]">
                    {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                  </div>
                  <div className="text-[11.5px] text-[#9AA7AE] mt-px">{nights} nights</div>
                </div>
                <span className="text-[14px] font-semibold text-[#3F4B55] text-center">{r.num_guests}</span>
                <span className="text-center">
                  <Chip tone={quoteSent ? "green" : "teal"}>{quoteSent ? "Sent" : "Ready"}</Chip>
                </span>
                <span className="text-center">
                  <Chip tone={inv.tone}>{inv.text}</Chip>
                </span>
                <span className="text-center">
                  <Chip tone={pers.tone}>{pers.text}</Chip>
                </span>
                <span className="text-right">
                  <button
                    onClick={(e) => toggleCancel(e, r.id, cancelled)}
                    className={`text-[12px] font-semibold bg-transparent border-none cursor-pointer ${
                      cancelled ? "text-fv-accent-deep" : "text-[#9AA7AE] hover:text-[#C0392B]"
                    }`}
                  >
                    {cancelled ? "Restore" : "Cancel"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Col({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-bold tracking-[1.4px] uppercase text-ink-400 ${className}`}>
      {children}
    </span>
  );
}
