import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { nightsBetween } from "../lib/pricing";
import {
  useDocData,
  useDocEdits,
  useDocStatus,
  GuestPicker,
  Editable,
  PrintOrientation,
  DocControls,
  DocStatusBar,
  SendModal,
  type Orientation,
} from "../components/doc";
import { CurrencySelect } from "../components/CurrencySelect";
import brandLogo from "../assets/brand/logo-freedomvilla.png";
import robSignature from "../assets/brand/rob-signature-trim.png";
import docHeader from "../assets/doc-header-v2.png";

const DEFAULT_INCLUSIONS =
  "5 expansive bedroom suites (3 can split to singles)\n" +
  "1,000m² of beautifully manicured grounds\n" +
  "Private onsite commercial-grade gym\n" +
  "Daily chef-prepared breakfasts\n" +
  "Complimentary airport transfers\n" +
  "Full staff: butlers, security, villa manager, ground crew";

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
  const { data, settings, fxRates, currency, setCurrency, fmt, loaded, bookings, pick } = useDocData();
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
        <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0 mb-4">Quotation</h1>
        <div className="fv-card p-10 text-center">
          <p className="text-[15px] text-[#6B7780] mb-5">
            No saved request yet. Fill in the Quotation Request screen and click <b>Save Request</b>.
          </p>
          <button className="btn-accent" onClick={() => navigate("/inquiry")}>
            Go to Quotation Request
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
  const quoteNo = `FV-Q-${year}-${String(booking.id).padStart(3, "0")}`;

  const balanceArrival = booking.grand_total - booking.deposit;
  const hasSaving = booking.direct_saving > 0;
  const hasCharges = booking.additional_total > 0;
  const taxAmount = booking.grand_total - booking.accommodation_total - booking.additional_total;
  const fxOfCurrency = fxRates.find((f) => f.code === currency)?.rate_per_aud;

  const lineItems = [
    {
      label: `Accommodation · ${nights} nights`,
      amount: booking.accommodation_total,
    },
    ...charges
      .filter((c) => c.description || c.unit_price)
      .map((c) => ({
        label: c.description || "Additional charge",
        amount: c.qty * c.unit_price,
      })),
  ];

  const intro = edits.get(
    "intro",
    "Thank you for your interest in Freedom Villa. Your exclusive direct-booking rate is confirmed below."
  );
  const terms = edits.get(
    "terms",
    `A ${depositPct}% deposit secures your dates, with the balance due before arrival. ` +
      `This quotation is valid until ${fmtDate(validUntil)}. All rates are all-inclusive of taxes, service and staff.`
  );
  const inclusions = edits.get("inclusions", settings.inclusions || DEFAULT_INCLUSIONS);
  const closing = edits.get(
    "closing",
    "Should you have any questions or wish to secure your dates, please don't hesitate to reach out. We'd be thrilled to welcome you to Freedom Villa."
  );

  const inclusionLines = inclusions.split("\n").map((l) => l.trim()).filter(Boolean);
  const half = Math.ceil(inclusionLines.length / 2);
  const incCols = [inclusionLines.slice(0, half), inclusionLines.slice(half)];

  const owner = settings.villa_owner || "Robert Addamo";
  const ownerTitle = settings.villa_owner_title || "Villa Owner and Booking Co-ordinator";
  const phone = settings.villa_phone || "+62 812 384 88685";
  const email = settings.villa_email || "robert@freedomvillabali.com";
  const website = settings.villa_website || "freedomvillabali.com";
  const checkInTime = settings.villa_checkin_time || "3:00 PM";
  const checkOutTime = settings.villa_checkout_time || "11:00 AM";
  const logoSrc = settings.doc_logo || brandLogo;
  const sheetMax = orientation === "landscape" ? "max-w-[1400px]" : "max-w-[1000px]";

  return (
    <div className={`${sheetMax} mx-auto`}>
      <PrintOrientation orientation={orientation} />
      {/* toolbar — not printed */}
      <div className="no-print flex items-end justify-between gap-6 mb-[26px]">
        <div>
          <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">Document</div>
          <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0">Quotation</h1>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <GuestPicker bookings={bookings} activeId={data.booking.id} onPick={pick} />
          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            fxRates={fxRates}
            triggerClassName="flex items-center gap-2 text-[13px] font-semibold text-fv-ink bg-white border border-[#C5D2D2] rounded-md pl-3 pr-3 py-2.5 cursor-pointer outline-none"
          />
          <DocControls editing={edits.editing} onToggleEdit={toggleEdit} orientation={orientation} setOrientation={setOrientation} />
          <button className="btn-ghost" onClick={() => navigate("/inquiry")}>Back to Request</button>
          <button className="btn-accent" onClick={savePdf} disabled={edits.editing}>Save PDF</button>
        </div>
      </div>

      <DocStatusBar status={docStatus.status} onSend={() => setSendOpen(true)} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} docLabel="Quotation" guest={guest} settings={settings} onSent={docStatus.markSent} />

      {/* THE DOCUMENT SHEET — single A4 page */}
      <div className="print-sheet bg-white border border-[#E7ECEC] rounded-[4px] shadow-[0_10px_40px_rgba(27,58,91,0.10)] px-[52px] py-[40px]">
        {/* full-bleed banner letterhead — logo + title over the photo header */}
        <div className="relative mb-4">
          {/* photo accent bleeding into the sheet's top-right corner */}
          <img src={docHeader} alt="Freedom Villa" className="absolute -top-10 -right-[52px] h-[118px] w-auto" />
          {/* logo + gold title on the left */}
          <div className="relative flex items-center gap-4 h-[80px]">
            <img src={logoSrc} alt="Freedom Villa · Petitenget Bali" className="w-[120px] h-auto flex-none" />
            <div className="flex flex-col">
              <div className="font-display text-[22px] font-semibold tracking-[4px] uppercase leading-none" style={{ color: "#B68A3E" }}>
                Quotation
              </div>
              <div className="w-[80px] h-0.5 mt-2" style={{ background: "linear-gradient(90deg,#C9A14E,transparent)" }} />
            </div>
          </div>
          <div className="h-px mt-1.5" style={{ background: "linear-gradient(90deg,#E4C998,transparent)" }} />
        </div>

        {/* meta row */}
        <div className="flex items-start justify-between gap-6 mb-3">
          <div>
            <div className="text-[8px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-1">Prepared for</div>
            <div className="text-[14px] font-bold text-fv-ink leading-tight">{guest?.full_name || "—"}</div>
            <div className="text-[10px] text-[#7A8790] mt-0.5">
              {[guest?.email, guest?.whatsapp, guest?.country].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="text-right text-[10px] text-[#7A8790] leading-[1.7]">
            <div>Quote no: <b className="text-[#3F4B55] font-semibold">{quoteNo}</b></div>
            <div>Date: <b className="text-[#3F4B55] font-semibold">{fmtDate(issued)}</b></div>
            <div>Valid until: <b className="text-[#3F4B55] font-semibold">{fmtDate(validUntil)}</b></div>
          </div>
        </div>
        {/* italic intro one-liner */}
        <Editable
          editing={edits.editing}
          value={intro}
          onChange={(v) => edits.setField("intro", v)}
          className="text-[10.5px] italic leading-[1.5] text-[#6B7780] mb-4"
        />

        {/* stay details — 4-col row */}
        <div className="grid grid-cols-4 gap-px bg-[#EAEFEF] border border-[#EAEFEF] rounded-md overflow-hidden mb-4">
          <StayCell label="Villa" value={settings.villa_name || "Freedom Villa"} />
          <StayCell label="Check-in" value={fmtDate(booking.check_in)} sub={checkInTime} />
          <StayCell label="Check-out" value={fmtDate(booking.check_out)} sub={checkOutTime} />
          <StayCell label="Nights · Guests" value={`${nights} · ${booking.num_guests}`} />
        </div>

        {/* main — gold rate box LEFT, totals RIGHT */}
        <div className="grid grid-cols-2 gap-4 mb-4 items-start">
          {/* LEFT: exclusive direct booking rate */}
          <div className="rounded-md border border-[#E4C998] px-4 py-3.5" style={{ background: "#FBF6EC" }}>
            <div className="text-[8px] font-bold tracking-[1.2px] uppercase mb-2" style={{ color: "#9A7327" }}>
              Your Exclusive Direct Booking Rate
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] text-[#6B7780]">Nightly rate</span>
              <span className="text-[14px] font-bold text-fv-ink">{fmt(booking.applied_rate)}</span>
            </div>
            <div className="h-px my-2" style={{ background: "#E4C998" }} />
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold text-[#3F4B55]">Total for {nights} nights</span>
              <span className="text-[16px] font-bold text-fv-ink">{fmt(booking.accommodation_total)}</span>
            </div>
            <div className="text-[8px] italic text-[#8794A0] mt-2 leading-[1.45]">
              All-inclusive of taxes, service and full staff for up to {settings.villa_max_guests || "10"} guests.
            </div>
            {hasSaving && (
              <div className="text-[8px] font-semibold mt-1.5" style={{ color: "#C0563B" }}>
                Direct saving: {fmt(booking.direct_saving)} off published rate
              </div>
            )}
          </div>

          {/* RIGHT: totals */}
          <div className="pt-1">
            {lineItems.map((li, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 py-1 text-[10.5px]">
                <span className="text-[#5E6B75]">{li.label}</span>
                <span className="font-semibold text-[#2B3640] whitespace-nowrap">{fmt(li.amount)}</span>
              </div>
            ))}
            {taxAmount > 0 && (
              <div className="flex items-baseline justify-between gap-3 py-1 text-[10.5px]">
                <span className="text-[#5E6B75]">Tax &amp; service ({settings.tax_rate || "16"}%)</span>
                <span className="font-semibold text-[#2B3640]">{fmt(taxAmount)}</span>
              </div>
            )}
            {(hasCharges || taxAmount > 0) && (
              <div className="flex items-baseline justify-between gap-3 py-1 text-[11px] border-t border-[#EEF1F1] mt-0.5">
                <span className="font-semibold text-fv-ink">Total</span>
                <span className="font-bold text-fv-ink">{fmt(booking.grand_total)}</span>
              </div>
            )}
            <div className="h-px my-2" style={{ background: "#E4C998" }} />
            <div className="flex items-baseline justify-between gap-3 py-1 text-[10.5px]">
              <span className="text-[#5E6B75]">Deposit to confirm ({depositPct}%)</span>
              <span className="font-bold text-fv-accent-deep">{fmt(booking.deposit)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1 text-[10.5px]">
              <span className="text-[#5E6B75]">Balance before arrival</span>
              <span className="font-bold text-[#2B3640]">{fmt(balanceArrival)}</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[#EEF1F1] mb-3" />

        {/* inclusions — 2-col bullet grid */}
        <div className="mb-3">
          <div className="text-[8px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-2">Your stay will include</div>
          {edits.editing ? (
            <Editable
              editing
              value={inclusions}
              onChange={(v) => edits.setField("inclusions", v)}
              className="text-[10px] leading-[1.5] text-[#3F4B55]"
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {incCols.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1">
                  {col.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-[3px] h-[3px] rounded-full flex-none mt-[6px]" style={{ background: "#C9A14E" }} />
                      <span className="text-[9px] leading-[1.45] text-[#3F4B55]">{line}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-[#EEF1F1] mb-3" />

        {/* terms */}
        <Editable
          editing={edits.editing}
          value={terms}
          onChange={(v) => edits.setField("terms", v)}
          className="text-[8px] leading-[1.5] text-[#9AA7AE] mb-3"
        />

        {/* closing */}
        <Editable
          editing={edits.editing}
          value={closing}
          onChange={(v) => edits.setField("closing", v)}
          className="text-[10px] italic leading-[1.5] text-[#5E6B75] mb-4"
        />

        {/* currency conversion note */}
        {currency !== "AUD" && fxOfCurrency != null && (
          <div className="text-[8px] italic text-[#9AA7AE] mb-2">
            Amounts shown in {currency}, converted from AUD at 1 AUD = {fxOfCurrency} {currency} on {fmtDate(new Date().toISOString())}.
          </div>
        )}

        {/* footer — contact LEFT, signature RIGHT */}
        <div className="flex items-end justify-between gap-6 pt-3 border-t border-[#EEF1F1]">
          <div className="text-[9px] leading-[1.55]">
            <div className="font-bold text-fv-ink">{owner}</div>
            <div className="text-[#5E6B75]">{ownerTitle}</div>
            <div className="text-[#5E6B75]">{phone}</div>
            <div className="text-fv-accent-deep">{email}</div>
            <div className="text-[#5E6B75]">{website}</div>
          </div>
          <img src={robSignature} alt="Robert Addamo" className="w-[70px] h-auto flex-none" style={{ mixBlendMode: "multiply" }} />
        </div>
      </div>
    </div>
  );
}

function StayCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#FAFCFC] px-3 py-2">
      <div className="text-[7.5px] font-bold tracking-[1px] uppercase text-fv-accent-label mb-0.5">{label}</div>
      <div className="text-[11px] font-medium text-fv-ink leading-tight">{value}</div>
      {sub && <div className="text-[8.5px] text-[#9AA7AE] mt-px">{sub}</div>}
    </div>
  );
}
