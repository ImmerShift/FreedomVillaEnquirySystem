import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadGuestStays,
  loadFxRates,
  setBookingCancelled,
  loadFollowups,
  addFollowup,
  toggleFollowup,
  deleteFollowup,
  type GuestStayRow,
  type FxRate,
  type Followup,
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

const SOURCE_FILTERS = [
  "All",
  "Direct (website)",
  "Direct (phone)",
  "Direct (WhatsApp)",
  "OTA — Airbnb",
  "OTA — Booking.com",
  "OTA — VRBO",
  "Agent",
];
const STATUS_FILTERS = ["All", "Enquiry", "Quoted", "Part-paid", "Paid", "Cancelled"];

function deriveStatus(r: GuestStayRow): string {
  if (r.status === "Cancelled") return "Cancelled";
  if (r.grand_total > 0 && r.amount_paid >= r.grand_total) return "Paid";
  if (r.amount_paid > 0) return "Part-paid";
  if (r.quote_sent_at) return "Quoted";
  return "Enquiry";
}

export function GuestsStay() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GuestStayRow[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [monthF, setMonthF] = useState("");
  const [sourceF, setSourceF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [fuDate, setFuDate] = useState(new Date().toISOString().slice(0, 10));
  const [fuNote, setFuNote] = useState("");

  const loadFu = async (bookingId: number) => setFollowups(await loadFollowups(bookingId));
  useEffect(() => {
    if (expandedId != null) loadFu(expandedId);
    else setFollowups([]);
  }, [expandedId]);

  const onAddFu = async () => {
    if (expandedId == null || !fuNote.trim()) return;
    await addFollowup(expandedId, fuDate, fuNote.trim());
    setFuNote("");
    await loadFu(expandedId);
    reload();
  };
  const onToggleFu = async (id: number, done: boolean) => {
    await toggleFollowup(id, done);
    if (expandedId != null) await loadFu(expandedId);
    reload();
  };
  const onDeleteFu = async (id: number) => {
    await deleteFollowup(id);
    if (expandedId != null) await loadFu(expandedId);
    reload();
  };

  const totalDue = rows.reduce((n, r) => n + (r.followups_due || 0), 0);

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

  // emails appearing on more than one booking → returning guests
  const returningEmails = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const e = (r.email || "").trim().toLowerCase();
      if (e) counts.set(e, (counts.get(e) || 0) + 1);
    }
    return new Set([...counts].filter(([, c]) => c > 1).map(([e]) => e));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.guest_name} ${r.email || ""}`.toLowerCase().includes(q)) return false;
      if (monthF && !(r.check_in || "").startsWith(monthF)) return false;
      if (sourceF !== "All" && r.source !== sourceF) return false;
      if (statusF !== "All" && deriveStatus(r) !== statusF) return false;
      return true;
    });
  }, [rows, search, monthF, sourceF, statusF]);

  const hasFilters = !!search || !!monthF || sourceF !== "All" || statusF !== "All";
  const clearFilters = () => {
    setSearch("");
    setMonthF("");
    setSourceF("All");
    setStatusF("All");
  };

  return (
    <div className="max-w-[1180px] mx-auto">
      <PageTitle
        eyebrow="Pipeline"
        title="Guests Stay"
        subtitle="Click a guest to manage follow-ups and open their documents."
      />

      {totalDue > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-[#FDF6E8] border border-[#EAD9A8] rounded-lg text-[13px] text-[#8A6D1F]">
          🔔 <b className="font-semibold">{totalDue}</b> follow-up{totalDue > 1 ? "s" : ""} due today or overdue.
        </div>
      )}

      {loaded && rows.length > 0 && (
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="fv-input !py-2.5 flex-1 min-w-[200px]"
          />
          <input
            type="month"
            value={monthF}
            onChange={(e) => setMonthF(e.target.value)}
            className="fv-input !py-2 !text-[13px] w-[150px]"
          />
          <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} className="fv-input !py-2.5 !text-[13px] cursor-pointer appearance-none w-[170px]">
            {SOURCE_FILTERS.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All sources" : s}</option>
            ))}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="fv-input !py-2.5 !text-[13px] cursor-pointer appearance-none w-[130px]">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All status" : s}</option>
            ))}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[12.5px] font-semibold text-[#7A8790] hover:text-fv-ink px-2">
              Clear
            </button>
          )}
        </div>
      )}

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

          {filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-[14px] text-[#9AA7AE]">
              No bookings match these filters.
            </div>
          )}
          {filtered.map((r) => {
            const fmt = makeFormatter(r.currency || "AUD", fxRates);
            const nights = nightsBetween(r.check_in, r.check_out);
            const inv = invoiceChip(r.grand_total, r.amount_paid);
            const pers = personalizeChip(r.personalize_status);
            const quoteSent = !!r.quote_sent_at;
            const cancelled = r.status === "Cancelled";
            const returning = returningEmails.has((r.email || "").trim().toLowerCase());
            const expanded = expandedId === r.id;
            const due = r.followups_due || 0;
            return (
              <div key={r.id}>
                <div
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className={`grid grid-cols-[1.6fr_1.4fr_0.6fr_1fr_1fr_1fr_84px] gap-3.5 items-center px-6 py-[17px] border-b border-[#F0F4F4] cursor-pointer transition-colors ${
                    expanded ? "bg-[#F4FBFB]" : cancelled ? "bg-[#FBFCFC] opacity-60" : "hover:bg-[#FAFDFD]"
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
                    {!cancelled && returning && (
                      <span className="text-[9.5px] font-bold tracking-[0.6px] uppercase text-fv-accent-deep bg-fv-accent-soft border border-fv-accent-soft-border rounded-full px-2 py-0.5">
                        Returning
                      </span>
                    )}
                    {due > 0 && (
                      <span className="text-[9.5px] font-bold tracking-[0.6px] uppercase text-[#B7841F] bg-[#FDF6E8] border border-[#EAD9A8] rounded-full px-2 py-0.5">
                        {due} due
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

                {expanded && (
                  <div className="px-6 py-5 bg-[#F8FCFC] border-b border-[#E6EDED]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="fv-section-label">Follow-ups</span>
                      <button className="btn-accent !py-2 !px-4" onClick={() => openGuest(r.id)}>
                        Open documents →
                      </button>
                    </div>
                    {followups.length > 0 && (
                      <div className="mb-3">
                        {followups.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 py-2 border-b border-[#EEF4F4] text-[13px]">
                            <input type="checkbox" checked={f.done === 1} onChange={(e) => onToggleFu(f.id, e.target.checked)} className="w-4 h-4 accent-[#15A3A0] flex-none" />
                            <span className={`w-[92px] flex-none ${f.done ? "text-[#B8C5C5]" : "text-[#7A8790]"}`}>{fmtDate(f.due_date || "")}</span>
                            <span className={`flex-1 min-w-0 ${f.done ? "line-through text-[#B8C5C5]" : "text-[#3F4B55]"}`}>{f.note}</span>
                            <button onClick={() => onDeleteFu(f.id)} className="text-[16px] text-[#B8C5C5] hover:text-[#C0392B] flex-none leading-none">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-[150px_1fr_auto] gap-2.5">
                      <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="fv-input !py-2 !text-[13px]" />
                      <input value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder="e.g. Chase balance, send villa guide…" className="fv-input !py-2 !text-[13px]" onKeyDown={(e) => { if (e.key === "Enter") onAddFu(); }} />
                      <button onClick={onAddFu} className="btn-accent !py-2">Add</button>
                    </div>
                  </div>
                )}
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
