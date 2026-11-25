import fs from "fs";
import path from "path";
import axios from "axios";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { quoteTotals } from "./travel";
import { ICONS } from "./travelPdfIcons";

/**
 * Travel PDFs: itinerary, quotation and vouchers.
 * Built with pdfkit (no browser on the server) using Noto Sans (assets/fonts, OFL) so ₹ prints correctly.
 * Look: a magazine-style trip planner in the agency's colour - a cover page with a big "5D4N" headline and a
 * rounded photo collage, round icon badges, day cards on a dotted timeline, price cards and a closing band.
 * Icons are Lucide line icons drawn as vectors (travelPdfIcons.ts).
 */

type Doc = InstanceType<typeof PDFDocument>;
export interface Brand { name: string; color: string; phone: string; email: string; address: string; logo: string | null; gstin?: string; upi?: string; bank?: string; review?: string; rating?: string }

const W = 595.28, H = 841.89, M = 40, CW = W - 2 * M;
const BOTTOM = H - 66; // lowest y for content (footer below)
const INK = "#111827", MUTED = "#6b7280", BODY = "#374151", LINE = "#e5e7eb", SOFT = "#f8fafc";
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const hasFonts = fs.existsSync(path.join(FONT_DIR, "NotoSans-Regular.ttf"));
const R = "R", SB = "SB", B = "B";
const money = (paise: number) => `${hasFonts ? "₹" : "Rs "}${(Math.round(Number(paise || 0)) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const fmtDate = (d?: string | null, withYear = true) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }) : "");
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
/** "25–30 Dec 2026" / "28 Dec – 2 Jan 2027". */
const dateRange = (a: string, b: string | null) => {
    if (!b || a === b) return fmtDate(a);
    const da = new Date(`${a}T00:00:00Z`), db = new Date(`${b}T00:00:00Z`);
    const mon = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    if (da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${db.getUTCDate()} ${mon(db)} ${db.getUTCFullYear()}`;
    return `${da.getUTCDate()} ${mon(da)} – ${db.getUTCDate()} ${mon(db)} ${db.getUTCFullYear()}`;
};
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const paxText = (q: any) => [q?.adults ? plural(Number(q.adults), "adult") : "", q?.children ? plural(Number(q.children), "child", "children") : "", q?.infants ? plural(Number(q.infants), "infant") : ""].filter(Boolean).join(", ");
/** "5D4N" style headline. */
const durationTag = (nights: number) => (nights > 0 ? `${nights + 1}D${nights}N` : "1 DAY");

/** A lighter version of a colour (amount 0..1 towards white). */
const tint = (hex: string, amount: number) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};
/** A darker version of a colour (amount 0..1 towards black). */
const shade = (hex: string, amount: number) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(c * (1 - amount));
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};

