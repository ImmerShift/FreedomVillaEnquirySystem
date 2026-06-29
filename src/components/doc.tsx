import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  loadActiveBooking,
  loadBookingById,
  loadGuestStays,
  loadSettings,
  loadFxRates,
  loadDocFields,
  saveDocFields,
  loadDocStatus,
  markDocPdf,
  markDocSent,
  loadPayments,
  addPayment,
  deletePayment,
  type FullBooking,
  type FxRate,
  type Settings,
  type Guest,
  type DocStatus,
  type GuestStayRow,
  type Payment,
} from "../db";
import { setActiveBookingId } from "../lib/activeBooking";
import { makeFormatter, fmtDate } from "../lib/pricing";
import { CurrencySelect } from "./CurrencySelect";
import brandLogo from "../assets/brand/logo-freedomvilla.png";
import robSignature from "../assets/brand/rob-signature-trim.png";
import docHeader from "../assets/doc-header-v2.png";

export type Orientation = "portrait" | "landscape";

/** Loads the active booking + settings + fx + the guest list, and lets the doc
 *  screens switch which guest/booking they're showing. */
export function useDocData() {
  const [data, setData] = useState<FullBooking | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [currency, setCurrency] = useState("AUD");
  const [loaded, setLoaded] = useState(false);
  const [bookings, setBookings] = useState<GuestStayRow[]>([]);

  useEffect(() => {
    (async () => {
      const [b, s, fx, list] = await Promise.all([
        loadActiveBooking(),
        loadSettings(),
        loadFxRates(),
        loadGuestStays(),
      ]);
      setData(b);
      setSettings(s);
      setFxRates(fx);
      setBookings(list);
      if (b) setCurrency(b.booking.currency || "AUD");
      setLoaded(true);
    })();
  }, []);

  /** Switch the document to a different guest's booking. */
  const pick = useCallback(async (id: number) => {
    setActiveBookingId(id);
    const b = await loadBookingById(id);
    setData(b);
    if (b) setCurrency(b.booking.currency || "AUD");
  }, []);

  const fmt = useMemo(() => makeFormatter(currency, fxRates), [currency, fxRates]);
  return { data, settings, fxRates, currency, setCurrency, fmt, loaded, bookings, pick };
}

