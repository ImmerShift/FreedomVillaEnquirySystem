import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui";

interface Topic {
  title: string;
  body: React.ReactNode;
}

const Step = ({ children }: { children: React.ReactNode }) => (
  <li className="text-[13.5px] text-[#3F4B55] leading-[1.6] mb-1.5 pl-1">{children}</li>
);
const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[13px] text-[#7A8790] leading-[1.6] mb-2">{children}</div>
);
const B = ({ children }: { children: React.ReactNode }) => (
  <b className="font-semibold text-fv-ink">{children}</b>
);

const TOPICS: Topic[] = [
  {
    title: "How the app works",
    body: (
      <>
        <Note>
          Everything runs on <B>this computer</B> — no internet needed. Every change saves
          itself the moment you make it; there's no "save file" button to worry about.
        </Note>
        <ul className="list-disc pl-5">
          <Step>The menu on the left is split into <B>Workspace</B> (daily work), <B>Documents</B> (what you send guests), and <B>Setup</B> (one-time configuration).</Step>
          <Step>Close the app with the normal window <B>✕</B>. Don't force-quit it from Task Manager.</Step>
          <Step>Back up regularly (see <B>Backups</B> below) so nothing is ever lost.</Step>
        </ul>
      </>
    ),
  },
  {
    title: "Home dashboard",
    body: (
      <>
        <Note>Your morning glance — what needs attention today.</Note>
        <ul className="list-disc pl-5">
          <Step><B>Arrivals · next 30 days</B>, <B>Outstanding balance</B>, <B>Follow-ups due</B>, and this month's <B>Occupancy</B>.</Step>
          <Step><B>Upcoming arrivals</B> lists the next guests; click <B>Documents →</B> to jump straight to their paperwork.</Step>
          <Step><B>Follow-ups due</B> shows reminders you set; tick one off when it's done.</Step>
        </ul>
      </>
    ),
  },
  {
    title: "Making a quote (Quotation Request)",
    body: (
      <>
        <Note>This is where every booking starts.</Note>
        <ul className="list-disc pl-5">
          <Step>Fill the guest details and pick <B>check-in / check-out</B>. The calendar shows already-booked nights in <span className="text-[#C0392B] font-semibold">red</span> — you can't double-book by accident.</Step>
          <Step>The <B>season, nightly rate and totals fill in automatically</B> from your Settings. Add extra charges (chef, transfers…) at the bottom.</Step>
          <Step>Choose the guest's <B>currency</B> top-right — totals convert instantly.</Step>
          <Step>Click <B>Save Request</B>. You land on Guests Stay with the new booking highlighted.</Step>
        </ul>
        <Note>A quote is just a price — record any deposit later, under Guests Stay or the Invoice.</Note>
      </>
    ),
  },
  {
    title: "Guests Stay (your booking list)",
    body: (
      <ul className="list-disc pl-5">
        <Step>Every booking in one list. <B>Search</B> by name/email, or filter by month, source, or status.</Step>
        <Step>Click a row to expand it — set <B>follow-up reminders</B> and open <B>Generate document →</B>.</Step>
        <Step><B>Returning</B> and <B>N due</B> badges flag repeat guests and overdue follow-ups.</Step>
        <Step><B>Cancel</B> asks you to confirm first, and can always be undone with <B>Restore</B>.</Step>
      </ul>
    ),
  },
  {
    title: "Documents (Quotation, Invoice, Receipt…)",
    body: (
      <ul className="list-disc pl-5">
        <Step>Use the <B>Guest</B> picker at the top to choose whose document you're viewing (search by name or email).</Step>
        <Step>Switch <B>currency</B>, or click <B>Edit</B> to tweak the wording, then <B>Save PDF</B> to print or save it.</Step>
        <Step>On the <B>Invoice</B> and <B>Receipt</B>, record payments in the <B>Payments</B> panel — the balance updates everywhere.</Step>
        <Step><B>Personalization</B> collects arrival/bedding details; <B>Villa Instructions</B> is the pre-arrival guide.</Step>
      </ul>
    ),
  },
  {
    title: "Availability calendar",
    body: (
      <>
        <ul className="list-disc pl-5">
          <Step>Colours: <span className="text-[#B5302C] font-semibold">red</span> = booked (stronger = paid, lighter = deposit), <span className="text-[#B98F22] font-semibold">amber stripes</span> = a tentative hold, <span className="font-semibold" style={{ color: "#3B6D11" }}>green dashed</span> = open dates you could still sell.</Step>
          <Step>Add a <B>tentative hold</B> (with an expiry that auto-releases) from the sidebar.</Step>
          <Step>Filter by booking source, and toggle seasons / holds / open dates on the calendar.</Step>
          <Step>Set a <B>cleaning buffer</B> in Settings to block turnaround days after each checkout.</Step>
        </ul>
        <Note>Bookings block <B>nights</B>, not whole days — a guest can check in the same morning another checks out.</Note>
      </>
    ),
  },
  {
    title: "Seasons, rates & the direct-booking saving",
    body: (
      <ul className="list-disc pl-5">
        <Step>In <B>Settings → Seasons &amp; Nightly Rates</B>, set each season's dates, <B>Direct</B> rate, optional <B>Agent</B> rate, and minimum nights.</Step>
        <Step><B>Direct-Booking Saving</B> sets the "you save by booking direct" line on quotes: <B>Automatic</B> (a % above your rate), <B>Published rate</B> (per season), or <B>manual</B>.</Step>
        <Step>The Agent rate is used automatically when a booking's source is "Agent" — it never appears on guest documents.</Step>
      </ul>
    ),
  },
  {
    title: "Currencies",
    body: (
      <ul className="list-disc pl-5">
        <Step>Everything is stored in <B>AUD</B> (your base). In <B>Settings → Exchange Rates</B> you enter how many units equal 1 AUD.</Step>
        <Step><B>Add any currency</B> a guest asks for (code, name, rate) — it appears with its flag in every currency picker. Remove ones you don't use.</Step>
      </ul>
    ),
  },
  {
    title: "Payments & reminders",
    body: (
      <ul className="list-disc pl-5">
        <Step>Record each payment on the <B>Invoice</B> or <B>Receipt</B> — the deposit/balance stay in sync and show on the Home dashboard.</Step>
        <Step>Set <B>follow-up reminders</B> per guest in Guests Stay; due ones surface on Home and as badges.</Step>
        <Step>Automatic <B>email</B> reminders will arrive once the online version is set up.</Step>
      </ul>
    ),
  },
  {
    title: "Backups (important)",
    body: (
      <ul className="list-disc pl-5">
        <Step>In <B>Settings → Data Backup</B>, click <B>Export backup</B> to save every guest, booking, payment and setting to one file.</Step>
        <Step>Keep that file somewhere safe — a Google Drive folder is ideal — so nothing is lost if this computer ever fails.</Step>
        <Step>Do this regularly (e.g. weekly).</Step>
      </ul>
    ),
  },
];

export function Help() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-[880px] mx-auto">
      <PageTitle
        eyebrow="Help"
        title="How to use the Hub"
        subtitle="Plain-English guides for every screen. Click a topic to expand it."
      />

      <div className="flex flex-col gap-2.5">
        {TOPICS.map((t, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="fv-card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex items-center justify-between w-full text-left px-6 py-4 hover:bg-[#FAFDFD] transition-colors"
              >
                <span className="text-[15.5px] font-semibold text-fv-ink">{t.title}</span>
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9FB0BE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  className={`flex-none transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isOpen && <div className="px-6 pb-5 pt-0.5 border-t border-[#EEF4F4]">{t.body}</div>}
            </div>
          );
        })}
      </div>

      <div className="fv-card p-7 mt-6 flex items-center justify-between gap-5 flex-wrap">
        <div className="text-[13.5px] text-[#6B7780] leading-[1.6] max-w-[52ch]">
          Still stuck on something? Jump to the settings to adjust how the app behaves,
          or start a new quote.
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <button className="btn-ghost" onClick={() => navigate("/settings")}>Open Settings</button>
          <button className="btn-accent" onClick={() => navigate("/inquiry")}>New quote</button>
        </div>
      </div>
    </div>
  );
}
