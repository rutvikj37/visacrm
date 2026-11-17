import { Op } from "sequelize";

/** Canonical storage form, e.g. "+91". */
export const normalizeCountryCode = (raw?: string | null) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    return digits ? `+${digits}` : "+91";
};

/** Digits-only national number (agency login sends 10 digits). */
export const normalizeNationalPhone = (raw?: string | null) =>
    String(raw ?? "").replace(/\D/g, "");

/**
 * Match both "+91" and legacy "91" (and similar) so login still finds the row
 * when country_code was saved without a leading +.
 */
export const countryCodeMatch = (raw?: string | null) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    const variants = new Set<string>();
    if (digits) {
        variants.add(digits);
        variants.add(`+${digits}`);
    }
    const trimmed = String(raw ?? "").trim();
    if (trimmed) variants.add(trimmed);
    if (!variants.size) {
        variants.add("+91");
        variants.add("91");
    }
    return { [Op.in]: [...variants] };
};

export const agentPhoneWhere = (
    phone?: string | null,
    country?: string | null,
    extra: Record<string, unknown> = {},
) => ({
    phone_number: normalizeNationalPhone(phone),
    country_code: countryCodeMatch(country),
    ...extra,
});
