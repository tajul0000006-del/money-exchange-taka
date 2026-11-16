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
- `GET /api/pay-in/methods` — lists enabled Pay In methods and their public payment instructions.
- `POST /api/pay-in/requests` — creates a private pending deposit request for the signed-in user. Body: `{ "methodId", "currency", "amount", "transactionReference", "sender", "proofUrl" }`.
- `GET /api/pay-in/requests/me` — returns only the signed-in user's Pay In history.
- `GET /api/admin/pay-in/settings` — Owner-only payment method settings.
- `PUT /api/admin/pay-in/settings` — Owner-only method configuration. Body: `{ "settings": { "methods": [...] } }`.
- `GET /api/admin/pay-in/requests` — Owner-only deposit queue.
- `POST /api/admin/pay-in/decision` — Owner-only approval/rejection. Body: `{ "uid", "requestId", "decision": "approve" | "reject" }`.

The bootstrap endpoint preserves an existing profile Account ID and existing wallet. If the profile has no Account ID, it creates a unique 15-digit ID. New wallets start at zero for BDT, USD, and USDT. The endpoint is idempotent and uses Firestore commit preconditions to avoid partial account creation.


## Pay In configuration

Configure methods from Admin Dashboard → Deposit Management / Payment Methods. Each method must have:
- unique lowercase `id` (2–40 chars)
- `name`
- `type`: `crypto`, `local`, or `bank`
- `currency`: `BDT`, `USD`, or `USDT`
- `address` (wallet address, account number, or payment ID)
- optional `network`, `accountType`, and `instruction`
- `enabled`: `true` or `false`

Example:
```json
[
  {
    "id": "bkash-personal",
    "name": "bKash Personal",
    "type": "local",
    "currency": "BDT",
    "network": "",
    "accountType": "Personal",
    "address": "Set your real receiving number in Admin",
    "instruction": "Send Money only. Enter the transaction ID after payment.",
    "enabled": false
  },
  {
    "id": "usdt-trc20",
    "name": "USDT (TRC20)",
    "type": "crypto",
    "currency": "USDT",
    "network": "TRON / TRC20",
    "accountType": "Deposit address",
    "address": "Set your verified wallet address in Admin",
    "instruction": "Send USDT on TRC20 only. Wrong-network transfers may be lost.",
    "enabled": false
  }
]
```

The API stores user-scoped requests at `depositRequests/{uid}/items/{requestId}` and an admin queue at `payInQueue`. Firestore client rules deny direct writes; all financial writes are performed by the Core API using the service account. Approval atomically changes the request status, updates the user's wallet, and creates a ledger credit. A Firestore update-time precondition prevents two admins from approving the same request concurrently. Transaction references are reserved uniquely to block duplicate submissions.

## Important deployment and safety notes

- Deploy the updated `workers/fastmoney-core-api.js` to the existing `fastmoney-core-api` Worker. Keep the existing `FIREBASE_SERVICE_ACCOUNT_JSON` and `OWNER_UID` secrets.
- Deploy the updated site files (`dashboard.html` and `admin.js`) to the Cloudflare Pages/Worker site.
- Configure payment methods with real receiving details only after verifying the destination wallet/account. They are disabled by default until you set `enabled: true`.
- The Pay In flow is **manual review only**. It does not connect to a bank, mobile-money provider, or blockchain node and cannot automatically verify an on-chain transfer.
- The proof field currently accepts an HTTPS image URL; it is not a direct file uploader. Do not mark deposits approved without checking the provider/wallet transaction independently.
- Do not credit real funds until the updated Worker and website are deployed and tested with a small controlled test payment.