const imageCache = new Map<string, Promise<Buffer | null>>();
const fetchImage = (url?: string | null): Promise<Buffer | null> => {
    if (!url || !/^https?:\/\//.test(url)) return Promise.resolve(null);
    if (!imageCache.has(url)) {
        imageCache.set(url, axios.get(url, { responseType: "arraybuffer", timeout: 7000, maxContentLength: 6 * 1024 * 1024 })
            .then((r) => (/jpe?g|png/i.test(String(r.headers["content-type"] || "")) ? Buffer.from(r.data) : null))
            .catch(() => null)
            .finally(() => setTimeout(() => imageCache.delete(url), 60_000)));
    }
    return imageCache.get(url)!;
};
const fetchAll = async (urls: string[], max: number) => (await Promise.all([...new Set(urls.filter(Boolean))].slice(0, max + 2).map(fetchImage))).filter(Boolean).slice(0, max) as Buffer[];

const ITEM_LABEL: Record<string, string> = { hotel: "Stay", sightseeing: "Sightseeing", transfer: "Transfer", meal: "Meal", flight: "Flight", activity: "Activity", note: "Note", visa: "Visa", insurance: "Insurance", forex: "Forex", other: "Service" };
const ITEM_COLOR: Record<string, string> = { hotel: "#7c3aed", sightseeing: "#0891b2", transfer: "#2563eb", meal: "#d97706", flight: "#0f766e", activity: "#db2777", note: "#64748b", visa: "#4f46e5", insurance: "#059669", forex: "#ca8a04", other: "#64748b" };
const ITEM_ICON: Record<string, string> = { hotel: "bed", sightseeing: "camera", transfer: "car", meal: "utensils", flight: "plane", activity: "sparkles", note: "info", visa: "passport", insurance: "shield", forex: "coins", other: "ticket" };
/** The icon that best describes a day: flights first, then sightseeing, activities, stays. */
const dayIcon = (items: any[]) => {
    const types = new Set(items.map((it) => it.type));
    for (const t of ["flight", "sightseeing", "activity", "transfer", "hotel", "meal"]) if (types.has(t)) return ITEM_ICON[t];
    return "pin";
};
/** "12:30 Lunch at ..." → time "12:30" + text. */
const TIME_RE = /^\s*(\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)\s*[-–—:]?\s+/i;
const splitTime = (t: string) => {
    const m = String(t || "").match(TIME_RE);
    return m ? { time: m[1].replace(".", ":").replace(/\s+/g, " ").toUpperCase(), text: String(t).slice(m[0].length) } : { time: "", text: String(t || "") };
};
const picsOf = (x: any): string[] => (Array.isArray(x?.images) && x.images.length ? x.images : x?.image ? [x.image] : []);
const daysOf = (x: any) => (Array.isArray(x?.days) ? x.days : (() => { try { return JSON.parse(x?.days || "[]"); } catch { return []; } })());

// ---------------------------------------------------------------- document frame

class Pdf {
    doc: Doc;
    brand: Brand;
    title: string;
    /** Pages without the running footer (the cover). */
    noFooter = new Set<number>();
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

    /** New page with the running header: a rounded brand bar, agency name and document title. */
    newPage() {
        this.doc.addPage();
        const d = this.doc;
        d.roundedRect(M, 16, CW, 7, 3.5).fill(this.c);
        d.font(SB).fontSize(8).fillColor(MUTED).text(this.brand.name.toUpperCase(), M, 30, { width: CW / 2, lineBreak: false, characterSpacing: 0.8 });
        d.font(R).fontSize(8).fillColor(MUTED).text(this.title, M + CW / 2, 30, { width: CW / 2, align: "right", lineBreak: false });
        d.x = M; d.y = 54;
        d.font(R).fontSize(10).fillColor(INK);
    }
    /** Room for `h` points before the footer, else a new page. */
    need(h: number) { if (this.doc.y + h > BOTTOM) this.newPage(); }

    // ---- drawing primitives

    icon(name: string, x: number, y: number, size: number, color: string, lw = 2) {
        const paths = ICONS[name];
        if (!paths) return;
        const d = this.doc;
        d.save().translate(x, y).scale(size / 24);
        d.lineWidth(lw).lineCap("round").lineJoin("round").strokeColor(color);
        for (const p of paths) d.path(p).stroke();
        d.restore();
    }
    /** Filled circle with a white icon; `ring` adds a white outline so it can sit on photos. */
    badge(name: string, cx: number, cy: number, r: number, color = this.c, ring = false) {
        const d = this.doc;
        if (ring) d.circle(cx, cy, r + 3).fill("#ffffff");
        d.circle(cx, cy, r).fill(color);
        const s = r * 1.05;
        this.icon(name, cx - s / 2, cy - s / 2, s, "#ffffff", 2);
    }
    /** Soft icon chip: tinted circle with a coloured icon. */
    softBadge(name: string, cx: number, cy: number, r: number, color = this.c) {
        this.doc.circle(cx, cy, r).fill(tint(color, 0.86));
        const s = r * 1.1;
        this.icon(name, cx - s / 2, cy - s / 2, s, color, 2.2);
    }
    /** Grid of small dots (decoration). */
    dots(x: number, y: number, cols: number, rows: number, color = this.c, gap = 7, opacity = 0.35) {
        const d = this.doc;
        d.save().fillOpacity(opacity);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) d.circle(x + i * gap, y + j * gap, 1.1).fill(color);
        d.restore();
    }
    /** Big faint palm outline (decoration). */
    palm(x: number, y: number, size: number, color = INK, opacity = 0.05) {
        const d = this.doc;
        d.save().strokeOpacity(opacity);
        this.icon("palm", x, y, size, color, 1.1);
        d.restore();
    }
    /** White card with a soft drop shadow and hairline border. */
    card(x: number, y: number, w: number, h: number, r = 12, fill = "#ffffff") {
        const d = this.doc;
        d.save().fillOpacity(0.05).roundedRect(x + 1, y + 3, w, h, r).fill("#0f172a").restore();
        d.roundedRect(x, y, w, h, r).fill(fill);
        d.roundedRect(x, y, w, h, r).lineWidth(0.6).strokeColor(LINE).stroke();
    }
    photo(img: Buffer, x: number, y: number, w: number, h: number, r = 12) {
        const d = this.doc;
        d.save();
        d.roundedRect(x, y, w, h, r).clip();
        try { d.image(img, x, y, { cover: [w, h], align: "center", valign: "center" }); } catch { d.rect(x, y, w, h).fill(tint(this.c, 0.8)); }
        d.restore();
    }
    pill(text: string, x: number, y: number, color: string, opts: { solid?: boolean; size?: number; textColor?: string } = {}) {
        const d = this.doc, size = opts.size || 7.5;
        d.font(SB).fontSize(size);
        const w = d.widthOfString(text) + size * 1.8, h = size + 8;
        d.roundedRect(x, y, w, h, h / 2).fill(opts.solid ? color : tint(color, 0.86));
        d.fillColor(opts.textColor || (opts.solid ? "#ffffff" : color)).text(text, x + size * 0.9, y + 3.6, { lineBreak: false });
        d.fillColor(INK).font(R);
        return w;
    }
    check(x: number, y: number, color = "#16a34a") { this.doc.save().lineWidth(1.6).lineCap("round").lineJoin("round").strokeColor(color).moveTo(x, y + 4).lineTo(x + 3, y + 7).lineTo(x + 8.5, y + 1).stroke().restore(); }
    cross(x: number, y: number, color = "#dc2626") { this.doc.save().lineWidth(1.4).lineCap("round").strokeColor(color).moveTo(x + 1, y + 1).lineTo(x + 7, y + 7).moveTo(x + 7, y + 1).lineTo(x + 1, y + 7).stroke().restore(); }

    // ---- blocks

    /** Section heading: icon badge + bold title (+ muted line). */
    /** `keep` = height of what follows, so a heading is never left alone at the bottom of a page. */
    section(title: string, sub?: string, icon?: string, keep = 60) {
        this.need((sub ? 52 : 40) + keep);
        const d = this.doc, y = d.y + 12;
        let x = M;
        if (icon) { this.badge(icon, M + 12, y + 10, 12); x = M + 32; }
        else { d.roundedRect(M, y + 3, 4, 15, 2).fill(this.c); x = M + 12; }
        d.font(B).fontSize(15).fillColor(INK).text(title, x, y, { width: CW - (x - M) });
        if (sub) d.font(R).fontSize(8.5).fillColor(MUTED).text(sub, x, d.y, { width: CW - (x - M) });
        d.y = Math.max(d.y, y + 22) + 10; d.x = M;
        d.font(R).fontSize(10).fillColor(INK);
    }

    /** Row of icon + label/value tiles. */
    tiles(items: { icon: string; label: string; value: string; sub?: string }[], y = this.doc.y) {
        const d = this.doc, gap = 10, w = (CW - gap * (items.length - 1)) / items.length;
        const h = items.some((t) => t.sub) ? 60 : 50;
        items.forEach((t, i) => {
            const x = M + i * (w + gap);
            this.card(x, y, w, h, 12);
            this.softBadge(t.icon, x + 22, y + h / 2, 13);
            const tx = x + 42, tw = w - 50;
            d.font(SB).fontSize(7).fillColor(MUTED).text(t.label.toUpperCase(), tx, y + (t.sub ? 11 : 13), { width: tw, characterSpacing: 0.6, lineBreak: false });
            let fs = 10;
            d.font(SB).fontSize(fs);
            while (fs > 7.5 && d.widthOfString(t.value || "-") > tw) d.fontSize(fs -= 0.5);
            d.fillColor(INK).text(t.value || "-", tx, d.y + 1, { width: tw, height: fs * 1.4, lineBreak: false, ellipsis: true });
            if (t.sub) d.font(R).fontSize(7.5).fillColor(MUTED).text(t.sub, tx, d.y, { width: tw, lineBreak: false, ellipsis: true });
        });
        d.y = y + h + 12; d.x = M;
    }

    /** Included / not included cards with ticks and crosses. */
    twoLists(left: { title: string; items: string[] }, right: { title: string; items: string[] }) {
        const d = this.doc, colW = (CW - 14) / 2;
        const measure = (items: string[]) => items.reduce((s, t) => s + d.font(R).fontSize(9).heightOfString(t, { width: colW - 46 }) + 6, 50);
        const h = Math.max(measure(left.items), measure(right.items), 70);
        this.need(Math.min(h, 420));
        const y0 = d.y;
        [left, right].forEach((col, ci) => {
            const x = M + ci * (colW + 14), color = ci === 0 ? "#16a34a" : "#dc2626";
            this.card(x, y0, colW, h, 12);
            d.circle(x + 22, y0 + 22, 10).fill(tint(color, 0.85));
            if (ci === 0) this.check(x + 17.7, y0 + 18, color); else this.cross(x + 18, y0 + 18, color);
            d.font(B).fontSize(10.5).fillColor(INK).text(col.title, x + 40, y0 + 15.5, { width: colW - 52 });
            let y = y0 + 44;
            for (const t of col.items) {
                d.circle(x + 21, y + 6, 2).fill(color);
                d.font(R).fontSize(9).fillColor(BODY).text(t, x + 32, y, { width: colW - 46 });
                y = d.y + 6;
            }
        });
        d.y = y0 + h + 12; d.x = M;
    }

    paragraphBox(title: string, text: string, icon = "info") {
        const d = this.doc;
        const h = d.font(R).fontSize(9).heightOfString(text, { width: CW - 66 }) + 44;
        this.need(Math.min(h, 320));
        const y0 = d.y;
        d.roundedRect(M, y0, CW, h, 12).fill(SOFT);
        d.roundedRect(M, y0, CW, h, 12).lineWidth(0.6).strokeColor(LINE).stroke();
        this.softBadge(icon, M + 24, y0 + 22, 11);
        d.font(B).fontSize(10.5).fillColor(INK).text(title, M + 44, y0 + 15, { width: CW - 60 });
        d.font(R).fontSize(9).fillColor(BODY).text(text, M + 44, y0 + 34, { width: CW - 66 });
        d.y = Math.max(d.y, y0 + h) + 12; d.x = M;
    }

    /** Closing band: "See you in GOA" pill, thank-you line and contact details. */
    closing(destination?: string | null) {
        const b = this.brand, d = this.doc;
        const lines: [string, string][] = [];
        if (b.phone) lines.push(["phone", b.phone]);
        if (b.email) lines.push(["mail", b.email]);
        if (b.address) lines.push(["pin", b.address]);
        const h = Math.max(150, 70 + lines.length * 20 + (b.review ? 20 : 0));
        this.need(h + 10);
        const y0 = d.y + 6;
        d.save();
        d.roundedRect(M, y0, CW, h, 18).clip();
        d.rect(M, y0, CW, h).fill(this.c);
        this.palm(W - M - 120, y0 + h - 110, 150, "#ffffff", 0.1);
        this.dots(W - M - 70, y0 + 18, 8, 3, "#ffffff", 7, 0.3);
        d.restore();
        const lw = CW * 0.5;
        d.font(SB).fontSize(8.5).fillColor(tint(this.c, 0.75)).text(destination ? "SEE YOU IN" : "HAPPY TRAVELS", M + 22, y0 + 22, { characterSpacing: 1.5 });
        const dest = (destination || b.name).toUpperCase();
        let size = 22;
        d.font(B).fontSize(size);
        while (size > 12 && d.widthOfString(dest) > lw - 64) d.fontSize(--size);
        const pw = d.widthOfString(dest) + 32;
        d.roundedRect(M + 22, y0 + 40, pw, size + 18, (size + 18) / 2).fill("#ffffff");
        d.fillColor(this.c).text(dest, M + 38, y0 + 40 + 7, { lineBreak: false });
        d.font(R).fontSize(9.5).fillColor("#ffffff").text(`Thank you for planning with ${b.name}. We are a message away, before and during your trip.`, M + 22, y0 + size + 70, { width: lw - 10 });
        // contacts on the right
        const rx = M + lw + 10;
        d.font(B).fontSize(11).fillColor("#ffffff").text("Talk to us", rx, y0 + 22);
        let y = y0 + 44;
        for (const [ic, t] of lines) {
            this.icon(ic, rx, y, 12, "#ffffff", 2);
            d.font(R).fontSize(9).fillColor("#ffffff").text(t, rx + 18, y, { width: CW - lw - 40 });
            y = Math.max(d.y, y + 14) + 6;
        }
        if (b.review) {
            this.icon("star", rx, y, 12, "#ffffff", 2);
            d.font(SB).fontSize(9).fillColor("#ffffff").text(`${b.rating ? `Rated ${b.rating}/5 on Google · ` : ""}Review us`, rx + 18, y, { link: b.review, underline: true });
        }
        d.y = y0 + h + 10; d.x = M;
    }

    finish() {
        const d = this.doc, range = d.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            if (this.noFooter.has(i)) continue;
            d.switchToPage(i);
            const bottom = d.page.margins.bottom;
            d.page.margins.bottom = 0; // writing in the footer area must not start a new page
            d.font(R).fontSize(7.5).fillColor(MUTED).text([this.brand.name, this.brand.phone, this.brand.email].filter(Boolean).join("   ·   "), M, H - 32, { width: CW - 80, lineBreak: false, ellipsis: true });
            const label = `${i - range.start + 1} / ${range.count}`;
            d.font(SB).fontSize(7.5);
            const pw = d.widthOfString(label) + 16;
            d.roundedRect(W - M - pw, H - 36, pw, 16, 8).fill(tint(this.c, 0.88));
            d.fillColor(this.c).text(label, W - M - pw, H - 32, { width: pw, align: "center", lineBreak: false });
            d.page.margins.bottom = bottom;
        }
        d.end();
    }
}

