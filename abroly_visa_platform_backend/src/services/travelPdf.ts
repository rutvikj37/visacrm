import fs from "fs";
import path from "path";
import axios from "axios";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { quoteTotals } from "./travel";

/**
 * Travel PDFs: itinerary, quotation and vouchers.
 * Built with pdfkit (no browser on the server) using Noto Sans (assets/fonts, OFL) so ₹ prints correctly.
 * One small design system: brand-coloured cover band, running header and footer with page numbers,
 * section titles, info tiles, tables and drawn icons.
 */

type Doc = InstanceType<typeof PDFDocument>;
export interface Brand { name: string; color: string; phone: string; email: string; address: string; logo: string | null; gstin?: string; upi?: string; bank?: string; review?: string; rating?: string }

const W = 595.28, H = 841.89, M = 40, CW = W - 2 * M;
const INK = "#111827", MUTED = "#6b7280", LINE = "#e5e7eb", SOFT = "#f8fafc";
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const hasFonts = fs.existsSync(path.join(FONT_DIR, "NotoSans-Regular.ttf"));
const R = "R", SB = "SB", B = "B";
const money = (paise: number) => `${hasFonts ? "₹" : "Rs "}${(Math.round(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const fmtDate = (d?: string | null, withYear = true) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }) : "");
/** "25–30 Dec 2026" / "28 Dec – 2 Jan 2027". */
const dateRange = (a: string, b: string | null) => {
    if (!b || a === b) return fmtDate(a);
    const da = new Date(`${a}T00:00:00Z`), db = new Date(`${b}T00:00:00Z`);
    const mon = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    if (da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${db.getUTCDate()} ${mon(db)} ${db.getUTCFullYear()}`;
    return `${da.getUTCDate()} ${mon(da)} – ${db.getUTCDate()} ${mon(db)} ${db.getUTCFullYear()}`;
};
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** A lighter version of a brand colour (amount 0..1 towards white). */
const tint = (hex: string, amount: number) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};

