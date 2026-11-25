import express from "express"
import { validateAgent } from "../../middleware/authMiddleware"
import TravelController from "../controller/TravelController"
import PublicTravelController from "../controller/PublicTravelController"
import { travelGuard } from "../../services/travelAccess"
import TravelPlusController, { publicCatalogue, publicPackage, publicPackageEnquiry, travelImageUpload } from "../controller/TravelPlusController"
import TravelFinanceController from "../controller/TravelFinanceController"
import TravelExtraController, { publicTripKit, publicTripKitDoc, publicTripVouchers, travelUpload } from "../controller/TravelExtraController"

/**
 * Travel CRM: /api/v1/travel/...
 * validateAgent also checks the module for the path (itinerary, bookings, suppliers - services/modules.ts).
 */
const travelRoutes = express.Router()
const T: any = TravelController
// every travel route: role permission matrix first (services/travelAccess.ts)
const h = (name: string) => (req: any, res: any) => travelGuard(req, res, () => T[name](req, res))

travelRoutes.get("/summary", validateAgent, h("summary"))
travelRoutes.get("/dashboard", validateAgent, h("dashboard"))

// pipeline, contacts, photos, PDFs, WhatsApp (TravelPlusController)
const P: any = TravelPlusController
const pl = (name: string) => (req: any, res: any) => travelGuard(req, res, () => P[name](req, res))
travelRoutes.get("/pipeline", validateAgent, pl("pipeline"))
travelRoutes.post("/pipeline/:uuid", validateAgent, pl("updateDeal"))
travelRoutes.get("/clients", validateAgent, pl("clients"))
travelRoutes.post("/media", validateAgent, travelImageUpload, pl("uploadImage"))
travelRoutes.get("/itineraries/:uuid/pdf", validateAgent, pl("itineraryPdf"))
travelRoutes.get("/quotes/:uuid/pdf", validateAgent, pl("quotePdf"))
travelRoutes.get("/bookings/:uuid/vouchers.pdf", validateAgent, pl("vouchersPdf"))
travelRoutes.post("/whatsapp/send", validateAgent, pl("sendWhatsapp"))
travelRoutes.get("/whatsapp/numbers", validateAgent, pl("whatsappNumbers"))

// settings, permissions, calendar link (settings are owner-only to save)
const X: any = TravelExtraController
const x = (name: string) => (req: any, res: any) => travelGuard(req, res, () => X[name](req, res))
const F: any = TravelFinanceController
const f = (name: string) => (req: any, res: any) => travelGuard(req, res, () => F[name](req, res))
travelRoutes.get("/settings", validateAgent, x("getSettings"))
travelRoutes.post("/settings", validateAgent, x("saveSettings"))

// reports and targets
travelRoutes.get("/reports", validateAgent, x("reports"))
travelRoutes.get("/reports/export", validateAgent, x("exportReport"))
travelRoutes.post("/targets", validateAgent, x("saveTargets"))

// client profile: preferences, family members, erase on request
travelRoutes.get("/clients/:id", validateAgent, x("clientProfile"))
travelRoutes.post("/clients/:id/prefs", validateAgent, x("saveClientPrefs"))
travelRoutes.post("/clients/:id/members", validateAgent, x("addMember"))
travelRoutes.post("/clients/:id/erase", validateAgent, x("eraseClient"))
travelRoutes.post("/clients/members/:uuid/update", validateAgent, x("updateMember"))
travelRoutes.post("/clients/members/:uuid/delete", validateAgent, x("deleteMember"))

// master library
travelRoutes.get("/library", validateAgent, h("listLibrary"))
travelRoutes.post("/library", validateAgent, h("saveLibrary"))
travelRoutes.post("/library/:uuid/update", validateAgent, h("saveLibrary"))
travelRoutes.post("/library/:uuid/delete", validateAgent, h("deleteLibrary"))

// suppliers and rate contracts (fixed paths before /:uuid)
travelRoutes.get("/suppliers", validateAgent, h("listSuppliers"))
travelRoutes.post("/suppliers", validateAgent, h("saveSupplier"))
travelRoutes.get("/suppliers/rates", validateAgent, h("searchRates"))
travelRoutes.post("/suppliers/rates/:uuid/delete", validateAgent, h("deleteRate"))
travelRoutes.get("/suppliers/:uuid", validateAgent, h("supplierDetails"))
travelRoutes.post("/suppliers/:uuid/update", validateAgent, h("saveSupplier"))
travelRoutes.post("/suppliers/:uuid/delete", validateAgent, h("deleteSupplier"))
travelRoutes.post("/suppliers/:uuid/rates", validateAgent, h("saveRate"))

// itineraries
travelRoutes.get("/itineraries", validateAgent, h("listItineraries"))
travelRoutes.post("/itineraries", validateAgent, h("createItinerary"))
travelRoutes.get("/itineraries/:uuid", validateAgent, h("itineraryDetails"))
travelRoutes.post("/itineraries/:uuid/update", validateAgent, h("updateItinerary"))
travelRoutes.post("/itineraries/:uuid/delete", validateAgent, h("deleteItinerary"))
travelRoutes.post("/itineraries/:uuid/share", validateAgent, h("shareItinerary"))

