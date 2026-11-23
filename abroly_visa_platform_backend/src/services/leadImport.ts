import ExcelJS from "exceljs";
import { Readable } from "stream";
import { ingestLead, LeadInput, LeadValidationError } from "./leadIngestion";

/**
 * CSV / Excel lead import.
 * Column headers are matched loosely (case, spaces and punctuation ignored), so files exported from
 * Facebook, Google Sheets, IndiaMART or other CRMs usually import without any mapping.
 */

export const MAX_IMPORT_ROWS = 5000;

const FIELD_ALIASES: Record<keyof LeadInput | "first_name" | "last_name", string[]> = {
    name: ["name", "fullname", "studentname", "leadname", "customername", "contactname", "sendername"],
    first_name: ["firstname", "fname"],
    last_name: ["lastname", "lname", "surname"],
    phone: ["phone", "phonenumber", "mobile", "mobilenumber", "mobileno", "phoneno", "contact", "contactnumber", "whatsapp", "whatsappnumber", "sendermobile"],
    country_code: ["countrycode", "dialcode", "isd", "isdcode"],
    email: ["email", "emailaddress", "emailid", "mail", "senderemail"],
    city: ["city", "location", "town", "sendercity"],
    interested_country: ["country", "interestedcountry", "preferredcountry", "destination", "destinationcountry", "studycountry", "countryofinterest"],
    interested_course: ["course", "interestedcourse", "program", "programme", "fieldofstudy", "service", "product", "queryproductname"],
    visa_type: ["visatype", "visa", "visacategory"],
    intake: ["intake", "intakeyear", "intakemonth", "session"],
    message: ["message", "notes", "note", "remarks", "remark", "comments", "comment", "query", "querymessage", "requirement"],
    campaign: ["campaign", "campaignname", "adname", "adsetname", "formname"],
    source_ref: ["id", "leadid", "uniquequeryid", "externalid", "referenceid"],
    tags: ["tags", "tag", "labels"],
    extra: [],
    assigned_to: [],
    status: [],
    next_follow_up_at: [],
    branch_id: [],
    travel: [],
};

const normaliseHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

const buildHeaderMap = (headers: string[]) => {
    const map: Record<number, string> = {};
    headers.forEach((header, index) => {
        const key = normaliseHeader(header || "");
        if (!key) return;
        for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
            if (aliases.includes(key)) {
                map[index] = field;
                return;
            }
        }
    });
    return map;
};

const cellText = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if ("text" in value) return String(value.text);
        if ("result" in value) return String(value.result);
        if ("richText" in value) return value.richText.map((r: any) => r.text).join("");
        if (value instanceof Date) return value.toISOString();
        if ("hyperlink" in value) return String(value.hyperlink).replace(/^mailto:/, "");
    }
    return String(value);
};

const readRows = async (buffer: Buffer, fileName: string): Promise<string[][]> => {
    const workbook = new ExcelJS.Workbook();
    const lower = (fileName || "").toLowerCase();
    if (lower.endsWith(".xlsx")) {
        await workbook.xlsx.load(buffer as any);
    } else {
        // strip a UTF-8 BOM (Excel adds it to CSV exports)
        const text = buffer.toString("utf8").replace(/^﻿/, "");
        await workbook.csv.read(Readable.from([text]));
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
        const values = Array.isArray(row.values) ? (row.values as any[]).slice(1) : [];
        rows.push(values.map(cellText));
    });
    return rows;
};

export interface ImportSummary {
    total: number;
    created: number;
    duplicates: number;
    failed: number;
    errors: { row: number; message: string }[];
    unmapped_columns: string[];
}

