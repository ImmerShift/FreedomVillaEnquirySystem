import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadGuestStays,
  loadSeasons,
  loadFxRates,
  loadSettings,
  loadHolds,
  addHold,
  releaseHold,
  autoReleaseExpiredHolds,
  type GuestStayRow,
  type Season,
  type FxRate,
  type Hold,
} from "../db";
import { setActiveBookingId } from "../lib/activeBooking";
import { nightsBetween, fmtDate, findSeason, makeFormatter } from "../lib/pricing";
import { PageTitle } from "../components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addIso = (isoStr: string, n: number) => {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
};
const nextDay = (isoStr: string) => addIso(isoStr, 1);

type Tone = "confirmed" | "pending";
const toneOf = (r: GuestStayRow): Tone => (r.amount_paid > 0 ? "confirmed" : "pending");
// red = the villa is taken. Solid/stronger red = paid, lighter red = deposit/pending.
const TONE_BG: Record<Tone, string> = { confirmed: "#EFA3A0", pending: "#FBE3E2" };
const TONE_BAR: Record<Tone, string> = { confirmed: "#B5302C", pending: "#E2918C" };

// open dates (was "gap") use green so they read as "free to sell"
const OPEN_BORDER = "#7FB04A";
const OPEN_TEXT = "#3B6D11";

const HOLD_BG = "repeating-linear-gradient(135deg, #FBF1DA, #FBF1DA 6px, #F4E4BD 6px, #F4E4BD 12px)";
const CLEAN_BG = "repeating-linear-gradient(135deg, #F2F5F6, #F2F5F6 5px, #E9EDEF 5px, #E9EDEF 10px)";

const SEASON_BG: Record<string, string> = { Low: "#F2F8EC", High: "#FDF8EC", Peak: "#FBEFEC" };
const SEASON_TEXT: Record<string, string> = { Low: "#6E9456", High: "#B7841F", Peak: "#C0563B" };

interface Gap {
  start: string;
  end: string;
  nights: number;
}

const compactAud = (aud: number) =>
  aud >= 1000 ? `A$${(aud / 1000).toFixed(aud >= 10000 ? 0 : 1)}k` : `A$${Math.round(aud)}`;