// ---------------------------------------------------------------- shared blocks

/** Logo tile + agency name at the top of a cover. */
const brandRow = async (pdf: Pdf, y: number, onDark = false) => {
    const d = pdf.doc, logo = await fetchImage(pdf.brand.logo);
    let x = M;
    if (logo) {
        d.roundedRect(M, y, 38, 38, 9).fill("#ffffff");
        if (!onDark) d.roundedRect(M, y, 38, 38, 9).lineWidth(0.6).strokeColor(LINE).stroke();
        try { d.image(logo, M + 4, y + 4, { fit: [30, 30], align: "center", valign: "center" }); } catch { /* skip */ }
        x = M + 48;
    }
    d.font(B).fontSize(11).fillColor(onDark ? "#ffffff" : INK).text(pdf.brand.name, x, y + 4, { width: 260, lineBreak: false, ellipsis: true });
    const sub = [pdf.brand.phone, pdf.brand.email].filter(Boolean).join("  ·  ");
    if (sub) d.font(R).fontSize(8).fillColor(onDark ? "#e5e7eb" : MUTED).text(sub, x, d.y, { width: 260, lineBreak: false, ellipsis: true });
};

/** Rounded photo collage for the cover, with icon badges on the tile corners (like a travel planner). */
const collage = (pdf: Pdf, imgs: Buffer[], x: number, y: number, w: number, h: number, destination: string) => {
    const d = pdf.doc, g = 12;
    type T = [number, number, number, number];
    let tiles: T[] = [];
    const n = imgs.length;
    if (n === 0) {
        d.save(); d.roundedRect(x, y, w, h, 18).clip();
        d.rect(x, y, w, h).fill(tint(pdf.c, 0.9));
        pdf.palm(x + w - 230, y - 10, 260, pdf.c, 0.12);
        pdf.dots(x + 24, y + 24, 10, 6, pdf.c, 8, 0.35);
        d.restore();
        pdf.badge("pin", x + w / 2, y + h / 2 - 24, 26);
        d.font(B).fontSize(20).fillColor(shade(pdf.c, 0.2)).text(destination || "Your next holiday", x, y + h / 2 + 14, { width: w, align: "center" });
        return;
    }
    if (n === 1) tiles = [[x, y, w, h]];
    else if (n === 2) { const cw = (w - g) / 2; tiles = [[x, y, cw, h - 36], [x + cw + g, y + 36, cw, h - 36]]; }
    else if (n === 3) { const lw = w * 0.56, rw = w - lw - g, rh = (h - g) / 2; tiles = [[x, y, lw, h], [x + lw + g, y, rw, rh], [x + lw + g, y + rh + g, rw, rh]]; }
    else {
        // staggered 2 x 2, the right column pushed down
        const cw = (w - g) / 2, off = 34, th = (h - g - off) / 2;
        tiles = [[x, y, cw, th], [x + cw + g, y + off, cw, th], [x, y + th + g, cw, th], [x + cw + g, y + off + th + g, cw, th]];
    }
    tiles.forEach(([tx, ty, tw, th], i) => pdf.photo(imgs[i], tx, ty, tw, th, 16));
    // badges on corners: pin bottom-left of the first tile, camera top-right of the second, bag on the last
    const [a] = tiles;
    pdf.badge("pin", a[0] + 4, a[1] + a[3] - 34, 15, pdf.c, true);
    if (tiles[1]) { const t = tiles[1]; pdf.badge("camera", t[0] + t[2] - 30, t[1] + 4, 15, pdf.c, true); }
    else pdf.badge("camera", a[0] + a[2] - 30, a[1] + 4, 15, pdf.c, true);
    const last = tiles[tiles.length - 1];
    if (tiles.length > 2) pdf.badge("bag", last[0] + 4, last[1] + last[3] - 4, 15, pdf.c, true);
};

