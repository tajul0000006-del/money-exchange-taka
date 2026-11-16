/**
 * FastMoney Core API
 * Secure account bootstrap and read-only wallet API.
 *
 * Required Cloudflare Worker Secrets:
 * - FIREBASE_SERVICE_ACCOUNT_JSON
 * - OWNER_UID
 *
 * Firebase project: moneyexchangetaka
 */

const PROJECT_ID = "moneyexchangetaka";
const ALLOWED_ORIGINS = new Set([
  "https://money-exchange-taka.taijulsheikh60.workers.dev",
  "https://fastmoney.com",
  "https://www.fastmoney.com"
]);
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";
let serviceTokenCache = { token: null, expiresAt: 0 };
let firebaseJwksCache = { keys: null, expiresAt: 0 };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function encodeText(value) { return new TextEncoder().encode(value); }
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function pemToBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function base64urlJson(value) { return b64url(encodeText(JSON.stringify(value))); }

async function getServiceAccessToken(env) {
  if (serviceTokenCache.token && Date.now() < serviceTokenCache.expiresAt - 60000) return serviceTokenCache.token;
  let account;
  try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || ""); }
  catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"); }
  if (!account.client_email || !account.private_key || account.project_id !== PROJECT_ID) {
    throw new Error("Firebase service account configuration is incomplete or belongs to another project");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: "RS256", typ: "JWT" });
  const claim = base64urlJson({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  });
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encodeText(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error("Google service-account authentication failed");
  serviceTokenCache = { token: result.access_token, expiresAt: Date.now() + (Number(result.expires_in) || 3600) * 1000 };
  return result.access_token;
}

async function getFirebaseJwks() {
  if (firebaseJwksCache.keys && Date.now() < firebaseJwksCache.expiresAt) return firebaseJwksCache.keys;
  const response = await fetch(FIREBASE_JWKS_URL);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.keys)) throw new Error("Could not load Firebase token verification keys");
  firebaseJwksCache = { keys: data.keys, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.keys;
}

async function verifyFirebaseIdToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid authentication token");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported authentication token");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT_ID || claims.iss !== "https://securetoken.google.com/" + PROJECT_ID ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
      !claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 300 ||
      !claims.auth_time || claims.auth_time > now + 300) {
    throw new Error("Authentication token claims are invalid or expired");
  }
  const keys = await getFirebaseJwks();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) {
    firebaseJwksCache.expiresAt = 0;
    const refreshed = await getFirebaseJwks();
    const retryKey = refreshed.find(k => k.kid === header.kid);
    if (!retryKey) throw new Error("Authentication signing key not found");
    const key = await crypto.subtle.importKey("jwk", retryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), encodeText(parts[0] + "." + parts[1]));
    if (!valid) throw new Error("Authentication token signature is invalid");
  } else {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), encodeText(parts[0] + "." + parts[1]));
    if (!valid) throw new Error("Authentication token signature is invalid");
  }
  return claims;
}

async function requireUser(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Please sign in to continue");
  return verifyFirebaseIdToken(auth.slice(7).trim());
}

