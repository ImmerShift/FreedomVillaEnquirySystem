import { useEffect } from "react";

/** Small centered confirmation dialog. Backdrop-click or Escape cancels. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm]);

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
            className={`text-[13px] font-semibold text-white rounded-md px-4 py-2.5 transition-colors ${
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