/** Searchable picker to switch which guest/booking a document is generated for. */
export function GuestPicker({
  bookings,
  activeId,
  onPick,
}: {
  bookings: GuestStayRow[];
  activeId: number | undefined;
  onPick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = bookings.find((b) => b.id === activeId);

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

  if (bookings.length === 0) return null;
  const s = q.trim().toLowerCase();
  const filtered = s
    ? bookings.filter((b) => `${b.guest_name} ${b.email || ""}`.toLowerCase().includes(s))
    : bookings;
  const LIMIT = 50;
  const shown = filtered.slice(0, LIMIT);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[13px] font-semibold text-fv-ink bg-white border border-[#C5D2D2] rounded-md pl-3 pr-2.5 py-2.5 cursor-pointer max-w-[230px]"
        title="Switch guest"
      >
        <span className="text-[10px] font-bold tracking-[1.2px] uppercase text-[#9AA7AE]">Guest</span>
        <span className="truncate">{current ? current.guest_name : "Select…"}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9FB0BE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-[290px] bg-white border border-[#E2EAEA] rounded-xl shadow-[0_16px_40px_rgba(27,58,91,0.18)] p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="fv-input !py-2 !text-[13px] w-full mb-2"
          />
          <div className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-[12.5px] text-[#9AA7AE] italic">No matching guest.</div>
            ) : (
              shown.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { onPick(b.id); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                    b.id === activeId ? "bg-fv-accent-soft" : "hover:bg-[#F4FBFB]"
                  }`}
                >
                  <div className="text-[13.5px] font-semibold text-fv-ink truncate">{b.guest_name}</div>
                  <div className="text-[11.5px] text-[#9AA7AE] truncate">
                    {[b.email, fmtDate(b.check_in)].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))
            )}
            {filtered.length > LIMIT && (
              <div className="px-2.5 py-2 text-[11.5px] text-[#9AA7AE] italic">
                Showing {LIMIT} of {filtered.length} — type a name or email to narrow it down.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function logoFrom(settings: Settings): string {
  return settings.doc_logo || brandLogo;
}

/** Per-document editable text overrides (intro, terms, etc.), persisted per booking. */
export function useDocEdits(bookingId: number | undefined, docType: string) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (bookingId == null) return;
    loadDocFields(bookingId, docType).then(setFields);
  }, [bookingId, docType]);

  const get = (key: string, fallback: string) =>
    fields[key] !== undefined && fields[key] !== "" ? fields[key] : fallback;
  const setField = (key: string, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  const save = async () => {
    if (bookingId != null) await saveDocFields(bookingId, docType, fields);
  };
  return { editing, setEditing, get, setField, save };
}

/** Renders editable text (textarea) in edit mode, plain text in preview/print. */
export function Editable({
  editing,
  value,
  onChange,
  className = "",
  placeholder,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  if (editing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full resize-y border border-dashed border-fv-accent bg-[#F4FBFB] rounded-md px-3 py-2.5 outline-none ${className}`}
      />
    );
  }
  return <div className={`whitespace-pre-line ${className}`}>{value}</div>;
}

/** Injects the @page size so the print dialog defaults to the chosen orientation. */
export function PrintOrientation({ orientation }: { orientation: Orientation }) {
  return <style>{`@media print { @page { size: A4 ${orientation}; margin: 0; } }`}</style>;
}

/** Small Edit/Done + Portrait/Landscape control cluster for document toolbars. */
export function DocControls({
  editing,
  onToggleEdit,
  orientation,
  setOrientation,
}: {
  editing: boolean;
  onToggleEdit: () => void;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
}) {
  return (
    <>
      <div className="flex rounded-md border border-[#C5D2D2] overflow-hidden">
        {(["portrait", "landscape"] as Orientation[]).map((o) => (
          <button
            key={o}
            onClick={() => setOrientation(o)}
            className={`text-[12px] font-semibold px-3 py-2.5 transition-colors ${
              orientation === o ? "bg-fv-accent-soft text-fv-accent-deep" : "bg-white text-[#7A8790] hover:bg-[#F2F8F8]"
            }`}
          >
            {o === "portrait" ? "Portrait" : "Landscape"}
          </button>
        ))}
      </div>
      <button
        onClick={onToggleEdit}
        className={`text-[13px] font-semibold rounded-md px-4 py-2.5 border transition-colors ${
          editing
            ? "text-white bg-fv-accent border-fv-accent"
            : "text-fv-ink bg-white border-[#C5D2D2] hover:border-fv-ink"
        }`}
      >
        {editing ? "Done" : "Edit"}
      </button>
    </>
  );
}

/** Screen toolbar (not printed): document title, currency, back + Save PDF. */
export function DocToolbar({
  title,
  currency,
  setCurrency,
  showCurrency = true,
  editing,
  onToggleEdit,
  orientation,
  setOrientation,
  onSavePdf,
  guests,
  activeId,
  onPick,
  fxRates = [],
}: {
  title: string;
  currency: string;
  setCurrency: (c: string) => void;
  showCurrency?: boolean;
  editing?: boolean;
  onToggleEdit?: () => void;
  orientation?: Orientation;
  setOrientation?: (o: Orientation) => void;
  onSavePdf?: () => void;
  guests?: GuestStayRow[];
  activeId?: number;
  onPick?: (id: number) => void;
  fxRates?: FxRate[];
}) {
  const navigate = useNavigate();
  const hasControls = onToggleEdit && setOrientation && orientation;
  return (
    <div className="no-print flex items-end justify-between gap-6 mb-[26px]">
      <div>
        <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
          Document
        </div>
        <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0">{title}</h1>
      </div>
      <div className="flex items-center gap-3 flex-none">
        {guests && onPick && (
          <GuestPicker bookings={guests} activeId={activeId} onPick={onPick} />
        )}
        {showCurrency && (
          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            fxRates={fxRates}
            triggerClassName="flex items-center gap-2 text-[13px] font-semibold text-fv-ink bg-white border border-[#C5D2D2] rounded-md pl-3 pr-3 py-2.5 cursor-pointer outline-none"
          />
        )}
        {hasControls && (
          <DocControls
            editing={!!editing}
            onToggleEdit={onToggleEdit!}
            orientation={orientation!}
            setOrientation={setOrientation!}
          />
        )}
        <button className="btn-ghost" onClick={() => navigate("/inquiry")}>
          Back to Request
        </button>
        <button
          className="btn-accent"
          onClick={onSavePdf || (() => window.print())}
          disabled={!!editing}
        >
          Save PDF
        </button>
      </div>
    </div>
  );
}

/** Screen-only payments ledger for a booking. Used on the Invoice and Receipt.
 *  Amounts are entered/stored in AUD; `fmt` converts for display. Reports the
 *  running total up via `onTotalChange` so the doc's balance stays live. */
export function PaymentsPanel({
  bookingId,
  grandTotal,
  fmt,
  onTotalChange,
}: {
  bookingId: number;
  grandTotal: number;
  fmt: (n: number) => string;
  onTotalChange?: (total: number) => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amt, setAmt] = useState("");
  const [kind, setKind] = useState("Balance");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank transfer");

  const refresh = useCallback(async () => {
    const ps = await loadPayments(bookingId);
    setPayments(ps);
    onTotalChange?.(ps.reduce((s, p) => s + p.amount, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const balance = grandTotal - total;

  const add = async () => {
    const a = parseFloat((amt || "").replace(/,/g, ""));
    if (!Number.isFinite(a) || a === 0) return;
    await addPayment({ booking_id: bookingId, amount: a, kind, method, paid_on: paidOn, note: "" });
    setAmt("");
    refresh();
  };
  const remove = async (id: number) => {
    await deletePayment(id, bookingId);
    refresh();
  };

  return (
    <div className="no-print fv-card p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <span className="fv-section-label">Payments</span>
        <div className="flex items-center gap-4 text-[13px]">
          <span className="text-[#5E6B75]">Received <b className="text-fv-accent-deep font-semibold">{fmt(total)}</b></span>
          <span className="text-[#5E6B75]">Balance <b className="text-fv-alert font-semibold">{fmt(balance)}</b></span>
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
              <button onClick={() => remove(p.id)} className="text-[16px] text-[#B8C5C5] hover:text-[#C0392B] flex-none leading-none">×</button>
            </div>
          ))}
        </div>
      )}

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
        <button onClick={add} className="btn-accent !py-2.5">Add</button>
      </div>
    </div>
  );
}