const fetchImage = async (url?: string | null) => {
    if (!url || !/^https?:\/\//.test(url)) return null;
    try {
        const r = await axios.get(url, { responseType: "arraybuffer", timeout: 7000, maxContentLength: 6 * 1024 * 1024 });
        return /jpe?g|png/i.test(String(r.headers["content-type"] || "")) ? Buffer.from(r.data) : null;
    } catch { return null; }
};

const ITEM_LABEL: Record<string, string> = { hotel: "Stay", sightseeing: "Sightseeing", transfer: "Transfer", meal: "Meal", flight: "Flight", activity: "Activity", note: "Note", visa: "Visa", insurance: "Insurance", forex: "Forex", other: "Service" };
const ITEM_COLOR: Record<string, string> = { hotel: "#7c3aed", sightseeing: "#0891b2", transfer: "#2563eb", meal: "#d97706", flight: "#0f766e", activity: "#db2777", note: "#64748b", visa: "#4f46e5", insurance: "#059669", forex: "#ca8a04", other: "#64748b" };

// ---------------------------------------------------------------- document frame

class Pdf {
    doc: Doc;
    brand: Brand;
    title: string;
    constructor(public res: Response, brand: Brand, title: string, filename: string) {
        this.brand = brand;
        this.title = title;
        this.doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: 56, left: M, right: M }, bufferPages: true, info: { Title: title, Author: brand.name, Creator: brand.name } });
        if (hasFonts) {
            this.doc.registerFont(R, path.join(FONT_DIR, "NotoSans-Regular.ttf"));
            this.doc.registerFont(SB, path.join(FONT_DIR, "NotoSans-SemiBold.ttf"));
            this.doc.registerFont(B, path.join(FONT_DIR, "NotoSans-Bold.ttf"));
        } else {
            this.doc.registerFont(R, "Helvetica"); this.doc.registerFont(SB, "Helvetica-Bold"); this.doc.registerFont(B, "Helvetica-Bold");
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename.replace(/[^\w.-]+/g, "_")}"`);
        this.doc.pipe(res);
        this.doc.font(R).fontSize(10).fillColor(INK);
    }
    get c() { return this.brand.color; }

    /** New page with the slim running header (pages after the first). */
    newPage() {
        this.doc.addPage();
        const d = this.doc;
        d.rect(0, 0, W, 4).fill(this.c);
        d.font(SB).fontSize(8.5).fillColor(MUTED).text(this.brand.name, M, 18, { width: CW / 2, lineBreak: false });
        d.font(R).text(this.title, M + CW / 2, 18, { width: CW / 2, align: "right", lineBreak: false });
        d.moveTo(M, 34).lineTo(W - M, 34).lineWidth(0.5).strokeColor(LINE).stroke();
        d.x = M; d.y = 48;
        d.font(R).fontSize(10).fillColor(INK);
    }
    /** Room for `h` points before the footer, else a new page. */
    need(h: number) { if (this.doc.y + h > H - 70) this.newPage(); }

    section(title: string, sub?: string) {
        this.need(sub ? 54 : 40);
        const d = this.doc, y = d.y + 10;
        d.rect(M, y + 2, 3, 15).fill(this.c);
        d.font(B).fontSize(13).fillColor(INK).text(title, M + 10, y, { width: CW - 10 });
        if (sub) d.font(R).fontSize(9).fillColor(MUTED).text(sub, M + 10, d.y, { width: CW - 10 });
        d.y += 8; d.x = M;
        d.font(R).fontSize(10).fillColor(INK);
    }

    /** Row of label/value tiles. */
    tiles(items: [string, string][], y = this.doc.y) {
        const d = this.doc, gap = 8, w = (CW - gap * (items.length - 1)) / items.length, h = 46;
        items.forEach(([label, value], i) => {
            const x = M + i * (w + gap);
            d.roundedRect(x, y, w, h, 6).fill(tint(this.c, 0.92));
            d.font(R).fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x + 10, y + 8, { width: w - 20, characterSpacing: 0.4, lineBreak: false });
            d.font(SB).fontSize(10.5).fillColor(INK).text(value || "-", x + 10, y + 21, { width: w - 20, height: 20, ellipsis: true });
        });
        d.y = y + h + 6; d.x = M;
    }

    pill(text: string, x: number, y: number, color: string, opts: { solid?: boolean; size?: number } = {}) {
        const d = this.doc, size = opts.size || 7.5;
        d.font(SB).fontSize(size);
        const w = d.widthOfString(text) + 12, h = size + 7;
        d.roundedRect(x, y, w, h, h / 2).fill(opts.solid ? color : tint(color, 0.86));
        d.fillColor(opts.solid ? "#ffffff" : color).text(text, x + 6, y + 3, { lineBreak: false });
        d.fillColor(INK).font(R);
        return w;
    }
    check(x: number, y: number, color = "#16a34a") { this.doc.save().lineWidth(1.6).strokeColor(color).moveTo(x, y + 4).lineTo(x + 3, y + 7).lineTo(x + 8.5, y + 1).stroke().restore(); }
    cross(x: number, y: number, color = "#dc2626") { this.doc.save().lineWidth(1.4).strokeColor(color).moveTo(x + 1, y + 1).lineTo(x + 7, y + 7).moveTo(x + 7, y + 1).lineTo(x + 1, y + 7).stroke().restore(); }

    /** Two side-by-side lists with ticks / crosses (Included / Not included). */
    twoLists(left: { title: string; items: string[] }, right: { title: string; items: string[] }) {
        const d = this.doc, colW = (CW - 16) / 2;
        const measure = (items: string[]) => items.reduce((s, t) => s + d.font(R).fontSize(9.5).heightOfString(t, { width: colW - 34 }) + 5, 30);
        const h = Math.max(measure(left.items), measure(right.items), 50);
        this.need(Math.min(h, 400));
        const y0 = d.y;
        [left, right].forEach((col, ci) => {
            const x = M + ci * (colW + 16);
            d.roundedRect(x, y0, colW, h, 8).lineWidth(0.7).strokeColor(LINE).stroke();
            d.font(SB).fontSize(10).fillColor(INK).text(col.title, x + 12, y0 + 10);
            let y = y0 + 30;
            for (const t of col.items) {
                if (ci === 0) this.check(x + 12, y + 3); else this.cross(x + 12, y + 3);
                d.font(R).fontSize(9.5).fillColor(INK).text(t, x + 28, y, { width: colW - 40 });
                y = d.y + 5;
            }
        });
        d.y = y0 + h + 10; d.x = M;
    }

    paragraphBox(title: string, text: string) {
        const d = this.doc;
        const h = d.font(R).fontSize(9.5).heightOfString(text, { width: CW - 24 }) + 34;
        this.need(Math.min(h, 300));
        const y0 = d.y;
        d.roundedRect(M, y0, CW, h, 8).fill(SOFT);
        d.font(SB).fontSize(10).fillColor(INK).text(title, M + 12, y0 + 10);
        d.font(R).fontSize(9.5).fillColor("#374151").text(text, M + 12, y0 + 27, { width: CW - 24 });
        d.y = Math.max(d.y, y0 + h) + 10; d.x = M;
    }

    /** Contact card at the end of a document. */
    contactCard() {
        const b = this.brand, d = this.doc;
        const lines = [b.phone && `Call / WhatsApp: ${b.phone}`, b.email && `Email: ${b.email}`, b.address].filter(Boolean) as string[];
        const h = 40 + lines.length * 14 + (b.review ? 18 : 0);
        this.need(h + 10);
        const y0 = d.y + 4;
        d.roundedRect(M, y0, CW, h, 10).fill(tint(this.c, 0.9));
        d.font(B).fontSize(11).fillColor(this.c).text(`Questions? ${b.name} is here to help.`, M + 14, y0 + 12, { width: CW - 28 });
        let y = y0 + 32;
        for (const l of lines) { d.font(R).fontSize(9.5).fillColor(INK).text(l, M + 14, y, { width: CW - 28 }); y = d.y + 2; }
        if (b.review) d.font(SB).fontSize(9.5).fillColor(this.c).text(`${b.rating ? `Rated ${b.rating}/5 on Google · ` : ""}Leave us a review`, M + 14, y + 2, { link: b.review, underline: true });
        d.y = y0 + h + 8; d.x = M;
    }

    finish() {
        const d = this.doc, range = d.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            d.switchToPage(i);
            const bottom = d.page.margins.bottom;
            d.page.margins.bottom = 0; // writing in the footer area must not start a new page
            d.moveTo(M, H - 38).lineTo(W - M, H - 38).lineWidth(0.5).strokeColor(LINE).stroke();
            d.font(R).fontSize(7.5).fillColor(MUTED).text([this.brand.name, this.brand.phone, this.brand.email].filter(Boolean).join("  ·  "), M, H - 30, { width: CW - 70, lineBreak: false, ellipsis: true });
            d.text(`Page ${i - range.start + 1} of ${range.count}`, W - M - 70, H - 30, { width: 70, align: "right", lineBreak: false });
            d.page.margins.bottom = bottom;
        }
        d.end();
    }
}

