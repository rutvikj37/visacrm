import { Request, Response } from "express";
import Agent from "../../model/Agent";
import CrmLead from "../../model/CrmLead";
import { Itinerary, Quotation } from "../../model/Travel";
import { publicFileUrl } from "../../helpers/storage";
import { logActivity } from "../../services/leadIngestion";
import { leadRecipients, notifyLater } from "../../services/notifications";
import { hasModule } from "../../services/modules";
import { renderItineraryPdf } from "./TravelPlusController";

/**
 * Public itinerary page (IT-05, IT-06): /api/v1/public/travel/itinerary/:token
 * A branded page the client opens from WhatsApp or email. They can print or save it as a PDF,
 * accept it, or ask for changes. No login; the token is a long random string.
 * Shows prices of the latest sent quote per person, never cost or margin.
 */

const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const nl = (v: any) => esc(v).replace(/\n/g, "<br>");
const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const safeColor = (c?: string | null) => (/^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? String(c) : "#0f5bd8");

const ICON: Record<string, string> = { hotel: "Stay", sightseeing: "Sightseeing", transfer: "Transfer", meal: "Meal", flight: "Flight", activity: "Activity", note: "Note" };

const load = async (token: string) => {
    if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
    const it: any = await Itinerary.findOne({ where: { share_token: token } });
    if (!it) return null;
    if (!(await hasModule(it.dataValues.agency_uuid, "itinerary"))) return null;
    const agency: any = await Agent.findOne({
        where: { uuid: it.dataValues.agency_uuid, role: "agent" },
        attributes: ["app_name", "username", "primary_color", "support_number", "support_email", "agency_address", "favicon_url"], raw: true,
    });
    return { it, agency };
};

