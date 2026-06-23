import type { ReactNode } from "react";

/** Section divider: uppercase teal label with a hairline rule. */
export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 mb-5">
      <span className="fv-section-label">{children}</span>
      <span className="flex-1 h-px bg-[#E6EDED]" />
    </div>
  );
}

/** Stacked label + control. */
export function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-full" : ""}`}>
      <span className="fv-field-label">{label}</span>
      {children}
    </label>
  );
}

/** Page heading block: eyebrow + title + subtitle. */
export function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-[26px]">
      <div className="text-[11px] font-semibold tracking-[3px] uppercase text-fv-accent-deep mb-2.5">
        {eyebrow}
      </div>
      <h1 className="text-[38px] font-light text-fv-ink leading-[1.05] tracking-[0.3px] m-0 mb-2">
        {title}
      </h1>
      {subtitle && <div className="text-[13.5px] text-[#6B7780]">{subtitle}</div>}
    </div>
  );
}
