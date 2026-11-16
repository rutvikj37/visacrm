import { useMemo } from "react";
import ReactFlagsSelect from "react-flags-select";
import { countries } from "country-data";

/** Common study / visa destinations shown first in the picker. */
export const VISA_COUNTRY_CODES = [
    "CA", "US", "GB", "AU", "NZ", "DE", "FR", "IE", "NL", "SE",
    "DK", "FI", "IT", "ES", "PT", "AT", "CH", "BE", "PL", "MT",
    "CY", "SG", "AE", "JP", "KR", "MY", "HK", "CN", "IN",
];

const ALIASES: Record<string, string> = {
    uk: "GB",
    unitedkingdom: "GB",
    greatbritain: "GB",
    england: "GB",
    usa: "US",
    us: "US",
    unitedstates: "US",
    unitedstatesofamerica: "US",
    uae: "AE",
    emirates: "AE",
    unitedarabemirates: "AE",
    korea: "KR",
    southkorea: "KR",
    holland: "NL",
    czechia: "CZ",
    czechrepublic: "CZ",
};

const assigned = (countries.all || []).filter(
    (c: any) => c?.status === "assigned" && typeof c?.alpha2 === "string" && c.alpha2.length === 2,
);

const norm = (v?: string) => (v || "").toLowerCase().replace(/[^a-z]/g, "");

/** Resolve a stored country name (or code) to an ISO alpha-2 code for the flag picker. */
export const countryCodeFromName = (name?: string | null): string => {
    const raw = (name || "").trim();
    if (!raw) return "";
    if (/^[A-Za-z]{2}$/.test(raw)) {
        const upper = raw.toUpperCase();
        return (countries as any)[upper]?.alpha2 ? upper : "";
    }
    const n = norm(raw);
    if (ALIASES[n]) return ALIASES[n];
    const exact = assigned.find((c: any) => norm(c.name) === n);
    if (exact) return exact.alpha2;
    const partial = assigned.find((c: any) => {
        const cn = norm(c.name);
        return cn.includes(n) || n.includes(cn);
    });
    return partial?.alpha2 || "";
};

/** Country display name from ISO alpha-2 (what we store on the lead). */
export const countryNameFromCode = (code?: string | null): string => {
    if (!code) return "";
    const upper = String(code).toUpperCase();
    return (countries as any)[upper]?.name || upper;
};

interface Props {
    value?: string;
    onChange: (countryName: string) => void;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
}

/**
 * Searchable country dropdown with flags.
 * `value` / `onChange` use the country display name (e.g. "Canada") to match CRM fields.
 */
const CountrySelectWithFlag = ({
    value,
    onChange,
    placeholder = "Select country",
    className = "",
    "aria-label": ariaLabel = "Country",
}: Props) => {
    const selected = useMemo(() => countryCodeFromName(value), [value]);
    const codes = useMemo(() => {
        if (selected && !VISA_COUNTRY_CODES.includes(selected)) {
            return [selected, ...VISA_COUNTRY_CODES];
        }
        return VISA_COUNTRY_CODES;
    }, [selected]);

    return (
        <div
            className={`country-select-flag [&_[class*="ReactFlagsSelect-module_flagsSelect"]]:w-full [&_[class*="ReactFlagsSelect-module_selectBtn"]]:w-full [&_[class*="ReactFlagsSelect-module_selectBtn"]]:min-h-10 [&_[class*="ReactFlagsSelect-module_selectBtn"]]:rounded-xl [&_[class*="ReactFlagsSelect-module_selectBtn"]]:border [&_[class*="ReactFlagsSelect-module_selectBtn"]]:border-default-200 ${className}`}
            aria-label={ariaLabel}
        >
            <ReactFlagsSelect
                selected={selected}
                searchable
                searchPlaceholder="Search country"
                placeholder={placeholder}
                countries={codes}
                onSelect={(code) => onChange(countryNameFromCode(code))}
                className="!w-full"
            />
        </div>
    );
};

export default CountrySelectWithFlag;
