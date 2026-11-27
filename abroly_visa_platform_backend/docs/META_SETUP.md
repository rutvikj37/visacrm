# Meta setup: Facebook / Instagram Lead Ads + WhatsApp

You do this **once for the whole platform**. After that, every agency connects its own
Facebook Pages with one click (or a Page access token), and its own WhatsApp number from **Lead Sources**.

Replace `https://api.yourdomain.com/api` below with your real `PUBLIC_API_URL`.

**Why agencies see “Facebook is not switched on”:** the platform Meta app credentials are empty.
`GET /crm/meta/status` returns `{ facebook: false }` until `META_APP_ID` + `META_APP_SECRET` + `PUBLIC_API_URL`
are set (env **or** Admin → **SaaS → Meta / Facebook**). Agencies can still paste a Page token and use
**Fetch last 7 days** without OAuth; real-time webhooks need the platform app + leadgen subscription.

---

## 0. Fastest enable path (TechX / production)

1. Ensure backend `.env` has `PUBLIC_API_URL=https://api.yourdomain.com/api` (deploy already sets this).
2. Open the **platform admin** panel → **SaaS → Meta / Facebook**.
3. Paste **App ID**, **App secret**, and a **webhook verify token** → Save.
4. Copy the OAuth redirect URI and webhook URL shown on that page into the Meta app dashboard (steps below).
5. In an agency panel → **Lead Sources → Facebook & Instagram Lead Ads → Connect Facebook Pages**.

Alternatively set env (takes priority over the admin UI):

```
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...
META_LOGIN_CONFIG_ID=...        # optional
META_GRAPH_VERSION=v21.0
```

Restart the backend after changing env. Admin UI saves apply within ~15 seconds (no restart).

---

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> → **Create app**.
2. Use case: **Other** → app type **Business**. Connect it to your company's Business portfolio.
3. In **App settings → Basic**:
   - copy **App ID** → `META_APP_ID`
   - copy **App secret** → `META_APP_SECRET`
   - fill **Privacy policy URL**, **Terms URL**, **App icon**, **Category** (needed for review)
   - **App domains**: your domain (e.g. `yourdomain.com`)

## 2. Facebook Login for Business

1. **Add product → Facebook Login for Business**.
2. **Settings → Valid OAuth Redirect URIs**:
   `https://api.yourdomain.com/api/v1/public/meta/oauth/callback`
3. Optional but recommended: **Configurations → Create configuration**
   - Login variation: *General*
   - Token type: **User access token**
   - Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `leads_retrieval`, `business_management`
   - Copy the **Configuration ID** → `META_LOGIN_CONFIG_ID`
   (Without it the app asks for the same permissions with the classic login dialog.)

## 3. Webhooks

1. **Add product → Webhooks**.
2. Choose object **Page** → **Subscribe to this object**:
   - Callback URL: `https://api.yourdomain.com/api/v1/public/meta/webhook`
   - Verify token: any random string → `META_WEBHOOK_VERIFY_TOKEN`
   - Then subscribe to the field **leadgen**.
3. (For WhatsApp numbers onboarded through *your* app in future) choose object
   **WhatsApp Business Account** with the same URL and token, field **messages**.

## 4. Backend `.env` (optional if using admin UI)

```
PUBLIC_API_URL=https://api.yourdomain.com/api
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...
META_LOGIN_CONFIG_ID=...        # optional
META_GRAPH_VERSION=v21.0
```

Or skip env and use **SaaS → Meta / Facebook** in the platform admin (App secret is stored encrypted).

Restart only if you changed `.env`. In the agency panel, **Lead Sources → Facebook & Instagram Lead Ads**
now shows **Connect Facebook Pages**. Agencies can also **Connect with Page access token** and
**Fetch last 7 days** without waiting for App Review (testers / system users).

## 5. Test before review (works immediately)

While the app is in **Development mode**, people with a role on the app (Admin / Developer /
Tester under **App roles**) can connect their own Pages:

1. Add yourself (and a test agency owner) under **App roles**.
2. In the agency panel → Lead Sources → **Connect Facebook Pages** → pick a Page.
3. Open the **Lead Ads Testing Tool**: <https://developers.facebook.com/tools/lead-ads-testing>
   → choose the Page and a form → **Create lead**.
