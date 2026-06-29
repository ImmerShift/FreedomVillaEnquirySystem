import { useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import "./App.css";
import logo from "./assets/brand/logo-freedomvilla.png";
import { NewInquiry } from "./pages/NewInquiry";
import { Settings } from "./pages/Settings";
import { Quotation } from "./pages/Quotation";
import { Invoice, Receipt, VillaInstructions } from "./pages/Documents";
import { GuestsStay } from "./pages/GuestsStay";
import { Personalization } from "./pages/Personalization";
import { Availability } from "./pages/Availability";
import { Home } from "./pages/Home";
import { Help } from "./pages/Help";

interface NavItem {
  to: string;
  label: string;
}

const WORKSPACE: NavItem[] = [
  { to: "/home", label: "Home" },
  { to: "/inquiry", label: "Quotation Request" },
  { to: "/guests", label: "Guests Stay" },
  { to: "/availability", label: "Availability" },
];
const DOCUMENTS: NavItem[] = [
  { to: "/quotation", label: "Quotation" },
  { to: "/invoice", label: "Invoice" },
  { to: "/receipt", label: "Receipt" },
  { to: "/personalization", label: "Personalization" },
  { to: "/instructions", label: "Villa Instructions" },
];
const SETUP: NavItem[] = [
  { to: "/settings", label: "Settings" },
  { to: "/help", label: "Help" },
];

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="mb-5">
      <div className="px-2 mb-2 text-[10px] font-semibold tracking-[2px] uppercase text-[#8FA0A0]">
        {title}
      </div>
      {items.map((it) => {
        const active = pathname === it.to;
        return (
          <button
            key={it.to}
            onClick={() => navigate(it.to)}
            className={`flex items-center w-full text-left px-3 py-2.5 mb-0.5 rounded-md text-[14px] transition-colors ${
              active
                ? "bg-fv-accent-soft text-fv-accent-deep font-semibold"
                : "text-[#56636D] font-medium hover:bg-[#EAF4F4]"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative px-4 py-3.5 border-t border-fv-side-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full bg-transparent border-none cursor-pointer px-2 py-1.5 rounded-md transition-colors hover:bg-[#EAF4F4]"
      >
        <span className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-fv-accent-soft flex-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E8482" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
          </svg>
        </span>
        <span className="text-[12.5px] font-medium text-[#7E8C8C]">
          How to read this screen
        </span>
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%-4px)] left-4 right-4 bg-white border border-[#E2EAEA] rounded-[10px] shadow-[0_8px_28px_rgba(27,58,91,0.16)] px-[18px] py-4 z-30">
          <div className="text-[9.5px] font-semibold tracking-[1.8px] uppercase text-[#8FA0A0] mb-3">
            Colour key
          </div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-[13px] h-[13px] rounded-[3px] bg-[#EAF1FB] border border-[#9FB6D6] flex-none" />
            <span className="text-[12px] text-[#56636D]">
              <b className="font-bold text-fv-type-text">Blue</b> — you type
            </span>
          </div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="w-[13px] h-[13px] rounded-[3px] bg-fv-pull-bg border border-fv-pull-border flex-none" />
            <span className="text-[12px] text-[#56636D]">
              <b className="font-bold text-fv-pull-text">Green</b> — pulled in
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-[13px] h-[13px] rounded-[3px] bg-fv-accent-soft border border-fv-accent-soft-border flex-none" />
            <span className="text-[12px] text-[#56636D]">
              <b className="font-bold text-fv-accent-deep">Teal</b> — calculated
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="no-print w-64 flex-none bg-fv-side-bg border-r border-fv-side-border flex flex-col sticky top-0 h-screen">
      <div className="px-[26px] py-[22px] border-b border-fv-side-border">
        <img src={logo} alt="Freedom Villa Bali" className="w-[120px] h-auto block" />
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <NavGroup title="Workspace" items={WORKSPACE} />
        <NavGroup title="Documents" items={DOCUMENTS} />
        <NavGroup title="Setup" items={SETUP} />
      </nav>
      <Legend />
    </aside>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen font-sans bg-fv-app-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 px-11 pt-8 pb-16">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/inquiry" element={<NewInquiry />} />
            <Route path="/guests" element={<GuestsStay />} />
            <Route path="/availability" element={<Availability />} />
            <Route path="/quotation" element={<Quotation />} />
            <Route path="/invoice" element={<Invoice />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/personalization" element={<Personalization />} />
            <Route path="/instructions" element={<VillaInstructions />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
