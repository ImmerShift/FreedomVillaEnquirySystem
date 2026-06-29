import { useEffect, useRef, useState } from "react";
import type { FxRate } from "../db";
import { ccForCurrency } from "../lib/currency";

/** Flag for a currency code. */
export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span
      className={`fi fi-${ccForCurrency(code)} rounded-[2px] ${className}`}
      style={{ width: 18, height: 13, backgroundSize: "cover" }}
      aria-hidden="true"
    />
  );
}

/** Currency picker with country flags, sourced from AUD (base) + the saved FX rates. */
export function CurrencySelect({
  value,
  onChange,
  fxRates,
  triggerClassName,
}: {
  value: string;
  onChange: (code: string) => void;
  fxRates: FxRate[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const codes = ["AUD", ...fxRates.map((f) => f.code)].filter((c, i, a) => a.indexOf(c) === i);
  const nameOf = (c: string) =>
    c === "AUD" ? "Australian Dollar" : fxRates.find((f) => f.code === c)?.name || c;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          triggerClassName ??
          "flex items-center gap-2 text-[13px] font-semibold text-fv-ink bg-[#F2F8F8] border border-[#DCEAEA] rounded-full pl-3 pr-3 py-2.5 cursor-pointer outline-none"
        }
      >
        <Flag code={value} />
        <span>{value}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9FB0BE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-[230px] bg-white border border-[#E2EAEA] rounded-xl shadow-[0_16px_40px_rgba(27,58,91,0.18)] p-1.5 max-h-[300px] overflow-y-auto">
          {codes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                c === value ? "bg-fv-accent-soft" : "hover:bg-[#F4FBFB]"
              }`}
            >
              <Flag code={c} />
              <span className="text-[13px] font-semibold text-fv-ink w-[44px] flex-none">{c}</span>
              <span className="text-[12px] text-[#9AA7AE] truncate">{nameOf(c)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
