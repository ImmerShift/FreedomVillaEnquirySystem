import { useCallback, useEffect, useState } from "react";
import {
  useDocData,
  useDocEdits,
  useDocStatus,
  logoFrom,
  DocToolbar,
  DocStatusBar,
  SendModal,
  DocSheet,
  DocLetterhead,
  DocFooter,
  DocEmpty,
  SummaryCell,
  Editable,
  PrintOrientation,
  type Orientation,
} from "../components/doc";
import { nightsBetween, fmtDate, addDays } from "../lib/pricing";
import {
  loadPayments,
  addPayment,
  deletePayment,
  type Payment,
} from "../db";

const parseAmt = (s: string): number => {
  const n = parseFloat((s || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// ============ INVOICE ============
export function Invoice() {
  const { data, settings, currency, setCurrency, fmt, loaded } = useDocData();
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [sendOpen, setSendOpen] = useState(false);
  const edits = useDocEdits(data?.booking.id, "invoice");
  const docStatus = useDocStatus(data?.booking.id, "invoice");
  const toggleEdit = async () => {
    if (edits.editing) await edits.save();
    edits.setEditing(!edits.editing);
  };
  const savePdf = async () => {
    await docStatus.markPdf();
    window.print();
  };

  if (!loaded) return null;
  if (!data) return <DocEmpty title="Invoice" />;

  const { booking, guest, charges } = data;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const issued = booking.inquiry_date || booking.created_at?.slice(0, 10) || "";
  const dueDays = Number(settings.invoice_due_days || "7");
  const dueDate = addDays(issued, dueDays);
  const year = (issued || "").slice(0, 4) || new Date().getFullYear();
  const invoiceNo = `INV-${year}-${String(booking.id).padStart(4, "0")}`;
  const balanceRemain = booking.grand_total - booking.amount_paid;
  const sheetMax = orientation === "landscape" ? "max-w-[1400px]" : "max-w-[1000px]";

  const paymentNote = edits.get("payment_note", settings.bank_details || "");
  const terms = edits.get(
    "terms",
    `Payment due within ${dueDays} days of the invoice date. All rates are inclusive of taxes, service and staff.`
  );

  const lineItems = [
    {
      label: "All-Inclusive Villa Stay",
      detail: `${nights} nights × ${fmt(booking.applied_rate)}`,
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

  return (
    <div className={`${sheetMax} mx-auto`}>
      <PrintOrientation orientation={orientation} />
      <DocToolbar
        title="Invoice"
        currency={currency}
        setCurrency={setCurrency}
        editing={edits.editing}
        onToggleEdit={toggleEdit}
        orientation={orientation}
        setOrientation={setOrientation}
        onSavePdf={savePdf}
      />
      <DocStatusBar status={docStatus.status} onSend={() => setSendOpen(true)} />
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docLabel="Invoice"
        guest={guest}
        settings={settings}
        onSent={docStatus.markSent}
      />
      <DocSheet>
        <DocLetterhead logoSrc={logoFrom(settings)} title="Invoice" />

        {/* billed to + meta */}
        <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] mb-[30px] border-b-2 border-fv-accent">
          <div>
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-1.5">Billed to</div>
            <div className="text-[19px] font-medium text-fv-ink">{guest?.full_name || "—"}</div>
            <div className="text-[13px] text-[#7A8790] mt-0.5">
              {[guest?.email, guest?.country].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-1.5 justify-end text-[12.5px] text-[#7A8790] text-right">
            <span>Invoice no.</span>
            <span className="font-semibold text-[#3F4B55]">{invoiceNo}</span>
            <span>Date</span>
            <span className="font-semibold text-[#3F4B55]">{fmtDate(issued)}</span>
            <span>Due</span>
            <span className="font-semibold text-[#3F4B55]">{fmtDate(dueDate)}</span>
          </div>
        </div>

        {/* stay summary */}
        <div className="grid grid-cols-4 gap-px bg-[#EAEFEF] border border-[#EAEFEF] rounded-lg overflow-hidden mb-[34px]">
          <SummaryCell label="Villa" value={settings.villa_name || "Freedom Villa"} />
          <SummaryCell label="Check-in" value={fmtDate(booking.check_in)} />
          <SummaryCell label="Check-out" value={fmtDate(booking.check_out)} />
          <SummaryCell label="Nights · Guests" value={`${nights} · ${booking.num_guests}`} />
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
          <div className="w-[340px]">
            <div className="flex justify-between py-1.5 text-[14px] text-[#5E6B75]">
              <span>Accommodation</span>
              <span className="font-semibold text-[#2B3640]">{fmt(booking.accommodation_total)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-[14px] text-[#5E6B75]">
              <span>Additional charges</span>
              <span className="font-semibold text-[#2B3640]">{fmt(booking.additional_total)}</span>
            </div>
            <div className="flex items-end justify-between gap-3 bg-fv-band rounded-lg px-5 py-[18px] mt-3">
              <span className="text-[11px] font-semibold tracking-[2px] uppercase text-fv-accent-tint pb-1">Total</span>
              <span className="text-[30px] font-light text-white leading-none">{fmt(booking.grand_total)}</span>
            </div>
            <div className="text-[11px] text-[#9AA7AE] text-right mt-1.5">Inclusive of taxes, service &amp; staff</div>
            <div className="flex justify-between pt-[11px] px-0.5 text-[13px] text-[#5E6B75]">
              <span>Deposit received</span>
              <span className="font-semibold text-fv-accent-deep">{fmt(booking.amount_paid)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 mt-2.5 bg-[#FBEEEA] border border-[#E8C3B6] rounded-lg">
              <span className="text-[13px] font-semibold tracking-[0.6px] uppercase text-[#B5503A]">Balance due</span>
              <span className="text-[22px] font-medium text-fv-alert">{fmt(balanceRemain)}</span>
            </div>
          </div>
        </div>

        {/* payment details */}
        {(paymentNote || edits.editing) && (
          <div className="mt-[34px] px-6 py-[22px] bg-[#FAFCFC] border border-[#EAEFEF] rounded-[10px]">
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-2.5">Payment details</div>
            <Editable
              editing={edits.editing}
              value={paymentNote}
              onChange={(v) => edits.setField("payment_note", v)}
              placeholder="Bank, account name, account number…"
              className="text-[14px] leading-[1.7] text-[#3F4B55] min-h-[60px]"
            />
          </div>
        )}

        {/* terms */}
        <div className="mt-[22px]">
          <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-2">Terms</div>
          <Editable
            editing={edits.editing}
            value={terms}
            onChange={(v) => edits.setField("terms", v)}
            className="text-[13px] leading-[1.7] text-[#8492A0] max-w-[74ch]"
          />
        </div>

        <DocFooter settings={settings} signature />
      </DocSheet>
    </div>
  );
}

// ============ RECEIPT ============
export function Receipt() {
  const { data, settings, currency, setCurrency, fmt, loaded } = useDocData();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amt, setAmt] = useState("");
  const [kind, setKind] = useState("Balance");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank transfer");
  const [note, setNote] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const edits = useDocEdits(data?.booking.id, "receipt");
  const toggleEdit = async () => {
    if (edits.editing) await edits.save();
    edits.setEditing(!edits.editing);
  };
  const [sendOpen, setSendOpen] = useState(false);
  const docStatus = useDocStatus(data?.booking.id, "receipt");
  const savePdf = async () => {
    await docStatus.markPdf();
    window.print();
  };

  const bookingId = data?.booking.id;
  const refreshPayments = useCallback(async () => {
    if (bookingId == null) return;
    setPayments(await loadPayments(bookingId));
  }, [bookingId]);
  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  if (!loaded) return null;
  if (!data) return <DocEmpty title="Receipt" />;

  const { booking, guest } = data;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const issued = booking.inquiry_date || booking.created_at?.slice(0, 10) || "";
  const year = (issued || "").slice(0, 4) || new Date().getFullYear();
  const receiptNo = `RCT-${year}-${String(booking.id).padStart(4, "0")}`;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balanceRemain = booking.grand_total - totalPaid;
  const sheetMax = orientation === "landscape" ? "max-w-[1400px]" : "max-w-[1000px]";
  const thanks = edits.get("thanks", "Received with thanks. We look forward to welcoming you.");

  const onAddPayment = async () => {
    const a = parseAmt(amt);
    if (a === 0) return;
    await addPayment({ booking_id: booking.id, amount: a, kind, method, paid_on: paidOn, note });
    setAmt("");
    setNote("");
    refreshPayments();
  };
  const onDeletePayment = async (id: number) => {
    await deletePayment(id, booking.id);
    refreshPayments();
  };

  return (
    <div className={`${sheetMax} mx-auto`}>
      <PrintOrientation orientation={orientation} />
      <DocToolbar
        title="Receipt"
        currency={currency}
        setCurrency={setCurrency}
        editing={edits.editing}
        onToggleEdit={toggleEdit}
        orientation={orientation}
        setOrientation={setOrientation}
        onSavePdf={savePdf}
      />
      <DocStatusBar status={docStatus.status} onSend={() => setSendOpen(true)} />
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docLabel="Receipt"
        guest={guest}
        settings={settings}
        onSent={docStatus.markSent}
      />

      {/* payments ledger — screen only, not printed */}
      <div className="no-print fv-card p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <span className="fv-section-label">Payments</span>
          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-[#5E6B75]">Received <b className="text-fv-accent-deep font-semibold">{fmt(totalPaid)}</b></span>
            <span className="text-[#5E6B75]">Balance <b className="text-fv-alert font-semibold">{fmt(balanceRemain)}</b></span>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mb-4">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#F0F4F4] text-[13px]">
                <span className="text-[#7A8790] w-[92px] flex-none">{fmtDate(p.paid_on || "")}</span>
                <span className="font-semibold text-[#3F4B55] w-[80px] flex-none">{p.kind}</span>
                <span className="text-[#7A8790] flex-1 min-w-0 truncate">{[p.method, p.note].filter(Boolean).join(" · ")}</span>
                <span className="font-semibold text-fv-ink flex-none">{fmt(p.amount)}</span>
                <button onClick={() => onDeletePayment(p.id)} className="text-[16px] text-[#B8C5C5] hover:text-[#C0392B] flex-none leading-none">×</button>
              </div>
            ))}
          </div>
        )}

        {/* add payment */}
        <div className="grid grid-cols-[120px_120px_140px_1fr_auto] gap-2.5 items-center">
          <div className="flex items-center bg-fv-type-bg border border-fv-type-border rounded-[5px] px-3">
            <span className="text-[13px] text-[#9FB0BE] mr-1">A$</span>
            <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0" className="flex-1 min-w-0 border-none outline-none bg-transparent py-2.5 text-[14px] text-ink-900" />
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="fv-input !py-2.5 !text-[13px] appearance-none cursor-pointer">
            <option>Deposit</option>
            <option>Balance</option>
            <option>Other</option>
          </select>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="fv-input !py-2 !text-[13px]" />
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Method / note" className="fv-input !py-2.5 !text-[13px]" />
          <button onClick={onAddPayment} className="btn-accent !py-2.5">Add</button>
        </div>
      </div>

      <DocSheet>
        <DocLetterhead logoSrc={logoFrom(settings)} title="Receipt" />

        {/* received from + meta */}
        <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] mb-[30px] border-b-2 border-fv-accent">
          <div>
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-1.5">Received from</div>
            <div className="text-[19px] font-medium text-fv-ink">{guest?.full_name || "—"}</div>
            {guest?.email && <div className="text-[13px] text-[#7A8790] mt-0.5">{guest.email}</div>}
          </div>
          <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-1.5 justify-end text-[12.5px] text-[#7A8790] text-right">
            <span>Receipt no.</span>
            <span className="font-semibold text-[#3F4B55]">{receiptNo}</span>
            <span>Date</span>
            <span className="font-semibold text-[#3F4B55]">{fmtDate(issued)}</span>
          </div>
        </div>

        {/* amount received hero */}
        <div className="flex flex-col items-center text-center pt-[18px] pb-[34px]">
          <div className="text-[11px] font-semibold tracking-[2.5px] uppercase text-fv-accent-deep mb-3.5">Amount received</div>
          <div className="text-[58px] font-light text-fv-ink leading-none">{fmt(totalPaid)}</div>
          <div className="inline-flex items-center gap-2 mt-[18px] px-4 py-1.5 bg-fv-accent-soft border border-fv-accent-soft-border rounded-full">
            <span className="text-[13px] font-bold text-fv-accent-deep">✓</span>
            <span className="text-[12.5px] font-semibold text-fv-accent-deep">Received with thanks</span>
          </div>
        </div>

        {/* figures */}
        <div className="grid grid-cols-3 gap-px bg-[#EAEFEF] border border-[#EAEFEF] rounded-lg overflow-hidden mb-[30px]">
          <div className="bg-[#FAFCFC] px-5 py-[18px]">
            <div className="text-[9.5px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-2">Total booking value</div>
            <div className="text-[19px] font-medium text-fv-ink">{fmt(booking.grand_total)}</div>
          </div>
          <div className="bg-[#FAFCFC] px-5 py-[18px]">
            <div className="text-[9.5px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-2">Amount received</div>
            <div className="text-[19px] font-medium text-fv-accent-deep">{fmt(totalPaid)}</div>
          </div>
          <div className="bg-[#FAFCFC] px-5 py-[18px]">
            <div className="text-[9.5px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-2">Balance remaining</div>
            <div className="text-[19px] font-medium text-fv-alert">{fmt(balanceRemain)}</div>
          </div>
        </div>

        <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-[#9AA7AE] mb-2.5">Stay</div>
        <div className="text-[15px] text-[#3F4B55]">
          {settings.villa_name || "Freedom Villa"} · {fmtDate(booking.check_in)} → {fmtDate(booking.check_out)} · {nights} nights · {booking.num_guests} guests
        </div>

        <div className="mt-[34px] pt-6 border-t border-[#EEF1F1]">
          <Editable
            editing={edits.editing}
            value={thanks}
            onChange={(v) => edits.setField("thanks", v)}
            className="text-[15px] text-[#4A555E]"
          />
        </div>

        <DocFooter settings={settings} />
      </DocSheet>
    </div>
  );
}

// ============ VILLA INSTRUCTIONS ============
export function VillaInstructions() {
  const { data, settings, loaded } = useDocData();
  const [sendOpen, setSendOpen] = useState(false);
  const docStatus = useDocStatus(data?.booking.id, "instructions");
  const savePdf = async () => {
    await docStatus.markPdf();
    window.print();
  };

  if (!loaded) return null;
  if (!data) return <DocEmpty title="Villa Instructions" />;

  const { booking, guest } = data;
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const inclusionLines = (settings.inclusions || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="max-w-[1000px] mx-auto">
      <DocToolbar title="Villa Instructions" currency="AUD" setCurrency={() => {}} showCurrency={false} onSavePdf={savePdf} />
      <DocStatusBar status={docStatus.status} onSend={() => setSendOpen(true)} />
      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        docLabel="Villa Guide"
        guest={guest}
        settings={settings}
        onSent={docStatus.markSent}
      />
      <DocSheet>
        <DocLetterhead logoSrc={logoFrom(settings)} title="Villa Guide" />

        <div className="text-center text-[16px] text-[#4A555E] leading-[1.7] max-w-[60ch] mx-auto mb-[34px]">
          Welcome, {guest?.full_name || "guest"} — everything you need for a seamless arrival at {settings.villa_name || "Freedom Villa"}.
        </div>

        {/* check-in / out / guests */}
        <div className="grid grid-cols-3 gap-px bg-[#EAEFEF] border border-[#EAEFEF] rounded-lg overflow-hidden mb-[30px]">
          <SummaryCell label="Check-in" value={fmtDate(booking.check_in)} sub={`from ${settings.villa_checkin_time || "2:00 PM"}`} />
          <SummaryCell label="Check-out" value={fmtDate(booking.check_out)} sub={`by ${settings.villa_checkout_time || "11:00 AM"}`} />
          <SummaryCell label="Guests" value={String(booking.num_guests)} sub={`${nights} nights`} />
        </div>

        {/* address + wifi */}
        <div className="grid grid-cols-2 gap-6 mb-[30px]">
          <div>
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-2.5">Address</div>
            <div className="text-[14.5px] leading-[1.7] text-[#3F4B55]">{settings.villa_address || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-2.5">WiFi</div>
            {settings.wifi_name || settings.wifi_pass ? (
              <div className="text-[14.5px] leading-[1.7] text-[#3F4B55]">
                Network · <b>{settings.wifi_name || "—"}</b>
                <br />
                Password · <b>{settings.wifi_pass || "—"}</b>
              </div>
            ) : (
              <div className="text-[13.5px] text-[#9AA7AE] italic">Add WiFi details in Settings.</div>
            )}
          </div>
        </div>

        {/* inclusions checklist */}
        {inclusionLines.length > 0 && (
          <div className="mb-[30px]">
            <div className="text-[10px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-3">Your rate includes</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {inclusionLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15A3A0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-0.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-[14px] leading-[1.55] text-[#3F4B55]">{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* contact strip */}
        <div className="flex items-center gap-3 px-[18px] py-4 bg-fv-accent-soft border border-fv-accent-soft-border rounded-[10px]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E8482" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="text-[13.5px] text-[#33474A]">
            Need anything? Call or WhatsApp <b className="font-bold">{settings.villa_phone || "—"}</b> — {settings.villa_owner || "Robert Addamo"}, {settings.villa_owner_title || "Owner"}.
          </span>
        </div>

        <DocFooter settings={settings} />
      </DocSheet>
    </div>
  );
}