export function Availability() {
  const navigate = useNavigate();
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [rows, setRows] = useState<GuestStayRow[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [buffer, setBuffer] = useState(0);
  const [revView, setRevView] = useState(false);

  // filters
  const [sourceFilter, setSourceFilter] = useState("");
  const [showSeasons, setShowSeasons] = useState(true);
  const [showHolds, setShowHolds] = useState(true);
  const [showGaps, setShowGaps] = useState(true);

  // hold form
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [holdForm, setHoldForm] = useState({
    guest_name: "",
    check_in: "",
    check_out: "",
    expires_on: "",
  });

  const reload = async () => {
    await autoReleaseExpiredHolds();
    const [all, se, fx, st, hs] = await Promise.all([
      loadGuestStays(),
      loadSeasons(),
      loadFxRates(),
      loadSettings(),
      loadHolds(),
    ]);
    setRows(all.filter((r) => r.status !== "Cancelled"));
    setSeasons(se);
    setFxRates(fx);
    setBuffer(Math.max(0, parseInt(st.buffer_days || "0", 10) || 0));
    setHolds(hs);
  };

  useEffect(() => {
    reload();
  }, []);

  const year = view.getFullYear();
  const month = view.getMonth();
  const monthStart = iso(new Date(year, month, 1));
  const monthEnd = iso(new Date(year, month + 1, 0));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = iso(today);
  const fmtAud = useMemo(() => makeFormatter("AUD", fxRates), [fxRates]);

  const sources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source).filter(Boolean))).sort(),
    [rows]
  );
  const visibleRows = useMemo(
    () => (sourceFilter ? rows.filter((r) => r.source === sourceFilter) : rows),
    [rows, sourceFilter]
  );

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const bookingOn = (dayIso: string) =>
    visibleRows.find((r) => r.check_in && r.check_out && dayIso >= r.check_in && dayIso < r.check_out);
  const arrivingOn = (dayIso: string) => visibleRows.find((r) => r.check_in === dayIso);
  const departingOn = (dayIso: string) => visibleRows.find((r) => r.check_out === dayIso);
  const holdOn = (dayIso: string) => holds.find((h) => dayIso >= h.check_in && dayIso < h.check_out);
  const isHeld = (dayIso: string) => holds.some((h) => dayIso >= h.check_in && dayIso < h.check_out);

  // cleaning/turnaround days: the `buffer` days after each checkout, when otherwise free
  const cleaningDays = useMemo(() => {
    const set = new Set<string>();
    if (buffer <= 0) return set;
    for (const r of visibleRows) {
      if (!r.check_out) continue;
      for (let k = 0; k < buffer; k++) set.add(addIso(r.check_out, k));
    }
    return set;
  }, [visibleRows, buffer]);

  const monthBookings = visibleRows
    .filter((r) => r.check_in && r.check_out && r.check_in <= monthEnd && r.check_out > monthStart)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const monthHolds = holds
    .filter((h) => h.check_in <= monthEnd && h.check_out > monthStart)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  let bookedNights = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (bookingOn(iso(new Date(year, month, day)))) bookedNights++;
  }
  const occPct = Math.round((bookedNights / daysInMonth) * 100);

  // gaps: runs of >= 3 consecutive bookable days (not booked, held or being cleaned)
  const { gapDays, gapList } = useMemo(() => {
    const gapDays = new Map<string, Gap>();
    const gapList: Gap[] = [];
    let run: string[] = [];
    const flush = () => {
      if (run.length >= 3) {
        const gap: Gap = { start: run[0], end: run[run.length - 1], nights: run.length };
        gapList.push(gap);
        for (const di of run) gapDays.set(di, gap);
      }
      run = [];
    };
    for (let day = 1; day <= daysInMonth; day++) {
      const di = iso(new Date(year, month, day));
      if (!bookingOn(di) && !isHeld(di) && !cleaningDays.has(di)) run.push(di);
      else flush();
    }
    flush();
    return { gapDays, gapList };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, holds, cleaningDays, year, month]);

  const openGapNights = gapList.reduce((n, g) => n + g.nights, 0);

  // confirmed revenue earned this month (prorated by nights in month)
  let confirmedRevenue = 0;
  for (const b of monthBookings) {
    if (b.amount_paid <= 0) continue;
    const total = nightsBetween(b.check_in, b.check_out);
    if (total <= 0) continue;
    let nim = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const di = iso(new Date(year, month, day));
      if (di >= b.check_in && di < b.check_out) nim++;
    }
    confirmedRevenue += (b.grand_total * nim) / total;
  }

  const openGuest = (id: number) => {
    setActiveBookingId(id);
    navigate("/quotation");
  };
  const fillGap = (g: Gap) =>
    navigate("/inquiry", { state: { checkIn: g.start, checkOut: nextDay(g.end) } });

  const submitHold = async () => {
    if (!holdForm.check_in || !holdForm.check_out || holdForm.check_out <= holdForm.check_in) return;
    await addHold({ ...holdForm, note: "" });
    setHoldForm({ guest_name: "", check_in: "", check_out: "", expires_on: "" });
    setShowHoldForm(false);
    await reload();
  };
  const onRelease = async (id: number) => {
    await releaseHold(id);
    await reload();
  };

  return (
    <div className="max-w-[1180px] mx-auto">
      <div className="flex items-end justify-between gap-6 mb-[26px] flex-wrap">
        <PageTitle
          eyebrow="Calendar"
          title="Availability"
          subtitle="Stays, holds, seasons, open dates and revenue — in one view."
        />
        <button
          onClick={() => setRevView((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#C5D2D2] rounded-md mb-1 text-[13px] font-semibold text-fv-ink hover:border-fv-ink transition-colors"
        >
          {revView ? "Occupancy view" : "Revenue view"}
        </button>
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

          {/* FILTERS */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="fv-input !w-auto !py-1.5 !px-2.5 !text-[12px] cursor-pointer appearance-none"
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="w-px h-5 bg-[#E6EDED]" />
            <FilterChip active={showSeasons} onClick={() => setShowSeasons((v) => !v)}>Seasons</FilterChip>
            <FilterChip active={showHolds} onClick={() => setShowHolds((v) => !v)}>Holds</FilterChip>
            <FilterChip active={showGaps} onClick={() => setShowGaps((v) => !v)}>Gaps</FilterChip>
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
              const dep = inMonth ? departingOn(dIso) : undefined;
              const arr = inMonth ? arrivingOn(dIso) : undefined;
              const sameDay = !!(dep && arr && dep.id !== arr.id);
              const hold = inMonth && !b && showHolds ? holdOn(dIso) : undefined;
              const cleaning = inMonth && !b && !hold && cleaningDays.has(dIso);
              const season = inMonth && !b && !hold && !cleaning && showSeasons ? findSeason(seasons, dIso) : null;
              const gap = inMonth && !b && !hold && !cleaning && showGaps ? gapDays.get(dIso) : undefined;
              const tone = b ? toneOf(b) : null;
              const isCheckIn = b && dIso === b.check_in;
              const isGapStart = gap && gap.start === dIso;
              const isToday = dIso === todayIso;

              let bg = inMonth ? "#FFFFFF" : "#FAFCFC";
              let bgImage: string | undefined;
              if (b && sameDay) {
                bgImage = `linear-gradient(135deg, ${TONE_BG[toneOf(dep!)]} 0 50%, ${TONE_BG[toneOf(arr!)]} 50% 100%)`;
              } else if (b) {
                bg = TONE_BG[tone as Tone];
              } else if (hold) {
                bgImage = HOLD_BG;
              } else if (cleaning) {
                bgImage = CLEAN_BG;
              } else if (season) {
                bg = SEASON_BG[season.name] || "#FFFFFF";
              }

              return (
                <div
                  key={i}
                  onClick={() => (b ? openGuest(b.id) : gap ? fillGap(gap) : undefined)}
                  className={`relative min-h-[76px] rounded-md px-2 py-1.5 text-left transition-colors ${
                    b || gap ? "cursor-pointer" : ""
                  } ${
                    gap
                      ? "border border-dashed"
                      : hold
                      ? "border border-dashed border-[#CFA13B]"
                      : isToday
                      ? "border border-fv-accent"
                      : "border border-[#EEF1F1]"
                  }`}
                  style={{
                    background: bg,
                    backgroundImage: bgImage,
                    borderColor: gap ? OPEN_BORDER : undefined,
                    borderLeft: b ? `3px solid ${TONE_BAR[tone as Tone]}` : undefined,
                  }}
                >
                  <div className={`text-[12.5px] font-semibold ${inMonth ? "text-[#3F4B55]" : "text-[#C3CFCF]"}`}>
                    {d.getDate()}
                  </div>
                  {sameDay && (
                    <div
                      className="absolute top-1 right-1.5 text-[10px] font-bold text-fv-accent-deep leading-none"
                      title={`${dep!.guest_name} out · ${arr!.guest_name} in`}
                    >
                      ⇄
                    </div>
                  )}
                  {isCheckIn && (
                    <div className="text-[11px] font-semibold text-fv-ink mt-1 leading-tight truncate">
                      {revView ? compactAud(b!.grand_total) : b!.guest_name}
                    </div>
                  )}
                  {hold && dIso === hold.check_in && (
                    <div className="text-[11px] font-semibold text-[#9C7B1E] mt-1 leading-tight truncate">
                      {hold.guest_name || "On hold"}
                    </div>
                  )}
                  {hold && (
                    <div className="absolute bottom-1 left-2 text-[8.5px] font-bold tracking-[0.6px] text-[#B98F22]">
                      HOLD
                    </div>
                  )}
                  {cleaning && (
                    <div className="absolute bottom-1 left-2 text-[8.5px] font-semibold text-[#94A2A8]">
                      Cleaning
                    </div>
                  )}
                  {!b && !hold && !cleaning && season && !revView && (
                    <div className="absolute bottom-1 left-2 text-[8.5px] font-semibold" style={{ color: SEASON_TEXT[season.name] || "#9AA7AE" }}>
                      {season.name} · {compactAud(season.nightly_rate)}
                    </div>
                  )}
                  {isGapStart && (
                    <div className="absolute bottom-1 right-1.5 text-[8.5px] font-bold" style={{ color: OPEN_TEXT }}>
                      {gap!.nights} open →
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* revenue stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            <Stat label="Occupancy" value={`${occPct}%`} />
            <Stat label="Confirmed revenue" value={fmtAud(confirmedRevenue)} accent />
            <Stat label="Open nights" value={String(openGapNights)} />
            <Stat label="Tentative holds" value={String(monthHolds.length)} />
          </div>

          <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[#EEF4F4] flex-wrap">
            <Legend bar={TONE_BAR.confirmed} bg={TONE_BG.confirmed} label="Booked · paid" />
            <Legend bar={TONE_BAR.pending} bg={TONE_BG.pending} label="Booked · deposit" />
            <span className="flex items-center gap-2 text-[12px] text-[#6B7780]">
              <span className="w-3.5 h-3.5 rounded-[3px] border border-dashed border-[#CFA13B]" style={{ backgroundImage: HOLD_BG }} />
              Hold
            </span>
            {buffer > 0 && (
              <span className="flex items-center gap-2 text-[12px] text-[#6B7780]">
                <span className="w-3.5 h-3.5 rounded-[3px] border border-[#E2E8EA]" style={{ backgroundImage: CLEAN_BG }} />
                Cleaning
              </span>
            )}
            <span className="flex items-center gap-2 text-[12px] text-[#6B7780]">
              <span className="w-3.5 h-3.5 rounded-[3px] border border-dashed bg-white" style={{ borderColor: OPEN_BORDER }} />
              Open dates (3+ nights)
            </span>
          </div>
        </div>

        {/* SIDE */}
        <div className="flex flex-col gap-6">
          <div className="bg-fv-band rounded-[9px] px-6 py-5 shadow-[0_1px_3px_rgba(30,58,95,0.05)]">
            <div className="text-[10px] font-semibold tracking-[2px] uppercase text-fv-accent-tint mb-3">
              {revView ? "Revenue" : "Occupancy"} · {MONTHS[month]}
            </div>
            <div className="text-[40px] font-light text-white leading-none mb-3.5">
              {revView ? fmtAud(confirmedRevenue) : `${occPct}%`}
            </div>
            {!revView && (
              <div className="h-[7px] rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-fv-accent-tint" style={{ width: `${occPct}%` }} />
              </div>
            )}
          </div>

          {/* TENTATIVE HOLDS */}
          <div className="fv-card p-7">
            <div className="flex items-center justify-between mb-3">
              <div className="fv-section-label">Tentative holds</div>
              <button
                onClick={() => setShowHoldForm((v) => !v)}
                className="text-[12px] font-semibold text-fv-accent-deep hover:underline"
              >
                {showHoldForm ? "Cancel" : "+ Add hold"}
              </button>
            </div>

            {showHoldForm && (
              <div className="mb-4 p-3 bg-[#FAFCFC] border border-[#EEF1F1] rounded-lg flex flex-col gap-2.5">
                <input
                  className="fv-input !py-2 !px-3 !text-[13px]"
                  placeholder="Guest / enquiry name"
                  value={holdForm.guest_name}
                  onChange={(e) => setHoldForm((f) => ({ ...f, guest_name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold tracking-[0.8px] uppercase text-[#9AA7AE]">Check-in</span>
                    <input
                      type="date"
                      className="fv-input !py-2 !px-2.5 !text-[12px]"
                      value={holdForm.check_in}
                      onChange={(e) => setHoldForm((f) => ({ ...f, check_in: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold tracking-[0.8px] uppercase text-[#9AA7AE]">Check-out</span>
                    <input
                      type="date"
                      className="fv-input !py-2 !px-2.5 !text-[12px]"
                      value={holdForm.check_out}
                      onChange={(e) => setHoldForm((f) => ({ ...f, check_out: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold tracking-[0.8px] uppercase text-[#9AA7AE]">Expires (auto-release)</span>
                  <input
                    type="date"
                    className="fv-input !py-2 !px-2.5 !text-[12px]"
                    value={holdForm.expires_on}
                    onChange={(e) => setHoldForm((f) => ({ ...f, expires_on: e.target.value }))}
                  />
                </label>
                <button
                  onClick={submitHold}
                  disabled={!holdForm.check_in || !holdForm.check_out || holdForm.check_out <= holdForm.check_in}
                  className="btn-accent !py-2 !text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add hold
                </button>
              </div>
            )}

            {holds.length === 0 ? (
              <div className="text-[13px] text-[#9AA7AE] italic">No active holds.</div>
            ) : (
              holds.map((h) => {
                const daysLeft = h.expires_on
                  ? Math.ceil(
                      (Date.parse(h.expires_on + "T00:00:00") - Date.parse(todayIso + "T00:00:00")) / 86_400_000
                    )
                  : null;
                return (
                  <div
                    key={h.id}
                    className="flex items-stretch gap-3 py-3 border-b border-[#EEF4F4] last:border-b-0"
                  >
                    <span className="w-1 rounded-full flex-none" style={{ background: "#CFA13B" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[14px] font-semibold text-fv-ink truncate">
                          {h.guest_name || "On hold"}
                        </span>
                        <button
                          onClick={() => onRelease(h.id)}
                          className="text-[12px] font-semibold text-[#9AA7AE] hover:text-[#C0392B] flex-none"
                        >
                          Release
                        </button>
                      </div>
                      <div className="text-[12px] text-[#7A8790]">
                        {fmtDate(h.check_in)} → {fmtDate(h.check_out)} · {nightsBetween(h.check_in, h.check_out)} nights
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {daysLeft == null ? (
                          <span className="text-[#9AA7AE]">No expiry</span>
                        ) : daysLeft <= 2 ? (
                          <span className="text-[#C0563B] font-semibold">
                            Expires in {daysLeft}d
                          </span>
                        ) : (
                          <span className="text-[#9AA7AE]">Expires in {daysLeft}d</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {gapList.length > 0 && (
            <div className="fv-card p-7">
              <div className="fv-section-label mb-3">Open dates</div>
              {gapList.map((g, i) => (
                <button
                  key={i}
                  onClick={() => fillGap(g)}
                  className="flex items-center justify-between w-full gap-2 py-2.5 border-b border-[#EEF4F4] last:border-b-0 text-left group"
                >
                  <span className="text-[13px] text-[#3F4B55]">
                    {fmtDate(g.start)} → {fmtDate(nextDay(g.end))} · <b>{g.nights} nights</b>
                  </span>
                  <span className="text-[12px] font-semibold text-fv-accent-deep group-hover:underline flex-none">Fill →</span>
                </button>
              ))}
            </div>
          )}

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
                        <span className="text-[12px] font-semibold text-fv-ink flex-none">{compactAud(b.grand_total)}</span>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#FAFCFC] border border-[#EEF1F1] rounded-lg px-3.5 py-3">
      <div className="text-[9px] font-bold tracking-[1.2px] uppercase text-[#9AA7AE] mb-1.5">{label}</div>
      <div className={`text-[20px] font-medium leading-none ${accent ? "text-fv-accent-deep" : "text-fv-ink"}`}>{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-fv-accent-soft text-fv-accent-deep border-fv-accent-soft-border"
          : "bg-white text-[#9AA7AE] border-[#E2E8EA] hover:border-[#C5D2D2]"
      }`}
    >
      {children}
    </button>
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
