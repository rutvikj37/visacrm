import { useMemo } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import ReactCountryFlag from "react-country-flag";
import { countries } from "country-data";

/** Common study / visa destinations shown in the picker. */
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

/** Country display name from ISO alpha-2 (what we store on the lead / case). */
export const countryNameFromCode = (code?: string | null): string => {
    if (!code) return "";
    const upper = String(code).toUpperCase();
    return (countries as any)[upper]?.name || upper;
};

export type CountryOption = { code: string; name: string };

interface Props {
    value?: string;
    onChange: (countryName: string) => void;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
    isDisabled?: boolean;
}

/**
 * Searchable country dropdown with flags.
 * Uses HeroUI Autocomplete (portaled popover) so it works inside modals.
 * `value` / `onChange` use the country display name (e.g. "Canada") to match CRM fields.
 */
const CountrySelectWithFlag = ({
    value,
    onChange,
    placeholder = "Select country",
    className = "",
    "aria-label": ariaLabel = "Country",
    isDisabled = false,
}: Props) => {
    const selected = useMemo(() => countryCodeFromName(value), [value]);

    const items = useMemo<CountryOption[]>(() => {
        const codes = selected && !VISA_COUNTRY_CODES.includes(selected)
            ? [selected, ...VISA_COUNTRY_CODES]
            : VISA_COUNTRY_CODES;
        return codes.map((code) => ({ code, name: countryNameFromCode(code) }));
    }, [selected]);

    return (
        <Autocomplete
            aria-label={ariaLabel}
            className={className}
            placeholder={placeholder}
            isDisabled={isDisabled}
            items={items}
            selectedKey={selected || null}
            onSelectionChange={(key) => {
                if (!key) {
                    onChange("");
                    return;
                }
                onChange(countryNameFromCode(String(key)));
            }}
            startContent={
                selected ? (
                    <ReactCountryFlag
                        countryCode={selected}
                        svg
                        style={{ width: "1.25em", height: "1.25em" }}
                        aria-hidden
                    />
                ) : undefined
            }
            allowsCustomValue={false}
            menuTrigger="focus"
            popoverProps={{ placement: "bottom-start", shouldFlip: true }}
            listboxProps={{ emptyContent: "No country found" }}
        >
            {(item) => (
                <AutocompleteItem
                    key={item.code}
                    textValue={item.name}
                    startContent={
                        <ReactCountryFlag
                            countryCode={item.code}
                            svg
                            style={{ width: "1.25em", height: "1.25em" }}
                            aria-hidden
                        />
                    }
                >
                    {item.name}
                </AutocompleteItem>
            )}
        </Autocomplete>
    );
};

export default CountrySelectWithFlag;