export const importLeadsFromFile = async (
    buffer: Buffer,
    fileName: string,
    agencyUuid: string,
    createdBy: number | null,
    defaults: { assigned_to?: number | null; tags?: string[] | null } = {},
): Promise<ImportSummary> => {
    const rows = await readRows(buffer, fileName);
    if (rows.length < 2) {
        throw new LeadValidationError("The file is empty or has no data rows");
    }
    const headers = rows[0].map((h) => (h || "").trim());
    const headerMap = buildHeaderMap(headers);
    const mappedFields = Object.values(headerMap);
    if (!mappedFields.includes("phone") && !mappedFields.includes("email")) {
        throw new LeadValidationError("Could not find a Phone or Email column. Please use the sample template.");
    }

    const dataRows = rows.slice(1, MAX_IMPORT_ROWS + 1);
    const summary: ImportSummary = {
        total: dataRows.length,
        created: 0,
        duplicates: 0,
        failed: 0,
        errors: [],
        unmapped_columns: headers.filter((h, i) => h && !headerMap[i]),
    };

    for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        if (row.every((cell) => !cell || !String(cell).trim())) {
            summary.total--;
            continue;
        }
        const input: any = { extra: {} };
        let firstName = "", lastName = "";
        row.forEach((cell, index) => {
            const value = (cell || "").trim();
            if (!value) return;
            const field = headerMap[index];
            if (!field) {
                if (headers[index]) input.extra[headers[index]] = value;
            } else if (field === "first_name") firstName = value;
            else if (field === "last_name") lastName = value;
            else if (field === "tags") input.tags = value.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
            else input[field] = value;
        });
        if (!input.name && (firstName || lastName)) input.name = `${firstName} ${lastName}`.trim();
        if (!Object.keys(input.extra).length) input.extra = null;
        if (defaults.tags?.length) input.tags = [...(input.tags || []), ...defaults.tags];
        if (defaults.assigned_to) input.assigned_to = defaults.assigned_to;

        try {
            const result = await ingestLead({ agencyUuid, source: "csv", input, createdBy });
            if (result.created) summary.created++; else summary.duplicates++;
        } catch (error: any) {
            summary.failed++;
            if (summary.errors.length < 50) {
                summary.errors.push({ row: r + 2, message: error instanceof LeadValidationError ? error.message : "Could not import this row" });
            }
            if (!(error instanceof LeadValidationError)) console.error("CSV row import failed", error);
        }
    }

    return summary;
};

export const IMPORT_TEMPLATE_CSV =
    "Name,Phone,Country Code,Email,City,Country,Course,Visa Type,Intake,Message,Campaign,Tags\n" +
    "Rahul Sharma,9876543210,+91,rahul@example.com,Ahmedabad,Canada,MBA,Student Visa,Sep 2026,Wants IELTS help too,Diwali Offer,hot\n";

/**
 * Map a loose key/value record (website form post, webhook body) to lead fields using the same
 * aliases as the CSV import. Unknown keys go to `extra`.
 */
export const mapRecordToLeadInput = (record: Record<string, any>): LeadInput => {
    const keys = Object.keys(record || {});
    const headerMap = buildHeaderMap(keys);
    const input: any = { extra: {} };
    let firstName = "", lastName = "";
    keys.forEach((key, index) => {
        const raw = record[key];
        if (raw === undefined || raw === null || typeof raw === "object") return;
        const value = String(raw).trim();
        if (!value) return;
        const field = headerMap[index];
        if (!field) {
            if (!key.startsWith("_") && Object.keys(input.extra).length < 30) input.extra[key.slice(0, 60)] = value.slice(0, 1000);
        } else if (field === "first_name") firstName = value;
        else if (field === "last_name") lastName = value;
        else if (field === "tags") input.tags = value.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
        else input[field] = value;
    });
    if (!input.name && (firstName || lastName)) input.name = `${firstName} ${lastName}`.trim();
    if (!Object.keys(input.extra).length) input.extra = null;
    // never let a public form choose the assignee or status
    delete input.assigned_to;
    delete input.status;
    delete input.next_follow_up_at;
    delete input.branch_id;
    return input;
};