// quotations
travelRoutes.get("/quotes", validateAgent, h("listQuotes"))
travelRoutes.post("/quotes", validateAgent, h("createQuote"))
travelRoutes.get("/quotes/:uuid", validateAgent, h("quoteDetails"))
travelRoutes.post("/quotes/:uuid/update", validateAgent, h("updateQuote"))
travelRoutes.post("/quotes/:uuid/version", validateAgent, h("newQuoteVersion"))
travelRoutes.post("/quotes/:uuid/status", validateAgent, h("quoteStatus"))
travelRoutes.post("/quotes/:uuid/book", validateAgent, h("bookQuote"))

// packages
travelRoutes.get("/packages", validateAgent, h("listPackages"))
travelRoutes.post("/packages", validateAgent, h("savePackage"))
travelRoutes.post("/packages/:uuid/update", validateAgent, h("savePackage"))
travelRoutes.post("/packages/:uuid/delete", validateAgent, h("deletePackage"))

// bookings (fixed paths before /:uuid)
travelRoutes.get("/bookings", validateAgent, h("listBookings"))
travelRoutes.post("/bookings/services/:uuid/update", validateAgent, h("updateService"))
travelRoutes.post("/bookings/services/:uuid/delete", validateAgent, h("deleteService"))
travelRoutes.post("/bookings/services/:uuid/supplier_payment", validateAgent, h("supplierPayment"))
travelRoutes.post("/bookings/travellers/:uuid/update", validateAgent, h("updateTraveller"))
travelRoutes.post("/bookings/travellers/:uuid/delete", validateAgent, h("deleteTraveller"))
travelRoutes.get("/bookings/travellers/:uuid/reveal", validateAgent, h("revealTraveller"))
travelRoutes.post("/bookings/travellers/:uuid/save_to_profile", validateAgent, x("travellerToMember"))
travelRoutes.post("/bookings/documents/:uuid/delete", validateAgent, x("deleteDocument"))
travelRoutes.post("/credit_notes/:uuid/refund", validateAgent, x("recordRefund"))
travelRoutes.post("/bookings/services/:uuid/cancel", validateAgent, f("cancelService"))
travelRoutes.post("/bookings/services/:uuid/supplier_refund", validateAgent, f("supplierRefund"))
travelRoutes.get("/finance/payables", validateAgent, f("payables"))
travelRoutes.get("/finance/profit", validateAgent, f("profit"))
travelRoutes.get("/bookings/:uuid", validateAgent, h("bookingDetails"))
travelRoutes.get("/bookings/:uuid/documents", validateAgent, x("listDocuments"))
travelRoutes.get("/bookings/:uuid/finance", validateAgent, f("bookingFinance"))
travelRoutes.post("/bookings/:uuid/cancel", validateAgent, f("cancelBooking"))
travelRoutes.post("/bookings/:uuid/documents", validateAgent, travelUpload, x("uploadDocuments"))
travelRoutes.post("/bookings/:uuid/kit", validateAgent, x("tripKit"))
travelRoutes.get("/bookings/:uuid/credit_notes", validateAgent, x("listCreditNotes"))
travelRoutes.post("/bookings/:uuid/credit_note", validateAgent, x("createCreditNote"))
travelRoutes.post("/bookings/:uuid/travellers/from_member", validateAgent, x("travellerFromMember"))
travelRoutes.post("/bookings/:uuid/update", validateAgent, h("updateBooking"))
travelRoutes.post("/bookings/:uuid/services", validateAgent, h("addService"))
travelRoutes.post("/bookings/:uuid/travellers", validateAgent, h("addTraveller"))
travelRoutes.post("/bookings/:uuid/invoice", validateAgent, h("createInvoice"))

/** Public, no login: /api/v1/public/travel/... */
export const publicTravelRoutes = express.Router()
publicTravelRoutes.get("/itinerary/:token", (req, res) => PublicTravelController.itinerary(req, res))
publicTravelRoutes.post("/itinerary/:token", (req, res) => PublicTravelController.respond(req, res))
publicTravelRoutes.get("/calendar/:token", (req, res) => (TravelExtraController as any).calendarFeed(req, res))
publicTravelRoutes.get("/kit/:token", publicTripKit)
publicTravelRoutes.get("/packages/:agency", publicCatalogue)
publicTravelRoutes.get("/package/:slug", publicPackage)
publicTravelRoutes.post("/package/:slug", publicPackageEnquiry)
publicTravelRoutes.get("/itinerary/:token/pdf", (req, res) => PublicTravelController.pdf(req, res))
publicTravelRoutes.get("/kit/:token/doc/:docId", publicTripKitDoc)
publicTravelRoutes.get("/kit/:token/vouchers.pdf", publicTripVouchers)

export default travelRoutes
