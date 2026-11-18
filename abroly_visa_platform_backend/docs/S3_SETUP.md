# AWS S3 file storage

Every upload in the CRM can be stored in one S3 bucket, with a folder per agency.

## Folder layout

```
<bucket>/
  agencies/<agency_uuid>/
    student_docs/          student documents, offer letters        (private)
    subscription_proof/    payment proofs                           (private)
    reports/               generated Excel reports                  (private)
    service_files/         service order files                      (private)
    profiles/              logos, favicons, OG images, profile photos
    certificates/          agency certificates
    event_images/          agency event banners
    banners/ courses/ course_chapter_items/ testimonials/ service_info/ content_writing_files/
  platform/<folder>/       uploads made by the platform admin
```

S3 has no real folders: a folder appears as soon as the first file with that prefix is
uploaded, so a new agency gets its folder automatically on its first upload.

Which agency a file belongs to:

| Uploaded by | Folder |
|---|---|
| Agency owner or staff | their agency (`agent_uuid` from the login token) |
| Student | the student's agency (`users.agency_uuid`) |
| Case / university / service-order files | the agency that owns the case or order |
| Platform admin | `platform/` |

## How files are served

The bucket stays **fully private** (keep "Block all public access" on).

- **Private files** (`student_docs`, `subscription_proof`, `reports`, `service_files`): the API returns
  `/api/v1/files/<folder>/<key>?exp=..&sig=..`, a signed link that works for 1 hour. It checks the signature and
  redirects to an S3 presigned URL that lives 5 minutes.
- **Public images**: the API returns `/api/v1/media/<key>`, which redirects to a 1-hour S3 presigned URL.
  Set `AWS_S3_PUBLIC_URL` to a CloudFront domain (with Origin Access Control to the bucket) to link images directly instead.

The database stores the S3 key (`agencies/<uuid>/<folder>/<file>`). Rows created before S3 was switched on keep
their plain file name and are still served from local disk, so switching on S3 needs no data migration.
Old files can be copied to S3 later if you want to retire local storage.

## Setup

1. **Create the bucket** (S3 console → Create bucket), e.g. `techx-crm-files` in `ap-south-1` (Mumbai).
   - Keep *Block all public access* **on**.
   - Default encryption: SSE-S3 (the API also asks for AES256 on every upload).
   - Optional: turn on Versioning so deleted / replaced documents can be recovered.

2. **Create an IAM user (or EC2 instance role)** with only this policy (replace the bucket name):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::techx-crm-files/*"
       }
     ]
   }
   ```

   For an IAM user, create an access key (Security credentials → Create access key → "Application running outside AWS").

3. **Set the env vars** on the server (`.env`):

   ```
   AWS_S3_BUCKET=techx-crm-files
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

   On EC2 with an instance role, leave the two key variables empty.

4. Restart the API. New uploads now go to S3.

## Notes

- Without `AWS_S3_BUCKET` everything stays on local disk (`public/` and `storage/`) as before, which is handy for local development.
- `PUBLIC_API_URL` (or `LOCAL_PATH`) must point at the API so the generated links are correct.
- The AWS SDK warns that releases after January 2027 need Node.js 22+. Plan a Node upgrade on the server.
