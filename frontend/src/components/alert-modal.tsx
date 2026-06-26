"use client";

import React, { useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "success" | "error" | "warning" | "info";
  okText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = "success",
  okText = "Tutup",
}: AlertModalProps) {
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
  let iconElement = <CheckCircle2 className="h-6 w-6" />;
  let iconBgColor = "bg-emerald-50 text-emerald-600";
  let okBtnColor = "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100";

  if (variant === "error") {
    iconElement = <AlertCircle className="h-6 w-6" />;
    iconBgColor = "bg-rose-50 text-rose-600";
    okBtnColor = "bg-rose-600 hover:bg-rose-700 shadow-rose-100";
  } else if (variant === "warning") {
    iconElement = <AlertTriangle className="h-6 w-6" />;
    iconBgColor = "bg-amber-50 text-amber-600";
    okBtnColor = "bg-amber-600 hover:bg-amber-700 shadow-amber-100";
  } else if (variant === "info") {
    iconElement = <Info className="h-6 w-6" />;
    iconBgColor = "bg-blue-50 text-blue-600";
    okBtnColor = "bg-blue-650 hover:bg-blue-750 shadow-blue-100";
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in">
      {/* Backdrop Close Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-2xl p-6 z-10 transform transition-all duration-300 scale-100 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center mt-2">
          {/* Icon */}
          <div className={`p-4 ${iconBgColor} rounded-full mb-4`}>
            {iconElement}
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-zinc-950 px-2">{title}</h3>

          {/* Message */}
          <p className="text-[11.5px] text-zinc-500 font-semibold mt-2 leading-relaxed px-1">
            {message}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex mt-6 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white ${okBtnColor} rounded-xl shadow-sm transition-all cursor-pointer`}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}
