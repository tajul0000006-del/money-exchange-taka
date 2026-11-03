# MoneyExchangeTaka — Admin Exchange Requests Worker Patch

This patch adds the two API routes already called by `admin.js`:

- `GET /api/admin/requests?limit=50`
- `POST /api/admin/requests/status`

It uses the existing Worker helpers documented in `WORKER_CONTENT_API_PATCH.md`:
`verifyContentAdmin(request, env)`, `getGoogleAccessToken(env)`, and `json(data, status, allowedOrigin)`.

**Important:** This patch changes request status only. It does not credit/debit a wallet, transfer money, or mark a payment as completed.

## 1. Add helper functions

Paste this block before `/* ---------------- MAIN WORKER ---------------- */` (or before the main `fetch()` handler):

```js
/* ---------------- ADMIN EXCHANGE REQUESTS ---------------- */

const EXCHANGE_REQUESTS_PATH =
  "/databases/(default)/documents/exchangeRequests";

function firestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return firestoreFields(value.mapValue.fields || {});
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  return null;
}

function firestoreFields(fields = {}) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = firestoreValue(value);
  }
  return result;
}

function firestoreString(value) {
  return { stringValue: String(value) };
}

async function listAdminExchangeRequests(env, limit) {
  const token = await getGoogleAccessToken(env);
  const url =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}${EXCHANGE_REQUESTS_PATH}:runQuery`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "exchangeRequests" }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
        limit
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Admin request list Firestore error:", response.status, detail.slice(0, 500));
    throw new Error("Exchange request list could not be read");
  }

  const rows = await response.json();
  const requests = [];

  for (const row of rows) {
    const doc = row.document;
    if (!doc?.name) continue;

    const fields = firestoreFields(doc.fields || {});
    const documentId = doc.name.split("/").pop();
    const amount = fields.amount ?? "";
    const currency = fields.currency || "BDT";
    const direction = fields.direction || fields.requestType || "exchange";
    const trackingCode = fields.trackingCode || documentId;

    requests.push({
      documentId,
      requestId: trackingCode,
      trackingCode,
      customer: fields.contact || fields.proofEmail || fields.uid || "Guest",
      type: direction,
      amount: amount === "" ? "—" : `${amount} ${currency}`,
      status: fields.status || "pending",
      currency,
      direction,
      paymentMethod: fields.paymentMethod || "",
      contact: fields.contact || "",
      createdAt: fields.createdAt || null,
      // Additional safe request details for the existing Details dialog.
      ...fields
    });
  }

  return requests;
}

async function updateAdminExchangeRequestStatus(env, documentId, nextStatus, adminUid) {
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(documentId)) {
    throw new Error("Invalid request document ID");
  }
  if (!["approved", "rejected"].includes(nextStatus)) {
    throw new Error("Status must be approved or rejected");
  }

  const token = await getGoogleAccessToken(env);
  const documentUrl =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}${EXCHANGE_REQUESTS_PATH}/${encodeURIComponent(documentId)}`;

  // Read current status first. Only pending requests can be decided.
  const currentResponse = await fetch(documentUrl, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (currentResponse.status === 404) throw new Error("Exchange request not found");
  if (!currentResponse.ok) throw new Error("Could not verify current request status");

  const currentDoc = await currentResponse.json();
  const currentStatus = currentDoc.fields?.status?.stringValue || "pending";
  if (currentStatus !== "pending") {
    throw new Error(`Request is already ${currentStatus}; refresh the list before changing it`);
  }

  const updateUrl = documentUrl +
    "?updateMask.fieldPaths=status" +
    "&updateMask.fieldPaths=statusUpdatedAt" +
    "&updateMask.fieldPaths=statusUpdatedBy";

  const updateResponse = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        status: firestoreString(nextStatus),
        statusUpdatedAt: { timestampValue: new Date().toISOString() },
        statusUpdatedBy: firestoreString(adminUid)
      }
    })
  });

  if (!updateResponse.ok) {
    const detail = await updateResponse.text().catch(() => "");
    console.error("Admin request status Firestore error:", updateResponse.status, detail.slice(0, 500));
    throw new Error("Request status could not be updated");
  }

  return { documentId, status: nextStatus };
}
```

## 2. Add the GET route

Inside the main `fetch(request, env)` handler, after `const url = new URL(request.url);` and after the existing public routes, add this route. Keep it before the generic admin 501 fallback:

```js
if (request.method === "GET" && url.pathname === "/api/admin/requests") {
  try {
    const { role } = await verifyContentAdmin(request, env);
    const rawLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 50;
    const requests = await listAdminExchangeRequests(env, limit);
    return json({ ok: true, role, total: requests.length, requests }, 200, allowedOrigin);
  } catch (error) {
    const message = error?.message || "Request list failed";
    const status = /token|required|denied|verified|admin/i.test(message) ? 403 : 500;
    return json({ ok: false, error: message }, status, allowedOrigin);
  }
}
```

## 3. Add the POST route

Add this route before the generic admin GET fallback:

```js
if (request.method === "POST" && url.pathname === "/api/admin/requests/status") {
  try {
    const { claims, role } = await verifyContentAdmin(request, env);

    const length = Number(request.headers.get("content-length") || 0);
    if (length > 5000) {
      return json({ ok: false, error: "Request body too large" }, 413, allowedOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400, allowedOrigin);
    }

    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof body.documentId !== "string" ||
        typeof body.status !== "string") {
      return json({ ok: false, error: "Invalid status update payload" }, 400, allowedOrigin);
    }

    const result = await updateAdminExchangeRequestStatus(
      env, body.documentId, body.status, claims.sub
    );

    return json({
      ok: true,
      role,
      ...result,
      walletChanged: false,
      message: "Request status updated; no wallet balance was changed."
    }, 200, allowedOrigin);
  } catch (error) {
    const message = error?.message || "Request status update failed";
    const status = /token|required|denied|verified|admin/i.test(message)
      ? 403
      : /not found/i.test(message) ? 404
      : /already|invalid|must be/i.test(message) ? 400
      : 500;
    return json({ ok: false, error: message }, status, allowedOrigin);
  }
}
```

## 4. Route placement and CORS

- Keep the existing OPTIONS/CORS handling unchanged.
- Keep `verifyContentAdmin` and all existing authentication checks unchanged.
- Both routes must execute before the generic `/api/admin/*` 501 fallback.
- Do not add service-account credentials to GitHub or frontend files.
- Existing Worker secrets remain server-side: `FIREBASE_PROJECT_ID`, `OWNER_UID`, and `FIREBASE_SERVICE_ACCOUNT_JSON`.

## 5. Test after manual review and deployment

1. First deploy only after merging these blocks into the actual existing Worker source without deleting its current routes.
2. Sign in to the Admin Panel with the verified owner account.
3. Load the request list. Confirm it shows actual Firestore records.
4. Test one pending request. Approve or reject should update only its `status`, `statusUpdatedAt`, and `statusUpdatedBy` fields.
5. Reload the list and verify the new status.
6. Confirm no wallet balance or ledger record was created or changed.

## Known limitation

The existing `admin.js` Details dialog displays request fields. This API returns the stored Firestore fields plus a few display fields. It does not implement payment settlement, wallet credit/debit, exchange-rate management, or a financial ledger. Those require a separately designed and audited accounting model.