/** "Trip at a glance": two columns of day chips. */
const glance = (pdf: Pdf, days: any[], start: string | null) => {
    const d = pdf.doc, colW = (CW - 10) / 2, h = 40;
    days.forEach((day: any, i: number) => {
        const col = i % 2;
        if (col === 0) pdf.need(h + 8);
        const x = M + col * (colW + 10), y = d.y;
        d.roundedRect(x, y, colW, h, 10).fill(tint(pdf.c, 0.93));
        d.roundedRect(x + 8, y + 8, 40, 24, 8).fill(pdf.c);
        d.font(B).fontSize(9).fillColor("#ffffff").text(`D${i + 1}`, x + 8, y + 14.5, { width: 40, align: "center", lineBreak: false });
        d.font(SB).fontSize(9).fillColor(INK).text(day.title || `Day ${i + 1}`, x + 56, y + 8, { width: colW - 64, lineBreak: false, ellipsis: true });
        const sub = [start ? `${weekday(addDays(start, i))}, ${fmtDate(addDays(start, i), false)}` : "", day.city].filter(Boolean).join("  ·  ");
        d.font(R).fontSize(7.5).fillColor(MUTED).text(sub || " ", x + 56, d.y, { width: colW - 64, lineBreak: false, ellipsis: true });
        if (col === 1 || i === days.length - 1) { d.y = y + h + 8; } else { d.y = y; }
    });
    d.x = M; d.y += 4;
};

