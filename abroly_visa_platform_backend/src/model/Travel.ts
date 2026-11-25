import { DataTypes } from 'sequelize';
import sequelize from '../config/dbconfig';
import { jsonGetter } from '../helpers/json';

/**
 * Travel CRM tables (itinerary, quotation, packages, bookings, suppliers).
 * Every row belongs to one agency (agency_uuid). Money is BIGINT paise.
 * Passport numbers and PAN are stored encrypted (helpers/crypto.ts) in *_enc columns.
 */

const base = {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uuid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agency_uuid: { type: DataTypes.STRING, allowNull: false },
};
const opts = (tableName: string, extraIndexes: any[] = []) => ({
    tableName,
    timestamps: true,
    paranoid: true,
    indexes: [{ unique: true, fields: ['uuid'] }, { fields: ['agency_uuid'] }, ...extraIndexes],
});

/** Hotels, DMCs, transporters, airlines, activity providers. */
export const TravelSupplier = sequelize.define('TravelSupplier', {
    ...base,
    type: { type: DataTypes.ENUM("hotel", "dmc", "transport", "airline", "activity", "other"), defaultValue: "hotel" },
    name: { type: DataTypes.STRING, allowNull: false },
    contact_name: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    gstin: { type: DataTypes.STRING(20), allowNull: true },
    pan: { type: DataTypes.STRING(12), allowNull: true },
    bank_enc: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('travel_suppliers'));

/** Rate contract line: what a supplier charges for one service in one season. */
export const SupplierRate = sequelize.define('SupplierRate', {
    ...base,
    supplier_id: { type: DataTypes.INTEGER, allowNull: false },
    library_item_id: { type: DataTypes.INTEGER, allowNull: true },
    service: { type: DataTypes.STRING, allowNull: false }, // "Deluxe room", "Airport transfer (sedan)"
    service_type: { type: DataTypes.ENUM("hotel", "transfer", "activity", "flight", "meal", "visa", "insurance", "other"), defaultValue: "hotel" },
    room_type: { type: DataTypes.STRING, allowNull: true },
    meal_plan: { type: DataTypes.STRING(20), allowNull: true }, // EP / CP / MAP / AP
    pax_type: { type: DataTypes.ENUM("per_room", "per_adult", "per_child", "per_infant", "per_unit"), defaultValue: "per_room" },
    season: { type: DataTypes.STRING, allowNull: true },
    valid_from: { type: DataTypes.DATEONLY, allowNull: true },
    valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    cost: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), defaultValue: "INR" },
}, opts('supplier_rates', [{ fields: ['supplier_id'] }]));

/** Master library: destinations, hotels, sightseeing, transfers. */
export const LibraryItem = sequelize.define('LibraryItem', {
    ...base,
    type: { type: DataTypes.ENUM("destination", "hotel", "activity", "transfer", "meal", "note"), defaultValue: "activity" },
    name: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: true },
    star: { type: DataTypes.INTEGER, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    photos: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('photos') },
    default_supplier_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('library_items'));

/**
 * Trip plan for a lead, or a reusable template (is_template).
 * days: [{ day, title, city, items: [{ type, text, library_item_id? }], notes }]
 */
export const Itinerary = sequelize.define('Itinerary', {
    ...base,
    crm_lead_id: { type: DataTypes.INTEGER, allowNull: true },
    booking_id: { type: DataTypes.INTEGER, allowNull: true },
    is_template: { type: DataTypes.BOOLEAN, defaultValue: false },
    title: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: true },
    nights: { type: DataTypes.INTEGER, defaultValue: 0 },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    days: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('days') },
    inclusions: { type: DataTypes.TEXT, allowNull: true },
    exclusions: { type: DataTypes.TEXT, allowNull: true },
    terms: { type: DataTypes.TEXT, allowNull: true },
    cancellation_policy: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM("draft", "sent", "accepted", "changes_requested"), defaultValue: "draft" },
    theme: { type: DataTypes.STRING(20), defaultValue: "classic" }, // classic | modern | elegant (client page and PDF)
    cover_image: { type: DataTypes.STRING(500), allowNull: true },
    client_note: { type: DataTypes.TEXT, allowNull: true }, // change request from the share link
    share_token: { type: DataTypes.STRING(64), allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('itineraries', [{ fields: ['crm_lead_id'] }, { fields: ['share_token'] }]));

/**
 * One version of a quote. options: [{ name, lines: [{ service_type, description, supplier_id, rate_id,
 *   pax_type, qty, nights, unit_cost, markup_type, markup_value }], totals }]
 * Totals of the chosen (or first) option are copied to columns for lists and reports.
 */
