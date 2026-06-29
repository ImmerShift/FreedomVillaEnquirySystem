import { useEffect, useState } from "react";

/** Small centered confirmation dialog. Backdrop-click or Escape cancels.
 *  Pass `requireText` to make the user type a phrase (e.g. the guest's name)
 *  before the confirm button enables — a guard against accidental destructive actions. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  requireText,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matched = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && matched) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm, matched]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,40,46,0.42)] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[14px] w-full max-w-[420px] shadow-[0_24px_60px_rgba(20,40,46,0.32)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-6 pb-5">
          <div className="text-[18px] font-semibold text-fv-ink mb-2">{title}</div>
          <div className="text-[13.5px] text-[#6B7780] leading-[1.6]">{message}</div>
          {requireText && (
            <div className="mt-4">
              <div className="text-[12.5px] text-[#5E6B75] mb-1.5">
                Type <b className="font-semibold text-fv-ink">{requireText}</b> to confirm:
              </div>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireText}
                className="fv-input w-full !py-2.5 !text-[14px]"
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2.5 px-7 pb-6">
          <button
            onClick={onClose}
            className="text-[13px] font-semibold text-[#5E6B75] bg-white border border-[#C5D2D2] rounded-md px-4 py-2.5 hover:border-fv-ink transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!matched}
            className={`text-[13px] font-semibold text-white rounded-md px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? "bg-[#C0392B] hover:bg-[#A93226]" : "bg-fv-accent hover:bg-fv-accent-deep"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
