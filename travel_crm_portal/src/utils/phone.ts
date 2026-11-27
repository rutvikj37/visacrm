import type { ChangeEvent, FormEvent } from "react";

// Phone numbers are entered without the country code: 10 digits, nothing else.
export const PHONE_LENGTH = 10;

// Keeps digits only, max 10. A pasted "+91 98765 43210" or "098765 43210" drops the
// prefix instead of cutting off the last digits.
export const toPhoneDigits = (value: unknown) => {
    let digits = String(value ?? "").replace(/\D/g, "");
    if ((digits.length === 12 && digits.startsWith("91")) || (digits.length === 11 && digits.startsWith("0"))) {
        digits = digits.slice(-PHONE_LENGTH);
    }
    return digits.slice(0, PHONE_LENGTH);
};

// Spread onto any phone input: opens the number pad on mobile. The 10-digit cap is
// enforced by toPhoneDigits rather than maxLength, which would count spaces and dashes
// in pasted text and cut off real digits.
export const phoneInputProps = { inputMode: "numeric" as const };

// Wraps an onChange handler so it only ever sees up to 10 digits (covers paste too).
export const phoneOnChange = <E extends ChangeEvent<HTMLInputElement>>(handler: (e: E) => void) =>
    (e: E) => {
        e.target.value = toPhoneDigits(e.target.value);
        handler(e);
    };

// For uncontrolled inputs (no onChange): clean the field as the user types or pastes.
export const sanitizePhoneInput = (e: FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const clean = toPhoneDigits(el.value);
    if (el.value !== clean) el.value = clean;
};