function firestoreRoot() {
  return "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
}
async function firestoreRequest(env, path, options = {}) {
  const accessToken = await getServiceAccessToken(env);
  const response = await fetch(firestoreRoot() + path, {
    ...options,
    headers: {
      authorization: "Bearer " + accessToken,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404) {
    const message = data.error?.message || "Firestore request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return { response, data };
}
function fieldString(value) { return { stringValue: String(value) }; }
function fieldNumber(value) { return { integerValue: String(value) }; }
function fieldMap(fields) { return { mapValue: { fields } }; }
function fieldTimestamp(value) { return { timestampValue: value }; }
function readString(document, field) { return document?.fields?.[field]?.stringValue || ""; }
function readBoolean(document, field) { return document?.fields?.[field]?.booleanValue === true; }
function docPath(collection, id) { return "/" + collection + "/" + encodeURIComponent(id); }

async function readDocument(env, collection, id) {
  const result = await firestoreRequest(env, docPath(collection, id));
  return result.response.status === 404 ? null : result.data;
}
function newAccountId() {
  // Generate a 10-digit numeric public FastMoney ID (first digit 1-9).
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let accountId = String((bytes[0] % 9) + 1);
  for (let i = 1; i < 10; i++) accountId += String(bytes[i] % 10);
  return accountId;
}
function documentName(collection, id) {
  return "projects/" + PROJECT_ID + "/databases/(default)/documents/" + collection + "/" + id;
}
function makeWalletDocument(uid, now) {
  return {
    name: documentName("wallets", uid),
    fields: {
      uid: fieldString(uid),
      balances: fieldMap({ BDT: fieldNumber(0), USD: fieldNumber(0), USDT: fieldNumber(0) }),
      currencyCodes: { arrayValue: { values: [fieldString("BDT"), fieldString("USD"), fieldString("USDT")] } },
      status: fieldString("active"),
      createdAt: fieldTimestamp(now),
      updatedAt: fieldTimestamp(now)
    }
  };
}
function makeRegistryDocument(accountId, now) {
  return {
    name: documentName("fastMoneyAccountIds", accountId),
    fields: { createdAt: fieldTimestamp(now) }
  };
}
function makeNewProfileDocument(uid, claims, accountId, now) {
  const displayName = typeof claims.name === "string" ? claims.name.slice(0, 120) : "";
  const email = typeof claims.email === "string" ? claims.email.slice(0, 160) : "";
  const names = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    name: documentName("userProfiles", uid),
    fields: {
      uid: fieldString(uid),
      accountId: fieldString(accountId),
      firstName: fieldString(names[0] || ""),
      lastName: fieldString(names.slice(1).join(" ")),
      fullName: fieldString(displayName),
      email: fieldString(email),
      emailVerified: { booleanValue: claims.email_verified === true },
      phoneVerified: { booleanValue: false },
      createdAt: fieldTimestamp(now),
      updatedAt: fieldTimestamp(now)
    }
  };
}
async function commitWrites(env, writes) {
  return firestoreRequest(env, ":commit", {
    method: "POST",
    body: JSON.stringify({ writes })
  });
}

async function bootstrapAccount(env, claims) {
  const uid = claims.sub;
  for (let attempt = 0; attempt < 8; attempt++) {
    const [profile, wallet] = await Promise.all([
      readDocument(env, "userProfiles", uid),
      readDocument(env, "wallets", uid)
    ]);
    const now = new Date().toISOString();
    let accountId = readString(profile, "accountId");
    const writes = [];
    let newIdReserved = false;

    if (!/^\d{10}$/.test(accountId)) {
      accountId = newAccountId();
      const registry = await readDocument(env, "fastMoneyAccountIds", accountId);
      if (registry) continue;
      writes.push({
        update: makeRegistryDocument(accountId, now),
        currentDocument: { exists: false }
      });
      newIdReserved = true;
    } else {
      const registry = await readDocument(env, "fastMoneyAccountIds", accountId);
      if (!registry) {
        writes.push({
          update: makeRegistryDocument(accountId, now),
          currentDocument: { exists: false }
        });
      }
    }

    if (!profile) {
      writes.push({
        update: makeNewProfileDocument(uid, claims, accountId, now),
        currentDocument: { exists: false }
      });
    } else if (profile) {
      const profileFields = {};
      const fieldPaths = [];
      if (readString(profile, "accountId") !== accountId) {
        profileFields.accountId = fieldString(accountId);
        fieldPaths.push("accountId");
      }
      if (readBoolean(profile, "emailVerified") !== (claims.email_verified === true)) {
        profileFields.emailVerified = { booleanValue: claims.email_verified === true };
        fieldPaths.push("emailVerified");
      }
      if (fieldPaths.length) {
        profileFields.updatedAt = fieldTimestamp(now);
        fieldPaths.push("updatedAt");
        writes.push({
          update: {
            name: documentName("userProfiles", uid),
            fields: profileFields
          },
          updateMask: { fieldPaths },
          currentDocument: { updateTime: profile.updateTime }
        });
      }
    }

    if (!wallet) {
      writes.push({
        update: makeWalletDocument(uid, now),
        currentDocument: { exists: false }
      });
    }

    if (writes.length === 0) {
      return { uid, accountId, walletReady: true, created: false };
    }

    try {
      await commitWrites(env, writes);
      return { uid, accountId, walletReady: true, created: true };
    } catch (error) {
      // A concurrent signup or rare account-ID collision is safe to retry.
      if (error.status === 409 || error.status === 400) {
        if (attempt < 7) continue;
      }
      throw error;
    }
  }
  throw new Error("Could not safely initialize this account. Please retry.");
}

async function getWallet(env, uid) {
  const [profile, wallet] = await Promise.all([
    readDocument(env, "userProfiles", uid),
    readDocument(env, "wallets", uid)
  ]);
  if (!profile || !wallet) return null;
  const balances = wallet.fields?.balances?.mapValue?.fields || {};
  const balanceValues = {};
  for (const [currency, field] of Object.entries(balances)) {
    const value = field.integerValue ?? field.doubleValue ?? "0";
    balanceValues[currency] = Number(value);
  }
  return {
    accountId: readString(profile, "accountId"),
    status: readString(wallet, "status") || "active",
    balances: balanceValues
  };
}


function fieldDouble(value) { return { doubleValue: Number(value) }; }
function readNumber(document, field) {
  const value = document?.fields?.[field]?.integerValue ?? document?.fields?.[field]?.doubleValue;
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
function readMap(document, field) { return document?.fields?.[field]?.mapValue?.fields || {}; }
function safeText(value, max = 160) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function randomId(prefix = "PIN") {
  return prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
}
function adminOnly(claims, env) {
  if (!env.OWNER_UID || claims.sub !== env.OWNER_UID) {
    const error = new Error("Owner permission required");
    error.status = 403;
    throw error;
  }
}
function payInSettingsDocument(settings) {
  return {
    name: documentName("payInSettings", "global"),
    fields: {
      methods: { arrayValue: { values: settings.methods.map(method => fieldMap({
        id: fieldString(method.id), name: fieldString(method.name), type: fieldString(method.type),
        currency: fieldString(method.currency), network: fieldString(method.network || ""),
        accountType: fieldString(method.accountType || ""), address: fieldString(method.address),
        instruction: fieldString(method.instruction || ""), enabled: { booleanValue: method.enabled === true }
      })) } },
      updatedAt: fieldTimestamp(new Date().toISOString())
    }
  };
}
function parsePayInMethods(document) {
  const values = document?.fields?.methods?.arrayValue?.values || [];
  return values.map(value => {
    const f = value.mapValue?.fields || {};
    return {
      id: f.id?.stringValue || "", name: f.name?.stringValue || "",
      type: f.type?.stringValue || "", currency: f.currency?.stringValue || "",
      network: f.network?.stringValue || "", accountType: f.accountType?.stringValue || "",
      address: f.address?.stringValue || "", instruction: f.instruction?.stringValue || "",
      enabled: f.enabled?.booleanValue === true
    };
  });
}
async function getPayInSettings(env) {
  const document = await readDocument(env, "payInSettings", "global");
  return { methods: parsePayInMethods(document) };
}
async function handlePayIn(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/pay-in/methods") {
    const settings = await getPayInSettings(env);
    return { success: true, methods: settings.methods.filter(m => m.enabled).map(({id,name,type,currency,network,accountType,address,instruction}) => ({id,name,type,currency,network,accountType,address,instruction})) };
  }
  if (url.pathname === "/api/admin/pay-in/settings") {
    const claims = await requireUser(request); adminOnly(claims, env);
    if (request.method === "GET") return { success: true, settings: await getPayInSettings(env) };
    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const methods = body?.settings?.methods;
      if (!Array.isArray(methods) || methods.length > 40) throw new Error("Invalid payment methods");
      const clean = [];
      const ids = new Set();
      for (const item of methods) {
        const method = {
          id: safeText(item.id, 40), name: safeText(item.name, 80),
          type: safeText(item.type, 20), currency: safeText(item.currency, 8).toUpperCase(),
          network: safeText(item.network, 40), accountType: safeText(item.accountType, 40),
          address: safeText(item.address, 180), instruction: safeText(item.instruction, 500),
          enabled: item.enabled === true
        };
        if (!/^[a-z0-9_-]{2,40}$/.test(method.id) || ids.has(method.id) || !method.name ||
            !["crypto","local","bank"].includes(method.type) || !["BDT","USD","USDT"].includes(method.currency) ||
            !method.address) throw new Error("Check each payment method: unique ID, name, type, currency and payment address are required");
        ids.add(method.id); clean.push(method);
      }
      const old = await readDocument(env, "payInSettings", "global");
      const write = { update: payInSettingsDocument({methods:clean}) };
      if (old) write.currentDocument = { updateTime: old.updateTime };
      else write.currentDocument = { exists: false };
      await commitWrites(env, [write]);
      return { success: true, settings: { methods: clean } };
    }
  }
  if (url.pathname === "/api/pay-in/requests" && request.method === "POST") {
    const claims = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const methodId = safeText(body.methodId, 40);
    const currency = safeText(body.currency, 8).toUpperCase();
    const amount = Number(body.amount);
    const transactionReference = safeText(body.transactionReference, 120);
    const sender = safeText(body.sender, 120);
    const proofUrl = safeText(body.proofUrl, 2048);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 ||
        !["BDT","USD","USDT"].includes(currency) || !methodId ||
        transactionReference.length < 4 || !sender) throw new Error("Enter a valid amount, payment reference and sender details");
    const settings = await getPayInSettings(env);
    const method = settings.methods.find(m => m.id === methodId && m.enabled);
    if (!method || method.currency !== currency) throw new Error("This payment method is unavailable for the selected currency");
    const uid = claims.sub, id = randomId();
    const now = new Date().toISOString();
    const fields = {
      requestId: fieldString(id), uid: fieldString(uid), methodId: fieldString(method.id),
      methodName: fieldString(method.name), currency: fieldString(currency),
      amount: fieldDouble(amount), transactionReference: fieldString(transactionReference),
      sender: fieldString(sender), proofUrl: fieldString(proofUrl),
      status: fieldString("pending"), createdAt: fieldTimestamp(now)
    };
    await commitWrites(env, [
      { update: { name: documentName("depositRequests/"+uid+"/items", id), fields }, currentDocument: { exists: false } },
      { update: { name: documentName("payInQueue", id), fields }, currentDocument: { exists: false } }
    ]);
    return { success: true, request: { requestId:id, status:"pending", currency, amount, methodName:method.name, createdAt:now } };
  }
  if (url.pathname === "/api/pay-in/requests/me" && request.method === "GET") {
    const claims = await requireUser(request);
    const result = await firestoreRequest(env, "/depositRequests/"+encodeURIComponent(claims.sub)+"/items?pageSize=100");
    const requests = (result.data.documents || []).map(doc => {
      const f=doc.fields||{};
      return {requestId:f.requestId?.stringValue||doc.name.split("/").pop(),methodName:f.methodName?.stringValue||"",currency:f.currency?.stringValue||"",amount:Number(f.amount?.doubleValue??f.amount?.integerValue??0),transactionReference:f.transactionReference?.stringValue||"",status:f.status?.stringValue||"pending",createdAt:f.createdAt?.timestampValue||""};
    }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    return { success:true, requests };
  }
  if (url.pathname === "/api/admin/pay-in/requests" && request.method === "GET") {
    const claims = await requireUser(request); adminOnly(claims, env);
    const result = await firestoreRequest(env, "/payInQueue?pageSize=100");
    const requests = (result.data.documents || []).map(doc => {
      const f=doc.fields||{};
      return {requestId:f.requestId?.stringValue||doc.name.split("/").pop(),uid:f.uid?.stringValue||"",methodName:f.methodName?.stringValue||"",methodId:f.methodId?.stringValue||"",currency:f.currency?.stringValue||"",amount:Number(f.amount?.doubleValue??f.amount?.integerValue??0),transactionReference:f.transactionReference?.stringValue||"",sender:f.sender?.stringValue||"",proofUrl:f.proofUrl?.stringValue||"",status:f.status?.stringValue||"pending",createdAt:f.createdAt?.timestampValue||""};
    }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    return { success:true, requests };
  }
  if (url.pathname === "/api/admin/pay-in/decision" && request.method === "POST") {
    const claims = await requireUser(request); adminOnly(claims, env);
    const body = await request.json().catch(() => ({}));
    const uid=safeText(body.uid,128), id=safeText(body.requestId,64), decision=safeText(body.decision,16);
    if (!uid || !id || !["approve","reject"].includes(decision)) throw new Error("Invalid deposit decision");
    const [queue, userRequest] = await Promise.all([
      readDocument(env,"payInQueue",id),
      readDocument(env,"depositRequests/"+uid+"/items",id)
    ]);
    if (!queue || !userRequest || readString(queue,"uid")!==uid || readString(userRequest,"uid")!==uid) {
      const error=new Error("Deposit request not found");error.status=404;throw error;
    }
    if (readString(queue,"status")!=="pending" || readString(userRequest,"status")!=="pending") {
      const error=new Error("This deposit has already been reviewed");error.status=409;throw error;
    }
    const now=new Date().toISOString();
    const status=decision==="approve"?"approved":"rejected";
    const writes=[
      {update:{name:queue.name,fields:{status:fieldString(status),reviewedAt:fieldTimestamp(now),reviewedBy:fieldString(claims.sub)}},updateMask:{fieldPaths:["status","reviewedAt","reviewedBy"]},currentDocument:{updateTime:queue.updateTime}},
      {update:{name:userRequest.name,fields:{status:fieldString(status),reviewedAt:fieldTimestamp(now),reviewedBy:fieldString(claims.sub)}},updateMask:{fieldPaths:["status","reviewedAt","reviewedBy"]},currentDocument:{updateTime:userRequest.updateTime}}
    ];
    if (decision==="approve") {
      const currency=readString(queue,"currency"), amount=readNumber(queue,"amount");
      if (!["BDT","USD","USDT"].includes(currency) || !Number.isFinite(amount) || amount<=0) throw new Error("Deposit data is invalid");
      const wallet=await readDocument(env,"wallets",uid);
      if (!wallet || readString(wallet,"status")!=="active") throw new Error("User wallet is unavailable or inactive");
      const balances={...readMap(wallet,"balances")};
      const current=Number(balances[currency]?.doubleValue??balances[currency]?.integerValue??0);
      balances[currency]=fieldDouble(current+amount);
      writes.push({update:{name:wallet.name,fields:{balances:fieldMap(balances),updatedAt:fieldTimestamp(now)}},updateMask:{fieldPaths:["balances","updatedAt"]},currentDocument:{updateTime:wallet.updateTime}});
      const ledgerId=randomId("LED");
      const ledgerFields={transactionId:fieldString(ledgerId),uid:fieldString(uid),type:fieldString("pay_in"),direction:fieldString("credit"),currency:fieldString(currency),amount:fieldDouble(amount),referenceId:fieldString(id),description:fieldString("Approved Pay In"),createdAt:fieldTimestamp(now),createdBy:fieldString(claims.sub)};
      writes.push({update:{name:documentName("ledger/"+uid+"/entries",ledgerId),fields:ledgerFields},currentDocument:{exists:false}});
    }
    await commitWrites(env,writes);
    return {success:true,requestId:id,status};
  }
  return null;
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      const payInResult = await handlePayIn(request, env, url);\n      if (payInResult) return json(payInResult, 200, cors);\n      if (request.method === "GET" && url.pathname === "/api/health") {
        // Confirms the Worker is running and can mint a service-account token.
        await getServiceAccessToken(env);
        return json({
          success: true,
          service: "FastMoney Core API",
          firebase: "connected",
          authentication: "ready",
          accountSystem: "ready",
          walletSystem: "server-managed",
          financialOperations: "not_enabled"
        }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/firestore/check") {
        await firestoreRequest(env, "/userProfiles?pageSize=1");
        return json({ success: true, firestore: "connected", message: "Firestore access verified" }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/auth/check") {
        const claims = await requireUser(request);
        return json({
          success: true,
          authenticated: true,
          uid: claims.sub,
          isAdmin: Boolean(env.OWNER_UID && claims.sub === env.OWNER_UID)
        }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/account/bootstrap") {
        const claims = await requireUser(request);
        const result = await bootstrapAccount(env, claims);
        return json({ success: true, message: "FastMoney account is ready", ...result }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/wallet/me") {
        const claims = await requireUser(request);
        const wallet = await getWallet(env, claims.sub);
        if (!wallet) return json({ success: false, error: "Wallet is not initialized. Call the account bootstrap endpoint first." }, 404, cors);
        return json({ success: true, wallet }, 200, cors);
      }
      return json({ success: false, error: "Not found" }, 404, cors);
    } catch (error) {
      const status = error.message?.includes("sign in") || error.message?.includes("token") ? 401 : (error.status || 500);
      return json({
        success: false,
        error: status >= 500 ? "The server could not complete this request. Please try again later." : error.message
      }, status, cors);
    }
  }
};