4. The lead appears in the Lead Inbox within a few seconds (source: Facebook).
   If not, check **Lead Sources → Last problem** and the webhook's **Recent deliveries** in the Meta app.

## 6. App Review (needed before real agencies can connect)

**App Review → Permissions and features**, request **Advanced access** for:

| Permission | Why we need it (paste into the form) |
|---|---|
| `pages_show_list` | To list the Pages the agency owner chooses to connect. |
| `pages_manage_metadata` | To subscribe the selected Page to lead webhooks so new leads reach the agency's CRM. |
| `pages_read_engagement` | Required with the Page token to read Page details. |
| `leads_retrieval` | To read the lead form answers (name, phone, email, answers) and save them as a lead in the agency's CRM. |
| `business_management` | To access Pages that are owned by the agency's Business portfolio. |

Also complete **Business verification** (Business settings → Security centre).

Record a short screen video for the reviewer showing:
1. agency logs in → Lead Sources → **Connect Facebook Pages** → selects a Page,
2. a test lead created in the Lead Ads Testing Tool,
3. the lead appearing in the Lead Inbox with its answers.

Give reviewers a test agency login. Review usually takes **1–4 weeks**.
When approved, switch the app to **Live** mode.

---

## WhatsApp (per agency)

Each agency uses **its own WhatsApp Business number** with the WhatsApp Cloud API.
Instructions are shown in Lead Sources; in short:

1. The agency creates a Meta app (type Business) with the **WhatsApp** product and adds its number.
2. From **WhatsApp → API Setup** it copies the **Phone number ID** and **WhatsApp Business Account ID**.
3. **Business settings → System users** → generate a **permanent token** with
   `whatsapp_business_messaging` and `whatsapp_business_management`.
4. **App settings → Basic → App secret**.
5. Paste all four in Lead Sources → **Connect WhatsApp**. The CRM then shows a **webhook link**
   and **verify token** - paste them in the agency's Meta app under
   **WhatsApp → Configuration → Webhook** and subscribe to **messages**.

What happens then:
- by default a message from a new number creates a lead (source WhatsApp; click-to-WhatsApp ad name saved as campaign),
- or, if the number is set to **Review first** (`settings.auto_create_leads = false`), the chat stays in
  the WhatsApp inbox until staff taps **Add as lead** (or Dismiss),
- every incoming message is added to that lead's timeline (or pending chat while reviewing),
- the team can reply with **Send on WhatsApp** on the lead. WhatsApp only allows free text within
  **24 hours** of the student's last message; after that the CRM shows a clear message
  (approved template messages can be added later).

Later option: become a **Meta Tech Provider** and add *Embedded Signup*, so agencies connect
WhatsApp with one click instead of copying IDs. The webhook code already supports that
(the platform webhook handles the WhatsApp object too).

## Instagram DMs

Messages to an agency's Instagram business account become leads (source Instagram), later messages
go on the lead's timeline, and the team can reply with **Send on Instagram** on the lead.

Platform setup (once, in the same Meta app):
1. Add the **Instagram** product (Instagram API with Facebook Login / Messenger API for Instagram).
2. **Webhooks** → choose the **Instagram** object → same callback URL and verify token as above
   (`/api/v1/public/meta/webhook`) → subscribe to **messages**.
3. App Review: request **instagram_basic**, **instagram_manage_messages** and **pages_messaging**
   together with the Lead Ads permissions (screencast: open a lead from an Instagram DM and reply).
   If you use a Facebook Login *configuration* (`META_LOGIN_CONFIG_ID`), add these permissions to it.

Agency side: the Instagram account must be a Business or Creator account **linked to a Facebook Page**.
When the agency clicks **Connect Facebook Pages**, the linked Instagram account is connected too
(Lead Sources → Instagram DMs). If Meta refuses the messages subscription (permission not approved yet),
the card shows that reason.

Notes:
- A DM lead is known by its Instagram id until the person shares a phone number or email; a number
  or email in the first message is picked up automatically.
- Instagram allows replies only within **24 hours** of the person's last message.
