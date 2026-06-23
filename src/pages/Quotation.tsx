import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadActiveBooking,
  loadSettings,
  loadFxRates,
  type FullBooking,
  type FxRate,
  type Settings,
} from "../db";
import { makeFormatter, nightsBetween } from "../lib/pricing";
import {
  useDocEdits,
  useDocStatus,
  Editable,
  PrintOrientation,
  DocControls,
  DocStatusBar,
  SendModal,
  type Orientation,
} from "../components/doc";
import logoGold from "../assets/logo-gold.png";
import villa1 from "../assets/villa-1.jpg";
import villa2 from "../assets/villa-2.jpg";
import villa3 from "../assets/villa-3.jpg";
import robSignature from "../assets/rob-signature.png";

const CURRENCIES = ["AUD", "USD", "IDR", "EUR", "GBP", "SGD", "THB"];

const fmtDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
};

const addDays = (iso: string, days: number): string => {
  const d = new Date((iso || "").slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function Quotation() {
  const navigate = useNavigate();
  const [data, setData] = useState<FullBooking | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [currency, setCurrency] = useState("AUD");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [b, s, fx] = await Promise.all([
        loadActiveBooking(),
        loadSettings(),
        loadFxRates(),
      ]);
      setData(b);
      setSettings(s);
      setFxRates(fx);
      if (b) setCurrency(b.booking.currency || "AUD");
      setLoaded(true);
    })();
  }, []);

  const fmt = useMemo(() => makeFormatter(currency, fxRates), [currency, fxRates]);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [sendOpen, setSendOpen] = useState(false);
  const edits = useDocEdits(data?.booking.id, "quotation");
  const docStatus = useDocStatus(data?.booking.id, "quotation");
  const toggleEdit = async () => {
    if (edits.editing) await edits.save();
    edits.setEditing(!edits.editing);
  };
  const savePdf = async () => {
    await docStatus.markPdf();
    window.print();
  };

  if (!loaded) return null;

  if (!data) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
          Document
        </div>
        <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0 mb-4">
          Quotation
        </h1>
        <div className="fv-card p-10 text-center">
          <p className="text-[15px] text-[#6B7780] mb-5">
            No saved inquiry yet. Fill in the New Inquiry screen and click{" "}
            <b>Save Inquiry</b> — the quotation builds itself from there.
          </p>
          <button className="btn-accent" onClick={() => navigate("/inquiry")}>
            Go to New Inquiry
          </button>
        </div>
      </div>
    );
  }

  const { booking, guest, charges } = data;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const depositPct = Number(settings.deposit_pct || "50");
  const validDays = Number(settings.quote_valid_days || "7");

  const issued = booking.inquiry_date || booking.created_at?.slice(0, 10) || "";
  const validUntil = addDays(issued, validDays);
  const year = (issued || "").slice(0, 4) || new Date().getFullYear();
  const quoteNo = `FV-${year}-${String(booking.id).padStart(4, "0")}`;

  const subtotal = booking.grand_total;
  const balanceArrival = booking.grand_total - booking.deposit;
  const hasSaving = booking.direct_saving > 0;

  const lineItems = [
    {
      label: "All-Inclusive Villa Stay",
      detail: `${nights} nights × ${fmt(booking.applied_rate)} · inclusive of taxes, service & staff`,
      amount: booking.accommodation_total,
    },
    ...charges
      .filter((c) => c.description || c.unit_price)
      .map((c) => ({
        label: c.description || "Additional charge",
        detail: `${c.qty} × ${fmt(c.unit_price)}`,
        amount: c.qty * c.unit_price,
      })),
  ];

  const intro = edits.get(
    "intro",
    `Thank you for considering Freedom Villa for your stay in Bali. It would be our pleasure to host you personally. ` +
      `Please find your tailored quotation below — every rate is all-inclusive of taxes, service and our full staff, with no hidden extras.`
  );
  const terms = edits.get(
    "terms",
    `A ${depositPct}% deposit secures your dates, with the balance settled on arrival. ` +
      `This quotation is valid until ${fmtDate(validUntil)}. All rates are quoted as all-inclusive of taxes, service and staff.`
  );
  const inclusions = edits.get("inclusions", settings.inclusions || "");
  const closing = edits.get(
    "closing",
    `Should you have any questions or wish to secure your dates, please don't hesitate to reach out. We'd be thrilled to welcome you to Freedom Villa.`
  );

  const ownerTitle = settings.villa_owner_title || "Owner · Freedom Villa Bali";
  const logoSrc = settings.doc_logo || logoGold;
  const sheetMax = orientation === "landscape" ? "max-w-[1400px]" : "max-w-[1000px]";

  return (
    <div className={`${sheetMax} mx-auto`}>
      <PrintOrientation orientation={orientation} />
      {/* toolbar — not printed */}
      <div className="no-print flex items-end justify-between gap-6 mb-[26px]">
        <div>
          <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
            Document
          </div>
          <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0">
            Quotation
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="text-[13px] font-semibold text-fv-ink bg-white border border-[#C5D2D2] rounded-md pl-4 pr-9 py-2.5 cursor-pointer outline-none appearance-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <DocControls
            editing={edits.editing}
            onToggleEdit={toggleEdit}
            orientation={orientation}
            setOrientation={setOrientation}
          />
          <button className="btn-ghost" onClick={() => navigate("/inquiry")}>
            Back to Inquiry
          </button>
          <button className="btn-accent" onClick={savePdf} disabled={edits.editing}>
            Save PDF
          </button>
        </div>
      </div>

      <DocStatusBar status={docStatus.status} onSend={() => setSendOpen(true)} />
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docLabel="Quotation"
        guest={guest}
        settings={settings}
        onSent={docStatus.markSent}
      />

      {/* THE DOCUMENT SHEET */}
      <div className="print-sheet bg-white border border-[#E7ECEC] rounded-[4px] shadow-[0_10px_40px_rgba(27,58,91,0.10)] px-[68px] pt-16 pb-[52px]">
        {/* letterhead: side photos flank the centered logo + title (which gets a
            wider centre column so it never collides), shorter centre photo below */}
        <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-3.5 items-end mb-[34px]">
          <div className="h-[300px] rounded-[4px] overflow-hidden">
            <img src={villa1} alt="Freedom Villa" className="w-full h-full object-cover block" />
          </div>

          <div className="flex flex-col items-center">
            <img src={logoSrc} alt="Freedom Villa · Petitenget Bali" className="w-[210px] h-auto inline-block" />
            <div className="font-display text-[36px] font-semibold tracking-[3px] uppercase leading-none mt-4 whitespace-nowrap" style={{ color: "#B68A3E" }}>
              Quotation
            </div>
            <div className="w-[118px] h-0.5 mt-3" style={{ background: "linear-gradient(90deg,transparent,#C9A14E,transparent)" }} />
            <div className="w-full mt-[18px] h-[150px] rounded-[4px] overflow-hidden">
              <img src={villa2} alt="Freedom Villa" className="w-full h-full object-cover block" />
            </div>
          </div>

          <div className="h-[300px] rounded-[4px] overflow-hidden">
            <img src={villa3} alt="Freedom Villa" className="w-full h-full object-cover block" />
          </div>
        </div>

        {/* meta row */}
        <div className="flex items-end justify-between gap-5 flex-wrap pb-[18px] mb-[30px] border-b-2 border-fv-accent">
          <div>
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-1.5">
              Prepared for
            </div>
            <div className="text-[19px] font-medium text-fv-ink">{guest?.full_name || "—"}</div>
            {guest?.country && (
              <div className="text-[13px] text-[#7A8790] mt-0.5">{guest.country}</div>
            )}
          </div>
          <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-1.5 justify-end text-[12.5px] text-[#7A8790] text-right">
            <span>Quote no.</span>
            <span className="font-semibold text-[#3F4B55]">{quoteNo}</span>
            <span>Issued</span>
            <span className="font-semibold text-[#3F4B55]">{fmtDate(issued)}</span>
            <span>Valid until</span>
            <span className="font-semibold text-[#3F4B55]">{fmtDate(validUntil)}</span>
          </div>
        </div>

        {/* greeting + intro */}
        <div className="text-[20px] text-fv-ink mb-3.5">Dear {guest?.full_name || "Guest"},</div>
        <Editable
          editing={edits.editing}
          value={intro}
          onChange={(v) => edits.setField("intro", v)}
          className="text-[15px] leading-[1.75] text-[#4A555E] mb-[34px] max-w-[62ch] min-h-[70px]"
        />

        {/* stay summary */}
        <div className="grid grid-cols-4 gap-px bg-[#EAEFEF] border border-[#EAEFEF] rounded-lg overflow-hidden mb-[38px]">
          <StayCell label="Villa" value={settings.villa_name || "Freedom Villa"} />
          <StayCell label="Check-in" value={fmtDate(booking.check_in)} />
          <StayCell label="Check-out" value={fmtDate(booking.check_out)} />
          <StayCell label="Nights · Guests" value={`${nights} · ${booking.num_guests}`} />
        </div>

        {/* line items */}
        <div className="flex items-baseline justify-between pb-2.5 border-b-2 border-fv-ink">
          <span className="text-[10px] font-bold tracking-[1.8px] uppercase text-fv-ink">Description</span>
          <span className="text-[10px] font-bold tracking-[1.8px] uppercase text-fv-ink">Amount</span>
        </div>
        {lineItems.map((li, i) => (
          <div key={i} className="flex items-baseline justify-between gap-6 py-[15px] border-b border-[#EEF1F1]">
            <div>
              <div className="text-[15px] font-medium text-[#2B3640]">{li.label}</div>
              <div className="text-[12.5px] text-[#9AA7AE] mt-0.5">{li.detail}</div>
            </div>
            <span className="text-[15px] font-semibold text-[#2B3640] whitespace-nowrap">{fmt(li.amount)}</span>
          </div>
        ))}

        {/* totals */}
        <div className="flex justify-end mt-6">
          <div className="w-[320px]">
            <div className="flex justify-between py-1.5 text-[14px] text-[#5E6B75]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#2B3640]">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-end justify-between gap-3 bg-fv-band rounded-lg px-5 py-[18px] mt-3">
              <span className="text-[11px] font-semibold tracking-[2px] uppercase text-fv-accent-tint pb-1">Total</span>
              <span className="text-[30px] font-light text-white leading-none">{fmt(booking.grand_total)}</span>
            </div>
            <div className="flex justify-between pt-[11px] px-0.5 text-[13px] text-[#5E6B75]">
              <span>Deposit to confirm ({depositPct}%)</span>
              <span className="font-semibold text-fv-accent-deep">{fmt(booking.deposit)}</span>
            </div>
            <div className="flex justify-between pt-1.5 px-0.5 text-[13px] text-[#5E6B75]">
              <span>Balance on arrival</span>
              <span className="font-semibold text-[#2B3640]">{fmt(balanceArrival)}</span>
            </div>
          </div>
        </div>

        {/* exclusive direct booking rate */}
        <div className="mt-[38px] border border-[#E6D6B4] rounded-xl overflow-hidden">
          <div className="px-[26px] py-[18px] border-b border-[#ECDFC2]" style={{ background: "linear-gradient(180deg,#FBF6EC,#F7EFDD)" }}>
            <div className="font-display text-[17px] font-semibold tracking-[0.5px]" style={{ color: "#9A7327" }}>
              Your Exclusive Direct Booking Rate
            </div>
          </div>
          <div className="px-[26px] py-[22px]">
            <p className="text-[14.5px] leading-[1.7] text-[#4A555E] m-0 mb-[18px]">
              As a token of our appreciation for booking directly, we are pleased to offer you a special rate that won't be found anywhere else:
            </p>
            <div className="flex items-baseline justify-between gap-4 py-[9px]">
              <span className="text-[15px] font-semibold text-[#2B3640]">Your nightly rate</span>
              <span className="text-[16px] font-bold text-fv-ink border-b-2 border-[#C9A14E]">{fmt(booking.applied_rate)}</span>
            </div>
            {hasSaving && (
              <div className="text-[13.5px] leading-[1.6] text-[#5E6B75] py-1.5">
                <b className="font-bold text-[#2B3640]">Exclusive Savings:</b> This rate includes a{" "}
                <b className="font-bold text-fv-accent-deep">{fmt(booking.direct_saving)}</b> saving off our standard published rate.
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 py-[9px] mt-1 border-t border-[#EFE4CB]">
              <span className="text-[15px] font-bold text-[#2B3640]">Total for {nights} nights</span>
              <span className="text-[19px] font-bold text-fv-ink border-b-2 border-[#C9A14E]">{fmt(booking.accommodation_total)}</span>
            </div>
            <div className="text-[13px] leading-[1.6] text-[#7A8790] mt-2.5">
              All-inclusive of taxes, service and full staff.
            </div>
          </div>
        </div>

        {/* inclusions */}
        {(inclusions || edits.editing) && (
          <div className="mt-[26px] px-6 py-[22px] bg-fv-accent-soft border border-fv-accent-soft-border rounded-[10px]">
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-2.5">
              Your rate includes
            </div>
            <Editable
              editing={edits.editing}
              value={inclusions}
              onChange={(v) => edits.setField("inclusions", v)}
              className="text-[14px] leading-[1.7] text-[#33474A] min-h-[60px]"
            />
          </div>
        )}

        {/* terms */}
        <div className="mt-[26px]">
          <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-2">Terms</div>
          <Editable
            editing={edits.editing}
            value={terms}
            onChange={(v) => edits.setField("terms", v)}
            className="text-[13px] leading-[1.7] text-[#8492A0] max-w-[74ch]"
          />
        </div>

        {/* closing + signature */}
        <div className="mt-[34px]">
          <Editable
            editing={edits.editing}
            value={closing}
            onChange={(v) => edits.setField("closing", v)}
            className="text-[14.5px] leading-[1.7] text-[#4A555E] max-w-[64ch]"
          />
          <div className="relative mt-2">
            <img src={robSignature} alt="" className="absolute -top-[26px] left-[245px] w-[128px] h-auto opacity-90 pointer-events-none" />
            <div className="text-[15px] font-semibold text-fv-ink mt-[34px]">{settings.villa_owner || "Robert Addamo"}</div>
            <div className="text-[13.5px] text-[#5E6B75]">{ownerTitle}</div>
            {settings.villa_phone && <div className="text-[13.5px] text-[#5E6B75]">{settings.villa_phone}</div>}
            {settings.villa_email && <div className="text-[13.5px] text-fv-accent-deep">{settings.villa_email}</div>}
          </div>
        </div>

        {/* footer */}
        <div className="mt-8 pt-[22px] border-t border-[#EEF1F1] text-center text-[12px] text-[#9AA7AE] tracking-[0.5px]">
          {[settings.villa_website, settings.villa_email, settings.villa_phone].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}

function StayCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#FAFCFC] px-[18px] py-4">
      <div className="text-[9.5px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-1.5">{label}</div>
      <div className="text-[15px] font-medium text-fv-ink">{value}</div>
    </div>
  );
}
