import express from "express"
import { validateAgent } from "../../middleware/authMiddleware"
import TravelController from "../controller/TravelController"
import PublicTravelController from "../controller/PublicTravelController"

/**
 * Travel CRM: /api/v1/travel/...
 * validateAgent also checks the module for the path (itinerary, bookings, suppliers - services/modules.ts).
 */
const travelRoutes = express.Router()
const T: any = TravelController
const h = (name: string) => (req: any, res: any) => T[name](req, res)

travelRoutes.get("/summary", validateAgent, h("summary"))

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
travelRoutes.get("/bookings/:uuid", validateAgent, h("bookingDetails"))
travelRoutes.post("/bookings/:uuid/update", validateAgent, h("updateBooking"))
travelRoutes.post("/bookings/:uuid/services", validateAgent, h("addService"))
travelRoutes.post("/bookings/:uuid/travellers", validateAgent, h("addTraveller"))
travelRoutes.post("/bookings/:uuid/invoice", validateAgent, h("createInvoice"))

/** Public, no login: /api/v1/public/travel/... */
export const publicTravelRoutes = express.Router()
publicTravelRoutes.get("/itinerary/:token", (req, res) => PublicTravelController.itinerary(req, res))
publicTravelRoutes.post("/itinerary/:token", (req, res) => PublicTravelController.respond(req, res))

export default travelRoutes
