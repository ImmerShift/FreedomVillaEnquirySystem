import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadGuestStays, type GuestStayRow } from "../db";
import { setActiveBookingId } from "../lib/activeBooking";
import { nightsBetween, fmtDate } from "../lib/pricing";
import { PageTitle } from "../components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Tone = "confirmed" | "pending";

// A booking confirms once any payment has landed; otherwise it's still pending.
const toneOf = (r: GuestStayRow): Tone => (r.amount_paid > 0 ? "confirmed" : "pending");

const TONE_BG: Record<Tone, string> = { confirmed: "#E7F4F3", pending: "#FDF6E8" };
const TONE_BAR: Record<Tone, string> = { confirmed: "#15A3A0", pending: "#E0B23C" };

export function Availability() {
  const navigate = useNavigate();
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [rows, setRows] = useState<GuestStayRow[]>([]);

  useEffect(() => {
    // cancelled stays don't occupy the calendar
    loadGuestStays().then((all) => setRows(all.filter((r) => r.status !== "Cancelled")));
  }, []);

  const year = view.getFullYear();
  const month = view.getMonth();
  const monthStart = iso(new Date(year, month, 1));
  const monthEnd = iso(new Date(year, month + 1, 0));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = iso(today);

  // 42-cell grid (6 weeks), Sunday-first, with leading/trailing days muted
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  // booking covering a given day (check_in <= day < check_out)
  const bookingOn = (dayIso: string) =>
    rows.find((r) => r.check_in && r.check_out && dayIso >= r.check_in && dayIso < r.check_out);

  // bookings overlapping the visible month
  const monthBookings = rows
    .filter((r) => r.check_in && r.check_out && r.check_in <= monthEnd && r.check_out > monthStart)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  // occupancy: booked nights within the month / nights in month
  let bookedNights = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (bookingOn(iso(new Date(year, month, day)))) bookedNights++;
  }
  const occPct = Math.round((bookedNights / daysInMonth) * 100);

  const openGuest = (id: number) => {
    setActiveBookingId(id);
    navigate("/quotation");
  };

  return (
    <div className="max-w-[1180px] mx-auto">
      <div className="flex items-end justify-between gap-6 mb-[26px] flex-wrap">
        <PageTitle
          eyebrow="Calendar"
          title="Availability"
          subtitle="Stays from your saved inquiries, in one view."
        />
        <div className="flex items-center gap-2 px-3.5 py-2 bg-[#F2F5F5] border border-[#E1E7E9] rounded-full mb-1">
          <span className="w-2 h-2 rounded-full bg-[#9AA7AE]" />
          <span className="text-[12.5px] font-semibold text-[#7A8790]">Offline · from saved inquiries</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        {/* CALENDAR */}
        <div className="fv-card p-7">
          <div className="flex items-center justify-between mb-4">
            <NavBtn dir="prev" onClick={() => setView(new Date(year, month - 1, 1))} />
            <div className="text-[20px] font-medium text-fv-ink tracking-[0.3px]">
              {MONTHS[month]} {year}
            </div>
            <NavBtn dir="next" onClick={() => setView(new Date(year, month + 1, 1))} />
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] font-bold tracking-[1px] uppercase text-[#9AA7AE] text-center">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              const dIso = iso(d);
              const inMonth = d.getMonth() === month;
              const b = inMonth ? bookingOn(dIso) : undefined;
              const tone = b ? toneOf(b) : null;
              const isCheckIn = b && dIso === b.check_in;
              const isToday = dIso === todayIso;
              return (
                <div
                  key={i}
                  onClick={() => b && openGuest(b.id)}
                  className={`min-h-[74px] rounded-md px-2 py-1.5 border text-left transition-colors ${
                    b ? "cursor-pointer" : ""
                  } ${isToday ? "border-fv-accent" : "border-[#EEF1F1]"}`}
                  style={{
                    background: b ? TONE_BG[tone as Tone] : inMonth ? "#FFFFFF" : "#FAFCFC",
                    borderLeft: b ? `3px solid ${TONE_BAR[tone as Tone]}` : undefined,
                  }}
                >
                  <div className={`text-[12.5px] font-semibold ${inMonth ? "text-[#3F4B55]" : "text-[#C3CFCF]"}`}>
                    {d.getDate()}
                  </div>
                  {isCheckIn && (
                    <div className="text-[11px] font-semibold text-fv-ink mt-1 leading-tight truncate">
                      {b!.guest_name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-5 mt-5 pt-4 border-t border-[#EEF4F4] flex-wrap">
            <Legend bar="#15A3A0" bg="#E7F4F3" label="Confirmed (deposit paid)" />
            <Legend bar="#E0B23C" bg="#FDF6E8" label="Pending" />
            <span className="text-[12px] text-[#9AA7AE]">Click a stay to open the guest.</span>
          </div>
        </div>

        {/* SIDE */}
        <div className="flex flex-col gap-6">
          <div className="bg-fv-band rounded-[9px] px-6 py-5 shadow-[0_1px_3px_rgba(30,58,95,0.05)]">
            <div className="text-[10px] font-semibold tracking-[2px] uppercase text-fv-accent-tint mb-3">
              Occupancy · {MONTHS[month]}
            </div>
            <div className="text-[40px] font-light text-white leading-none mb-3.5">{occPct}%</div>
            <div className="h-[7px] rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-fv-accent-tint" style={{ width: `${occPct}%` }} />
            </div>
          </div>

          <div className="fv-card p-7">
            <div className="fv-section-label mb-4">This Month</div>
            {monthBookings.length === 0 ? (
              <div className="text-[13px] text-[#9AA7AE] italic">No stays this month.</div>
            ) : (
              monthBookings.map((b) => {
                const tone = toneOf(b);
                return (
                  <div
                    key={b.id}
                    onClick={() => openGuest(b.id)}
                    className="flex items-stretch gap-3 py-3 border-b border-[#EEF4F4] last:border-b-0 cursor-pointer"
                  >
                    <span className="w-1 rounded-full flex-none" style={{ background: TONE_BAR[tone] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[14px] font-semibold text-fv-ink truncate">{b.guest_name}</span>
                        <span
                          className="text-[10px] font-bold tracking-[0.4px] uppercase rounded-full px-2 py-0.5 flex-none"
                          style={{ background: TONE_BG[tone], color: TONE_BAR[tone] }}
                        >
                          {tone === "confirmed" ? "Confirmed" : "Pending"}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#7A8790]">
                        {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {nightsBetween(b.check_in, b.check_out)} nights
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#F2F8F8] border border-[#DCEAEA] cursor-pointer transition-colors hover:border-fv-accent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#56636D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

function Legend({ bar, bg, label }: { bar: string; bg: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[12px] text-[#6B7780]">
      <span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: bg, borderLeft: `3px solid ${bar}` }} />
      {label}
    </span>
  );
}
