import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  loadSettings,
  loadSeasons,
  loadFxRates,
  saveInquiry,
  findReturningGuest,
  type Season,
  type FxRate,
  type Settings,
  type ReturningGuest,
} from "../db";
import { computePricing, makeFormatter, fmtDate, nightsBetween, type Charge } from "../lib/pricing";
import { setActiveBookingId } from "../lib/activeBooking";
import { SectionHeader, Field } from "../components/ui";

interface ChargeRowState {
  desc: string;
  qty: string;
  unit: string;
}

const num = (s: string): number => {
  const n = parseFloat((s || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const today = () => new Date().toISOString().slice(0, 10);

const CURRENCIES = ["AUD", "USD", "IDR", "EUR", "GBP", "SGD", "THB"];
const BOOKING_SOURCES = [
  "Direct (website)",
  "Direct (phone)",
  "Direct (WhatsApp)",
  "OTA — Airbnb",
  "OTA — Booking.com",
  "OTA — VRBO",
  "Agent",
];

export function NewInquiry() {
  const navigate = useNavigate();
  const location = useLocation();

  // reference data
  const [settings, setSettings] = useState<Settings>({});
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);

  // guest
  const [guestName, setGuestName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // stay
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [numGuests, setNumGuests] = useState("2");
  const [inquiryDate, setInquiryDate] = useState(today());

  // money
  const [currency, setCurrency] = useState("AUD");
  const [override, setOverride] = useState("");
  const [saving, setSaving] = useState("");
  const [charges, setCharges] = useState<ChargeRowState[]>([
    { desc: "", qty: "1", unit: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [source, setSource] = useState("Direct (website)");
  const [applyTaxOverride, setApplyTaxOverride] = useState<boolean | null>(null);
  const [returningGuest, setReturningGuest] = useState<ReturningGuest | null>(null);

  const [toast, setToast] = useState("");

  const checkReturning = async () => {
    setReturningGuest(email.trim() ? await findReturningGuest(email) : null);
  };

  // pre-fill dates when arriving from the Availability "Fill gap" action
  useEffect(() => {
    const s = location.state as { checkIn?: string; checkOut?: string } | null;
    if (s?.checkIn) setCheckIn(s.checkIn);
    if (s?.checkOut) setCheckOut(s.checkOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, se, fx] = await Promise.all([
          loadSettings(),
          loadSeasons(),
          loadFxRates(),
        ]);
        setSettings(s);
        setSeasons(se);
        setFxRates(fx);
        if (s.default_currency) setCurrency(s.default_currency);
      } catch (e) {
        console.error("Failed to load reference data", e);
      }
    })();
  }, []);

  const depositPct = num(settings.deposit_pct || "50");
  const taxMode = settings.tax_mode || "inclusive";
  const taxRate = num(settings.tax_rate || "16");
  const taxAllowOverride = settings.tax_allow_override === "1";
  const applyTax = taxMode === "added" ? applyTaxOverride ?? true : false;

  const pricingCharges: Charge[] = charges.map((c) => ({
    desc: c.desc,
    qty: num(c.qty),
    unit: num(c.unit),
  }));

  const p = useMemo(
    () =>
      computePricing({
        checkIn,
        checkOut,
        seasons,
        override: override.trim() === "" ? null : num(override),
        charges: pricingCharges,
        amountPaid: num(amountPaid),
        depositPct,
        source,
        taxMode,
        taxRate,
        applyTax,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkIn, checkOut, seasons, override, amountPaid, depositPct, source, taxMode, taxRate, applyTax, JSON.stringify(charges)]
  );

  const fmt = useMemo(() => makeFormatter(currency, fxRates), [currency, fxRates]);

  const fxRate = fxRates.find((f) => f.code === currency)?.rate_per_aud;
  const showFxNote = currency !== "AUD" && fxRate != null;

  // charge row helpers
  const setCharge = (i: number, field: keyof ChargeRowState, value: string) =>
    setCharges((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    );
  const addCharge = () =>
    setCharges((rows) => [...rows, { desc: "", qty: "1", unit: "" }]);
  const removeCharge = (i: number) =>
    setCharges((rows) => rows.filter((_, idx) => idx !== i));

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  };

  const datesInverted = !!checkIn && !!checkOut && checkOut <= checkIn;

  const handleSave = async () => {
    if (!guestName.trim()) return flash("Add a guest name first.");
    if (!checkIn || !checkOut) return flash("Add check-in and check-out dates.");
    if (datesInverted) return flash("Check-out must be after check-in.");
    try {
      const bookingId = await saveInquiry({
        guest: { full_name: guestName, country, email, whatsapp },
        booking: {
          check_in: checkIn,
          check_out: checkOut,
          num_guests: num(numGuests) || 0,
          inquiry_date: inquiryDate,
          currency,
          source,
          apply_tax: applyTax ? 1 : 0,
          override_rate: override.trim() === "" ? null : num(override),
          applied_rate: p.rateUsed,
          rate_source: p.rateSource,
          direct_saving: num(saving),
          accommodation_total: p.accommodation,
          additional_total: p.additionalTotal,
          grand_total: p.grandTotal,
          deposit: p.deposit,
          amount_paid: num(amountPaid),
          balance: p.balance,
          notes,
        },
        charges: pricingCharges,
      });
      setActiveBookingId(bookingId);
      navigate("/guests", { state: { highlightId: bookingId } });
    } catch (e) {
      console.error(e);
      flash(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const minBar = (() => {
    if (datesInverted)
      return {
        bg: "#FDECEA",
        border: "#F5B7B1",
        color: "#C0392B",
        mark: "!",
        label: "Check-out must be after check-in.",
      };
    if (p.minMet == null)
      return {
        bg: "#F2F4F5",
        border: "#E1E7E9",
        color: "#7A8790",
        mark: "·",
        label: "Enter dates to check the minimum-stay rule.",
      };
    if (p.minMet)
      return {
        bg: "#EDF5E8",
        border: "#9FC98A",
        color: "#5E8C49",
        mark: "✓",
        label: `Minimum ${p.minNights} nights — met.`,
      };
    return {
      bg: "#FDECEA",
      border: "#F5B7B1",
      color: "#C0392B",
      mark: "!",
      label: `Below minimum — ${p.minNights} nights required for ${p.seasonName} season.`,
    };
  })();

  return (
    <div className="max-w-[1180px] mx-auto">
      {/* header */}
      <div className="flex items-end justify-between gap-6 mb-[30px]">
        <div>
          <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
            New Request
          </div>
          <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] tracking-[0.3px] m-0 mb-2">
            Quotation Request
          </h1>
          <div className="text-[13.5px] text-[#6B7780]">
            Fill the blue cells — season, rate and totals fill themselves.
          </div>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <div className="flex flex-col items-end gap-1">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="text-[13px] font-semibold tracking-[0.3px] text-fv-ink bg-[#F2F8F8] border border-[#DCEAEA] rounded-full pl-4 pr-9 py-2.5 cursor-pointer outline-none appearance-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {showFxNote && (
              <span className="text-[10.5px] text-[#9AA7AE]">
                1 AUD = {fxRate} {currency}
              </span>
            )}
          </div>
          <button className="btn-ghost" onClick={() => navigate("/quotation")}>
            Open Quotation
          </button>
          <button className="btn-accent" onClick={handleSave}>
            Save Request
          </button>
        </div>
      </div>

      {/* returning guest banner */}
      {returningGuest && (
        <div className="flex items-center gap-2.5 mb-6 px-4 py-3 bg-fv-accent-soft border border-fv-accent-soft-border rounded-lg">
          <span className="text-[16px]">↩</span>
          <span className="text-[13.5px] text-[#33474A]">
            <b className="font-semibold">Returning guest</b> — {returningGuest.full_name} previously stayed{" "}
            {fmtDate(returningGuest.check_in)} → {fmtDate(returningGuest.check_out)} ({nightsBetween(returningGuest.check_in, returningGuest.check_out)} nights).
          </span>
        </div>
      )}

      {/* guest + stay */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <section className="fv-card p-7">
          <SectionHeader>Guest Information</SectionHeader>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Guest name">
              <input className="fv-input" placeholder="Full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </Field>
            <Field label="Country">
              <input className="fv-input" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="fv-input" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={checkReturning} />
            </Field>
            <Field label="WhatsApp">
              <input className="fv-input" placeholder="+00 000 000 000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="fv-card p-7">
          <SectionHeader>Stay Period</SectionHeader>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Check-in">
              <input type="date" className="fv-input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </Field>
            <Field label="Check-out">
              <input type="date" className="fv-input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </Field>
            <Field label="Guests · max 10">
              <input inputMode="numeric" className="fv-input" value={numGuests} onChange={(e) => setNumGuests(e.target.value)} />
            </Field>
            <Field label="Inquiry date">
              <input type="date" className="fv-input" value={inquiryDate} onChange={(e) => setInquiryDate(e.target.value)} />
            </Field>
            <Field label="Booking source" full>
              <select
                className="fv-input cursor-pointer appearance-none"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {BOOKING_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      </div>

      {/* pricing system */}
      <div className="relative rounded-[9px] border border-fv-accent-soft-border p-6 mb-6 bg-gradient-to-b from-[#EAF6F5] to-[#DEF1F0] shadow-[0_1px_3px_rgba(21,163,160,0.08)]">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[12px] font-semibold tracking-[2.5px] uppercase text-fv-accent-text">
            Pricing System
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-fv-accent rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
            <span className="text-[9.5px] font-semibold tracking-[1.8px] uppercase text-white">
              Calculated · read only
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-px bg-[#BFE3E2] border border-[#BFE3E2] rounded-[7px] overflow-hidden">
          <PriceCell label="Season" value={p.seasonName} />
          <PriceCell label="Seasonal rate" value={p.seasonalRate != null ? fmt(p.seasonalRate) : "—"} />
          <PriceCell label="Nights" value={p.nights ? String(p.nights) : "—"} />
          <PriceCell label="Min nights" value={p.minNights != null ? String(p.minNights) : "—"} />
        </div>
        <div
          className="flex items-center gap-2.5 mt-3.5 px-4 py-2.5 rounded-[7px]"
          style={{ background: minBar.bg, border: `1px solid ${minBar.border}` }}
        >
          <span className="text-[16px] leading-none font-bold" style={{ color: minBar.color }}>
            {minBar.mark}
          </span>
          <span className="text-[14px] font-medium text-ink-900">{minBar.label}</span>
        </div>
      </div>

      {/* rate */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Rate</SectionHeader>
        <div className="grid grid-cols-3 gap-5">
          <Field label="Custom rate override (blank = seasonal)">
            <MoneyInput value={override} onChange={setOverride} placeholder="—" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.8px] uppercase text-fv-accent-label">
              Rate used / night
            </span>
            <div className="flex items-center justify-between fv-calc">
              <span>{fmt(p.rateUsed)}</span>
              <span className="text-[9px] font-bold tracking-[1.4px] text-fv-accent-deep">
                {p.rateSource}
              </span>
            </div>
          </div>
          <Field label="Direct-booking saving (shown on quote)">
            <MoneyInput value={saving} onChange={setSaving} placeholder="0" />
          </Field>
        </div>
      </section>

      {/* additional charges */}
      <section className="fv-card p-7 mb-6">
        <div className="flex items-center gap-3.5 mb-1.5">
          <span className="fv-section-label">Additional Charges</span>
          <span className="flex-1 h-px bg-[#E6EDED]" />
        </div>
        <div className="text-[12.5px] italic text-[#8794A0] mb-4">
          Beyond the all-inclusive rate — extra beer, private chef, spa, transfers.
        </div>
        <div className="grid grid-cols-[1fr_90px_150px_150px_40px] gap-3 px-1 pb-2.5 border-b border-[#E6EDED]">
          <ColLabel>Description</ColLabel>
          <ColLabel className="text-center">Qty</ColLabel>
          <ColLabel>Unit price</ColLabel>
          <ColLabel className="text-right text-fv-accent-label">Line total</ColLabel>
          <span />
        </div>
        {charges.map((row, i) => {
          const lineTotal = num(row.qty) * num(row.unit);
          return (
            <div key={i} className="grid grid-cols-[1fr_90px_150px_150px_40px] gap-3 items-center py-2.5 border-b border-[#EEF4F4]">
              <input className="fv-input !py-2.5 !text-[14px]" placeholder="e.g. Private chef dinner" value={row.desc} onChange={(e) => setCharge(i, "desc", e.target.value)} />
              <input inputMode="numeric" className="fv-input !py-2.5 !text-[14px] text-center" value={row.qty} onChange={(e) => setCharge(i, "qty", e.target.value)} />
              <MoneyInput value={row.unit} onChange={(v) => setCharge(i, "unit", v)} small />
              <span className="text-[15px] font-semibold text-ink-900 text-right">{fmt(lineTotal)}</span>
              <button onClick={() => removeCharge(i)} className="text-[18px] text-[#B8C5C5] bg-transparent border-none cursor-pointer p-1.5 leading-none transition-colors hover:text-[#C0392B]">
                ×
              </button>
            </div>
          );
        })}
        <button onClick={addCharge} className="mt-4 text-[13px] font-semibold tracking-[0.4px] text-fv-type-text bg-transparent border border-dashed border-[#BCCFE2] rounded-md px-[18px] py-2.5 cursor-pointer transition-all hover:bg-fv-type-bg hover:border-fv-type-text">
          +  Add charge
        </button>
      </section>

      {/* notes + totals */}
      <div className="grid grid-cols-[1.3fr_1fr] gap-6 items-start">
        <section className="fv-card p-7 h-full flex flex-col">
          <SectionHeader>Notes &amp; Terms</SectionHeader>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal touches, arrival details, payment terms…"
            className="fv-input flex-1 min-h-[230px] resize-y !text-[14.5px] leading-[1.65]"
          />
        </section>

        <section className="fv-card p-7">
          <SectionHeader>Totals</SectionHeader>
          {p.rateSource === "AGENT" && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-[#FDF6E8] border border-[#EAD9A8] rounded-md text-[12px] text-[#8A6D1F]">
              <span className="font-semibold">Agent rate applied</span> — not shown on guest documents
            </div>
          )}
          <Row label={`Accommodation · ${p.nights} × ${fmt(p.rateUsed)}`} value={fmt(p.accommodation)} />
          <Row label="Additional charges" value={fmt(p.additionalTotal)} border={p.taxAmount === 0} />
          {p.taxAmount > 0 && (
            <Row label={`Tax & service · ${taxRate}%`} value={fmt(p.taxAmount)} border />
          )}
          {taxMode === "added" && taxAllowOverride && (
            <label className="flex items-center gap-2.5 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => setApplyTaxOverride(e.target.checked)}
                className="w-4 h-4 accent-[#15A3A0]"
              />
              <span className="text-[13px] text-[#5E6B75]">Apply {taxRate}% tax to this booking</span>
            </label>
          )}
          <div className="bg-fv-band rounded-lg px-6 py-5 my-4">
            <div className="flex items-end justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-[2.5px] uppercase text-fv-accent-tint pb-1.5">
                Total Investment
              </span>
              <span className="text-[34px] font-light text-white leading-none">{fmt(p.grandTotal)}</span>
            </div>
            <div className="text-[11.5px] text-[#8AA0B3] tracking-[0.3px] mt-2 text-right">
              {taxMode === "added" && p.taxAmount > 0
                ? `includes ${taxRate}% tax & service`
                : "includes taxes, service & staff"}
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-[#5E6B75]">
              Deposit to confirm <span className="text-[11px] text-[#97A3AD]">· {depositPct}%</span>
            </span>
            <span className="text-[15px] font-semibold text-fv-accent-deep bg-fv-accent-soft border border-fv-accent-soft-border rounded-[5px] px-3 py-1.5">
              {fmt(p.deposit)}
            </span>
          </div>
          <label className="flex items-center justify-between py-2.5 border-b border-[#E6EDED]">
            <span className="text-[14px] text-[#5E6B75]">Amount paid</span>
            <div className="w-[140px]">
              <MoneyInput value={amountPaid} onChange={setAmountPaid} small rightAlign />
            </div>
          </label>
          <div className="flex items-center justify-between pt-4 pb-1">
            <span className="text-[13px] font-semibold tracking-[1px] uppercase text-ink-900">Balance due</span>
            <span className="text-[26px] font-medium text-fv-alert leading-none">{fmt(p.balance)}</span>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-7 right-7 bg-fv-ink text-white text-[13.5px] font-medium px-5 py-3.5 rounded-lg shadow-[0_8px_28px_rgba(27,58,91,0.28)] z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---- small presentational helpers ----

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F1FAF9] px-5 py-[18px]">
      <div className="text-[10px] font-semibold tracking-[1.4px] uppercase text-fv-accent-label mb-2.5">
        {label}
      </div>
      <div className="text-[23px] font-medium text-fv-ink leading-[1.1]">{value}</div>
    </div>
  );
}

function ColLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-bold tracking-[1.4px] uppercase text-ink-400 ${className}`}>
      {children}
    </span>
  );
}

function Row({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2.5 ${border ? "border-b border-[#E6EDED]" : ""}`}>
      <span className="text-[14px] text-[#5E6B75]">{label}</span>
      <span className="text-[15px] font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  small,
  rightAlign,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  small?: boolean;
  rightAlign?: boolean;
}) {
  return (
    <div className="flex items-center bg-fv-type-bg border border-fv-type-border rounded-[5px] px-3.5 transition-all focus-within:bg-white focus-within:border-[#3F77AC] focus-within:shadow-[0_0_0_3px_rgba(63,119,172,0.16)]">
      <span className={`text-[#9FB0BE] mr-1.5 ${small ? "text-[13px]" : "text-[14px]"}`}>A$</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 border-none outline-none bg-transparent text-ink-900 ${
          small ? "text-[14px] py-2.5" : "text-[15px] py-3"
        } ${rightAlign ? "text-right" : ""}`}
      />
    </div>
  );
}