/** Tracks PDF-saved / sent status for one document of one booking. */
export function useDocStatus(bookingId: number | undefined, docType: string) {
  const [status, setStatus] = useState<DocStatus | null>(null);
  const reload = useCallback(async () => {
    if (bookingId == null) return;
    setStatus(await loadDocStatus(bookingId, docType));
  }, [bookingId, docType]);
  useEffect(() => {
    reload();
  }, [reload]);

  const markPdf = async () => {
    if (bookingId == null) return;
    await markDocPdf(bookingId, docType);
    reload();
  };
  const markSent = async (via: string) => {
    if (bookingId == null) return;
    await markDocSent(bookingId, docType, via);
    reload();
  };
  return { status, markPdf, markSent };
}

function StatusCheck({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[13px]">
      <span
        className={`flex items-center justify-center w-[18px] h-[18px] rounded-full flex-none ${
          on ? "bg-fv-accent text-white" : "bg-[#EDF1F1] text-[#B8C5C5]"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      </span>
      <span className={on ? "text-fv-ink font-medium" : "text-[#8794A0]"}>{label}</span>
    </span>
  );
}

/** Screen-only checklist (PDF created / sent) + a Send button. */
export function DocStatusBar({
  status,
  onSend,
}: {
  status: DocStatus | null;
  onSend: () => void;
}) {
  const pdf = !!status?.pdf_saved_at;
  const sent = !!status?.sent_at;
  return (
    <div className="no-print flex items-center justify-between gap-4 fv-card px-5 py-3 mb-6 flex-wrap">
      <div className="flex items-center gap-6">
        <StatusCheck on={pdf} label="PDF created" />
        <StatusCheck
          on={sent}
          label={
            sent
              ? `Sent ${fmtDate((status!.sent_at || "").slice(0, 10))}${status!.sent_via ? ` · ${status!.sent_via}` : ""}`
              : "Sent to guest"
          }
        />
      </div>
      <button className="btn-accent !py-2" onClick={onSend}>
        Send to guest →
      </button>
    </div>
  );
}

/** Send dialog: opens WhatsApp / email with a prefilled note and marks the doc sent. */
export function SendModal({
  open,
  onClose,
  docLabel,
  guest,
  settings,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  docLabel: string;
  guest: Guest | undefined;
  settings: Settings;
  onSent: (via: string) => void;
}) {
  if (!open) return null;
  const first = (guest?.full_name || "there").split(" ")[0];
  const villa = settings.villa_name || "Freedom Villa";
  const owner = settings.villa_owner || "Robert Addamo";
  const msg =
    `Hi ${first}, please find your ${docLabel.toLowerCase()} for your stay at ${villa} attached. ` +
    `Do let me know if you have any questions.\n\nWarm regards,\n${owner} — ${villa}`;
  const phone = (guest?.whatsapp || "").replace(/[^0-9]/g, "");

  const viaWhatsApp = () => {
    openUrl(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`).catch(() => {});
    onSent("WhatsApp");
    onClose();
  };
  const viaEmail = () => {
    openUrl(
      `mailto:${guest?.email || ""}?subject=${encodeURIComponent(`Your ${docLabel} — ${villa}`)}&body=${encodeURIComponent(msg)}`
    ).catch(() => {});
    onSent("Email");
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-7 max-w-[460px] w-full shadow-[0_20px_60px_rgba(27,58,91,0.3)]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-semibold tracking-[2.5px] uppercase text-fv-accent-deep mb-2">Send {docLabel}</div>
        <h2 className="text-[22px] font-light text-fv-ink m-0 mb-1">To {guest?.full_name || "your guest"}</h2>
        <p className="text-[13px] text-[#6B7780] leading-[1.6] mb-5">
          Save the PDF first, then send it here — we'll open your message ready to attach it, and mark this document as sent.
        </p>
        <div className="bg-[#F7FAFA] border border-[#E3EAEA] rounded-lg px-4 py-3 text-[13px] text-[#4A555E] leading-[1.6] whitespace-pre-line mb-5 max-h-[140px] overflow-auto">
          {msg}
        </div>
        <div className="flex flex-col gap-2.5">
          <button onClick={viaWhatsApp} disabled={!phone} className="btn-accent w-full justify-center !py-3 disabled:opacity-40">
            Send via WhatsApp
          </button>
          <button onClick={viaEmail} disabled={!guest?.email} className="btn-ghost w-full justify-center !py-3 disabled:opacity-40">
            Send via Email
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(msg);
            }}
            className="text-[13px] font-semibold text-fv-accent-deep bg-transparent border-none cursor-pointer py-1"
          >
            Copy message
          </button>
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#EEF1F1]">
          <button onClick={() => { onSent("Other"); onClose(); }} className="text-[12.5px] font-semibold text-[#7A8790] bg-transparent border-none cursor-pointer">
            Mark sent another way
          </button>
          <button onClick={onClose} className="text-[12.5px] font-semibold text-[#7A8790] bg-transparent border-none cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** White A4-ish document sheet wrapper. */
