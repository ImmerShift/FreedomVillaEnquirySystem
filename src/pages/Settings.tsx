import { useEffect, useState } from "react";
import {
  loadSettings,
  saveSetting,
  loadSeasons,
  updateSeasonField,
  addSeason,
  deleteSeason,
  loadFxRates,
  updateFxRate,
  exportAllData,
  type Season,
  type FxRate,
  type Settings as SettingsMap,
} from "../db";
import { SectionHeader, Field, PageTitle } from "../components/ui";
import logoGold from "../assets/logo-gold.png";

const num = (s: string): number => {
  const n = parseFloat((s || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const SEASON_TAG: Record<string, { bg: string; color: string }> = {
  Low: { bg: "#EDF5E8", color: "#5E8C49" },
  High: { bg: "#FDF6E8", color: "#B7841F" },
  Peak: { bg: "#FBEDEA", color: "#C0563B" },
};

export function Settings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      const [s, se, fx] = await Promise.all([
        loadSettings(),
        loadSeasons(),
        loadFxRates(),
      ]);
      // show editable defaults for room config if never set
      if (!s.rooms) s.rooms = "Bedroom 1\nBedroom 2\nBedroom 3\nBedroom 4\nBedroom 5";
      if (!s.bed_types) s.bed_types = "King, Twin, Not used";
      setSettings(s);
      setSeasons(se);
      setFxRates(fx);
    })();
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };

  // villa details / policy: local edit, persist on blur
  const setLocal = (key: string, value: string) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const persist = async (key: string) => {
    await saveSetting(key, settings[key] ?? "");
    flash("Saved");
  };

  // seasons
  const setSeasonLocal = (id: number, field: keyof Season, value: string) =>
    setSeasons((rows) =>
      rows.map((r) => (r.id === id ? ({ ...r, [field]: value } as Season) : r))
    );
  const persistSeason = async (
    id: number,
    field: "name" | "start_date" | "end_date" | "nightly_rate" | "agent_rate" | "rack_rate" | "minimum_nights"
  ) => {
    const row = seasons.find((r) => r.id === id);
    if (!row) return;
    const raw = row[field];
    const value =
      field === "nightly_rate" || field === "agent_rate" || field === "rack_rate" || field === "minimum_nights"
        ? num(String(raw))
        : String(raw);
    await updateSeasonField(id, field, value);
    flash("Saved");
  };
  const onAddSeason = async () => {
    const s = await addSeason();
    setSeasons((rows) => [...rows, s]);
  };
  const onDeleteSeason = async (id: number) => {
    await deleteSeason(id);
    setSeasons((rows) => rows.filter((r) => r.id !== id));
    flash("Removed");
  };

  // fx
  const setFxLocal = (code: string, value: string) =>
    setFxRates((rows) =>
      rows.map((r) =>
        r.code === code ? { ...r, rate_per_aud: value as unknown as number } : r
      )
    );
  const persistFx = async (code: string) => {
    const row = fxRates.find((r) => r.code === code);
    if (!row) return;
    await updateFxRate(code, num(String(row.rate_per_aud)));
    flash("Saved");
  };

  // document logo: read uploaded image as a data URL, store in settings
  const onLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > 4_000_000) {
      flash("Image too large (max 4 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setLocal("doc_logo", dataUrl);
      await saveSetting("doc_logo", dataUrl);
      flash("Logo updated");
    };
    reader.readAsDataURL(file);
  };
  const onLogoReset = async () => {
    setLocal("doc_logo", "");
    await saveSetting("doc_logo", "");
    flash("Logo reset to default");
  };

  const onExportBackup = async () => {
    const snapshot = await exportAllData();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freedom-villa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("Backup downloaded");
  };

  const sInput = (key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      className="fv-input"
      value={settings[key] ?? ""}
      onChange={(e) => setLocal(key, e.target.value)}
      onBlur={() => persist(key)}
      {...props}
    />
  );

  const savingMode = settings.saving_mode ?? "auto";
  const showRack = savingMode === "rack";
  const seasonGrid = showRack
    ? "grid-cols-[96px_1fr_1fr_82px_82px_82px_50px_22px]"
    : "grid-cols-[100px_1fr_1fr_92px_92px_56px_28px]";

  return (
    <div className="max-w-[880px] mx-auto">
      <PageTitle
        eyebrow="Setup"
        title="Settings"
        subtitle="The single source of truth — every document and total reads from here."
      />

      {/* VILLA DETAILS */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Villa Details</SectionHeader>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Villa name" full>
            {sInput("villa_name")}
          </Field>
          <Field label="Tagline" full>
            {sInput("villa_tagline")}
          </Field>
          <Field label="Address" full>
            {sInput("villa_address")}
          </Field>
          <Field label="Owner / coordinator">{sInput("villa_owner")}</Field>
          <Field label="Max guests">{sInput("villa_max_guests", { inputMode: "numeric" })}</Field>
          <Field label="Email">{sInput("villa_email")}</Field>
          <Field label="Phone / WhatsApp">{sInput("villa_phone")}</Field>
          <Field label="Website">{sInput("villa_website")}</Field>
          <Field label="Check-in time">{sInput("villa_checkin_time")}</Field>
          <Field label="Check-out time">{sInput("villa_checkout_time")}</Field>
          <Field label="Owner title" full>{sInput("villa_owner_title", { placeholder: "Owner · Freedom Villa Bali" })}</Field>
          <Field label="WiFi network">{sInput("wifi_name", { placeholder: "Network name" })}</Field>
          <Field label="WiFi password">{sInput("wifi_pass", { placeholder: "Password" })}</Field>
        </div>
      </section>

      {/* DOCUMENT BRANDING */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Document Logo</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          The gold logo printed at the top of every quotation, invoice and receipt.
          Upload a <b className="text-[#5E6B75]">high-resolution PNG</b> (transparent
          background works best) so it stays crisp in PDFs.
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center justify-center w-[260px] h-[120px] bg-[#FAFCFC] border border-dashed border-[#D7DFDF] rounded-[10px] overflow-hidden flex-none">
            <img
              src={settings.doc_logo || logoGold}
              alt="Document logo preview"
              className="max-w-[220px] max-h-[100px] w-auto h-auto object-contain"
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="btn-accent cursor-pointer inline-flex items-center !py-2.5">
              Upload logo
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onLogoUpload} className="hidden" />
            </label>
            {settings.doc_logo ? (
              <button onClick={onLogoReset} className="text-[13px] font-semibold text-[#7A8790] bg-transparent border border-[#D7DFDF] rounded-md px-4 py-2 cursor-pointer transition-all hover:border-[#C0392B] hover:text-[#C0392B]">
                Reset to default
              </button>
            ) : (
              <span className="text-[12px] text-[#9AA7AE]">Using the built-in logo.</span>
            )}
          </div>
        </div>
      </section>

      {/* BOOKING POLICY */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Booking Policy</SectionHeader>
        <div className="grid grid-cols-3 gap-x-5 gap-y-4">
          <Field label="Deposit %">
            <div className="flex items-center fv-input !py-0 !px-3.5">
              <input
                inputMode="numeric"
                className="flex-1 min-w-0 border-none outline-none bg-transparent py-3 text-[15px]"
                value={settings.deposit_pct ?? ""}
                onChange={(e) => setLocal("deposit_pct", e.target.value)}
                onBlur={() => persist("deposit_pct")}
              />
              <span className="text-[14px] text-[#9FB0BE]">%</span>
            </div>
          </Field>
          <Field label="Quote valid (days)">
            {sInput("quote_valid_days", { inputMode: "numeric" })}
          </Field>
          <Field label="Invoice due (days)">
            {sInput("invoice_due_days", { inputMode: "numeric" })}
          </Field>
          <Field label="Cleaning buffer (days)">
            {sInput("buffer_days", { inputMode: "numeric", placeholder: "0" })}
          </Field>
          <Field label="Rate inclusions — shown on every quotation" full>
            <textarea
              className="fv-input min-h-[120px] resize-y !text-[14px] leading-[1.6]"
              value={settings.inclusions ?? ""}
              onChange={(e) => setLocal("inclusions", e.target.value)}
              onBlur={() => persist("inclusions")}
            />
          </Field>
        </div>
      </section>

      {/* TAX & SERVICE */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Tax &amp; Service</SectionHeader>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="How is tax applied to your rates?">
            <select
              className="fv-input cursor-pointer appearance-none"
              value={settings.tax_mode ?? "inclusive"}
              onChange={(e) => { setLocal("tax_mode", e.target.value); saveSetting("tax_mode", e.target.value).then(() => flash("Saved")); }}
            >
              <option value="inclusive">Inclusive — already in my rate</option>
              <option value="added">Added on top — calculated &amp; added</option>
            </select>
          </Field>
          {(settings.tax_mode ?? "inclusive") === "added" && (
            <Field label="% government tax &amp; service">
              <div className="flex items-center fv-input !py-0 !px-3.5">
                <input
                  inputMode="numeric"
                  className="flex-1 min-w-0 border-none outline-none bg-transparent py-3 text-[15px]"
                  value={settings.tax_rate ?? "16"}
                  onChange={(e) => setLocal("tax_rate", e.target.value)}
                  onBlur={() => persist("tax_rate")}
                />
                <span className="text-[14px] text-[#9FB0BE]">%</span>
              </div>
            </Field>
          )}
          <Field label="Show tax on documents?" full>
            <select
              className="fv-input cursor-pointer appearance-none"
              value={settings.tax_show ?? "total"}
              onChange={(e) => { setLocal("tax_show", e.target.value); saveSetting("tax_show", e.target.value).then(() => flash("Saved")); }}
            >
              <option value="total">Show total only, with inclusive note</option>
              <option value="line_item">Show tax as a separate line item</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.tax_allow_override === "1"}
            onChange={(e) => { const v = e.target.checked ? "1" : "0"; setLocal("tax_allow_override", v); saveSetting("tax_allow_override", v).then(() => flash("Saved")); }}
            className="w-4 h-4 accent-[#15A3A0]"
          />
          <span className="text-[13.5px] text-[#3F4B55]">
            Allow turning tax on/off per booking (for agent or special-deal bookings)
          </span>
        </label>
      </section>

      {/* DIRECT-BOOKING SAVING */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Direct-Booking Saving</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          The "you save by booking direct" figure printed on quotations. Pick how it's worked out —
          it then fills in automatically on every request.
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="How is the saving calculated?">
            <select
              className="fv-input cursor-pointer appearance-none"
              value={savingMode}
              onChange={(e) => { setLocal("saving_mode", e.target.value); saveSetting("saving_mode", e.target.value).then(() => flash("Saved")); }}
            >
              <option value="auto">Automatic — a % above your direct rate</option>
              <option value="rack">From a rack / OTA rate per season</option>
              <option value="manual">I'll type it each time</option>
            </select>
          </Field>
          {savingMode === "auto" && (
            <Field label="% OTAs charge above direct">
              <div className="flex items-center fv-input !py-0 !px-3.5">
                <input
                  inputMode="numeric"
                  className="flex-1 min-w-0 border-none outline-none bg-transparent py-3 text-[15px]"
                  value={settings.ota_commission_pct ?? "15"}
                  onChange={(e) => setLocal("ota_commission_pct", e.target.value)}
                  onBlur={() => persist("ota_commission_pct")}
                />
                <span className="text-[14px] text-[#9FB0BE]">%</span>
              </div>
            </Field>
          )}
          {savingMode === "rack" && (
            <div className="flex items-end text-[12.5px] text-[#8794A0] leading-[1.5] pb-2">
              Set a <b className="text-[#5E6B75]">&nbsp;Rack&nbsp;</b> rate per season in the table below — the saving is that rate minus your direct rate, per night.
            </div>
          )}
        </div>
      </section>

      {/* PAYMENT DETAILS */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Payment Details</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          Bank / transfer details printed on every <b className="text-[#5E6B75]">invoice</b>.
        </div>
        <textarea
          className="fv-input w-full min-h-[120px] resize-y !text-[14px] leading-[1.6]"
          placeholder={"Bank: ...\nAccount name: ...\nAccount number: ...\nSWIFT/BIC: ..."}
          value={settings.bank_details ?? ""}
          onChange={(e) => setLocal("bank_details", e.target.value)}
          onBlur={() => persist("bank_details")}
        />
      </section>

      {/* ROOMS & BEDS */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Rooms &amp; Beds</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          The rooms guests choose bed types for on the{" "}
          <b className="text-[#5E6B75]">Personalization</b> form. One room per line.
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Rooms (one per line)">
            <textarea
              className="fv-input min-h-[150px] resize-y !text-[14px] leading-[1.8]"
              placeholder={"Master Suite\nGarden Room\nPool Room"}
              value={settings.rooms ?? ""}
              onChange={(e) => setLocal("rooms", e.target.value)}
              onBlur={() => persist("rooms")}
            />
          </Field>
          <Field label="Bed options (comma separated)">
            <input
              className="fv-input"
              placeholder="King, Twin, Not used"
              value={settings.bed_types ?? ""}
              onChange={(e) => setLocal("bed_types", e.target.value)}
              onBlur={() => persist("bed_types")}
            />
          </Field>
        </div>
      </section>

      {/* SEASONS & RATES */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Seasons &amp; Nightly Rates</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          Rates in <b className="text-[#5E6B75]">AUD / night</b>. The <b className="text-[#5E6B75]">Agent</b> rate
          is used automatically when a booking's source is "Agent" — it never appears on guest documents.
        </div>
        <div className={`grid ${seasonGrid} gap-2.5 px-1 pb-2.5 border-b border-[#E6EDED]`}>
          <Col>Season</Col>
          <Col>From</Col>
          <Col>To</Col>
          <Col className="text-right">Direct</Col>
          <Col className="text-right">Agent</Col>
          {showRack && <Col className="text-right">Rack</Col>}
          <Col className="text-center">Min</Col>
          <span />
        </div>
        {seasons.map((s) => {
          const tag = SEASON_TAG[s.name] ?? { bg: "#EEF3FA", color: "#3F77AC" };
          return (
            <div
              key={s.id}
              className={`grid ${seasonGrid} gap-2.5 items-center py-2.5 border-b border-[#EEF4F4]`}
            >
              <input
                className="fv-input !py-2 !px-3 !text-[12px] font-bold uppercase tracking-[0.6px] text-center rounded-full"
                style={{ background: tag.bg, color: tag.color, borderColor: "transparent" }}
                value={s.name}
                onChange={(e) => setSeasonLocal(s.id, "name", e.target.value)}
                onBlur={() => persistSeason(s.id, "name")}
              />
              <input
                type="date"
                className="fv-input !py-2 !px-3 !text-[13px]"
                value={s.start_date}
                onChange={(e) => setSeasonLocal(s.id, "start_date", e.target.value)}
                onBlur={() => persistSeason(s.id, "start_date")}
              />
              <input
                type="date"
                className="fv-input !py-2 !px-3 !text-[13px]"
                value={s.end_date}
                onChange={(e) => setSeasonLocal(s.id, "end_date", e.target.value)}
                onBlur={() => persistSeason(s.id, "end_date")}
              />
              <div className="flex items-center fv-input !py-0 !px-2.5">
                <span className="text-[11px] text-[#9FB0BE] mr-0.5">A$</span>
                <input
                  inputMode="numeric"
                  className="flex-1 min-w-0 border-none outline-none bg-transparent py-2 text-right text-[13px] font-semibold"
                  value={s.nightly_rate}
                  onChange={(e) => setSeasonLocal(s.id, "nightly_rate", e.target.value)}
                  onBlur={() => persistSeason(s.id, "nightly_rate")}
                />
              </div>
              <div className="flex items-center fv-input !py-0 !px-2.5">
                <span className="text-[11px] text-[#9FB0BE] mr-0.5">A$</span>
                <input
                  inputMode="numeric"
                  placeholder="—"
                  className="flex-1 min-w-0 border-none outline-none bg-transparent py-2 text-right text-[13px] font-semibold"
                  value={s.agent_rate ?? ""}
                  onChange={(e) => setSeasonLocal(s.id, "agent_rate", e.target.value)}
                  onBlur={() => persistSeason(s.id, "agent_rate")}
                />
              </div>
              {showRack && (
                <div className="flex items-center fv-input !py-0 !px-2.5">
                  <span className="text-[11px] text-[#9FB0BE] mr-0.5">A$</span>
                  <input
                    inputMode="numeric"
                    placeholder="—"
                    className="flex-1 min-w-0 border-none outline-none bg-transparent py-2 text-right text-[13px] font-semibold"
                    value={s.rack_rate ?? ""}
                    onChange={(e) => setSeasonLocal(s.id, "rack_rate", e.target.value)}
                    onBlur={() => persistSeason(s.id, "rack_rate")}
                  />
                </div>
              )}
              <input
                inputMode="numeric"
                className="fv-input !py-2 !px-2 !text-[13px] text-center"
                value={s.minimum_nights}
                onChange={(e) => setSeasonLocal(s.id, "minimum_nights", e.target.value)}
                onBlur={() => persistSeason(s.id, "minimum_nights")}
              />
              <button
                onClick={() => onDeleteSeason(s.id)}
                title="Remove season"
                className="text-[18px] text-[#B8C5C5] bg-transparent border-none cursor-pointer leading-none transition-colors hover:text-[#C0392B]"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          onClick={onAddSeason}
          className="mt-4 text-[13px] font-semibold tracking-[0.4px] text-fv-type-text bg-transparent border border-dashed border-[#BCCFE2] rounded-md px-[18px] py-2.5 cursor-pointer transition-all hover:bg-fv-type-bg hover:border-fv-type-text"
        >
          +  Add season
        </button>
      </section>

      {/* EXCHANGE RATES */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Exchange Rates</SectionHeader>
        <div className="text-[12.5px] text-[#8794A0] mb-4 leading-[1.6]">
          Stored against <b className="text-[#5E6B75]">AUD (base)</b>. Enter how many
          units equal 1 AUD — every document converts from here.
        </div>
        <div className="flex items-center justify-between py-3 border-b border-[#EEF4F4]">
          <span className="text-[14px] font-semibold text-fv-ink">
            AUD · Australian Dollar
          </span>
          <span className="text-[13px] font-semibold text-[#9AA7AE] bg-[#F2F8F8] border border-[#DCEAEA] rounded-[5px] px-3.5 py-2">
            Base · 1.00
          </span>
        </div>
        {fxRates.map((fx) => (
          <div
            key={fx.code}
            className="flex items-center justify-between gap-4 py-3 border-b border-[#EEF4F4]"
          >
            <span className="text-[14px] font-medium text-ink-700">
              {fx.name}
            </span>
            <label className="flex items-center gap-2.5">
              <span className="text-[12px] text-[#9AA7AE]">1 AUD =</span>
              <input
                inputMode="decimal"
                className="w-[120px] fv-input !py-2 !px-3 text-right !text-[14px] font-semibold"
                value={fx.rate_per_aud}
                onChange={(e) => setFxLocal(fx.code, e.target.value)}
                onBlur={() => persistFx(fx.code)}
              />
              <span className="text-[12px] font-semibold text-[#5E6B75] w-[34px]">
                {fx.code}
              </span>
            </label>
          </div>
        ))}
      </section>

      {/* DATA BACKUP */}
      <section className="fv-card p-7 mb-6">
        <SectionHeader>Data Backup</SectionHeader>
        <div className="flex items-center justify-between gap-5 flex-wrap">
          <div className="text-[13.5px] text-[#6B7780] leading-[1.6] max-w-[52ch]">
            Save a copy of every guest, booking, payment and setting to a single file.
            Keep it somewhere safe — like a Google Drive folder — so nothing is lost if
            this computer ever fails.
          </div>
          <button className="btn-accent flex-none" onClick={onExportBackup}>
            Export backup
          </button>
        </div>
      </section>

      {/* GOOGLE CALENDAR — deferred */}
      <section className="fv-card p-7">
        <SectionHeader>Google Calendar</SectionHeader>
        <div className="flex items-center justify-between gap-4 px-[18px] py-4 bg-[#FAFCFC] border border-[#E6EDED] rounded-[10px] flex-wrap">
          <div className="text-[13.5px] text-[#6B7780] max-w-[46ch] leading-[1.55]">
            Sync confirmed stays to a booking calendar so dates block out
            automatically. Coming in a later version — this stays offline for now.
          </div>
          <button
            disabled
            className="text-[13px] font-semibold text-white bg-fv-accent rounded-md px-5 py-2.5 flex-none opacity-50 cursor-not-allowed"
          >
            Connect Google Calendar
          </button>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-7 right-7 bg-fv-ink text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-[0_8px_28px_rgba(27,58,91,0.28)] z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function Col({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-bold tracking-[1.4px] uppercase text-ink-400 ${className}`}>
      {children}
    </span>
  );
}
