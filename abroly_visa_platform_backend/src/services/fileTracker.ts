/**
 * Agency "visa file" tracker — the columns agencies keep in Excel (DS-160, docs,
 * appointment, interview training, passport collection, etc.), stored as JSON on
 * agency_leads.file_tracker so the case page feels like their spreadsheet.
 */

const str = (v: any, max = 255) => (v === null || v === undefined ? "" : String(v).replace(/\u0000/g, "").trim().slice(0, max));
const pick = (v: any, allowed: readonly string[]) => {
    const s = str(v, 80);
    return allowed.includes(s) ? s : "";
};

export const DS160_STATUSES = ["", "Not started", "In process", "Submitted", "Confirmed"] as const;
export const DOC_CHECKLIST_STATUSES = ["", "Pending", "Partially Received", "Complete"] as const;
export const APPLICATION_FORM_STATUSES = ["", "Not Started", "In Process", "Sent for Client Review", "Completed"] as const;
export const PAYMENT_STATUSES = ["", "Not Paid", "Partial", "Paid"] as const;
export const APPOINTMENT_STATUSES = ["", "Not booked", "OFC booked", "Interview booked", "Interview Done"] as const;
export const TRAINING_STATUSES = ["", "Pending", "Scheduled", "Completed"] as const;
export const PASSPORT_STATUSES = ["", "With client", "With agency", "At consulate", "Returned"] as const;
export const YES_NO = ["", "Yes", "No"] as const;

export type FileTracker = ReturnType<typeof sanitizeFileTracker>;

export const sanitizeFileTracker = (raw: any) => {
    const d = raw && typeof raw === "object" ? raw : {};
    return {
        whatsapp_number: str(d.whatsapp_number, 30),
        ds160_status: pick(d.ds160_status, DS160_STATUSES),
        ds_manage: str(d.ds_manage, 120),
        doc_checklist_status: pick(d.doc_checklist_status, DOC_CHECKLIST_STATUSES),
        documents_pending: str(d.documents_pending, 500),
        application_form_status: pick(d.application_form_status, APPLICATION_FORM_STATUSES),
        payment_status: pick(d.payment_status, PAYMENT_STATUSES),
        appointment_status: pick(d.appointment_status, APPOINTMENT_STATUSES),
        interview_training_status: pick(d.interview_training_status, TRAINING_STATUSES),
        passport_collection_status: pick(d.passport_collection_status, PASSPORT_STATUSES),
        next_follow_up_at: /^\d{4}-\d{2}-\d{2}$/.test(String(d.next_follow_up_at || "")) ? String(d.next_follow_up_at) : "",
        staff_follow_up_done: pick(d.staff_follow_up_done, YES_NO),
        remarks: str(d.remarks, 2000),
        updated_at: str(d.updated_at, 40),
    };
};

export const readFileTracker = (raw: any): FileTracker => {
    if (!raw) return sanitizeFileTracker({});
    try {
        return sanitizeFileTracker(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch {
        return sanitizeFileTracker({});
    }
};

/** Options the case UI needs for selects. */
export const FILE_TRACKER_OPTIONS = {
    ds160_status: DS160_STATUSES.filter(Boolean),
    doc_checklist_status: DOC_CHECKLIST_STATUSES.filter(Boolean),
    application_form_status: APPLICATION_FORM_STATUSES.filter(Boolean),
    payment_status: PAYMENT_STATUSES.filter(Boolean),
    appointment_status: APPOINTMENT_STATUSES.filter(Boolean),
    interview_training_status: TRAINING_STATUSES.filter(Boolean),
    passport_collection_status: PASSPORT_STATUSES.filter(Boolean),
    staff_follow_up_done: YES_NO.filter(Boolean),
};
