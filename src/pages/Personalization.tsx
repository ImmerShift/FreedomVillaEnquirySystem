import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  loadActiveBooking,
  loadSettings,
  loadPersonalization,
  savePersonalization,
  type FullBooking,
  type Settings,
} from "../db";
import { fmtDate } from "../lib/pricing";
import { PageTitle, SectionHeader, Field } from "../components/ui";
import { DocEmpty } from "../components/doc";

const DEFAULT_ROOMS = "Bedroom 1\nBedroom 2\nBedroom 3\nBedroom 4\nBedroom 5";
const DEFAULT_BEDS = "King, Twin, Not used";
const splitLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const nowIso = () => new Date().toISOString();

export function Personalization() {
  const [data, setData] = useState<FullBooking | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loaded, setLoaded] = useState(false);

  // response fields
  const [arrivingNames, setArrivingNames] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [airline, setAirline] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [beds, setBeds] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      const [b, s] = await Promise.all([loadActiveBooking(), loadSettings()]);
      setData(b);
      setSettings(s);
      if (b) {
        const p = await loadPersonalization(b.booking.id);
        if (p) {
          setArrivingNames(p.arriving_names ?? "");
          setFlightNumber(p.flight_number ?? "");
          setAirline(p.airline ?? "");
          setArrivalDate(p.arrival_date ?? "");
          setArrivalTime(p.arrival_time ?? "");
          setNotes(p.notes ?? "");
          setCompletedAt(p.completed_at);
          setReceived(!!p.completed_at);
          try {
            setBeds(p.beds_json ? JSON.parse(p.beds_json) : {});
          } catch {
            setBeds({});
          }
        }
      }
      setLoaded(true);
    })();
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  if (!loaded) return null;
  if (!data) return <DocEmpty title="Personalization" />;

  const { booking, guest } = data;
  const firstName = (guest?.full_name || "there").split(" ")[0];
  const villaName = settings.villa_name || "Freedom Villa";
  const owner = settings.villa_owner || "Robert Addamo";
  const rooms = splitLines(settings.rooms || DEFAULT_ROOMS);
  const bedChoices = splitList(settings.bed_types || DEFAULT_BEDS);
  const previewBeds = bedChoices.filter((c) => c.toLowerCase() !== "not used");

  const message =
    `Hi ${firstName}, we can't wait to welcome you to ${villaName}! ` +
    `To prepare everything just the way you like, could you reply with:\n\n` +
    `• Full names of everyone arriving\n` +
    `• Flight number, airline & arrival time\n` +
    `• Bed preference for each room (King or Twin)\n\n` +
    `Anything else you'd like us to arrange, just say the word.\n\nWarm regards,\n${owner} — ${villaName}`;

  const phone = (guest?.whatsapp || "").replace(/[^0-9]/g, "");
  const openWhatsApp = () =>
    openUrl(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() =>
      flash("Couldn't open WhatsApp")
    );
  const openEmail = () =>
    openUrl(
      `mailto:${guest?.email || ""}?subject=${encodeURIComponent(
        `Preparing for your stay at ${villaName}`
      )}&body=${encodeURIComponent(message)}`
    ).catch(() => flash("Couldn't open email"));
  const copyMessage = () => {
    navigator.clipboard.writeText(message);
    flash("Message copied");
  };

  const setBed = (room: string, choice: string) =>
    setBeds((b) => ({ ...b, [room]: b[room] === choice ? "" : choice }));

  const handleSave = async () => {
    const completed = received ? completedAt || nowIso() : null;
    await savePersonalization({
      booking_id: booking.id,
      arriving_names: arrivingNames,
      flight_number: flightNumber,
      airline,
      arrival_date: arrivalDate,
      arrival_time: arrivalTime,
      beds_json: JSON.stringify(beds),
      notes,
      completed_at: completed,
    });
    setCompletedAt(completed);
    flash(received ? "Saved — marked received" : "Saved");
  };

  return (
    <div className="max-w-[1180px] mx-auto">
      <PageTitle
        eyebrow="Guest Form"
        title="Personalization"
        subtitle={`Send ${guest?.full_name || "the guest"} the pre-arrival questions, then record their reply here.`}
      />

      {/* share card */}
      <div className="fv-card p-7 mb-6">
        <div className="flex items-center justify-between gap-5 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <SectionHeader>Pre-arrival Questions</SectionHeader>
            <p className="text-[13.5px] text-[#6B7780] leading-[1.6] m-0">
              Send these to {firstName} on WhatsApp or email — names, flight details and
              bed preferences. Their reply gets recorded on the right.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-none">
            <button onClick={copyMessage} className="btn-ghost">Copy message</button>
            <button onClick={openEmail} disabled={!guest?.email} className="btn-ghost">Send via Email</button>
            <button onClick={openWhatsApp} disabled={!phone} className="btn-accent">Send via WhatsApp</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1.05fr_0.95fr] gap-6 items-start">
        {/* FORM PREVIEW */}
        <div className="bg-white border border-fv-card-border rounded-[9px] shadow-[0_1px_3px_rgba(30,58,95,0.05)] overflow-hidden">
          <div className="bg-fv-band px-[26px] py-[22px]">
            <div className="text-[10px] font-semibold tracking-[2.5px] uppercase text-fv-accent-tint mb-1.5">
              {villaName} Bali
            </div>
            <div className="text-[21px] font-light text-white">Guest Welcome Form</div>
            <div className="text-[12.5px] text-[#A9BACD] mt-1">This is what you're asking your guest.</div>
          </div>
          <div className="p-[26px]">
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-4">Arrival details</div>
            <PreviewField label="Full names of all guests arriving" placeholder="One name per line…" tall />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <PreviewField label="Check-in date" placeholder={fmtDate(booking.check_in)} />
              <PreviewField label="Check-out date" placeholder={fmtDate(booking.check_out)} />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <PreviewField label="Flight number" placeholder="e.g. QF43" />
              <PreviewField label="Airline" placeholder="e.g. Qantas" />
              <PreviewField label="Arrival time" placeholder="--:--" />
            </div>
            <div className="flex gap-3 items-start px-4 py-3.5 bg-fv-accent-soft border border-fv-accent-soft-border rounded-lg mb-5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0E8482" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-px">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
              <span className="text-[12.5px] leading-[1.6] text-[#33474A]">
                At Denpasar airport, look out for our sign bearing <b>our logo only</b> — for privacy we don't display guest names.
              </span>
            </div>
            <div className="text-[11px] font-bold tracking-[1.6px] uppercase text-fv-accent-deep mb-1.5">Bed arrangements</div>
            <div className="text-[12.5px] text-[#8794A0] mb-3 leading-[1.6]">So we prepare each room exactly as you like before you arrive.</div>
            {rooms.map((room) => (
              <div key={room} className="flex items-center justify-between gap-4 py-2.5 border-b border-[#F0F4F4]">
                <div className="text-[13.5px] font-semibold text-[#3F4B55]">{room}</div>
                <div className="flex gap-2">
                  {previewBeds.map((o) => (
                    <span key={o} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#5E6B75] bg-[#F7FAFA] border border-[#E3EAEA] rounded-full px-3 py-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-[#C3CFCF]" />
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GUEST RESPONSE (Rob fills) */}
        <div className="fv-card p-7">
          <div className="flex items-center justify-between gap-3.5 mb-5">
            <span className="fv-section-label">Guest Response</span>
            {completedAt ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3F8F5B] bg-[#EEF6EE] border border-[#C5DEC2] rounded-full px-3 py-1">
                ✓ Received {fmtDate(completedAt.slice(0, 10))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#B7841F] bg-[#FDF6E8] border border-[#EAD9A8] rounded-full px-3 py-1">
                Awaiting reply
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Arriving guests (one per line)" full>
              <textarea className="fv-input min-h-[80px] resize-y !text-[14px] leading-[1.6]" value={arrivingNames} onChange={(e) => setArrivingNames(e.target.value)} placeholder="Jane Smith&#10;John Smith" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Flight number"><input className="fv-input" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="QF43" /></Field>
              <Field label="Airline"><input className="fv-input" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Qantas" /></Field>
              <Field label="Arrival date"><input type="date" className="fv-input" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} /></Field>
              <Field label="Arrival time"><input className="fv-input" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} placeholder="14:30" /></Field>
            </div>

            <div>
              <span className="fv-field-label">Bed configuration</span>
              <div className="mt-2 border border-[#EBF0F0] rounded-lg overflow-hidden">
                {rooms.map((room) => (
                  <div key={room} className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[#F0F4F4] last:border-b-0">
                    <span className="text-[13px] font-semibold text-[#5E6B75]">{room}</span>
                    <div className="flex gap-1.5">
                      {bedChoices.map((choice) => {
                        const active = beds[room] === choice;
                        return (
                          <button
                            key={choice}
                            onClick={() => setBed(room, choice)}
                            className={`text-[12px] font-semibold rounded-full px-3 py-1 border transition-colors ${
                              active
                                ? "text-white bg-fv-accent border-fv-accent"
                                : "text-[#7A8790] bg-white border-[#DCE4E4] hover:border-fv-accent"
                            }`}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Notes / special requests" full>
              <textarea className="fv-input min-h-[70px] resize-y !text-[14px] leading-[1.6]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, celebrations, transfers…" />
            </Field>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="w-4 h-4 accent-[#15A3A0]" />
              <span className="text-[13.5px] text-[#3F4B55]">Mark as received from guest</span>
            </label>

            <button className="btn-accent w-full justify-center !py-3" onClick={handleSave}>
              Save response
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-7 right-7 bg-fv-ink text-white text-[13.5px] font-medium px-5 py-3.5 rounded-lg shadow-[0_8px_28px_rgba(27,58,91,0.28)] z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function PreviewField({ label, placeholder, tall }: { label: string; placeholder: string; tall?: boolean }) {
  return (
    <label className="block mb-4">
      <span className="block text-[12.5px] font-medium text-[#4A555E] mb-1.5">{label}</span>
      <div className={`text-[13px] text-[#B6C0C7] bg-[#F7FAFA] border border-[#E3EAEA] rounded-md px-3 py-2.5 ${tall ? "min-h-[54px]" : ""}`}>
        {placeholder}
      </div>
    </label>
  );
}
