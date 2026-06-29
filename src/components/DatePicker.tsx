import { useEffect, useMemo, useRef, useState } from "react";

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtTrigger = (s?: string) => {
  const d = parse(s);
  return d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : "";
};

export interface BookedRange {
  check_in: string;
  check_out: string;
}

/** A modern, availability-aware date picker. Booked nights show red and can't be
 *  selected; `min`/`max` bound the selectable range (used to stop overlaps). */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  booked = [],
  placeholder = "Select date",
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  booked?: BookedRange[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parse(value);
  const today = new Date();
  const todayIso = iso(today);
  const [view, setView] = useState<Date>(selected ?? parse(min) ?? today);

  useEffect(() => {
    if (open && selected) setView(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [y, m]);

  const isBooked = (di: string) =>
    booked.some((r) => r.check_in && r.check_out && di >= r.check_in && di < r.check_out);
  const isDisabled = (di: string) =>
    (min != null && di < min) || (max != null && di > max) || isBooked(di);

  const pick = (d: Date) => {
    const di = iso(d);
    if (isDisabled(di)) return;
    onChange(di);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fv-input w-full flex items-center justify-between text-left cursor-pointer"
      >
        <span className={selected ? "text-fv-ink" : "text-[#9FB0BE]"}>
          {selected ? fmtTrigger(value) : placeholder}
        </span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9FB0BE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 left-0 w-[300px] bg-white border border-[#E2EAEA] rounded-xl shadow-[0_16px_40px_rgba(27,58,91,0.18)] p-3">
          <div className="flex items-center justify-between mb-2.5">
            <NavBtn dir="prev" onClick={() => setView(new Date(y, m - 1, 1))} />
            <div className="text-[14px] font-semibold text-fv-ink">
              {MONTHS_FULL[m]} {y}
            </div>
            <NavBtn dir="next" onClick={() => setView(new Date(y, m + 1, 1))} />
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEK.map((w) => (
              <span key={w} className="text-[10px] font-bold text-[#9AA7AE] text-center py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const di = iso(d);
              const inMonth = d.getMonth() === m;
              const booked_ = isBooked(di);
              const disabled = isDisabled(di);
              const sel = selected != null && di === iso(selected);
              const isToday = di === todayIso;
              let cls =
                "h-9 rounded-md text-[12.5px] font-medium flex items-center justify-center transition-all ";
              if (sel) cls += "bg-fv-accent text-white font-semibold ";
              else if (booked_) cls += "bg-[#F7C1C1] text-[#A32D2D] line-through cursor-not-allowed ";
              else if (disabled) cls += "text-[#D2DADA] cursor-not-allowed ";
              else if (!inMonth) cls += "text-[#C3CFCF] hover:bg-[#F2F8F8] active:scale-90 cursor-pointer ";
              else cls += "text-[#3F4B55] hover:bg-fv-accent-soft active:scale-90 cursor-pointer ";
              if (isToday && !sel) cls += "ring-1 ring-fv-accent ";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  className={cls}
                  title={booked_ ? "Already booked" : undefined}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#EEF4F4]">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-[12px] font-semibold text-[#9AA7AE] hover:text-fv-ink"
            >
              Clear
            </button>
            <div className="flex items-center gap-3 text-[11px] text-[#9AA7AE]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-[3px] bg-[#F7C1C1]" /> booked
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F2F8F8] border border-[#DCEAEA] cursor-pointer transition-colors hover:border-fv-accent"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#56636D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}
