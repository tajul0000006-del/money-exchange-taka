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
  // Generate a 10-digit numeric public FastMoney account ID (first digit 1-9).
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let accountId = String((bytes[0] % 9) + 1);
  for (let i = 1; i < 10; i++) accountId += String(bytes[i] % 10);
  return accountId;
}
function newPayId() {
  // Generate a 20-digit numeric Pay ID (first digit 1-9).
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let payId = String((bytes[0] % 9) + 1);
  for (let i = 1; i < 20; i++) payId += String(bytes[i] % 10);
  return payId;
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
function makeRegistryDocument(accountId, uid, now) {
  return {
    name: documentName("fastMoneyAccountIds", accountId),
    fields: { uid: fieldString(uid), accountId: fieldString(accountId), createdAt: fieldTimestamp(now) }
  };
}
function makePayIdRegistryDocument(payId, uid, now) {
  return {
    name: documentName("fastMoneyPayIds", payId),
    fields: { uid: fieldString(uid), createdAt: fieldTimestamp(now) }
  };
}
function makeNewProfileDocument(uid, claims, accountId, payId, now) {
  const displayName = typeof claims.name === "string" ? claims.name.slice(0, 120) : "";
  const email = typeof claims.email === "string" ? claims.email.slice(0, 160) : "";
  const names = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    name: documentName("userProfiles", uid),
    fields: {
      uid: fieldString(uid),
      accountId: fieldString(accountId),
      payId: fieldString(payId),
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
  for (let attempt = 0; attempt < 12; attempt++) {
    const [profile, wallet] = await Promise.all([
      readDocument(env, "userProfiles", uid),
      readDocument(env, "wallets", uid)
    ]);
    const now = new Date().toISOString();
    let accountId = readString(profile, "accountId");
    let payId = readString(profile, "payId");
    const writes = [];

    if (!/^\d{10}$/.test(accountId)) {
      accountId = newAccountId();
      const registry = await readDocument(env, "fastMoneyAccountIds", accountId);
      if (registry) continue;
      writes.push({
        update: makeRegistryDocument(accountId, uid, now),
        currentDocument: { exists: false }
      });
    } else {
      const registry = await readDocument(env, "fastMoneyAccountIds", accountId);
      if (!registry) {
        writes.push({
          update: makeRegistryDocument(accountId, now),
          currentDocument: { exists: false }
        });
      }
    }

    if (!/^\d{20}$/.test(payId)) {
      payId = newPayId();
      const registry = await readDocument(env, "fastMoneyPayIds", payId);
      if (registry) continue;
      writes.push({
        update: makePayIdRegistryDocument(payId, uid, now),
        currentDocument: { exists: false }
      });
    } else {
      const registry = await readDocument(env, "fastMoneyPayIds", payId);
      if (!registry) {
        writes.push({
          update: makePayIdRegistryDocument(payId, uid, now),
          currentDocument: { exists: false }
        });
      }
    }

    if (!profile) {
      writes.push({
        update: makeNewProfileDocument(uid, claims, accountId, payId, now),
        currentDocument: { exists: false }
      });
    } else {
      const profileFields = {};
      const fieldPaths = [];
      if (readString(profile, "accountId") !== accountId) {
        profileFields.accountId = fieldString(accountId);
        fieldPaths.push("accountId");
      }
      if (readString(profile, "payId") !== payId) {
        profileFields.payId = fieldString(payId);
        fieldPaths.push("payId");
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
      return { uid, accountId, payId, walletReady: true, created: false };
    }

    try {
      await commitWrites(env, writes);
      return { uid, accountId, payId, walletReady: true, created: true };
    } catch (error) {
      // A concurrent signup or rare ID collision is safe to retry.
      if (error.status === 409 || error.status === 400) {
        if (attempt < 11) continue;
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
async function referenceKey(methodId, reference) {
  const digest = await crypto.subtle.digest("SHA-256", encodeText(methodId + ":" + reference.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}
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
    if (proofUrl && !/^https:\/\//i.test(proofUrl)) throw new Error("Payment proof must be an HTTPS image URL");
    const settings = await getPayInSettings(env);
    const method = settings.methods.find(m => m.id === methodId && m.enabled);
    if (!method || method.currency !== currency) throw new Error("This payment method is unavailable for the selected currency");
    const uid = claims.sub, id = randomId();
    const refKey = await referenceKey(method.id, transactionReference);
    const usedReference = await readDocument(env, "payInReferences", refKey);
    if (usedReference) { const error = new Error("This transaction reference has already been submitted"); error.status = 409; throw error; }
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
      { update: { name: documentName("payInQueue", id), fields }, currentDocument: { exists: false } },
      { update: { name: documentName("payInReferences", refKey), fields: { uid: fieldString(uid), requestId: fieldString(id), methodId: fieldString(method.id), createdAt: fieldTimestamp(now) } }, currentDocument: { exists: false } }
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


// ---------------------------------------------------------------------------
// Internal user-to-user transfers. All financial writes are server-side and
// a transfer remains pending until the Owner approves or rejects it.
// ---------------------------------------------------------------------------
const INTERNAL_WALLETS = Object.freeze({
  FASTMONEY_USD: { balanceKey: "USD", currency: "USD", label: "FastMoney USD", dollar: true },
  REDOTPAY_USD: { balanceKey: "REDOTPAY_USD", currency: "USD", label: "RedotPay USD", dollar: true },
  VOLET_USD: { balanceKey: "VOLET_USD", currency: "USD", label: "Volet USD", dollar: true },
  EPAY_USD: { balanceKey: "EPAY_USD", currency: "USD", label: "ePay USD", dollar: true },
  WEBMONEY_USD: { balanceKey: "WEBMONEY_USD", currency: "USD", label: "WebMoney USD", dollar: true },
  TUNEPAY_USD: { balanceKey: "TUNEPAY_USD", currency: "USD", label: "TunePay USD", dollar: true },
  PERFECTMONEY_USD: { balanceKey: "PERFECTMONEY_USD", currency: "USD", label: "Perfect Money USD", dollar: true },
  WINITY_USD: { balanceKey: "WINITY_USD", currency: "USD", label: "Winity USD", dollar: true },
  RIZON_USD: { balanceKey: "RIZON_USD", currency: "USD", label: "Rizon USD", dollar: true },
  USDT: { balanceKey: "USDT", currency: "USDT", label: "USDT", dollar: true }
});
function readCurrency(profile) {
  const code = (readString(profile, "signupCurrencyCode") || readString(profile, "currencyCode") || "").toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "";
}
function readDisplayName(profile) {
  return readString(profile, "fullName") ||
    [readString(profile, "firstName"), readString(profile, "lastName")].filter(Boolean).join(" ") ||
    readString(profile, "email") || "FastMoney User";
}
function amountValue(fields, key) {
  const raw = fields?.[key]?.doubleValue ?? fields?.[key]?.integerValue ?? "0";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}
function roundMoney(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
function randomTransferId(prefix) {
  return prefix + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase();
}
function arrayField(values) {
  return { arrayValue: { values } };
}
function notificationEntry(id, title, message, transfer, now) {
  return fieldMap({
    id: fieldString(id), title: fieldString(title), message: fieldString(message),
    type: fieldString("internal_transfer"), transactionId: fieldString(transfer.transactionId),
    referenceNumber: fieldString(transfer.referenceNumber), createdAt: fieldTimestamp(now),
    read: { booleanValue: false }
  });
}
function appendNotificationWrite(profile, uid, item, now) {
  const old = profile.fields?.notifications?.arrayValue?.values || [];
  const notifications = [...old, item].slice(-50);
  return {
    update: { name: profile.name, fields: { notifications: arrayField(notifications), updatedAt: fieldTimestamp(now) } },
    updateMask: { fieldPaths: ["notifications", "updatedAt"] },
    currentDocument: { updateTime: profile.updateTime }
  };
}
function transactionMirrorFields(t, uid, direction, status, now, rejectionReason = "") {
  const otherAccountId = direction === "sent" ? t.receiverAccountId : t.senderAccountId;
  const otherName = direction === "sent" ? t.receiverName : t.senderName;
  return {
    transactionId: fieldString(t.transactionId), referenceNumber: fieldString(t.referenceNumber),
    uid: fieldString(uid), direction: fieldString(direction), otherAccountId: fieldString(otherAccountId),
    otherName: fieldString(otherName), walletKey: fieldString(t.walletKey), walletLabel: fieldString(t.walletLabel),
    sendAmount: fieldDouble(t.sendAmount), sendCurrency: fieldString(t.sendCurrency),
    receiveAmount: fieldDouble(t.receiveAmount), receiveCurrency: fieldString(t.receiveCurrency),
    rate: fieldDouble(t.rate), status: fieldString(status), senderUid: fieldString(t.senderUid),
    receiverUid: fieldString(t.receiverUid), senderAccountId: fieldString(t.senderAccountId),
    receiverAccountId: fieldString(t.receiverAccountId), senderName: fieldString(t.senderName),
    receiverName: fieldString(t.receiverName), createdAt: fieldTimestamp(t.createdAt),
    updatedAt: fieldTimestamp(now), rejectionReason: fieldString(rejectionReason)
  };
}
async function findProfileByAccountId(env, accountId) {
  const registry = await readDocument(env, "fastMoneyAccountIds", accountId);
  const uid = readString(registry, "uid");
  if (uid) {
    const profile = await readDocument(env, "userProfiles", uid);
    if (profile && readString(profile, "accountId") === accountId) return { uid, profile, registry };
  }
  const query = {
    structuredQuery: {
      from: [{ collectionId: "userProfiles" }],
      where: { fieldFilter: { field: { fieldPath: "accountId" }, op: "EQUAL", value: fieldString(accountId) } },
      limit: 1
    }
  };
  const result = await firestoreRequest(env, ":runQuery", { method: "POST", body: JSON.stringify(query) });
  const row = Array.isArray(result.data) ? result.data.find(item => item.document) : null;
  if (!row?.document) return null;
  const foundUid = readString(row.document, "uid") || row.document.name.split("/").pop();
  return { uid: foundUid, profile: row.document, registry };
}
async function getInternalTransferSettings(env) {
  const doc = await readDocument(env, "internalTransferSettings", "global");
  const raw = doc?.fields?.rates?.mapValue?.fields || {};
  const rates = {};
  for (const [pair, value] of Object.entries(raw)) rates[pair] = amountValue({ value }, "value");
  return { rates };
}
function internalTransferSettingsDoc(rates) {
  const map = {};
  for (const [pair, rate] of Object.entries(rates)) map[pair] = fieldDouble(rate);
  return { name: documentName("internalTransferSettings", "global"), fields: {
    rates: fieldMap(map), updatedAt: fieldTimestamp(new Date().toISOString())
  }};
}
function transferPublicShape(doc) {
  const f = doc.fields || {};
  const get = key => f[key]?.stringValue || "";
  return {
    requestId: get("requestId"), transactionId: get("transactionId"), referenceNumber: get("referenceNumber"),
    senderUid: get("senderUid"), receiverUid: get("receiverUid"),
    senderAccountId: get("senderAccountId"), receiverAccountId: get("receiverAccountId"),
    senderName: get("senderName"), receiverName: get("receiverName"),
    walletKey: get("walletKey"), walletLabel: get("walletLabel"),
    sendAmount: amountValue(f, "sendAmount"), sendCurrency: get("sendCurrency"),
    receiveAmount: amountValue(f, "receiveAmount"), receiveCurrency: get("receiveCurrency"),
    rate: amountValue(f, "rate"), status: get("status"), rejectionReason: get("rejectionReason"),
    createdAt: f.createdAt?.timestampValue || "", updatedAt: f.updatedAt?.timestampValue || ""
  };
}
async function handleInternalTransfers(request, env, url) {
  if (url.pathname === "/api/internal-transfer/settings" && request.method === "GET") {
    const settings = await getInternalTransferSettings(env);
    return { success: true, settings };
  }
  if (url.pathname === "/api/admin/internal-transfer/settings") {
    const claims = await requireUser(request); adminOnly(claims, env);
    if (request.method === "GET") return { success: true, settings: await getInternalTransferSettings(env) };
    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const input = body?.settings?.rates;
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length > 300) throw new Error("Enter valid currency conversion rates");
      const rates = {};
      for (const [pair, raw] of Object.entries(input)) {
        const key = safeText(pair, 16).toUpperCase();
        const rate = Number(raw);
        if (!/^[A-Z]{3}_[A-Z]{3}$/.test(key) || !Number.isFinite(rate) || rate <= 0 || rate > 1e12) throw new Error("Each rate must use FROM_TO format and a positive number");
        rates[key] = rate;
      }
      const old = await readDocument(env, "internalTransferSettings", "global");
      const write = { update: internalTransferSettingsDoc(rates) };
      write.currentDocument = old ? { updateTime: old.updateTime } : { exists: false };
      await commitWrites(env, [write]);
      return { success: true, settings: { rates } };
    }
  }
  if (url.pathname === "/api/internal-transfer/submit" && request.method === "POST") {
    const claims = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const receiverAccountId = safeText(body.receiverAccountId, 10);
    const walletKey = safeText(body.walletKey, 32).toUpperCase();
    const sendAmount = Number(body.amount);
    if (!/^[1-9]\d{9}$/.test(receiverAccountId)) throw new Error("Enter a valid 10-digit FastMoney Account ID");
    if (!Number.isFinite(sendAmount) || sendAmount <= 0 || sendAmount > 100000000) throw new Error("Enter a valid transfer amount");
    if (!Object.prototype.hasOwnProperty.call(INTERNAL_WALLETS, walletKey) && walletKey !== "LOCAL") throw new Error("Choose a supported wallet");
    const senderUid = claims.sub;
    const [senderProfile, senderWallet, receiver] = await Promise.all([
      readDocument(env, "userProfiles", senderUid), readDocument(env, "wallets", senderUid),
      findProfileByAccountId(env, receiverAccountId)
    ]);
    if (!senderProfile || !senderWallet || readString(senderWallet, "status") !== "active") throw new Error("Your wallet is unavailable");
    if (!receiver || receiver.uid === senderUid) throw new Error("Receiver account not found or cannot be your own account");
    const receiverWallet = await readDocument(env, "wallets", receiver.uid);
    if (!receiverWallet || readString(receiverWallet, "status") !== "active") throw new Error("Receiver wallet is not ready");
    const senderAccountId = readString(senderProfile, "accountId");
    if (!/^[1-9]\d{9}$/.test(senderAccountId)) throw new Error("Your FastMoney Account ID is not ready. Refresh your dashboard.");
    const senderName = readDisplayName(senderProfile), receiverName = readDisplayName(receiver.profile);
    let sendCurrency, receiveCurrency, receiveAmount, rate, sourceBalanceKey, walletLabel;
    if (walletKey === "LOCAL") {
      sendCurrency = readCurrency(senderProfile);
      receiveCurrency = readCurrency(receiver.profile);
      if (!sendCurrency || !receiveCurrency) throw new Error("A local wallet currency is not configured for one of these accounts");
      sourceBalanceKey = sendCurrency;
      walletLabel = sendCurrency + " Local Balance";
      if (sendCurrency === receiveCurrency) rate = 1;
      else {
        const settings = await getInternalTransferSettings(env);
        rate = Number(settings.rates[sendCurrency + "_" + receiveCurrency] || 0);
        if (!(rate > 0)) throw new Error("Admin has not configured the " + sendCurrency + " to " + receiveCurrency + " conversion rate");
      }
      receiveAmount = roundMoney(sendAmount * rate, 2);
    } else {
      const wallet = INTERNAL_WALLETS[walletKey];
      sendCurrency = wallet.currency;
      receiveCurrency = wallet.currency;
      rate = 1;
      sourceBalanceKey = wallet.balanceKey;
      walletLabel = wallet.label;
      receiveAmount = roundMoney(sendAmount, wallet.currency === "USDT" ? 6 : 2);
    }
    const senderBalances = readMap(senderWallet, "balances");
    const available = amountValue(senderBalances, sourceBalanceKey);
    if (available < sendAmount) throw new Error("Insufficient balance in your selected wallet");
    const id = randomTransferId("FMTR");
    const referenceNumber = randomTransferId("FMR");
    const now = new Date().toISOString();
    const transfer = {
      requestId: id, transactionId: id, referenceNumber, senderUid, receiverUid: receiver.uid,
      senderAccountId, receiverAccountId, senderName, receiverName, walletKey, walletLabel,
      sourceBalanceKey, sendAmount: roundMoney(sendAmount, walletKey === "USDT" ? 6 : 2),
      sendCurrency, receiveAmount, receiveCurrency, rate, status: "pending", createdAt: now
    };
    const queueFields = {
      requestId: fieldString(id), transactionId: fieldString(id), referenceNumber: fieldString(referenceNumber),
      senderUid: fieldString(senderUid), receiverUid: fieldString(receiver.uid),
      senderAccountId: fieldString(senderAccountId), receiverAccountId: fieldString(receiverAccountId),
      senderName: fieldString(senderName), receiverName: fieldString(receiverName),
      walletKey: fieldString(walletKey), walletLabel: fieldString(walletLabel),
      sourceBalanceKey: fieldString(sourceBalanceKey), sendAmount: fieldDouble(transfer.sendAmount),
      sendCurrency: fieldString(sendCurrency), receiveAmount: fieldDouble(receiveAmount),
      receiveCurrency: fieldString(receiveCurrency), rate: fieldDouble(rate),
      status: fieldString("pending"), createdAt: fieldTimestamp(now)
    };
    const senderMirror = transactionMirrorFields(transfer, senderUid, "sent", "pending", now);
    const receiverMirror = transactionMirrorFields(transfer, receiver.uid, "received", "pending", now);
    await commitWrites(env, [
      { update: { name: documentName("internalTransferQueue", id), fields: queueFields }, currentDocument: { exists: false } },
      { update: { name: documentName("transactions/" + senderUid + "/items", id), fields: senderMirror }, currentDocument: { exists: false } },
      { update: { name: documentName("transactions/" + receiver.uid + "/items", id), fields: receiverMirror }, currentDocument: { exists: false } }
    ]);
    return { success: true, transfer: transferPublicShape({ fields: queueFields }) };
  }
  if (url.pathname === "/api/transactions/me" && request.method === "GET") {
    const claims = await requireUser(request);
    const result = await firestoreRequest(env, "/transactions/" + encodeURIComponent(claims.sub) + "/items?pageSize=100");
    const transactions = (result.data.documents || []).map(doc => transferPublicShape(doc))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { success: true, transactions };
  }
  if (url.pathname === "/api/admin/internal-transfers" && request.method === "GET") {
    const claims = await requireUser(request); adminOnly(claims, env);
    const result = await firestoreRequest(env, "/internalTransferQueue?pageSize=100");
    const transfers = (result.data.documents || []).map(doc => transferPublicShape(doc))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { success: true, transfers };
  }
  if (url.pathname === "/api/admin/internal-transfer/decision" && request.method === "POST") {
    const claims = await requireUser(request); adminOnly(claims, env);
    const body = await request.json().catch(() => ({}));
    const id = safeText(body.requestId, 80);
    const decision = safeText(body.decision, 16);
    const reason = safeText(body.reason, 500);
    if (!id || !["approve", "reject"].includes(decision) || (decision === "reject" && reason.length < 3)) throw new Error("Choose approve or provide a rejection reason");
    const queue = await readDocument(env, "internalTransferQueue", id);
    if (!queue || readString(queue, "status") !== "pending") {
      const error = new Error("Transfer not found or already reviewed"); error.status = 409; throw error;
    }
    const t = transferPublicShape(queue);
    const sourceBalanceKey = readString(queue, "sourceBalanceKey");
    const senderUid = readString(queue, "senderUid"), receiverUid = readString(queue, "receiverUid");
    const [senderWallet, receiverWallet, senderProfile, receiverProfile, senderMirror, receiverMirror] = await Promise.all([
      readDocument(env, "wallets", senderUid), readDocument(env, "wallets", receiverUid),
      readDocument(env, "userProfiles", senderUid), readDocument(env, "userProfiles", receiverUid),
      readDocument(env, "transactions/" + senderUid + "/items", id),
      readDocument(env, "transactions/" + receiverUid + "/items", id)
    ]);
    if (!senderWallet || !receiverWallet || !senderProfile || !receiverProfile || !senderMirror || !receiverMirror) throw new Error("Transfer account records are incomplete");
    const now = new Date().toISOString();
    const status = decision === "approve" ? "successful" : "rejected";
    const writes = [
      { update: { name: queue.name, fields: { status: fieldString(status), reviewedAt: fieldTimestamp(now), reviewedBy: fieldString(claims.sub), rejectionReason: fieldString(reason) } },
        updateMask: { fieldPaths: ["status", "reviewedAt", "reviewedBy", "rejectionReason"] }, currentDocument: { updateTime: queue.updateTime } },
      { update: { name: senderMirror.name, fields: transactionMirrorFields(t, senderUid, "sent", status, now, reason) },
        updateMask: { fieldPaths: Object.keys(transactionMirrorFields(t, senderUid, "sent", status, now, reason)) }, currentDocument: { updateTime: senderMirror.updateTime } },
      { update: { name: receiverMirror.name, fields: transactionMirrorFields(t, receiverUid, "received", status, now, reason) },
        updateMask: { fieldPaths: Object.keys(transactionMirrorFields(t, receiverUid, "received", status, now, reason)) }, currentDocument: { updateTime: receiverMirror.updateTime } }
    ];
    if (decision === "approve") {
      if (readString(senderWallet, "status") !== "active" || readString(receiverWallet, "status") !== "active") throw new Error("One of the wallets is inactive");
      const senderBalances = { ...readMap(senderWallet, "balances") };
      const receiverBalances = { ...readMap(receiverWallet, "balances") };
      const current = amountValue(senderBalances, sourceBalanceKey);
      if (current < t.sendAmount) {
        const error = new Error("Sender balance is no longer sufficient. Transfer cannot be approved."); error.status = 409; throw error;
      }
      const receiveKey = t.walletKey === "LOCAL" ? t.receiveCurrency : (INTERNAL_WALLETS[t.walletKey]?.balanceKey || "");
      if (!receiveKey) throw new Error("Receiver wallet mapping is invalid");
      senderBalances[sourceBalanceKey] = fieldDouble(roundMoney(current - t.sendAmount, t.sendCurrency === "USDT" ? 6 : 2));
      const receivedCurrent = amountValue(receiverBalances, receiveKey);
      receiverBalances[receiveKey] = fieldDouble(roundMoney(receivedCurrent + t.receiveAmount, t.receiveCurrency === "USDT" ? 6 : 2));
      writes.push(
        { update: { name: senderWallet.name, fields: { balances: fieldMap(senderBalances), updatedAt: fieldTimestamp(now) } },
          updateMask: { fieldPaths: ["balances", "updatedAt"] }, currentDocument: { updateTime: senderWallet.updateTime } },
        { update: { name: receiverWallet.name, fields: { balances: fieldMap(receiverBalances), updatedAt: fieldTimestamp(now) } },
          updateMask: { fieldPaths: ["balances", "updatedAt"] }, currentDocument: { updateTime: receiverWallet.updateTime } },
        { update: { name: documentName("ledger/" + senderUid + "/entries", randomTransferId("LED")),
          fields: { transactionId: fieldString(t.transactionId), referenceNumber: fieldString(t.referenceNumber), uid: fieldString(senderUid), type: fieldString("internal_transfer"), direction: fieldString("debit"), currency: fieldString(t.sendCurrency), amount: fieldDouble(t.sendAmount), referenceId: fieldString(id), description: fieldString("Internal transfer sent"), createdAt: fieldTimestamp(now) } }, currentDocument: { exists: false } },
        { update: { name: documentName("ledger/" + receiverUid + "/entries", randomTransferId("LED")),
          fields: { transactionId: fieldString(t.transactionId), referenceNumber: fieldString(t.referenceNumber), uid: fieldString(receiverUid), type: fieldString("internal_transfer"), direction: fieldString("credit"), currency: fieldString(t.receiveCurrency), amount: fieldDouble(t.receiveAmount), referenceId: fieldString(id), description: fieldString("Internal transfer received"), createdAt: fieldTimestamp(now) } }, currentDocument: { exists: false } }
      );
    }
    const senderMessage = decision === "approve"
      ? "Your transfer of " + t.sendAmount + " " + t.sendCurrency + " to " + t.receiverAccountId + " was successful."
      : "Your transfer to " + t.receiverAccountId + " was rejected. Reason: " + reason;
    const receiverMessage = decision === "approve"
      ? "You received " + t.receiveAmount + " " + t.receiveCurrency + " from " + t.senderAccountId + ". Transfer successful."
      : "The transfer from " + t.senderAccountId + " was rejected. Reason: " + reason;
    writes.push(
      appendNotificationWrite(senderProfile, senderUid, notificationEntry(randomTransferId("NTF"), decision === "approve" ? "Transfer Successful" : "Transfer Rejected", senderMessage, t, now), now),
      appendNotificationWrite(receiverProfile, receiverUid, notificationEntry(randomTransferId("NTF"), decision === "approve" ? "Money Received" : "Incoming Transfer Rejected", receiverMessage, t, now), now)
    );
    await commitWrites(env, writes);
    return { success: true, requestId: id, transactionId: t.transactionId, referenceNumber: t.referenceNumber, status };
  }
  return null;
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
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
      const internalTransferResult = await handleInternalTransfers(request, env, url);
      if (internalTransferResult) return json(internalTransferResult, 200, cors);
      const payInResult = await handlePayIn(request, env, url);
      if (payInResult) return json(payInResult, 200, cors);
      if (request.method === "GET" && url.pathname === "/api/health") {
        // Confirms the Worker is running and can mint a service-account token.
        await getServiceAccessToken(env);
        return json({
          success: true,
          service: "FastMoney Core API",
          firebase: "connected",
          authentication: "ready",
          accountSystem: "ready",
          walletSystem: "server-managed",
          financialOperations: "manual_pay_in_enabled"
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