export function DocSheet({ children }: { children: ReactNode }) {
  return (
    <div className="print-sheet bg-white border border-[#E7ECEC] rounded-[4px] shadow-[0_10px_40px_rgba(27,58,91,0.10)] px-[68px] pt-16 pb-[52px]">
      {children}
    </div>
  );
}

/** Full-bleed banner letterhead: the villa-photo header image with the logo and
 *  gold Cinzel title laid over its white left area. */
export function DocLetterhead({ logoSrc, title }: { logoSrc: string; title: string }) {
  return (
    <div className="relative mb-9">
      {/* photo accent bleeding into the sheet's top-right corner */}
      <img src={docHeader} alt="Freedom Villa" className="absolute -top-16 -right-[68px] h-[150px] w-auto" />
      {/* logo left, gold title centered in the white area before the photo */}
      <div className="relative flex items-center h-[100px]" style={{ width: "63%" }}>
        <img src={logoSrc} alt="Freedom Villa · Petitenget Bali" className="w-[150px] h-auto flex-none" />
        <div className="flex-1 flex flex-col items-center">
          <div className="font-display text-[30px] font-semibold tracking-[4px] uppercase leading-none" style={{ color: "#B68A3E" }}>
            {title}
          </div>
          <div className="w-[110px] h-0.5 mt-3" style={{ background: "linear-gradient(90deg,transparent,#C9A14E,transparent)" }} />
        </div>
      </div>
      <div className="h-px mt-2" style={{ background: "linear-gradient(90deg,#E4C998,transparent)" }} />
    </div>
  );
}