export const Quotation = sequelize.define('Quotation', {
    ...base,
    number: { type: DataTypes.STRING(40), allowNull: false },
    crm_lead_id: { type: DataTypes.INTEGER, allowNull: true },
    itinerary_id: { type: DataTypes.INTEGER, allowNull: true },
    package_id: { type: DataTypes.INTEGER, allowNull: true }, // tour_packages.id when quoted from a package
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    parent_id: { type: DataTypes.INTEGER, allowNull: true }, // first version of this quote
    title: { type: DataTypes.STRING, allowNull: true },
    is_international: { type: DataTypes.BOOLEAN, defaultValue: false },
    adults: { type: DataTypes.INTEGER, defaultValue: 2 },
    children: { type: DataTypes.INTEGER, defaultValue: 0 },
    infants: { type: DataTypes.INTEGER, defaultValue: 0 },
    options: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('options') },
    billing_mode: { type: DataTypes.ENUM("full_value", "margin"), defaultValue: "full_value" },
    gst_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 5 },
    tcs_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    discount: { type: DataTypes.BIGINT, defaultValue: 0 },
    chosen_option: { type: DataTypes.INTEGER, allowNull: true },
    cost_total: { type: DataTypes.BIGINT, defaultValue: 0 },
    sell_total: { type: DataTypes.BIGINT, defaultValue: 0 },
    status: { type: DataTypes.ENUM("draft", "sent", "accepted", "rejected", "superseded"), defaultValue: "draft" },
    valid_until: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('quotations', [{ fields: ['crm_lead_id'] }]));

/** Fixed package for sale, built on a template itinerary. */
export const TourPackage = sequelize.define('TourPackage', {
    ...base,
    title: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: true },
    nights: { type: DataTypes.INTEGER, defaultValue: 0 },
    itinerary_id: { type: DataTypes.INTEGER, allowNull: true },
    price_pp: { type: DataTypes.BIGINT, defaultValue: 0 },
    valid_from: { type: DataTypes.DATEONLY, allowNull: true },
    valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    highlights: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.STRING(500), allowNull: true },
    public_slug: { type: DataTypes.STRING(80), allowNull: true },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('tour_packages'));

/** A confirmed trip. */
export const Booking = sequelize.define('Booking', {
    ...base,
    booking_no: { type: DataTypes.STRING(40), allowNull: false },
    crm_lead_id: { type: DataTypes.INTEGER, allowNull: true },
    quotation_id: { type: DataTypes.INTEGER, allowNull: true },
    itinerary_id: { type: DataTypes.INTEGER, allowNull: true },
    package_id: { type: DataTypes.INTEGER, allowNull: true },
    messages_sent: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('messages_sent') }, // automatic WhatsApp: { trip_tomorrow: date, welcome_back: date }
    user_id: { type: DataTypes.INTEGER, allowNull: false }, // the client (users table)
    visa_case_id: { type: DataTypes.INTEGER, allowNull: true }, // agency_leads.id
    title: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: true },
    is_international: { type: DataTypes.BOOLEAN, defaultValue: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.ENUM("confirmed", "in_progress", "completed", "cancelled"), defaultValue: "confirmed" },
    total_sell: { type: DataTypes.BIGINT, defaultValue: 0 },
    total_cost: { type: DataTypes.BIGINT, defaultValue: 0 },
    tax_total: { type: DataTypes.BIGINT, defaultValue: 0 },
    discount: { type: DataTypes.BIGINT, defaultValue: 0 },
    billing_mode: { type: DataTypes.ENUM("full_value", "margin"), defaultValue: "full_value" },
    gst_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 5 },
    tcs_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    invoice_id: { type: DataTypes.INTEGER, allowNull: true }, // client_invoices.id
    share_token: { type: DataTypes.STRING(64), allowNull: true }, // public trip kit link
    credited: { type: DataTypes.BIGINT, defaultValue: 0 },        // selling value taken off by credit notes (excl. GST)
    cancel_reason: { type: DataTypes.STRING(500), allowNull: true },
    cancelled_at: { type: DataTypes.DATEONLY, allowNull: true },
    cancel_charge: { type: DataTypes.BIGINT, allowNull: true },  // what the client still pays after cancelling (incl. GST)
    ops_owner_id: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('bookings', [{ fields: ['user_id'] }, { fields: ['start_date'] }]));

/** One service on a booking: flight, hotel, transfer, activity, visa, insurance, forex. */
export const BookingService = sequelize.define('BookingService', {
    ...base,
    booking_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM("flight", "hotel", "transfer", "activity", "visa", "insurance", "forex", "other"), defaultValue: "hotel" },
    description: { type: DataTypes.STRING(500), allowNull: false },
    supplier_id: { type: DataTypes.INTEGER, allowNull: true },
    confirmation_no: { type: DataTypes.STRING(80), allowNull: true },
    status: { type: DataTypes.ENUM("requested", "confirmed", "cancelled"), defaultValue: "requested" },
    service_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    cost: { type: DataTypes.BIGINT, defaultValue: 0 },
    sell: { type: DataTypes.BIGINT, defaultValue: 0 },
    details: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('details') }, // room type, pickup time, PNR...
    supplier_due_date: { type: DataTypes.DATEONLY, allowNull: true },
    supplier_paid: { type: DataTypes.BIGINT, defaultValue: 0 },
    supplier_payments: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('supplier_payments') }, // [{ amount, paid_at, method, reference }]
    cancel_charge: { type: DataTypes.BIGINT, allowNull: true },   // once cancelled: what the supplier keeps
    cancelled_at: { type: DataTypes.DATEONLY, allowNull: true },
    supplier_refunded: { type: DataTypes.BIGINT, defaultValue: 0 },  // money the supplier has paid back
    supplier_refunds: { type: DataTypes.JSON, allowNull: true, get: jsonGetter('supplier_refunds') }, // [{ amount, received_at, reference }]
}, opts('booking_services', [{ fields: ['booking_id'] }, { fields: ['supplier_id'] }]));

