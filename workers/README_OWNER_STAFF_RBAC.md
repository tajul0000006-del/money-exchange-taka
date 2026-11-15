# FastMoney Owner & Staff RBAC API

This is an isolated first-stage RBAC Worker. It does not replace or modify the current exchange Admin Worker, and it does not change wallet balances or financial operations.

## Deploy as a NEW Cloudflare Worker

1. Create a Worker named `fastmoney-admin-rbac`.
2. Copy the complete source from `workers/fastmoney-admin-rbac.js`.
3. Add these Worker secrets:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: the existing Firebase service-account JSON (keep it secret).
   - `FIREBASE_WEB_API_KEY`: the Firebase Web API key for project `moneyexchangetaka`.
   - `OWNER_UID`: the existing Owner Firebase UID.
   - `ALLOWED_ORIGINS`: comma-separated exact origins that host the Admin Panel, for example the deployed FastMoney website origin. Do not use `*`.
4. Deploy only this new Worker and test `GET /api/health`.

## API

All routes except `GET /api/health` require a Firebase ID token in `Authorization: Bearer <token>`. Accounts must be email-verified and not disabled.

- `GET /api/admin/me`: returns the signed-in account's role and permission list.
- `GET /api/admin/permissions`: returns available staff roles.
- `GET /api/admin/staff`: Owner only; lists staff records.
- `POST /api/admin/staff`: Owner only; creates a staff record. JSON body: `{"uid":"FIREBASE_AUTH_UID","email":"staff@example.com","role":"exchange_manager"}`.
- `PATCH /api/admin/staff/{uid}`: Owner only; update role and/or active status. JSON body example: `{"role":"payment_reviewer","active":true}` or `{"active":false}`.

Allowed roles:
- `exchange_manager`: read and update exchange requests.
- `payment_reviewer`: read and update exchange requests.
- `support_staff`: read requests and send notifications.
- `finance_viewer`: read requests and activity.

The current first-stage API exposes staff registry and identity/permission information only. The permission map is groundwork; it does NOT yet authorize the existing exchange-request, notification, settings, wallet, deposit, or withdrawal routes. Those existing routes must be migrated into the same server-side authorization layer before staff can safely use them. Keep the old Admin Worker unchanged until that migration and end-to-end tests are complete.

## Firestore

The Worker writes:
- `adminRoles/{uid}`: role, active flag, email, createdBy, createdAt, updatedAt.
- `adminActivity/{auto-id}`: actor, action, target UID, limited details, timestamp.

Firestore Security Rules can continue denying client writes to these collections. The Worker uses the service account and does not require loosening client rules.

## Important safety notes

- Never share or paste service-account private keys in chat or source control.
- Only `OWNER_UID` is treated as Owner. This Worker intentionally does not trust the legacy `ADMIN_UIDS` allowlist.
- The Owner must copy the staff member's Firebase Authentication UID from Firebase Console. Creating a staff record does not create a Firebase account.
- Do not delete the old Worker, change its secrets, or deploy this code over it.
- Do not enable deposits, withdrawals, wallet balance edits, or money transfers as part of this RBAC stage.

## Admin Panel connection

The Admin Panel branch now contains an Owner-only Staff Management screen and calls:

- `https://fastmoney-admin-rbac.taijulsheikh60.workers.dev/api/admin/me`
- `GET/POST /api/admin/staff`
- `PATCH /api/admin/staff/{uid}`

Create the Cloudflare Worker with the exact name `fastmoney-admin-rbac` under the same Cloudflare account so the configured workers.dev hostname matches. Set `ALLOWED_ORIGINS` to the exact origin serving the Admin Panel (for the current public Worker deployment, this is `https://money-exchange-taka.taijulsheikh60.workers.dev`; add any other actual admin-panel origin only if it is used). Then deploy and test the health endpoint, followed by Owner `/api/admin/me` and staff list/create/update tests. Do not merge this branch into production until these tests pass.