/** Big cover band: photo (or brand colour) with logo, title and subtitle. Returns the y below it. */
const coverBand = async (pdf: Pdf, opts: { kicker: string; title: string; subtitle: string; image?: string | null; height?: number; right?: [string, string][] }) => {
    const d = pdf.doc, h = opts.height || 220;
    const img = await fetchImage(opts.image);
    d.save();
    d.rect(0, 0, W, h).clip();
    if (img) {
        try { d.image(img, 0, 0, { cover: [W, h], align: "center", valign: "center" }); } catch { d.rect(0, 0, W, h).fill(pdf.c); }
        d.rect(0, 0, W, h).fillOpacity(0.55).fill("#0b1020").fillOpacity(1);
    } else {
        d.rect(0, 0, W, h).fill(pdf.c);
        d.circle(W - 60, 30, 120).fillOpacity(0.08).fill("#ffffff").fillOpacity(1);
        d.circle(W - 10, h, 90).fillOpacity(0.07).fill("#ffffff").fillOpacity(1);
    }
    d.restore();
    const logo = await fetchImage(pdf.brand.logo);
    let x = M;
    if (logo) {
        d.roundedRect(M, 26, 46, 46, 8).fill("#ffffff");
        try { d.image(logo, M + 5, 31, { fit: [36, 36], align: "center", valign: "center" }); } catch { /* skip */ }
        x = M + 58;
    }
    d.font(SB).fontSize(10).fillColor("#ffffff").text(pdf.brand.name, x, logo ? 33 : 30, { width: CW - (x - M) - 160, lineBreak: false, ellipsis: true });
    if (pdf.brand.phone) d.font(R).fontSize(8.5).fillColor("#e5e7eb").text(pdf.brand.phone, x, d.y + 1, { lineBreak: false });
    if (opts.right?.length) {
        let ry = 30;
        for (const [k, v] of opts.right) {
            d.font(R).fontSize(7.5).fillColor("#e5e7eb").text(k.toUpperCase(), W - M - 150, ry, { width: 150, align: "right", characterSpacing: 0.4 });
            d.font(SB).fontSize(10).fillColor("#ffffff").text(v, W - M - 150, d.y, { width: 150, align: "right" });
            ry = d.y + 4;
        }
    }
    d.font(SB).fontSize(9).fillColor("#e5e7eb").text(opts.kicker.toUpperCase(), M, h - 92, { characterSpacing: 1.2 });
    d.font(B).fontSize(24).fillColor("#ffffff").text(opts.title, M, d.y + 2, { width: CW, height: 64, ellipsis: true });
    d.font(R).fontSize(10.5).fillColor("#f3f4f6").text(opts.subtitle, M, d.y + 2, { width: CW, lineBreak: false, ellipsis: true });
    d.x = M; d.y = h + 16;
    d.font(R).fontSize(10).fillColor(INK);
    return h;
};

// ---------------------------------------------------------------- shared blocks