/** Pax on a booking. */
export const BookingTraveller = sequelize.define('BookingTraveller', {
    ...base,
    booking_id: { type: DataTypes.INTEGER, allowNull: false },
    pax_type: { type: DataTypes.ENUM("adult", "child", "infant"), defaultValue: "adult" },
    name: { type: DataTypes.STRING, allowNull: false },
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.STRING(10), allowNull: true },
    nationality: { type: DataTypes.STRING(60), allowNull: true },
    passport_no_enc: { type: DataTypes.TEXT, allowNull: true },
    passport_last4: { type: DataTypes.STRING(4), allowNull: true },
    passport_expiry: { type: DataTypes.DATEONLY, allowNull: true },
    pan_enc: { type: DataTypes.TEXT, allowNull: true },
    meal_pref: { type: DataTypes.STRING(60), allowNull: true },
    seat_pref: { type: DataTypes.STRING(60), allowNull: true },
    is_lead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, opts('booking_travellers', [{ fields: ['booking_id'] }]));

/** A client's family members, reused as travellers on later trips (CP-01). */
export const ClientMember = sequelize.define('ClientMember', {
    ...base,
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    relation: { type: DataTypes.STRING(40), allowNull: true },
    pax_type: { type: DataTypes.ENUM("adult", "child", "infant"), defaultValue: "adult" },
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    anniversary: { type: DataTypes.DATEONLY, allowNull: true },
    nationality: { type: DataTypes.STRING(60), allowNull: true },
    passport_no_enc: { type: DataTypes.TEXT, allowNull: true },
    passport_last4: { type: DataTypes.STRING(4), allowNull: true },
    passport_expiry: { type: DataTypes.DATEONLY, allowNull: true },
    pan_enc: { type: DataTypes.TEXT, allowNull: true },
    meal_pref: { type: DataTypes.STRING(60), allowNull: true },
    seat_pref: { type: DataTypes.STRING(60), allowNull: true },
}, opts('client_members', [{ fields: ['user_id'] }]));

/** Tickets, visas, insurance and other files on a booking (VC-02). Stored privately (travel_docs). */
export const BookingDocument = sequelize.define('BookingDocument', {
    ...base,
    booking_id: { type: DataTypes.INTEGER, allowNull: false },
    service_id: { type: DataTypes.INTEGER, allowNull: true },
    kind: { type: DataTypes.ENUM("ticket", "visa", "insurance", "voucher", "passport", "other"), defaultValue: "other" },
    name: { type: DataTypes.STRING, allowNull: false },
    file_ref: { type: DataTypes.STRING(500), allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: true },
    share_with_client: { type: DataTypes.BOOLEAN, defaultValue: true },
    uploaded_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('booking_documents', [{ fields: ['booking_id'] }]));

/** Monthly sales target per team member (RP-02). amount = selling value in paise. */
export const TravelTarget = sequelize.define('TravelTarget', {
    ...base,
    agent_id: { type: DataTypes.INTEGER, allowNull: false },
    month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM
    amount: { type: DataTypes.BIGINT, defaultValue: 0 },
}, opts('travel_targets', [{ unique: true, fields: ['agency_uuid', 'agent_id', 'month'] }]));

/**
 * GST credit note against a client invoice (PY-03), e.g. after a cancellation or discount.
 * It lowers the invoice total; anything already paid above the new total is a refund due.
 */
export const CreditNote = sequelize.define('CreditNote', {
    ...base,
    number: { type: DataTypes.STRING(40), allowNull: false },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false },
    booking_id: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.BIGINT, allowNull: false },       // total credited, incl. GST
    taxable_value: { type: DataTypes.BIGINT, defaultValue: 0 },
    gst_amount: { type: DataTypes.BIGINT, defaultValue: 0 },
    reason: { type: DataTypes.STRING(500), allowNull: true },
    refund_due: { type: DataTypes.BIGINT, defaultValue: 0 },
    refunded: { type: DataTypes.BIGINT, defaultValue: 0 },
    refund_reference: { type: DataTypes.STRING(120), allowNull: true },
    issue_date: { type: DataTypes.DATEONLY, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, opts('credit_notes', [{ fields: ['invoice_id'] }]));