/** Shared closing footer for invoice/receipt/instructions. */
export function DocFooter({ settings, signature }: { settings: Settings; signature?: boolean }) {
  return (
    <div className="mt-[38px] pt-[26px] border-t border-[#EEF1F1] flex items-end justify-between gap-6 flex-wrap">
      <div>
        <div className="text-[14px] text-[#4A555E] mb-0.5">With warm regards,</div>
        <div className="text-[17px] font-medium text-fv-ink">
          {settings.villa_owner || "Robert Addamo"}
          {!signature && " & the Freedom Villa team"}
        </div>
        {signature && (
          <div className="text-[12.5px] text-[#5E6B75]">
            {settings.villa_owner_title || "Villa Owner and Booking Co-ordinator"}
          </div>
        )}
      </div>
      <div className="text-right text-[12px] text-[#9AA7AE] leading-[1.7]">
        {signature && (
          <img
            src={robSignature}
            alt="Robert Addamo"
            className="w-[70px] h-auto ml-auto mb-1"
            style={{ mixBlendMode: "multiply" }}
          />
        )}
        {settings.villa_website && <div>{settings.villa_website}</div>}
        {settings.villa_email && <div>{settings.villa_email}</div>}
        {settings.villa_phone && <div>{settings.villa_phone}</div>}
      </div>
    </div>
  );
}

/** Empty state shown when no inquiry has been saved yet. */
export function DocEmpty({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
        Document
      </div>
      <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] m-0 mb-4">{title}</h1>
      <div className="fv-card p-10 text-center">
        <p className="text-[15px] text-[#6B7780] mb-5">
          No saved request yet. Fill in the Quotation Request screen and click{" "}
          <b>Save Request</b> — this document builds itself from there.
        </p>
        <button className="btn-accent" onClick={() => navigate("/inquiry")}>
          Go to Quotation Request
        </button>
      </div>
    </div>
  );
}

/** 3- or 4-column summary strip cell (villa / dates / nights). */
export function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#FAFCFC] px-[18px] py-4">
      <div className="text-[9.5px] font-bold tracking-[1.4px] uppercase text-[#9AA7AE] mb-1.5">{label}</div>
      <div className="text-[15px] font-medium text-fv-ink">{value}</div>
      {sub && <div className="text-[12.5px] text-[#7A8790] mt-0.5">{sub}</div>}
    </div>
  );
}