const dayPlan = async (pdf: Pdf, days: any[], start: string | null, withImages: boolean) => {
    const d = pdf.doc;
    for (const [i, day] of days.entries()) {
        const items = Array.isArray(day.items) ? day.items : [];
        const textW = CW - 74;
        let est = 34 + (day.notes ? d.font(R).fontSize(9).heightOfString(day.notes, { width: textW }) + 6 : 0);
        for (const it of items) est += d.font(R).fontSize(9.5).heightOfString(it.text || "", { width: textW - 70 }) + 6;
        const img = withImages ? await fetchImage(day.image) : null;
        if (img) est += 130;
        pdf.need(Math.min(est, 420));
        const y0 = d.y;
        // day badge
        d.roundedRect(M, y0, 56, 44, 8).fill(pdf.c);
        d.font(SB).fontSize(7.5).fillColor("#e0e7ff").text("DAY", M, y0 + 7, { width: 56, align: "center", characterSpacing: 1 });
        d.font(B).fontSize(16).fillColor("#ffffff").text(String(i + 1), M, y0 + 16, { width: 56, align: "center" });
        if (start) d.font(R).fontSize(7.5).fillColor(MUTED).text(fmtDate(addDays(start, i), false), M, y0 + 48, { width: 56, align: "center" });
        // content
        const x = M + 70;
        d.font(SB).fontSize(12).fillColor(INK).text(day.title || `Day ${i + 1}`, x, y0 + 2, { width: textW });
        if (day.city) d.font(R).fontSize(8.5).fillColor(MUTED).text(day.city, x, d.y, { width: textW });
        let y = d.y + 6;
        for (const it of items) {
            const color = ITEM_COLOR[it.type] || ITEM_COLOR.note;
            const label = ITEM_LABEL[it.type] || "";
            if (label && it.type !== "note") pdf.pill(label, x, y + 1, color);
            const tx = label && it.type !== "note" ? x + 74 : x;
            d.font(R).fontSize(9.5).fillColor(it.type === "note" ? "#4b5563" : INK).text(it.text || "", tx, y, { width: textW - (tx - x) });
            y = d.y + 5;
        }
        if (day.notes) { d.font(R).fontSize(9).fillColor("#4b5563").text(day.notes, x, y, { width: textW }); y = d.y + 5; }
        if (img) {
            d.save();
            d.roundedRect(x, y + 2, textW, 120, 8).clip();
            try { d.image(img, x, y + 2, { cover: [textW, 120], align: "center", valign: "center" }); } catch { /* skip */ }
            d.restore();
            y += 128;
        }
        const bottom = Math.max(y, y0 + 62);
        if (i < days.length - 1) { d.moveTo(M + 28, y0 + 64).lineTo(M + 28, bottom + 8).dash(2, { space: 3 }).lineWidth(0.8).strokeColor(tint(pdf.c, 0.6)).stroke().undash(); }
        d.y = bottom + 12; d.x = M;
    }
};

const optionTotals = (q: any, o: any) => quoteTotals(Array.isArray(o.lines) ? o.lines : [], {
    discount: Number(q.discount || 0), billingMode: q.billing_mode, gstPercent: Number(q.gst_percent), tcsPercent: Number(q.tcs_percent),
    international: Boolean(q.is_international), travellers: Math.max(1, Number(q.adults || 0) + Number(q.children || 0)),
});

/** Simple table. cols: [title, width, align]. */
const table = (pdf: Pdf, colsIn: [string, number, "left" | "right" | "center"][], rows: { cells: string[]; bold?: boolean; tint?: boolean }[]) => {
    const d = pdf.doc;
    // scale the columns to the table width (10pt padding each side)
    const total = colsIn.reduce((s, c) => s + c[1], 0);
    const cols = colsIn.map(([t, w, a]) => [t, (w / total) * (CW - 20), a] as [string, number, "left" | "right" | "center"]);
    const drawHeader = () => {
        const y = d.y;
        d.roundedRect(M, y, CW, 22, 5).fill(tint(pdf.c, 0.9));
        let x = M + 10;
        for (const [t, w, a] of cols) { d.font(SB).fontSize(8).fillColor(INK).text(t.toUpperCase(), x, y + 7, { width: w - 10, align: a, characterSpacing: 0.3, lineBreak: false }); x += w; }
        d.y = y + 26;
    };
    drawHeader();
    for (const r of rows) {
        const h = Math.max(...r.cells.map((c, i) => d.font(r.bold ? SB : R).fontSize(9.5).heightOfString(c, { width: cols[i][1] - 10 }))) + 10;
        if (d.y + h > H - 70) { pdf.newPage(); drawHeader(); }
        const y = d.y;
        if (r.tint) d.rect(M, y - 2, CW, h).fill(SOFT);
        let x = M + 10;
        r.cells.forEach((c, i) => { d.font(r.bold ? SB : R).fontSize(9.5).fillColor(INK).text(c, x, y + 3, { width: cols[i][1] - 10, align: cols[i][2] }); x += cols[i][1]; });
        d.y = y + h;
        d.moveTo(M, d.y - 1).lineTo(W - M, d.y - 1).lineWidth(0.4).strokeColor(LINE).stroke();
    }
    d.y += 8; d.x = M;
};

