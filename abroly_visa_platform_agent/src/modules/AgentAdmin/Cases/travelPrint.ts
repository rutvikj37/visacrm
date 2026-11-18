/**
 * Printable pages for tourist / business visa files: the day-by-day itinerary (on the agency's letterhead)
 * and the cover letter (plain, signed by the applicant or their company). Opens a print window; the
 * browser's "Save as PDF" turns it into a PDF. Same file in the agency panel and the client portal.
 */
export type PrintAgency = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null; logo?: string | null; color?: string | null };

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const nl = (v: any) => esc(v).replace(/\n/g, "<br>");
export const longDate = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(`${v}T00:00:00`);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const page = (title: string, body: string, color = "#1f2937") => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12.5px; line-height: 1.55; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${color}; padding-bottom: 10px; margin-bottom: 18px; }
  .head img { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; }
  .head .n { font-size: 18px; font-weight: 700; color: ${color}; }
  .head .s { font-size: 11px; color: #4b5563; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  .muted { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; text-align: left; }
  th { background: #f3f4f6; font-size: 11.5px; }
  td.d { white-space: nowrap; width: 110px; font-weight: 600; }
  .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-top: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .letter { font-size: 13px; line-height: 1.7; white-space: normal; }
  .foot { margin-top: 22px; font-size: 10.5px; color: #9ca3af; }
</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;

const open = (html: string) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to print this document."); return; }
    w.document.open(); w.document.write(html); w.document.close();
};

const letterhead = (a: PrintAgency) => `<div class="head">${a.logo ? `<img src="${esc(a.logo)}" alt="">` : ""}<div><div class="n">${esc(a.name || "")}</div>
  <div class="s">${[a.address, a.phone, a.email].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ")}</div></div></div>`;

export const printItinerary = (docs: any, ctx: { client?: string | null; country?: string | null; visaType?: string | null; agency: PrintAgency }) => {
    const t = docs?.trip || {};
    const travellers = (t.travellers || []).filter((x: any) => x.name);
    const rows = (docs?.itinerary || []).filter((d: any) => d.date || d.city || d.plan);
    const flights = (docs?.flights || []).filter((f: any) => f.from || f.to);
    const body = `${letterhead(ctx.agency)}
  <h1>Travel itinerary - ${esc(t.destination || ctx.country || "")}</h1>
  <div class="muted">${esc(ctx.visaType || "")}${t.start_date ? ` · ${longDate(t.start_date)} to ${longDate(t.end_date)}` : ""}</div>
  <div class="box grid">
    <div><b>Applicant:</b> ${esc(travellers[0]?.name || ctx.client || "")}</div>
    <div><b>Passport:</b> ${esc(travellers[0]?.passport_no || "-")}</div>
    <div><b>Purpose:</b> ${esc(({ tourism: "Tourism", business: "Business", family: "Visiting family", conference: "Conference / trade fair" } as any)[t.purpose] || "Tourism")}</div>
    <div><b>Departure from:</b> ${esc(t.from_city || "-")}</div>
    ${travellers.length > 1 ? `<div style="grid-column:1/-1"><b>Travelling with:</b> ${travellers.slice(1).map((x: any) => `${esc(x.name)}${x.relation ? ` (${esc(x.relation)})` : ""}`).join(", ")}</div>` : ""}
    ${t.host ? `<div style="grid-column:1/-1"><b>${t.purpose === "business" || t.purpose === "conference" ? "Visiting" : "Host / contact"}:</b> ${nl(t.host)}</div>` : ""}
  </div>
  ${flights.length ? `<table><tr><th>Date</th><th>From</th><th>To</th><th>Flight</th></tr>${flights.map((f: any) => `<tr><td class="d">${esc(longDate(f.date))}</td><td>${esc(f.from)}</td><td>${esc(f.to)}</td><td>${esc(f.flight)}</td></tr>`).join("")}</table>` : ""}
  <table><tr><th>Date</th><th>City</th><th>Plan</th><th>Stay</th></tr>
  ${rows.map((d: any, i: number) => `<tr><td class="d">Day ${i + 1}<br><span class="muted" style="font-weight:400">${esc(longDate(d.date))}</span></td><td>${esc(d.city)}</td><td>${nl(d.plan)}</td><td>${nl(d.stay)}</td></tr>`).join("")}
  </table>
  <div class="foot">Prepared by ${esc(ctx.agency.name || "")} for the visa application. Hotel and flight reservations are enclosed separately.</div>`;
    open(page(`Itinerary - ${ctx.client || ""}`, body, ctx.agency.color || undefined));
};

export const printCoverLetter = (docs: any, ctx: { client?: string | null }) => {
    const c = docs?.cover_letter || {};
    const body = `<div class="letter">
  <div style="text-align:right">Date: ${esc(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}</div>
  <p>To,<br>${nl(c.addressed_to || "The Visa Officer")}</p>
  ${c.subject ? `<p><b>Subject: ${esc(c.subject)}</b></p>` : ""}
  <p>${nl(c.body || "")}</p>
  <p style="margin-top:28px">${nl(c.signed_by || `Yours sincerely,\n${ctx.client || ""}`)}</p>
  </div>`;
    open(page(`Cover letter - ${ctx.client || ""}`, body));
};
