# Deploy FastMoney Core API

This Worker source is in `workers/fastmoney-core-api.js`.

## Before replacing the Worker code

The existing Cloudflare Worker must have these two secrets configured under **Settings → Variables and Secrets**:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — the Firebase service-account JSON as a Secret.
- `OWNER_UID` — the owner Firebase Auth UID as a Secret.

Never paste the service-account JSON/private key into GitHub or chat.

## Deploy

1. Open the Cloudflare dashboard and select the `fastmoney-core-api` Worker.
2. Open **Edit code**.
3. Open this repository file: `workers/fastmoney-core-api.js`.
4. Copy the entire file and replace all code in the Worker editor.
5. Select **Deploy**.
6. Do not change or remove the two existing Secrets.

## Endpoints

- `GET /api/health` — Worker and service-account token check.
- `GET /api/firestore/check` — Firestore read check.
- `GET /api/auth/check` — verifies the signed-in Firebase user token.
- `POST /api/account/bootstrap` — initializes a verified user's profile/account registry/wallet. Requires `Authorization: Bearer FIREBASE_ID_TOKEN`.
- `GET /api/wallet/me` — returns only the signed-in user's wallet. Requires the same Bearer token.

The bootstrap endpoint preserves an existing profile Account ID and existing wallet. If the profile has no Account ID, it creates a unique 15-digit ID. New wallets start at zero for BDT, USD, and USDT. The endpoint is idempotent and uses Firestore commit preconditions to avoid partial account creation.

## Important

This is the first secure account/wallet foundation only. It does not yet implement deposits, withdrawals, transfers, exchange approvals, or real payment processing. Do not credit real funds until the server-side ledger and admin approval flows are completed and tested.