const listOf = (text?: string | null) => String(text || "").split(/\n+/).map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

// ---------------------------------------------------------------- itinerary

export const itineraryPdf = async (res: Response, brand: Brand, it: any, quote: any, client?: { name?: string | null } | null) => {
    const x = it.toJSON ? it.toJSON() : it;
    const days = Array.isArray(x.days) ? x.days : (() => { try { return JSON.parse(x.days || "[]"); } catch { return []; } })();
    const pdf = new Pdf(res, brand, x.title, `${x.title}.pdf`);
    const q = quote ? (quote.toJSON ? quote.toJSON() : quote) : null;
    const pax = q ? Number(q.adults || 0) + Number(q.children || 0) : 0;
    await coverBand(pdf, {
        kicker: "Your trip plan", title: x.title,
        subtitle: [x.destination, `${x.nights} nights / ${Number(x.nights) + 1} days`, client?.name ? `Prepared for ${client.name}` : null].filter(Boolean).join("   ·   "),
        image: x.cover_image, height: 240,
    });
    const end = x.start_date ? addDays(x.start_date, Number(x.nights || 0)) : null;
    pdf.tiles([
        ["Duration", `${x.nights}N / ${Number(x.nights) + 1}D`],
        ["Travel dates", x.start_date ? dateRange(x.start_date, end) : "To be confirmed"],
        ["Travellers", pax ? `${q.adults} adult${q.adults > 1 ? "s" : ""}${q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""}` : "-"],
        ["Destination", x.destination || "-"],
    ]);
    if (days.length) {
        pdf.section("Trip at a glance");
        const d = pdf.doc;
        for (const [i, day] of days.entries()) {
            pdf.need(16);
            d.font(SB).fontSize(9.5).fillColor(pdf.c).text(`Day ${i + 1}`, M, d.y, { width: 48, continued: false });
            d.moveUp();
            d.font(R).fontSize(9.5).fillColor(INK).text(`${day.title}${day.city ? `  ·  ${day.city}` : ""}`, M + 50, d.y, { width: CW - 50 });
            d.y += 2;
        }
        pdf.section("Day by day");
        await dayPlan(pdf, days, x.start_date || null, true);
    }
    if (q && Array.isArray(q.options) && q.options.length) {
        pdf.section("Price", `Valid until ${q.valid_until ? fmtDate(q.valid_until) : "further notice"} · ${pax} traveller${pax === 1 ? "" : "s"} · all taxes shown`);
        table(pdf, [["Option", 150, "left"], ["Package", 85, "right"], ["GST", 70, "right"], ["TCS", 60, "right"], ["Total", 75, "right"], ["Per person", 75, "right"]],
            q.options.map((o: any, i: number) => { const t = optionTotals(q, o); return { cells: [`${o.name}${(q.chosen_option ?? 0) === i && q.options.length > 1 ? "  (recommended)" : ""}`, money(t.sell), money(t.gst), t.tcs ? money(t.tcs) : "-", money(t.total), money(t.per_person)], bold: (q.chosen_option ?? 0) === i, tint: i % 2 === 1 }; }));
    }
    const inc = listOf(x.inclusions), exc = listOf(x.exclusions);
    if (inc.length || exc.length) { pdf.section("What's included"); pdf.twoLists({ title: "Included", items: inc.length ? inc : ["As per the day plan"] }, { title: "Not included", items: exc.length ? exc : ["Anything not listed as included"] }); }
    if (x.cancellation_policy) pdf.paragraphBox("Cancellation policy", x.cancellation_policy);
    if (x.terms) pdf.paragraphBox("Terms", x.terms);
    pdf.contactCard();
    pdf.finish();
};

// ---------------------------------------------------------------- quotation

