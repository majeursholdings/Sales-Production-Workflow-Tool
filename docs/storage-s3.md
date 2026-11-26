# Supabase Storage & S3 Protocol Setup

This project stores files in **Supabase Storage** (backed by S3). The browser never talks directly to Supabase; all uploads and reads go through authenticated Next.js routes on the server.

## Buckets

| Bucket | Visibility | Limit | Purpose |
| --- | --- | --- | --- |
| `company-assets` | Public | 1 MB | Document logos printed on quotes & invoices (`logo/...`). |
| `project-media` | **Private** | 10 MB | Internal photos organized by folder with role-based RLS policies. |

### `project-media` folder layout & RLS permissions

| Folder | Read access | Upload / update / delete access |
| --- | --- | --- |
| `furniture/` | Any active signed-in role | `templates.edit` + `quotes.view_prices` (MD, GM) |
| `parts/` | `materials.view`, `templates.view`, `work_orders.view`, or `purchase_orders.view` | `materials.edit` (Procurement, MD, GM) |
| `machines/` | `work_orders.view` or `materials.view` | `work_orders.edit_status` or `materials.edit` |
| `job-cards/` | `work_orders.view` | `work_orders.edit_status` (Production, MD, GM) |
| `cost-requests/` | `materials.view`, `quotes.create`, or `quotes.view` | `quotes.create` or `materials.edit` |

## How the app accesses storage

- **Upload:** `POST /api/storage/upload` validates the live session, role permissions, MIME type, and file size (≤ 10 MB, up to 6 photos per upload), then uploads via `supabase.storage.from("project-media").upload(...)` so Supabase RLS is enforced on every write.
- **Read:** Stored URLs use `/api/storage/<folder>/<filename>`. `GET /api/storage/[...path]` validates the live session (`getClaims()` + `sessionState()`) and downloads from the private bucket via the user's Supabase client so RLS is enforced on every read.

## Connecting via the S3-compatible protocol (CLI, rclone, backups, AWS SDK)

Supabase Storage exposes an S3-compatible endpoint for server-side tooling (bulk migrations, backups, `aws s3`, `rclone`, or `@aws-sdk/client-s3`).

### Production (`sale-production-workflow-tool`)

- **Endpoint:** `https://mdrwwsatijqlkfmcqaji.storage.supabase.co/storage/v1/s3`
- **Region:** `eu-west-1`
- **Path style:** `forcePathStyle: true` (required)
- **Credentials:** Generate an S3 Access Key ID + Secret Access Key in the Supabase Dashboard under **Storage → Settings → S3 Access Keys**:
  https://supabase.com/dashboard/project/mdrwwsatijqlkfmcqaji/storage/settings

> Keep S3 Access Keys server-only — they bypass RLS and have full access across all buckets. Do not use S3 Session Token auth because legacy `anon` keys are disabled on this project.

### Example: AWS CLI

```bash
AWS_ACCESS_KEY_ID="your-s3-access-key-id" \
AWS_SECRET_ACCESS_KEY="your-s3-secret-access-key" \
aws s3 ls \
  --endpoint-url https://mdrwwsatijqlkfmcqaji.storage.supabase.co/storage/v1/s3 \
  --region eu-west-1 \
  s3://project-media/
```

### Example: `@aws-sdk/client-s3` (server-side scripts only)

```ts
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
	forcePathStyle: true,
	region: process.env.SUPABASE_S3_REGION ?? "eu-west-1",
	endpoint: process.env.SUPABASE_S3_ENDPOINT,
	credentials: {
		accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
		secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
	},
});
```

### Local development (`supabase start`)

- **Endpoint:** `http://127.0.0.1:54321/storage/v1/s3`
- **Region:** `local`
- Credentials are printed by `supabase status`.