/** Day cards on a dotted timeline: DAY pill, title, date, photo and the day's items (time or type on the left). */
const dayPlan = async (pdf: Pdf, days: any[], start: string | null, withImages: boolean) => {
    const d = pdf.doc;
    const TX = M + 15, CX = M + 42, CWD = W - M - CX, PAD = 14, LABEL = 80;
    const photoSets = withImages ? await Promise.all(days.map((day: any) => fetchAll([...picsOf(day), ...(Array.isArray(day.items) ? day.items : []).flatMap(picsOf)], 4))) : days.map(() => []);
    for (const [i, day] of days.entries()) {
        const items = (Array.isArray(day.items) ? day.items : []).filter((it: any) => String(it.text || "").trim());
        const imgs = photoSets[i] as Buffer[];
        const thumb = imgs[0], strip = imgs.slice(1, 4);
        const date = start ? addDays(start, i) : null;
        // measure
        const dateW = date ? 74 : 0;
        const pillW = (() => { d.font(SB).fontSize(8); return d.widthOfString(`DAY ${i + 1}`) + 16; })();
        const titleW = CWD - PAD * 2 - pillW - 8 - dateW;
        const title = String(day.title || `Day ${i + 1}`).toUpperCase();
        const titleH = d.font(B).fontSize(10.5).heightOfString(title, { width: titleW });
        const headH = Math.max(18, titleH) + (day.city ? 14 : 0);
        const tW = thumb ? 108 : 0, textX = CX + PAD + (thumb ? tW + 12 : 0), textW = CX + CWD - PAD - textX;
        const rows = items.map((it: any) => { const s = splitTime(it.text); return { ...s, type: it.type || "note", h: d.font(R).fontSize(9).heightOfString(s.text, { width: textW - LABEL }) }; });
        let listH = rows.reduce((s: number, r: any) => s + r.h + 5, 0);
        const notesH = day.notes ? d.font(R).fontSize(8.5).heightOfString(day.notes, { width: textW }) + 6 : 0;
        listH += notesH;
        const bodyH = Math.max(thumb ? 84 : 0, listH);
        const stripH = strip.length ? 78 : 0;
        const cardH = PAD + headH + 10 + bodyH + (stripH ? stripH + 10 : 0) + PAD - 4;
        pdf.need(Math.min(cardH + 14, BOTTOM - 60));
        const y0 = d.y;
        // timeline: dashed line to the next day, connector and badge
        if (i < days.length - 1) d.save().moveTo(TX, y0 + 36).lineTo(TX, y0 + cardH + 26).dash(2, { space: 3 }).lineWidth(1).strokeColor(tint(pdf.c, 0.55)).stroke().undash().restore();
        d.moveTo(TX + 15, y0 + 22).lineTo(CX, y0 + 22).lineWidth(1).strokeColor(tint(pdf.c, 0.55)).stroke();
        pdf.badge(dayIcon(items), TX, y0 + 22, 15);
        // card
        pdf.card(CX, y0, CWD, cardH, 14);
        let y = y0 + PAD;
        pdf.pill(`DAY ${i + 1}`, CX + PAD, y, pdf.c, { solid: true, size: 8 });
        d.font(B).fontSize(10.5).fillColor(pdf.c).text(title, CX + PAD + pillW + 8, y + 1.5, { width: titleW });
        if (day.city) {
            const cy = d.y + 1;
            pdf.icon("pin", CX + PAD + pillW + 8, cy + 1, 9, MUTED, 2.2);
            d.font(R).fontSize(8).fillColor(MUTED).text(day.city, CX + PAD + pillW + 20, cy, { width: titleW - 12, lineBreak: false, ellipsis: true });
        }
        if (date) {
            d.font(SB).fontSize(8.5).fillColor(INK).text(fmtDate(date, false), CX + CWD - PAD - dateW, y + 1, { width: dateW, align: "right", lineBreak: false });
            d.font(R).fontSize(7.5).fillColor(MUTED).text(weekday(date).toUpperCase(), CX + CWD - PAD - dateW, d.y, { width: dateW, align: "right", lineBreak: false, characterSpacing: 0.6 });
        }
        y += headH + 10;
        d.moveTo(CX + PAD, y - 5).lineTo(CX + CWD - PAD, y - 5).lineWidth(0.5).strokeColor("#f1f5f9").stroke();
        if (thumb) pdf.photo(thumb, CX + PAD, y, tW, 84, 10);
        let ly = y;
        for (const r of rows) {
            const color = ITEM_COLOR[r.type] || ITEM_COLOR.note;
            if (r.time) d.font(SB).fontSize(8.5).fillColor(INK).text(r.time, textX, ly + 0.5, { width: LABEL - 6, lineBreak: false });
            else if (r.type !== "note") {
                pdf.icon(ITEM_ICON[r.type] || "ticket", textX, ly + 1.5, 9, color, 2.2);
                d.font(SB).fontSize(7).fillColor(color).text((ITEM_LABEL[r.type] || "").toUpperCase(), textX + 12, ly + 2, { width: LABEL - 14, lineBreak: false, characterSpacing: 0.3 });
            } else pdf.icon("info", textX, ly + 1.5, 9, MUTED, 2.2);
            d.font(R).fontSize(9).fillColor(r.type === "note" ? "#4b5563" : BODY).text(r.text, textX + LABEL, ly, { width: textW - LABEL });
            ly = d.y + 5;
        }
        if (day.notes) { d.font(R).fontSize(8.5).fillColor(MUTED).text(day.notes, textX, ly + 1, { width: textW }); }
        y += bodyH + 10;
        if (strip.length) {
            const gap = 8, sw = (CWD - PAD * 2 - gap * (strip.length - 1)) / strip.length;
            strip.forEach((im, k) => pdf.photo(im, CX + PAD + k * (sw + gap), y, sw, stripH, 10));
        }
        d.y = y0 + cardH + 16; d.x = M;
    }
};

const optionTotals = (q: any, o: any) => quoteTotals(Array.isArray(o.lines) ? o.lines : [], {
    discount: Number(q.discount || 0), billingMode: q.billing_mode, gstPercent: Number(q.gst_percent), tcsPercent: Number(q.tcs_percent),
    international: Boolean(q.is_international), travellers: Math.max(1, Number(q.adults || 0) + Number(q.children || 0)),
});

/** Option price cards, the chosen one filled with the brand colour. */
const priceCards = (pdf: Pdf, q: any) => {
    const d = pdf.doc, options = Array.isArray(q.options) ? q.options : [];
    const chosen = q.chosen_option ?? 0, perRow = Math.min(3, options.length), gap = 12;
    const w = (CW - gap * (perRow - 1)) / perRow, h = 132;
    for (let start = 0; start < options.length; start += perRow) {
        pdf.need(h + 12);
        const y = d.y;
        options.slice(start, start + perRow).forEach((o: any, k: number) => {
            const i = start + k, t = optionTotals(q, o), on = i === chosen && options.length > 1 || options.length === 1;
            const x = M + k * (w + gap), fg = on ? "#ffffff" : INK, mute = on ? tint(pdf.c, 0.7) : MUTED;
            if (on) {
                d.save().fillOpacity(0.18).roundedRect(x + 1, y + 4, w, h, 16).fill(pdf.c).restore();
                d.save(); d.roundedRect(x, y, w, h, 16).clip(); d.rect(x, y, w, h).fill(pdf.c); pdf.dots(x + w - 54, y + h - 50, 6, 4, "#ffffff", 7, 0.3); d.restore();
            } else pdf.card(x, y, w, h, 16);
            d.font(SB).fontSize(7.5).fillColor(mute).text(options.length > 1 ? `OPTION ${i + 1}` : "PACKAGE", x + 16, y + 16, { characterSpacing: 1 });
            d.font(B).fontSize(11).fillColor(fg).text(o.name || `Option ${i + 1}`, x + 16, d.y + 1, { width: w - 32, lineBreak: false, ellipsis: true });
            d.font(B).fontSize(perRow === 3 ? 17 : 20).fillColor(fg).text(money(t.total), x + 16, y + 58, { width: w - 32, lineBreak: false });
            d.font(R).fontSize(8).fillColor(mute).text(`${money(t.per_person)} per person · all taxes`, x + 16, d.y, { width: w - 32, lineBreak: false, ellipsis: true });
            const bits = [`Package ${money(t.sell)}`, `GST ${money(t.gst)}`, t.tcs ? `TCS ${money(t.tcs)}` : ""].filter(Boolean).join("  ·  ");
            d.font(R).fontSize(7).fillColor(mute).text(bits, x + 16, y + h - 26, { width: w - 32, lineBreak: false, ellipsis: true });
            if (on && options.length > 1) {
                d.font(SB).fontSize(6.5);
                const tw = d.widthOfString("RECOMMENDED") + 14;
                d.roundedRect(x + w - tw - 12, y + 14, tw, 14, 7).fill("#ffffff");
                d.fillColor(pdf.c).text("RECOMMENDED", x + w - tw - 12, y + 17.5, { width: tw, align: "center", lineBreak: false, characterSpacing: 0.4 });
            }
        });
        d.y = y + h + 14; d.x = M;
    }
};