export const quotePdf = async (res: Response, brand: Brand, quote: any, it: any | null, client: { name?: string | null; phone?: string | null; email?: string | null } | null, issued: string) => {
    const q = quote.toJSON ? quote.toJSON() : quote;
    const x = it ? (it.toJSON ? it.toJSON() : it) : null;
    const pdf = new Pdf(res, brand, `Quotation ${q.number}`, `Quote-${q.number}.pdf`);
    const d = pdf.doc;
    await coverBand(pdf, {
        kicker: "Quotation", title: q.title || "Trip quotation",
        subtitle: [x?.destination, x ? `${x.nights} nights / ${Number(x.nights) + 1} days` : null].filter(Boolean).join("   ·   ") || "Holiday quotation",
        image: x?.cover_image, height: 214,
        right: [["Quote no.", `${q.number}${q.version > 1 ? ` (v${q.version})` : ""}`], ["Date", fmtDate(issued)], ["Valid until", q.valid_until ? fmtDate(q.valid_until) : "-"]],
    });
    // bill to / trip
    const colW = (CW - 12) / 2, y0 = d.y;
    const pax = Number(q.adults || 0) + Number(q.children || 0);
    const box = (bx: number, title: string, lines: string[]) => {
        d.roundedRect(bx, y0, colW, 78, 8).lineWidth(0.7).strokeColor(LINE).stroke();
        d.font(R).fontSize(7.5).fillColor(MUTED).text(title.toUpperCase(), bx + 12, y0 + 10, { characterSpacing: 0.5 });
        let yy = y0 + 24;
        lines.filter(Boolean).forEach((l, i) => { d.font(i === 0 ? SB : R).fontSize(i === 0 ? 11 : 9).fillColor(i === 0 ? INK : "#374151").text(l, bx + 12, yy, { width: colW - 24, lineBreak: false, ellipsis: true }); yy = d.y + 2; });
    };
    box(M, "Prepared for", [client?.name || "Valued guest", client?.phone || "", client?.email || ""]);
    box(M + colW + 12, "Trip", [q.title || "", x?.start_date ? dateRange(x.start_date, addDays(x.start_date, Number(x.nights || 0))) : "Dates to be confirmed", `${q.adults} adult${q.adults > 1 ? "s" : ""}${q.children ? `, ${q.children} child${q.children > 1 ? "ren" : ""}` : ""}${q.infants ? `, ${q.infants} infant${q.infants > 1 ? "s" : ""}` : ""}`]);
    d.y = y0 + 90; d.x = M;

    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length > 1) {
        pdf.section("Compare options");
        table(pdf, [["Option", 170, "left"], ["Package", 85, "right"], ["Taxes", 85, "right"], ["Total", 90, "right"], ["Per person", 85, "right"]],
            options.map((o: any, i: number) => { const t = optionTotals(q, o); return { cells: [o.name, money(t.sell), money(t.gst + t.tcs), money(t.total), money(t.per_person)], bold: (q.chosen_option ?? 0) === i, tint: i % 2 === 1 }; }));
    }
    for (const [oi, o] of options.entries()) {
        const t = optionTotals(q, o);
        pdf.section(options.length > 1 ? `Option ${oi + 1}: ${o.name}` : "Price details");
        table(pdf, [["Service", 300, "left"], ["Quantity", 100, "center"], ["Amount", 115, "right"]],
            (o.lines || []).map((l: any, li: number) => {
                const sell = Number(l.unit_cost) * Number(l.qty || 1) * Math.max(1, Number(l.nights || 0)) + (l.markup_type === "flat" ? Number(l.markup_value) : Number(l.unit_cost) * Number(l.qty || 1) * Math.max(1, Number(l.nights || 0)) * Number(l.markup_value) / 100);
                const qty = `${l.qty}${Number(l.nights) > 0 ? ` × ${l.nights} night${l.nights > 1 ? "s" : ""}` : ""}`;
                return { cells: [`${ITEM_LABEL[l.service_type] ? `${ITEM_LABEL[l.service_type]}: ` : ""}${l.description}`, qty, money(sell)], tint: li % 2 === 1 };
            }));
        // totals block (right aligned)
        const rows: [string, string, boolean?][] = [
            ...(t.discount ? [["Discount", `– ${money(t.discount)}`] as [string, string]] : []),
            ["Package price", money(t.sell)],
            [`GST ${Number(q.gst_percent)}%${q.billing_mode === "margin" ? " (on service charge)" : ""}`, money(t.gst)],
            ...(t.tcs ? [[`TCS ${Number(q.tcs_percent)}% (overseas package)`, money(t.tcs)] as [string, string]] : []),
            ["Total payable", money(t.total), true],
            [`Per person (${pax})`, money(t.per_person)],
        ];
        pdf.need(rows.length * 18 + 20);
        const bx = M + CW - 250;
        for (const [k, v, strong] of rows) {
            const y = d.y;
            if (strong) { d.roundedRect(bx - 8, y - 4, 258, 24, 6).fill(pdf.c); }
            d.font(strong ? B : R).fontSize(strong ? 11 : 9.5).fillColor(strong ? "#ffffff" : "#374151").text(k, bx, y + (strong ? 1 : 0), { width: 150 });
            d.font(strong ? B : SB).fontSize(strong ? 11 : 9.5).fillColor(strong ? "#ffffff" : INK).text(v, bx + 150, y + (strong ? 1 : 0), { width: 92, align: "right" });
            d.y = y + (strong ? 26 : 17);
        }
        d.y += 6; d.x = M;
    }
    if (q.notes) pdf.paragraphBox("Notes", q.notes);
    // payment
    const pay = [
        "Booking amount: 30% to confirm. Balance as per the payment schedule on your invoice, before travel.",
        brand.upi ? `UPI: ${brand.upi}` : "",
        brand.bank ? `Bank transfer:\n${brand.bank}` : "",
        brand.gstin ? `GSTIN: ${brand.gstin}` : "",
    ].filter(Boolean).join("\n");
    pdf.paragraphBox("How to pay", pay);
    if (x && Array.isArray(x.days) && x.days.length) {
        pdf.section("Day plan");
        await dayPlan(pdf, x.days, x.start_date || null, false);
        const inc = listOf(x.inclusions), exc = listOf(x.exclusions);
        if (inc.length || exc.length) pdf.twoLists({ title: "Included", items: inc.length ? inc : ["As per the day plan"] }, { title: "Not included", items: exc.length ? exc : ["Anything not listed as included"] });
        if (x.cancellation_policy) pdf.paragraphBox("Cancellation policy", x.cancellation_policy);
    }
    pdf.paragraphBox("Please note", "Prices are subject to availability at the time of booking and may change until the booking is confirmed with a payment. Supplier costs are not shown.");
    pdf.contactCard();
    pdf.finish();
};

