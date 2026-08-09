"use client";

import { useState, type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  help?: ReactNode;
  helpId?: string;
  helpClassName?: string;
  error?: ReactNode;
  errorId?: string;
  errorClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  revealButtonClassName?: string;
  revealIconClassName?: string;
  revealAccessibleName?: string;
};

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  help,
  helpId = `${id}-help`,
  helpClassName,
  error,
  errorId = `${id}-error`,
  errorClassName,
  labelClassName,
  inputClassName,
  revealButtonClassName = "absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800",
  revealIconClassName = "w-5 h-5",
  revealAccessibleName = label.toLowerCase(),
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const describedBy = [ariaDescribedBy, help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={onChange}
          aria-describedby={describedBy}
          aria-invalid={error ? true : inputProps["aria-invalid"]}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={`${revealed ? "Hide" : "Show"} ${revealAccessibleName}`}
          className={revealButtonClassName}
        >
          {revealed ? (
            <EyeOff aria-hidden="true" className={revealIconClassName} />
          ) : (
            <Eye aria-hidden="true" className={revealIconClassName} />
          )}
        </button>
      </div>
      {help && (
        <p id={helpId} className={helpClassName}>
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={errorClassName}>
          {error}
        </p>
      )}
    </>
  );
}
