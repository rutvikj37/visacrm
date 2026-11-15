import { Request } from "express";

/**
 * Multi-tenant helpers.
 *
 * Every agency (Agent with role "agent") is a tenant. Students belong to exactly
 * one agency, so the same phone number can exist once per agency without one
 * agency ever seeing another agency's students.
 *
 * The student portal sends the agency it is running for (resolved from its
 * subdomain via /agent/get_agency) in the `x-agency-uuid` header, or as
 * `agency_uuid` in the body.
 */
export const getAgencyUuidFromRequest = (req: Request): string | null => {
    const fromHeader = req.headers["x-agency-uuid"];
    const value = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) || req.body?.agency_uuid || req.query?.agency_uuid;
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 64 ? trimmed : null;
};

/** Where-clause fragment that limits a User (student) query to the request's agency. */
export const studentAgencyScope = (req: Request): { agency_uuid?: string } => {
    const agencyUuid = getAgencyUuidFromRequest(req);
    return agencyUuid ? { agency_uuid: agencyUuid } : {};
};
