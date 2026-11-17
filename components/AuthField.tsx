"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IAlert, IEye, IEyeOff } from "./icons";

type AuthFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  placeholder?: string;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  error?: string;
  hint?: string;
  filling?: boolean;
  onEnter?: () => void;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  maxLength?: number;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  {
    label,
    value,
    onChange,
    icon,
    placeholder,
    type = "text",
    error,
    hint,
    filling = false,
    onEnter,
    inputMode,
    autoComplete,
    autoFocus,
    disabled = false,
    maxLength,
  },
  ref
) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && !show ? "password" : "text";
  const hasRightControl = filling || isPassword;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isPassword && typeof e.getModifierState === "function") {
      setCaps(e.getModifierState("CapsLock"));
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-faint">
        {label}
      </label>

      <div
        className={`relative rounded-xl border bg-surface transition-all duration-200 focus-within:shadow-[0_0_0_3px_var(--accent-soft)] ${
          error ? "border-chili" : "border-line focus-within:border-accent"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => setCaps(false)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={!!error}
          className={`w-full bg-transparent py-3 text-sm font-semibold text-ink outline-none placeholder:text-faint ${
            icon ? "pl-10" : "pl-3.5"
          } ${hasRightControl ? "pr-10" : "pr-3.5"} ${
            filling ? "tracking-wide" : ""
          }`}
        />

        {filling ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent spin" />
          </span>
        ) : isPassword ? (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-accent transition-colors"
            aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
          >
            {show ? <IEyeOff size={16} /> : <IEye size={16} />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-[11px] text-chili flex items-center gap-1.5">
          <IAlert size={12} className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[10.5px] text-faint">{hint}</p>
      ) : null}

      {caps && isPassword && !error && (
        <p className="text-[10.5px] text-amber">Caps Lock aktif</p>
      )}
    </div>
  );
});