// ---------------------------------------------------------------- vouchers

const VOUCHER_NOTES: Record<string, string[]> = {
    hotel: ["Show this voucher and a photo ID for every guest at check-in.", "Standard check-in is from 2 PM and check-out by 12 noon unless stated.", "Extras such as minibar, laundry and tourism fees are paid directly at the hotel."],
    transfer: ["Be ready at the pick-up point 10 minutes before the time shown.", "The driver will wait for up to 30 minutes after the pick-up time.", "For flight delays, call the supplier or us so the pick-up can be moved."],
    activity: ["Carry this voucher (printed or on your phone) and a photo ID.", "Reach the meeting point 15 minutes early.", "Timings may change because of weather; the supplier will inform you."],
    other: ["Carry this voucher (printed or on your phone) and a photo ID."],
};
const KIND: Record<string, string> = { hotel: "Hotel voucher", transfer: "Transfer voucher", activity: "Activity voucher", other: "Service voucher" };

export const vouchersPdf = async (res: Response, brand: Brand, booking: any, services: any[], travellers: any[], client: any) => {
    const b = booking.toJSON ? booking.toJSON() : booking;
    const pdf = new Pdf(res, brand, `Vouchers ${b.booking_no}`, `Vouchers-${b.booking_no}.pdf`);
    const d = pdf.doc;
    const logo = await fetchImage(brand.logo);
    if (!services.length) { d.font(R).fontSize(11).text("There are no hotel, transfer or activity services on this booking yet.", M, 80); pdf.finish(); return; }
    services.forEach((raw: any, idx: number) => {
        const s = raw.toJSON ? raw.toJSON() : raw;
        if (idx > 0) d.addPage();
        const kind = ["hotel", "transfer", "activity"].includes(s.type) ? s.type : "other";
        // header band
        d.rect(0, 0, W, 92).fill(pdf.c);
        let x = M;
        if (logo) { d.roundedRect(M, 22, 46, 46, 8).fill("#ffffff"); try { d.image(logo, M + 5, 27, { fit: [36, 36], align: "center", valign: "center" }); } catch { /* skip */ } x = M + 58; }
        d.font(B).fontSize(14).fillColor("#ffffff").text(brand.name, x, 28, { width: 260, lineBreak: false, ellipsis: true });
        d.font(R).fontSize(8.5).fillColor("#e5e7eb").text([brand.phone, brand.email].filter(Boolean).join("  ·  "), x, d.y + 1, { width: 280, lineBreak: false, ellipsis: true });
        d.font(SB).fontSize(8).fillColor("#e5e7eb").text(KIND[kind].toUpperCase(), W - M - 200, 26, { width: 200, align: "right", characterSpacing: 1.2 });
        d.font(B).fontSize(16).fillColor("#ffffff").text(`${b.booking_no}-${idx + 1}`, W - M - 200, 40, { width: 200, align: "right" });
        // status + confirmation
        let y = 112;
        const ok = s.status === "confirmed" && s.confirmation_no;
        d.roundedRect(M, y, CW, 64, 10).fill(ok ? "#ecfdf5" : "#fffbeb");
        d.font(R).fontSize(8).fillColor(MUTED).text("CONFIRMATION NUMBER", M + 16, y + 12, { characterSpacing: 0.6 });
        d.font(B).fontSize(20).fillColor(ok ? "#065f46" : "#92400e").text(s.confirmation_no || "Awaiting confirmation", M + 16, y + 26, { width: CW - 200, lineBreak: false, ellipsis: true });
        pdf.pill(ok ? "CONFIRMED" : "PENDING", W - M - 100, y + 24, ok ? "#059669" : "#d97706", { solid: true, size: 9 });
        y += 80;
        // two cards: service / supplier
        const colW = (CW - 12) / 2;
        const det = s.details || {};
        const nights = s.service_date && s.end_date ? Math.max(0, Math.round((Date.parse(s.end_date) - Date.parse(s.service_date)) / 864e5)) : null;
        const left: [string, string][] = kind === "hotel"
            ? [["Hotel / service", s.description], ["Check-in", fmtDate(s.service_date)], ["Check-out", s.end_date ? fmtDate(s.end_date) : "-"], ["Nights", nights ? String(nights) : "-"], ["Room type", det.room_type || "-"], ["Meal plan", det.meal_plan || "-"]]
            : [["Service", s.description], ["Date", fmtDate(s.service_date)], ["Pick-up", det.pickup_time || "As advised"], ...(det.pnr ? [["PNR", det.pnr] as [string, string]] : [])];
        const right: [string, string][] = [["Supplier", s.supplier?.name || "Arranged by us"], ["Supplier phone", s.supplier?.phone || "-"], ["City", s.supplier?.city || "-"], ["Trip", b.title], ["Booking", b.booking_no]];
        const measure = (rows: [string, string][]) => 34 + rows.reduce((sum, [, v]) => sum + Math.max(17, d.font(SB).fontSize(9.5).heightOfString(v || "-", { width: colW - 120 }) + 3), 0);
        const cardH = Math.max(measure(left), measure(right));
        const card = (cx: number, title: string, rows: [string, string][]) => {
            const h = cardH;
            d.roundedRect(cx, y, colW, h, 8).lineWidth(0.7).strokeColor(LINE).stroke();
            d.font(SB).fontSize(10).fillColor(pdf.c).text(title, cx + 12, y + 10);
            let yy = y + 28;
            for (const [k, v] of rows) {
                d.font(R).fontSize(8.5).fillColor(MUTED).text(k, cx + 12, yy, { width: 96 });
                d.font(SB).fontSize(9.5).fillColor(INK).text(v || "-", cx + 108, yy, { width: colW - 120 });
                yy = Math.max(d.y, yy + 14) + 3;
            }
            return h;
        };
        const hl = card(M, kind === "hotel" ? "Stay details" : "Service details", left);
        const hr = card(M + colW + 12, "Supplier and booking", right);
        y += Math.max(hl, hr) + 16;
        // guests
        d.y = y; d.x = M;
        pdf.section("Guests");
        const guests = travellers.length ? travellers : [{ name: client?.username || "Lead guest", pax_type: "adult", is_lead: true }];
        table(pdf, [["#", 30, "left"], ["Name", 270, "left"], ["Type", 100, "left"], ["Role", 110, "left"]],
            guests.map((g: any, i: number) => ({ cells: [String(i + 1), g.name, String(g.pax_type || "adult").replace(/^./, (c: string) => c.toUpperCase()), g.is_lead ? "Lead guest" : ""], tint: i % 2 === 1 })));
        // contacts and notes
        pdf.need(110);
        const yc = d.y;
        d.roundedRect(M, yc, colW, 70, 8).fill(tint(pdf.c, 0.92));
        d.font(SB).fontSize(10).fillColor(INK).text("Lead guest", M + 12, yc + 10);
        d.font(R).fontSize(9.5).text(client?.username || guests[0]?.name || "", M + 12, yc + 27, { width: colW - 24 });
        d.text(`${client?.country_code || ""} ${client?.phone_number || ""}`.trim(), M + 12, d.y + 1, { width: colW - 24 });
        d.roundedRect(M + colW + 12, yc, colW, 70, 8).fill("#fef2f2");
        d.font(SB).fontSize(10).fillColor("#991b1b").text("Help during your trip", M + colW + 24, yc + 10);
        d.font(R).fontSize(9.5).fillColor(INK).text(brand.name, M + colW + 24, yc + 27, { width: colW - 24 });
        d.text(brand.phone || brand.email || "", M + colW + 24, d.y + 1, { width: colW - 24 });
        d.y = yc + 84; d.x = M;
        pdf.paragraphBox("Important", VOUCHER_NOTES[kind].map((n) => `•  ${n}`).join("\n"));
    });
    pdf.finish();
};