/** Extra styles per itinerary theme (classic is the base). */
const THEMES: Record<string, string> = {
    classic: "",
    modern: `body{background:#f1f5f9}header{border-radius:20px;padding:28px 26px;background:linear-gradient(135deg,var(--brand),#111827)}.card{border:0;box-shadow:0 6px 24px rgba(15,23,42,.08);border-radius:18px}.badge{border-radius:999px;background:var(--brand);color:#fff}h2{text-transform:uppercase;letter-spacing:.06em;font-size:13px;color:var(--brand)}`,
    elegant: `body{font-family:Georgia,'Times New Roman',serif;background:#fbf8f3}header{background:#fff;color:var(--ink);border:1px solid #e8dfd0;flex-direction:column;text-align:center}header h1{font-size:28px;font-weight:normal;letter-spacing:.02em}header p{color:var(--muted)}.card{border-color:#e8dfd0}.badge{background:transparent;border:1px solid var(--brand);color:var(--brand)}h2{font-weight:normal;font-size:18px;border-bottom:1px solid #e8dfd0;padding-bottom:6px}`,
};
const page = (title: string, color: string, body: string, theme = "classic") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>
:root{--brand:${color};--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--bg:#f8fafc;--card:#fff}
*{box-sizing:border-box}body{margin:0;font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
.wrap{max-width:820px;margin:0 auto;padding:16px}
header{background:var(--brand);color:#fff;border-radius:16px;padding:20px 22px;display:flex;gap:14px;align-items:center}
header img{width:52px;height:52px;border-radius:12px;background:#fff;object-fit:contain}
header h1{margin:0;font-size:22px;line-height:1.25}header p{margin:2px 0 0;opacity:.9;font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-top:14px}
h2{font-size:16px;margin:0 0 10px}
.day{display:grid;grid-template-columns:64px 1fr;gap:14px;padding:14px 0;border-top:1px solid var(--line)}.day:first-of-type{border-top:0;padding-top:4px}
.badge{background:color-mix(in srgb,var(--brand) 12%,#fff);color:var(--brand);border-radius:10px;text-align:center;padding:6px 4px;font-weight:600;font-size:13px;height:fit-content}
.day h3{margin:0 0 4px;font-size:15px}.city{color:var(--muted);font-size:13px}
ul{margin:6px 0 0;padding-left:18px}li{margin:2px 0}.tag{color:var(--muted);font-size:12px;margin-right:4px}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.opt{border:1px solid var(--line);border-radius:12px;padding:12px}.opt b{font-size:20px;display:block}.opt small{color:var(--muted)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:620px){.cols{grid-template-columns:1fr}.day{grid-template-columns:52px 1fr}}
textarea{width:100%;min-height:80px;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button,.btn{border:0;border-radius:10px;padding:10px 16px;font:600 14px system-ui;cursor:pointer;text-decoration:none;display:inline-block}
.primary{background:var(--brand);color:#fff}.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.ok{background:#ecfdf5;border-color:#a7f3d0}.muted{color:var(--muted);font-size:13px}
footer{color:var(--muted);font-size:13px;text-align:center;padding:18px 0}
.cover{width:100%;max-height:340px;object-fit:cover;border-radius:16px;margin-top:14px;display:block}.dayimg{width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-top:8px}.thumbs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 2px}.thumb{width:72px;height:54px;object-fit:cover;border-radius:6px;display:block}
.gallery{display:grid;gap:6px;margin-top:8px}.gallery.g1{grid-template-columns:1fr}.gallery.g2{grid-template-columns:1fr 1fr}.gallery.g3{grid-template-columns:repeat(3,1fr)}.gallery img{width:100%;height:150px;object-fit:cover;border-radius:10px;display:block}.gallery.g1 img{height:220px}@media(max-width:620px){.gallery.g3{grid-template-columns:1fr 1fr}.gallery img{height:110px}}
${THEMES[theme] || ""}
@media print{.noprint{display:none!important}body{background:#fff}.card,header{break-inside:avoid}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="wrap">${body}</div></body></html>`;

class PublicTravelController {
    async itinerary(req: Request, res: Response) {
        try {
            const found = await load(String(req.params.token || ""));
            if (!found) return res.status(404).send(page("Not found", "#0f5bd8", `<div class="card"><h2>This link is not available</h2><p class="muted">Please ask your travel consultant for a new link.</p></div>`));
            const { it, agency } = found;
            const x = it.toJSON();
            const color = safeColor(agency?.primary_color);
            const name = agency?.app_name || agency?.username || "Your travel agency";
            const logo = agency?.favicon_url ? (String(agency.favicon_url).startsWith("http") ? agency.favicon_url : publicFileUrl("profiles", agency.favicon_url)) : null;
            const quote: any = await Quotation.findOne({ where: { agency_uuid: x.agency_uuid, itinerary_id: x.id, status: ["sent", "accepted"] }, order: [["version", "DESC"]] });
            const days = Array.isArray(x.days) ? x.days : [];
            const startMs = x.start_date ? Date.parse(`${x.start_date}T00:00:00Z`) : null;

            let pricing = "";
            if (quote) {
                const q = quote.toJSON();
                const pax = Math.max(1, Number(q.adults || 0) + Number(q.children || 0));
                const { quoteOptionTotals } = await import("../../services/travel");
                const opts = (Array.isArray(q.options) ? q.options : []).map((o: any) => {
                    const t = quoteOptionTotals({ ...q, adults: pax, children: 0 }, o);
                    return `<div class="opt"><small>${esc(o.name)}</small><b>${inr(t.total)}</b><small>${inr(t.per_person)} per person · ${pax} travellers${t.tcs ? " · incl. GST and TCS" : " · incl. GST"}</small></div>`;
                }).join("");
                if (q.design && q.design.show_price === false) pricing = ""; else pricing = `<div class="card"><h2>Price</h2><div class="opts">${opts}</div>${q.valid_until ? `<p class="muted">Valid until ${fmtDate(q.valid_until)}.</p>` : ""}</div>`;
            }

            const dayHtml = days.map((d: any, i: number) => {
                const when = startMs ? fmtDate(new Date(startMs + i * 864e5).toISOString().slice(0, 10)) : "";
                const pics = (x: any) => (Array.isArray(x?.images) && x.images.length ? x.images : x?.image ? [x.image] : []).filter((u: any) => /^https?:\/\//.test(String(u || ""))) as string[];
                const items = (Array.isArray(d.items) ? d.items : []).map((it2: any) => {
                    const ip = pics(it2);
                    return `<li><span class="tag">${esc(ICON[it2.type] || "")}</span>${esc(it2.text)}${ip.length ? `<div class="thumbs">${ip.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img class="thumb" src="${esc(u)}" alt=""></a>`).join("")}</div>` : ""}</li>`;
                }).join("");
                const dp = pics(d);
                const gallery = dp.length ? `<div class="gallery g${Math.min(dp.length, 3)}">${dp.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt=""></a>`).join("")}</div>` : "";
                return `<div class="day"><div class="badge">Day ${i + 1}</div><div><h3>${esc(d.title)}</h3><div class="city">${esc([d.city, when].filter(Boolean).join(" · "))}</div>${gallery}${items ? `<ul>${items}</ul>` : ""}${d.notes ? `<p class="muted">${nl(d.notes)}</p>` : ""}</div></div>`;
            }).join("");

            const block = (title: string, v: any) => (v ? `<div class="card"><h2>${title}</h2><div>${nl(v)}</div></div>` : "");
            const respond = x.status === "accepted"
                ? `<div class="card ok"><h2>You accepted this itinerary</h2><p class="muted">Your consultant will be in touch with the next steps.</p><p><a class="btn ghost" href="${esc(req.originalUrl.split("?")[0].replace(/\/$/, ""))}/pdf">Download PDF</a></p></div>`
                : `<form class="card noprint" method="post" action=""><h2>Happy with this plan?</h2>
                    ${x.status === "changes_requested" ? `<p class="muted">You asked for changes. Your consultant is updating the plan.</p>` : ""}
                    <textarea name="note" maxlength="2000" placeholder="Any changes you would like? (optional)"></textarea>
                    <div class="btns"><button class="primary" name="action" value="accept">Accept itinerary</button><button class="ghost" name="action" value="changes">Request changes</button><a class="btn ghost" href="${esc(req.originalUrl.split("?")[0].replace(/\/$/, ""))}/pdf">Download PDF</a></div></form>`;

            const body = `<header>${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div><h1>${esc(x.title)}</h1><p>${esc([x.destination, `${x.nights}N/${Number(x.nights) + 1}D`, x.start_date ? `from ${fmtDate(x.start_date)}` : ""].filter(Boolean).join(" · "))}</p><p>Prepared by ${esc(name)}</p></div></header>
                ${/^https?:\/\//.test(String(x.cover_image || "")) ? `<img class="cover" src="${esc(x.cover_image)}" alt="">` : ""}
                <div class="card"><h2>Day by day</h2>${dayHtml || `<p class="muted">The day plan is being prepared.</p>`}</div>
                ${pricing}
                <div class="cols">${block("Included", x.inclusions)}${block("Not included", x.exclusions)}</div>
                ${block("Cancellation policy", x.cancellation_policy)}${block("Terms", x.terms)}
                ${respond}
                <footer>${esc(name)}${agency?.support_number ? ` · ${esc(agency.support_number)}` : ""}${agency?.support_email ? ` · ${esc(agency.support_email)}` : ""}${agency?.agency_address ? `<br>${esc(agency.agency_address)}` : ""}</footer>`;
            res.setHeader("Content-Security-Policy", "default-src 'none'; img-src * data:; style-src 'unsafe-inline'; form-action 'self'");
            return res.status(200).send(page(x.title, color, body, x.theme || "classic"));
        } catch (error) {
            console.error("PublicTravelController.itinerary", error);
            return res.status(500).send("Something went wrong");
        }
    }

    /** GET /public/travel/itinerary/:token/pdf */
    async pdf(req: Request, res: Response) {
        try {
            const found = await load(String(req.params.token || ""));
            if (!found) return res.status(404).send("Not found");
            const { it } = found;
            const quote: any = await Quotation.findOne({ where: { agency_uuid: it.dataValues.agency_uuid, itinerary_id: it.dataValues.id, status: ["sent", "accepted"] }, order: [["version", "DESC"]] });
            return renderItineraryPdf(res, it, quote, it.dataValues.agency_uuid);
        } catch (error) {
            console.error("PublicTravelController.pdf", error);
            return res.status(500).send("Something went wrong");
        }
    }

    async respond(req: Request, res: Response) {
        try {
            const found = await load(String(req.params.token || ""));
            if (!found) return res.status(404).send("Not found");
            const { it } = found;
            const action = String(req.body?.action || "");
            const note = String(req.body?.note || "").replace(/\u0000/g, "").trim().slice(0, 2000) || null;
            if (it.dataValues.status !== "accepted" && ["accept", "changes"].includes(action)) {
                await it.update({ status: action === "accept" ? "accepted" : "changes_requested", client_note: note });
                const leadId = it.dataValues.crm_lead_id;
                if (leadId) {
                    const msg = action === "accept" ? `Client accepted the itinerary "${it.dataValues.title}"` : `Client asked for changes to "${it.dataValues.title}"`;
                    await logActivity(leadId, it.dataValues.agency_uuid, "portal", note ? `${msg}: ${note}` : msg, null);
                    const lead: any = await CrmLead.findByPk(leadId);
                    if (lead) {
                        notifyLater({
                            agencyUuid: it.dataValues.agency_uuid, recipientIds: await leadRecipients(it.dataValues.agency_uuid, lead.dataValues.assigned_to), type: "itinerary_response",
                            title: action === "accept" ? "Itinerary accepted" : "Itinerary changes requested", body: `${lead.dataValues.name || "Client"}: ${it.dataValues.title}`,
                            link: `/crm/leads/${lead.dataValues.uuid}`,
                        });
                    }
                }
            }
            return res.redirect(303, req.originalUrl.replace(/\/respond$/, ""));
        } catch (error) {
            console.error("PublicTravelController.respond", error);
            return res.status(500).send("Something went wrong");
        }
    }
}

export default new PublicTravelController();
