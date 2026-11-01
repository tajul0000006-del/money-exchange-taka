# MoneyExchangeTaka Website Text Control — Worker Patch

This patch adds a Firestore-backed content store without changing the existing request, tracking, or password-reset routes.

## 1) Add helper functions

Paste this block immediately BEFORE `/* ---------------- MAIN WORKER ---------------- */` in the current Cloudflare Worker:

```js
/* ---------------- WEBSITE CONTENT CONTROL ---------------- */

const CONTENT_DOC_PATH =
  "/databases/(default)/documents/websiteContent/global";

function emptyContentEntries() {
  return {};
}

function validateContentEntries(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid content entries");
  }
  const keys = Object.keys(input);
  if (keys.length > 300) throw new Error("Too many content entries");

  const clean = {};
  for (const key of keys) {
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(key)) {
      throw new Error("Invalid content key");
    }
    const item = input[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid content item");
    }
    if (typeof item.text !== "string" || item.text.length < 1 || item.text.length > 2000) {
      throw new Error("Text must be 1–2000 characters");
    }
    if (typeof item.struck !== "boolean") {
      throw new Error("Invalid strike-through value");
    }
    clean[key] = { text: item.text, struck: item.struck };
  }

  const encoded = JSON.stringify(clean);
  if (new TextEncoder().encode(encoded).byteLength > 180000) {
    throw new Error("Website content is too large");
  }
  return clean;
}

async function readWebsiteContent(env) {
  const token = await getGoogleAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}${CONTENT_DOC_PATH}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (response.status === 404) return emptyContentEntries();
  if (!response.ok) throw new Error("Website content read failed");

  const doc = await response.json();
  const raw = doc.fields?.payload?.stringValue;
  if (!raw) return emptyContentEntries();

  try {
    return validateContentEntries(JSON.parse(raw));
  } catch {
    throw new Error("Stored website content is invalid");
  }
}

async function writeWebsiteContent(env, entries) {
  const clean = validateContentEntries(entries);
  const token = await getGoogleAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}${CONTENT_DOC_PATH}?updateMask.fieldPaths=payload`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fields: { payload: { stringValue: JSON.stringify(clean) } }
    })
  });

  if (!response.ok) throw new Error("Website content save failed");
  return clean;
}

async function verifyContentAdmin(request, env) {
  if (!env.FIREBASE_PROJECT_ID || !env.OWNER_UID || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Worker configuration incomplete");
  }

  const claims = await verifyFirebaseIdToken(
    getBearer(request),
    env.FIREBASE_PROJECT_ID
  );

  if (claims.email_verified !== true) {
    throw new Error("Verified email required");
  }

  const role = isAllowedAdmin(claims.sub, env);
  if (!role) throw new Error("Admin access denied");

  return { claims, role };
}
```

## 2) Add the public read route

Inside `fetch()`, immediately AFTER `const url = new URL(request.url);`, paste:

```js
    // Public website text overrides. Only plain text is returned.
    if (request.method === "GET" && url.pathname === "/api/content") {
      try {
        if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          return json({ error: "Content service unavailable" }, 503, allowedOrigin);
        }
        const entries = await readWebsiteContent(env);
        return json({ ok: true, entries }, 200, allowedOrigin);
      } catch {
        return json({ error: "Website content unavailable" }, 503, allowedOrigin);
      }
    }
```

## 3) Add the admin GET route

Inside the existing `if (request.method === "GET" && url.pathname.startsWith("/api/admin/"))` block, add this route AFTER the `/api/admin/firestore-check` route and BEFORE the final 501 response:

```js
        if (url.pathname === "/api/admin/content") {
          const entries = await readWebsiteContent(env);
          return json({ ok: true, role, entries }, 200, allowedOrigin);
        }
```

## 4) Add the admin POST route

Inside `fetch()`, paste this block BEFORE the existing Admin API GET block:

```js
    // Admin-only website content save.
    if (request.method === "POST" && url.pathname === "/api/admin/content") {
      try {
        const { role } = await verifyContentAdmin(request, env);

        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 200000) {
          return json({ error: "Content too large" }, 413, allowedOrigin);
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400, allowedOrigin);
        }

        if (!body || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).length !== 1 || !body.entries) {
          return json({ error: "Invalid content payload" }, 400, allowedOrigin);
        }

        const entries = await writeWebsiteContent(env, body.entries);
        return json({ ok: true, role, entries }, 200, allowedOrigin);
      } catch (error) {
        const message = error?.message || "Content save failed";
        const status = /token|required|denied|verified/i.test(message) ? 403 : 400;
        return json({ error: message }, status, allowedOrigin);
      }
    }
```

## 5) Firestore setup

No client-side Firestore write rule is needed. The Worker uses the existing service-account secret and server-side Firestore access. It stores one document:

- Collection: `websiteContent`
- Document ID: `global`
- Field: `payload` (string containing validated JSON)

Do not expose the service account JSON or private key in website files.

## 6) Frontend text keys

The Admin editor stores text by key. To make an HTML text editable, add a unique `data-content-key` attribute to the element, for example:

```html
<h1 data-content-key="home.hero.title">Your Exchange, Made Easier</h1>
<p data-content-key="home.hero.description">Fast and secure exchange requests.</p>
```

The public frontend applies saved values as `textContent` (not HTML), so admin-entered markup or scripts will not execute. Include `app.js` on pages that should load these overrides.

## 7) Publish and test

1. Save the Worker changes and press **Deploy** in Cloudflare.
2. Keep the existing Worker variables/secrets unchanged.
3. Open the website Admin Panel and sign in with the verified Owner/Admin account.
4. Open **Website Settings → Website Text Control**, load the content, then save a test key.
5. Confirm the public page element with the matching `data-content-key` shows the saved text.

The GitHub frontend editor is already added in `admin.js`; the public loader is added in `app.js`. The Worker patch must be deployed before Save/Load can work.
