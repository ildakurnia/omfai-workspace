"use client";

import React, { useEffect } from "react";
import { X, AlertTriangle, Trash2, HelpCircle, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Set colors and icons based on variant
  let iconElement = <HelpCircle className="h-5 w-5" />;
  let iconBgColor = "bg-zinc-50 text-zinc-500";
  let confirmBtnColor = "bg-[#FF8200] hover:bg-[#e07200] shadow-orange-200";

  if (variant === "danger") {
    iconElement = <Trash2 className="h-5 w-5" />;
    iconBgColor = "bg-red-50 text-red-600";
    confirmBtnColor = "bg-red-600 hover:bg-red-700 shadow-red-100";
  } else if (variant === "warning") {
    iconElement = <AlertTriangle className="h-5 w-5" />;
    iconBgColor = "bg-orange-50 text-[#FF8200]";
    confirmBtnColor = "bg-[#FF8200] hover:bg-[#e07200] shadow-orange-200";
  }

  const handleConfirmClick = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in">
      {/* Backdrop Close Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-2xl p-6 z-10 transform transition-all duration-300 scale-100 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center mt-2">
          {/* Icon */}
          <div className={`p-3.5 ${iconBgColor} rounded-full mb-4`}>
            {iconElement}
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-zinc-950 px-2">{title}</h3>

          {/* Message */}
          <p className="text-[11.5px] text-zinc-500 font-medium mt-2 leading-relaxed px-1">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 mt-6 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white ${confirmBtnColor} rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Memproses...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
