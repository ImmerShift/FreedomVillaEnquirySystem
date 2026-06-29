import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadGuestStays,
  loadFxRates,
  loadHolds,
  loadDueFollowups,
  loadSettings,
  autoReleaseExpiredHolds,
  toggleFollowup,
  type GuestStayRow,
  type FxRate,
  type Hold,
  type DueFollowup,
  type Settings,
} from "../db";
import { makeFormatter, fmtDate, nightsBetween } from "../lib/pricing";
import { GenerateDocModal } from "../components/GenerateDocModal";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function Home() {
  const navigate = useNavigate();
  const today = new Date();
  const todayIso = iso(today);

  const [rows, setRows] = useState<GuestStayRow[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [due, setDue] = useState<DueFollowup[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [docRow, setDocRow] = useState<GuestStayRow | null>(null);

  const reload = async () => {
    await autoReleaseExpiredHolds();
    const [r, fx, h, d, s] = await Promise.all([
      loadGuestStays(),
      loadFxRates(),
      loadHolds(),
      loadDueFollowups(),
      loadSettings(),
    ]);
    setRows(r.filter((x) => x.status !== "Cancelled"));
    setFxRates(fx);
    setHolds(h);
    setDue(d);
    setSettings(s);
  };
  useEffect(() => {
    reload();
  }, []);

  const fmtAud = useMemo(() => makeFormatter("AUD", fxRates), [fxRates]);

  // ---- derived ----
  const horizon = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30));

  const arrivals = useMemo(
    () =>
      rows
        .filter((r) => r.check_in && r.check_in >= todayIso)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [rows, todayIso]
  );
  const inHouse = useMemo(
    () => rows.filter((r) => r.check_in && r.check_out && r.check_in <= todayIso && r.check_out > todayIso),
    [rows, todayIso]
  );
  const upcoming30 = arrivals.filter((r) => r.check_in <= horizon);

  const outstanding = rows.reduce((n, r) => {
    if (!r.check_out || r.check_out < todayIso) return n; // ignore past stays
    return n + Math.max(0, r.grand_total - r.amount_paid);
  }, 0);

  // occupancy this month
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let bookedNights = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const di = iso(new Date(year, month, day));
    if (rows.some((r) => r.check_in && r.check_out && di >= r.check_in && di < r.check_out)) bookedNights++;
  }
  const occPct = Math.round((bookedNights / daysInMonth) * 100);

  const holdsSoon = useMemo(
    () => [...holds].sort((a, b) => (a.expires_on || "9999").localeCompare(b.expires_on || "9999")),
    [holds]
  );

  const onDoneFu = async (id: number) => {
    await toggleFollowup(id, true);
    reload();
  };

  const villaName = settings.villa_name || "Freedom Villa";
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="max-w-[1180px] mx-auto">
      {/* header */}
      <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
            {greeting}
          </div>
          <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] tracking-[0.3px] m-0 mb-2">
            {villaName}
          </h1>
          <div className="text-[13.5px] text-[#6B7780]">
            {WEEKDAY(today)}, {today.getDate()} {MONTHS[month]} {year}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-none mb-1">
          <button className="btn-ghost" onClick={() => navigate("/availability")}>
            Calendar
          </button>
          <button className="btn-ghost" onClick={() => navigate("/guests")}>
            All guests
          </button>
          <button className="btn-accent" onClick={() => navigate("/inquiry")}>
            New inquiry
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Arrivals · next 30 days" value={String(upcoming30.length)} onClick={() => navigate("/availability")} />
        <StatCard label="Outstanding balance" value={fmtAud(outstanding)} accent />
        <StatCard
          label="Follow-ups due"
          value={String(due.length)}
          alert={due.length > 0}
          onClick={() => navigate("/guests")}
        />
        <StatCard label="Occupancy · this month" value={`${occPct}%`} />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-6 items-start">
        {/* LEFT: arrivals + in-house */}
        <div className="flex flex-col gap-6">
          <div className="fv-card p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="fv-section-label">Upcoming arrivals</div>
              <button onClick={() => navigate("/availability")} className="text-[12px] font-semibold text-fv-accent-deep hover:underline">
                Calendar →
              </button>
            </div>
            {arrivals.length === 0 ? (
              <Empty>No upcoming arrivals. Create a new inquiry to get started.</Empty>
            ) : (
              arrivals.slice(0, 6).map((r) => {
                const balance = Math.max(0, r.grand_total - r.amount_paid);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 py-3 border-b border-[#EEF4F4] last:border-b-0"
                  >
                    <DayBadge isoDate={r.check_in} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-semibold text-fv-ink truncate">{r.guest_name}</div>
                      <div className="text-[12px] text-[#7A8790]">
                        {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {nightsBetween(r.check_in, r.check_out)} nights
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-none">
                      <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${
                        balance <= 0
                          ? "text-[#3F8F5B] bg-[#EEF6EE] border-[#C5DEC2]"
                          : "text-[#B7841F] bg-[#FDF6E8] border-[#EAD9A8]"
                      }`}>
                        {balance <= 0 ? "Paid" : `${fmtAud(balance)} due`}
                      </span>
                      <button
                        onClick={() => setDocRow(r)}
                        className="text-[12px] font-semibold text-fv-accent-deep hover:underline"
                      >
                        Documents →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {inHouse.length > 0 && (
            <div className="fv-card p-7">
              <div className="fv-section-label mb-4">In the villa now</div>
              {inHouse.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3 border-b border-[#EEF4F4] last:border-b-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-fv-accent flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-semibold text-fv-ink truncate">{r.guest_name}</div>
                    <div className="text-[12px] text-[#7A8790]">
                      Checks out {fmtDate(r.check_out)}
                    </div>
                  </div>
                  <button onClick={() => setDocRow(r)} className="text-[12px] font-semibold text-fv-accent-deep hover:underline flex-none">
                    Documents →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: follow-ups + holds */}
        <div className="flex flex-col gap-6">
          <div className="fv-card p-7">
            <div className="fv-section-label mb-4">Follow-ups due</div>
            {due.length === 0 ? (
              <Empty>Nothing due. You're all caught up.</Empty>
            ) : (
              due.map((f) => (
                <div key={f.id} className="flex items-start gap-2.5 py-2.5 border-b border-[#EEF4F4] last:border-b-0">
                  <input
                    type="checkbox"
                    onChange={() => onDoneFu(f.id)}
                    className="w-4 h-4 accent-[#15A3A0] flex-none mt-0.5"
                    title="Mark done"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-[#3F4B55] leading-snug">{f.note}</div>
                    <div className="text-[11.5px] text-[#9AA7AE] mt-0.5">
                      {f.guest_name} · due {fmtDate(f.due_date || "")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="fv-card p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="fv-section-label">Tentative holds</div>
              <button onClick={() => navigate("/availability")} className="text-[12px] font-semibold text-fv-accent-deep hover:underline">
                Manage →
              </button>
            </div>
            {holdsSoon.length === 0 ? (
              <Empty>No active holds.</Empty>
            ) : (
              holdsSoon.slice(0, 5).map((h) => {
                const daysLeft = h.expires_on
                  ? Math.ceil((Date.parse(h.expires_on + "T00:00:00") - Date.parse(todayIso + "T00:00:00")) / 86_400_000)
                  : null;
                return (
                  <div key={h.id} className="flex items-center gap-3 py-2.5 border-b border-[#EEF4F4] last:border-b-0">
                    <span className="w-1 self-stretch rounded-full flex-none" style={{ background: "#CFA13B" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-fv-ink truncate">{h.guest_name || "On hold"}</div>
                      <div className="text-[11.5px] text-[#9AA7AE]">
                        {fmtDate(h.check_in)} → {fmtDate(h.check_out)}
                      </div>
                    </div>
                    {daysLeft != null && (
                      <span className={`text-[11px] font-semibold flex-none ${daysLeft <= 2 ? "text-[#C0563B]" : "text-[#9AA7AE]"}`}>
                        {daysLeft}d
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {docRow && <GenerateDocModal row={docRow} onClose={() => setDocRow(null)} />}
    </div>
  );
}

const WEEKDAY = (d: Date) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];

function StatCard({
  label,
  value,
  accent,
  alert,
  onClick,
}: {
  label: string;
  value: string;
  accent?: boolean;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`fv-card px-5 py-4 ${onClick ? "cursor-pointer hover:border-fv-accent transition-colors" : ""}`}
    >
      <div className="text-[9.5px] font-bold tracking-[1.2px] uppercase text-[#9AA7AE] mb-2">{label}</div>
      <div className={`text-[28px] font-light leading-none ${alert ? "text-fv-alert" : accent ? "text-fv-accent-deep" : "text-fv-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function DayBadge({ isoDate }: { isoDate: string }) {
  const d = new Date((isoDate || "").slice(0, 10) + "T00:00:00");
  const valid = !Number.isNaN(d.getTime());
  return (
    <div className="flex flex-col items-center justify-center w-11 h-11 rounded-lg bg-[#F2F8F8] border border-[#DCEAEA] flex-none">
      <span className="text-[9px] font-bold tracking-[0.6px] uppercase text-[#9AA7AE] leading-none">
        {valid ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] : "—"}
      </span>
      <span className="text-[17px] font-semibold text-fv-ink leading-tight">
        {valid ? d.getDate() : "—"}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-[#9AA7AE] italic">{children}</div>;
}