/** Simple table (vouchers). cols: [title, width, align]. */
const table = (pdf: Pdf, colsIn: [string, number, "left" | "right" | "center"][], rows: { cells: string[]; bold?: boolean; tint?: boolean }[]) => {
    const d = pdf.doc;
    const total = colsIn.reduce((s, c) => s + c[1], 0);
    const cols = colsIn.map(([t, w, a]) => [t, (w / total) * (CW - 20), a] as [string, number, "left" | "right" | "center"]);
    const drawHeader = () => {
        const y = d.y;
        d.roundedRect(M, y, CW, 22, 6).fill(tint(pdf.c, 0.9));
        let x = M + 10;
        for (const [t, w, a] of cols) { d.font(SB).fontSize(7.5).fillColor(shade(pdf.c, 0.25)).text(t.toUpperCase(), x, y + 7, { width: w - 10, align: a, characterSpacing: 0.4, lineBreak: false }); x += w; }
        d.y = y + 26;
    };
    drawHeader();
    for (const r of rows) {
        const h = Math.max(...r.cells.map((c, i) => d.font(r.bold ? SB : R).fontSize(9.5).heightOfString(c, { width: cols[i][1] - 10 }))) + 10;
        if (d.y + h > BOTTOM) { pdf.newPage(); drawHeader(); }
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
    const days = daysOf(x);
    const nights = Number(x.nights || 0);
    const pdf = new Pdf(res, brand, x.title, `${x.title}.pdf`);
    const d = pdf.doc;
    const q = quote ? (quote.toJSON ? quote.toJSON() : quote) : null;
    const end = x.start_date ? addDays(x.start_date, nights) : null;
    const imgs = await fetchAll([x.cover_image, ...days.flatMap((day: any) => [...picsOf(day), ...(day.items || []).flatMap(picsOf)])], 4);

    // ---- cover page
    pdf.noFooter.add(0);
    pdf.palm(W - 250, 70, 320);
    pdf.palm(-110, 470, 300);
    await brandRow(pdf, 34);
    d.font(B).fontSize(9).fillColor(pdf.c).text("ITINERARY", W - M - 140, 40, { width: 140, align: "right", characterSpacing: 2.5 });
    pdf.dots(W - M - 60, 60, 9, 4);
    // big duration headline
    const tag = durationTag(nights);
    let size = 104;
    d.font(B).fontSize(size);
    while (size > 50 && d.widthOfString(tag) > CW - 40) d.fontSize(--size);
    d.fillColor(pdf.c).text(tag, M, 86, { width: CW, align: "center", lineBreak: false });
    let y = 86 + size * 1.12;
    d.font(B).fontSize(17).fillColor(INK).text(x.title, M + 30, y, { width: CW - 60, align: "center", height: 48, ellipsis: true });
    y = d.y + 10;
    // "Travel to ..." search pill
    const pillText = x.destination ? `Travel to ${x.destination}` : "Your trip plan";
    d.font(SB).fontSize(10);
    const pw = Math.min(CW, d.widthOfString(pillText) + 52);
    const px = (W - pw) / 2;
    pdf.card(px, y, pw, 28, 14);
    pdf.icon("search", px + 14, y + 8, 12, pdf.c, 2.4);
    d.font(SB).fontSize(10).fillColor(INK).text(pillText, px + 34, y + 7.5, { width: pw - 44, lineBreak: false, ellipsis: true });
    y += 46;
    // collage
    const factsH = 60, bottomBand = 78;
    const colH = Math.max(200, H - bottomBand - factsH - 24 - y);
    collage(pdf, imgs, M, y, CW, colH, x.destination || "");
    pdf.dots(M - 18, y + colH - 50, 4, 8);
    y += colH + 18;
    // facts
    pdf.tiles([
        { icon: "calendar", label: "Travel dates", value: x.start_date ? dateRange(x.start_date, end) : "To be confirmed" },
        q && paxText(q) ? { icon: "users", label: "Travellers", value: paxText(q) } : { icon: "pin", label: "Destination", value: x.destination || "-" },
        { icon: "star", label: client?.name ? "Prepared for" : "Duration", value: client?.name || `${nights} nights / ${nights + 1} days` },
    ], y);
    // bottom band: PLAN • EXPERIENCE • ENJOY (writing below the bottom margin must not add a page)
    d.page.margins.bottom = 0;
    const by = H - 64;
    d.roundedRect(M, by, CW, 30, 15).fill(pdf.c);
    const words = ["PLAN", "EXPERIENCE", "ENJOY"];
    d.font(B).fontSize(9.5);
    const totalW = words.reduce((s, w) => s + d.widthOfString(w), 0) + 2 * 46;
    let wx = (W - totalW) / 2;
    words.forEach((w, k) => {
        d.fillColor("#ffffff").text(w, wx, by + 9.5, { lineBreak: false, characterSpacing: 1.5 });
        wx += d.widthOfString(w) + 23 + (w.length - 1) * 1.5 / 2;
        if (k < words.length - 1) { d.circle(wx, by + 15, 2.4).fill("#ffffff"); wx += 23; }
    });
    d.font(R).fontSize(7.5).fillColor(MUTED).text([brand.phone, brand.email].filter(Boolean).join("   ·   "), M, H - 26, { width: CW, align: "center", lineBreak: false });
    d.page.margins.bottom = 56;

    // ---- day by day
    pdf.newPage();
    if (days.length) {
        pdf.section("Trip at a glance", `${plural(days.length, "day")}${x.destination ? ` in ${x.destination}` : ""}${x.start_date ? ` · ${dateRange(x.start_date, end)}` : ""}`, "calendar", 48);
        glance(pdf, days, x.start_date || null);
        pdf.section("Day by day", undefined, "pin", 140);
        await dayPlan(pdf, days, x.start_date || null, true);
    }
    const pax = q ? Number(q.adults || 0) + Number(q.children || 0) : 0;
    if (q && Array.isArray(q.options) && q.options.length) {
        pdf.section("Price", `${plural(pax || 1, "traveller")} · valid until ${q.valid_until ? fmtDate(q.valid_until) : "further notice"} · all taxes included`, "wallet", 146);
        priceCards(pdf, q);
    }
    const inc = listOf(x.inclusions), exc = listOf(x.exclusions);
    if (inc.length || exc.length) { pdf.section("What's included", undefined, "check", 130); pdf.twoLists({ title: "Included", items: inc.length ? inc : ["As per the day plan"] }, { title: "Not included", items: exc.length ? exc : ["Anything not listed as included"] }); }
    if (x.cancellation_policy) pdf.paragraphBox("Cancellation policy", x.cancellation_policy, "shield");
    if (x.terms) pdf.paragraphBox("Terms", x.terms, "info");
    pdf.closing(x.destination);
    pdf.finish();
};

// ---------------------------------------------------------------- quotation

export const quotePdf = async (res: Response, brand: Brand, quote: any, it: any | null, client: { name?: string | null; phone?: string | null; email?: string | null } | null, issued: string) => {
    const q = quote.toJSON ? quote.toJSON() : quote;
    const x = it ? (it.toJSON ? it.toJSON() : it) : null;
    const days = x ? daysOf(x) : [];
    const nights = Number(x?.nights || 0);
    const pdf = new Pdf(res, brand, `Quotation ${q.number}`, `Quote-${q.number}.pdf`);
    const d = pdf.doc;
    const pax = Number(q.adults || 0) + Number(q.children || 0);

    // ---- header: brand + QUOTATION
    pdf.palm(W - 210, -30, 230, INK, 0.04);
    await brandRow(pdf, 30);
    d.font(B).fontSize(24).fillColor(pdf.c).text("QUOTATION", W - M - 220, 28, { width: 220, align: "right", lineBreak: false, characterSpacing: 1 });
    d.font(SB).fontSize(8.5).fillColor(MUTED).text(`No. ${q.number}${q.version > 1 ? ` (v${q.version})` : ""}`, W - M - 220, 60, { width: 220, align: "right", lineBreak: false });
    // meta chips
    let y = 84;
    const chips: [string, string][] = [["Issued", fmtDate(issued)], ["Valid until", q.valid_until ? fmtDate(q.valid_until) : "-"]];
    let cx = W - M;
    for (const [k, v] of chips.reverse()) {
        d.font(SB).fontSize(8);
        const w = d.widthOfString(`${k}  ${v}`) + 20;
        cx -= w;
        d.roundedRect(cx, y, w, 20, 10).fill(tint(pdf.c, 0.9));
        d.font(R).fontSize(8).fillColor(MUTED).text(k, cx + 10, y + 5.5, { lineBreak: false, continued: true }).font(SB).fillColor(shade(pdf.c, 0.2)).text(`  ${v}`, { lineBreak: false });
        cx -= 8;
    }
    pdf.dots(M, y + 4, 12, 3);
    y += 32;
    // ---- hero
    const heroH = 200;
    const hero = await fetchImage(x?.cover_image) || (await fetchAll(days.flatMap(picsOf), 1))[0] || null;
    d.save();
    d.roundedRect(M, y, CW, heroH, 20).clip();
    if (hero) {
        try { d.image(hero, M, y, { cover: [CW, heroH], align: "center", valign: "center" }); } catch { d.rect(M, y, CW, heroH).fill(pdf.c); }
        const grad = d.linearGradient(0, y + heroH * 0.25, 0, y + heroH);
        grad.stop(0, "#000000", 0).stop(1, "#000000", 0.72);
        d.rect(M, y, CW, heroH).fill(grad);
    } else {
        d.rect(M, y, CW, heroH).fill(pdf.c);
        pdf.palm(W - M - 230, y - 20, 260, "#ffffff", 0.14);
        pdf.dots(W - M - 120, y + 20, 12, 5, "#ffffff", 8, 0.3);
    }
    d.restore();
    const tag = x ? durationTag(nights) : "";
    if (tag) {
        d.font(B).fontSize(11);
        const tw = d.widthOfString(tag) + 22;
        d.roundedRect(M + 20, y + 18, tw, 24, 12).fill("#ffffff");
        d.fillColor(pdf.c).text(tag, M + 20, y + 23.5, { width: tw, align: "center", lineBreak: false });
    }
    if (x?.destination) { pdf.icon("pin", M + 20, y + heroH - 92, 12, "#ffffff", 2.2); d.font(SB).fontSize(9).fillColor("#ffffff").text(x.destination.toUpperCase(), M + 37, y + heroH - 92, { characterSpacing: 1.2, lineBreak: false }); }
    d.font(B).fontSize(22).fillColor("#ffffff").text(q.title || "Trip quotation", M + 20, y + heroH - 74, { width: CW - 130, height: 34, ellipsis: true, lineBreak: false });
    d.font(R).fontSize(10).fillColor("#f3f4f6").text([x ? `${nights} nights / ${nights + 1} days` : "", paxText(q)].filter(Boolean).join("   ·   "), M + 20, y + heroH - 40, { width: CW - 130, lineBreak: false, ellipsis: true });
    pdf.badge("plane", W - M - 34, y + heroH - 34, 16, pdf.c, true);
    pdf.badge("camera", W - M - 74, y + heroH - 34, 16, pdf.c, true);
    y += heroH + 14;
    // ---- facts
    pdf.tiles([
        { icon: "users", label: "Prepared for", value: client?.name || "Valued guest", sub: client?.phone || client?.email || "" },
        { icon: "calendar", label: "Travel dates", value: x?.start_date ? dateRange(x.start_date, addDays(x.start_date, nights)) : "To be confirmed", sub: x?.start_date ? `${weekday(x.start_date)} to ${weekday(addDays(x.start_date, nights))}` : "" },
        { icon: "moon", label: "Duration", value: x ? `${nights}N / ${nights + 1}D` : "-", sub: days.length ? plural(days.length, "day") + " planned" : "" },
        { icon: "users", label: "Travellers", value: plural(pax || 1, "guest"), sub: paxText(q) },
    ], y);

    // ---- price
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length > 1) {
        pdf.section("Choose your option", `${options.length} options · total for ${plural(pax || 1, "traveller")}, all taxes included`, "star", 146);
        priceCards(pdf, q);
    }
    for (const [oi, o] of options.entries()) {
        const t = optionTotals(q, o);
        pdf.section(options.length > 1 ? `Option ${oi + 1}: ${o.name}` : "Price details", "What your package includes", "wallet", 90);
        // services list
        const lines = Array.isArray(o.lines) ? o.lines : [];
        const rows = lines.map((l: any) => {
            const base = Number(l.unit_cost) * Number(l.qty || 1) * Math.max(1, Number(l.nights || 0));
            const sell = base + (l.markup_type === "flat" ? Number(l.markup_value) : base * Number(l.markup_value) / 100);
            const qty = `${l.qty} × ${Number(l.nights) > 0 ? plural(Number(l.nights), "night") : "1"}`.replace(/ × 1$/, "");
            return { type: l.service_type, text: l.description || ITEM_LABEL[l.service_type] || "Service", qty: Number(l.nights) > 0 || Number(l.qty) > 1 ? qty : "", amount: money(sell) };
        });
        const descW = CW - 46 - 90 - 90;
        for (const [ri, r] of rows.entries()) {
            const th = d.font(SB).fontSize(9.5).heightOfString(r.text, { width: descW });
            const h = Math.max(38, th + 22);
            pdf.need(h + 4);
            const ry = d.y, color = ITEM_COLOR[r.type] || ITEM_COLOR.other;
            if (ri % 2 === 0) d.roundedRect(M, ry, CW, h, 10).fill(SOFT);
            pdf.softBadge(ITEM_ICON[r.type] || "ticket", M + 20, ry + h / 2, 11, color);
            d.font(SB).fontSize(7).fillColor(color).text((ITEM_LABEL[r.type] || "Service").toUpperCase(), M + 40, ry + (h - th - 11) / 2, { width: descW, characterSpacing: 0.5, lineBreak: false });
            d.font(SB).fontSize(9.5).fillColor(INK).text(r.text, M + 40, d.y, { width: descW });
            d.font(R).fontSize(8.5).fillColor(MUTED).text(r.qty, M + 46 + descW, ry + h / 2 - 6, { width: 86, align: "center", lineBreak: false });
            d.font(SB).fontSize(10).fillColor(INK).text(r.amount, W - M - 100, ry + h / 2 - 7, { width: 88, align: "right", lineBreak: false });
            d.y = ry + h + 2;
        }
        d.y += 10;
        // per-person highlight (left) + totals (right)
        const totals: [string, string, boolean?][] = [
            ...(t.discount ? [["Discount", `– ${money(t.discount)}`] as [string, string]] : []),
            ["Package price", money(t.sell)],
            [`GST ${Number(q.gst_percent)}%${q.billing_mode === "margin" ? " (on service charge)" : ""}`, money(t.gst)],
            ...(t.tcs ? [[`TCS ${Number(q.tcs_percent)}% (overseas)`, money(t.tcs)] as [string, string]] : []),
        ];
        const boxH = 30 + totals.length * 19 + 42;
        pdf.need(boxH + 10);
        const by = d.y, rw = 272, lw = CW - rw - 12, rx = M + lw + 12;
        // left
        d.save(); d.roundedRect(M, by, lw, boxH, 16).clip(); d.rect(M, by, lw, boxH).fill(tint(pdf.c, 0.92)); pdf.dots(M + lw - 60, by + boxH - 34, 7, 4); d.restore();
        d.font(SB).fontSize(7.5).fillColor(shade(pdf.c, 0.2)).text("PER PERSON", M + 18, by + 18, { characterSpacing: 1.2 });
        d.font(B).fontSize(24).fillColor(pdf.c).text(money(t.per_person), M + 18, d.y + 2, { width: lw - 36, lineBreak: false });
        d.font(R).fontSize(8.5).fillColor(BODY).text(`for ${plural(pax || 1, "traveller")}, taxes included`, M + 18, d.y + 2, { width: lw - 36 });
        pdf.icon("clock", M + 18, by + boxH - 28, 11, MUTED, 2.2);
        d.font(R).fontSize(8).fillColor(MUTED).text(`Price valid until ${q.valid_until ? fmtDate(q.valid_until) : "further notice"}`, M + 34, by + boxH - 27.5, { width: lw - 50, lineBreak: false, ellipsis: true });
        // right
        pdf.card(rx, by, rw, boxH, 16);
        let ty = by + 18;
        for (const [k, v] of totals) {
            d.font(R).fontSize(9).fillColor(BODY).text(k, rx + 16, ty, { width: rw - 120, lineBreak: false, ellipsis: true });
            d.font(SB).fontSize(9).fillColor(INK).text(v, rx + rw - 116, ty, { width: 100, align: "right", lineBreak: false });
            ty += 19;
        }
        d.roundedRect(rx + 8, by + boxH - 44, rw - 16, 36, 12).fill(pdf.c);
        d.font(B).fontSize(10.5).fillColor("#ffffff").text("Total payable", rx + 20, by + boxH - 32.5, { lineBreak: false });
        d.font(B).fontSize(13).fillColor("#ffffff").text(money(t.total), rx + rw - 136, by + boxH - 34, { width: 116, align: "right", lineBreak: false });
        d.y = by + boxH + 14; d.x = M;
    }
    if (q.notes) pdf.paragraphBox("Notes", q.notes, "info");

    // ---- how to pay
    const payCols: { icon: string; title: string; text: string }[] = [];
    if (brand.upi) payCols.push({ icon: "wallet", title: "UPI", text: brand.upi });
    if (brand.bank) payCols.push({ icon: "landmark", title: "Bank transfer", text: brand.bank });
    if (brand.gstin) payCols.push({ icon: "passport", title: "GSTIN", text: brand.gstin });
    pdf.section("How to pay", "Pay 30% to confirm. The balance is due as per your invoice, before travel.", "coins", payCols.length ? 110 : 0);
    if (payCols.length) {
        const gap = 10, w = (CW - gap * (payCols.length - 1)) / payCols.length;
        const h = Math.max(...payCols.map((p) => d.font(R).fontSize(8.5).heightOfString(p.text, { width: w - 28 }))) + 62;
        pdf.need(h + 8);
        const py = d.y;
        payCols.forEach((p, k) => {
            const px = M + k * (w + gap);
            pdf.card(px, py, w, h, 14);
            pdf.softBadge(p.icon, px + 26, py + 24, 12);
            d.font(B).fontSize(10).fillColor(INK).text(p.title, px + 46, py + 18, { width: w - 56, lineBreak: false });
            d.font(R).fontSize(8.5).fillColor(BODY).text(p.text, px + 14, py + 46, { width: w - 28 });
        });
        d.y = py + h + 12; d.x = M;
    }

    // ---- day plan and policies
    if (days.length) {
        pdf.section("Your day plan", undefined, "pin", 140);
        await dayPlan(pdf, days, x.start_date || null, false);
        const inc = listOf(x.inclusions), exc = listOf(x.exclusions);
        if (inc.length || exc.length) { pdf.section("What's included", undefined, "check", 130); pdf.twoLists({ title: "Included", items: inc.length ? inc : ["As per the day plan"] }, { title: "Not included", items: exc.length ? exc : ["Anything not listed as included"] }); }
        if (x.cancellation_policy) pdf.paragraphBox("Cancellation policy", x.cancellation_policy, "shield");
    }
    pdf.paragraphBox("Please note", "Prices depend on availability when you book and can change until the booking is confirmed with a payment. Supplier costs are not shown.", "info");
    pdf.closing(x?.destination);
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
