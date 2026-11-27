# Push lead sources: Google Ads, Justdial, Sulekha

Agencies set these up in **Lead Sources** (owner only, if their plan includes the source).
Each gets its own secret link; leads go through the same pipeline as every other source
(duplicate check by phone / email, auto-assign, score, notifications, welcome message).

| Source | Link | Method | Reply |
|---|---|---|---|
| Google Ads lead forms | `/api/v1/public/leads/google/:key` | POST JSON | `200 {}` |
| Justdial | `/api/v1/public/leads/justdial/:key` | GET or POST | text `RECEIVED` |
| Sulekha | `/api/v1/public/leads/sulekha/:key` | GET or POST (JSON / form) | `{ "success": true }` |

`PUBLIC_API_URL` in `.env` must be the public address of the API so the links shown to agencies are right.

## Google Ads
Google Ads → campaign → Assets → Lead form → **Lead delivery → Webhook integration**:
paste the **Webhook URL** and **Key** shown in Lead Sources, then **Send test data**.
The key is checked on every request (`google_key`); wrong key = 403. Test leads are tagged `test`.
`user_column_data` is mapped: FULL_NAME / FIRST_NAME + LAST_NAME, PHONE_NUMBER, EMAIL, CITY;
custom questions containing "country", "course" or "message" fill those fields, others are kept as extra details.
`lead_id` is stored so a retried delivery is not added twice.

## Justdial
The agency asks its Justdial account manager to enable the **Lead API / push URL** for its listing and
gives the Push URL. Accepted fields: `leadid, prefix, name, mobile, phone, email, category, city, area,
brancharea, pincode, date, time` (anything else is kept as extra details). `leadid` prevents duplicates.

## Sulekha
The agency asks its Sulekha relationship manager to push leads to its CRM URL. Accepted shapes:
a flat object, `{ "lead": {...} }`, `{ "data": {...} }` or `{ "leads": [...] }` (up to 50).
Common field names are understood (`LeadId`, `CustomerName`/`name`, `Mobile`/`phone`, `Email`, `City`,
`Need`/`ServiceName`/`Category`, `Description`); the rest are kept as extra details.

All three endpoints are rate limited (30 requests / minute per link and IP). **New link** in Lead Sources
replaces the URL (and the Google key) if a link leaks.
