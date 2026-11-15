/**
 * FastMoney Owner-controlled Admin & Staff RBAC API
 *
 * Deploy as a NEW Cloudflare Worker first. Do not replace the existing
 * moneyexchange-admin Worker until the RBAC API has been tested.
 *
 * Required Worker secrets:
 * FIREBASE_SERVICE_ACCOUNT_JSON
 * FIREBASE_WEB_API_KEY
 * OWNER_UID
 * ALLOWED_ORIGINS (comma-separated exact origins)
 *
 * Firestore collections:
 * adminRoles/{uid}
 * adminActivity/{auto-id}
 *
 * Existing ADMIN_UIDS is intentionally NOT trusted here. OWNER_UID is the
 * only immutable owner identity; all other access comes from adminRoles.
 */

const PROJECT_ID = "moneyexchangetaka";
const IDENTITY_LOOKUP = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

const ROLE_PERMISSIONS = Object.freeze({
  owner: ["*"],
  exchange_manager: ["requests:read", "requests:update"],
  payment_reviewer: ["requests:read", "requests:update"],
  support_staff: ["requests:read", "notifications:send"],
  finance_viewer: ["requests:read", "activity:read"]
});

let serviceTokenCache = { token: "", expiresAt: 0 };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function enc(value) { return new TextEncoder().encode(value); }
function pemBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function jwtPart(value) { return b64url(enc(JSON.stringify(value))); }

async function serviceToken(env) {
  if (serviceTokenCache.token && Date.now() < serviceTokenCache.expiresAt - 60000) return serviceTokenCache.token;
  let account;
  try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || ""); }
  catch { throw new Error("Firebase service account secret is invalid"); }
  if (!account.client_email || !account.private_key || account.project_id !== PROJECT_ID) {
    throw new Error("Firebase service account configuration is incomplete");
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = jwtPart({ alg: "RS256", typ: "JWT" }) + "." + jwtPart({
    iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600
  });
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error("Could not authenticate with Firebase service account");
  serviceTokenCache = { token: result.access_token, expiresAt: Date.now() + (Number(result.expires_in) || 3600) * 1000 };
  return serviceTokenCache.token;
}

function root() {
  return "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
}
async function fs(env, path, options = {}) {
  const token = await serviceToken(env);
  const response = await fetch(root() + path, {
    ...options,
    headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404) {
    const error = new Error(data.error?.message || "Firestore operation failed");
    error.status = response.status;
    throw error;
  }
  return { response, data };
}
function docPath(collection, id) { return "/" + collection + "/" + encodeURIComponent(id); }
function str(value) { return { stringValue: String(value) }; }
function bool(value) { return { booleanValue: Boolean(value) }; }
function stamp(value = new Date().toISOString()) { return { timestampValue: value }; }
function decode(doc) {
  const f = doc?.fields || {};
  const out = {};
  for (const [key, value] of Object.entries(f)) {
    if ("stringValue" in value) out[key] = value.stringValue;
    else if ("booleanValue" in value) out[key] = value.booleanValue;
    else if ("timestampValue" in value) out[key] = value.timestampValue;
    else if ("integerValue" in value) out[key] = Number(value.integerValue);
    else if ("doubleValue" in value) out[key] = Number(value.doubleValue);
  }
  return out;
}
function firestoreDoc(collection, id, fields) {
  return { name: "projects/" + PROJECT_ID + "/databases/(default)/documents/" + collection + "/" + id, fields };
}
async function audit(env, actor, action, targetUid, details = {}) {
  const id = crypto.randomUUID();
  const fields = {
    actorUid: str(actor.uid), actorEmail: str(actor.email || ""),
    actorRole: str(actor.role), action: str(action), targetUid: str(targetUid || ""),
    details: { mapValue: { fields: Object.fromEntries(Object.entries(details).map(([k, v]) => [k, str(String(v).slice(0, 300))])) } },
    createdAt: stamp()
  };
  await fs(env, "/adminActivity?documentId=" + encodeURIComponent(id), {
    method: "POST", body: JSON.stringify({ fields })
  });
}
async function authenticate(request, env) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw Object.assign(new Error("Sign in required"), { status: 401 });
  if (!env.FIREBASE_WEB_API_KEY) throw new Error("FIREBASE_WEB_API_KEY secret is missing");
  const response = await fetch(IDENTITY_LOOKUP + "?key=" + encodeURIComponent(env.FIREBASE_WEB_API_KEY), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: header.slice(7).trim() })
  });
  const data = await response.json().catch(() => ({}));
  const user = data.users?.[0];
  if (!response.ok || !user || user.emailVerified !== true || user.disabled === true) {
    throw Object.assign(new Error("Valid, email-verified account required"), { status: 401 });
  }
  const uid = user.localId;
  if (uid === env.OWNER_UID && env.OWNER_UID) {
    return { uid, email: user.email || "", role: "owner", permissions: ROLE_PERMISSIONS.owner };
  }
  const record = await fs(env, docPath("adminRoles", uid));
  if (record.response.status === 404) throw Object.assign(new Error("No staff access assigned"), { status: 403 });
  const roleData = decode(record.data);
  if (roleData.active !== true || !ROLE_PERMISSIONS[roleData.role]) {
    throw Object.assign(new Error("Staff access is disabled or invalid"), { status: 403 });
  }
  return { uid, email: user.email || "", role: roleData.role, permissions: ROLE_PERMISSIONS[roleData.role] };
}
function can(actor, permission) {
  return actor.role === "owner" || actor.permissions.includes(permission) || actor.permissions.includes("*");
}
function cors(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(String(env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean));
  const h = { "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "Authorization, Content-Type", "access-control-max-age": "86400", vary: "Origin" };
  if (allowed.has(origin)) h["access-control-allow-origin"] = origin;
  return h;
}
async function readBody(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  return body;
}
function validUid(uid) { return typeof uid === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(uid); }
function validRole(role) { return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role) && role !== "owner"; }

async function listStaff(env, actor) {
  const result = await fs(env, "/adminRoles?pageSize=200");
  const docs = result.data.documents || [];
  return docs.map(doc => {
    const data = decode(doc);
    return { uid: doc.name.split("/").pop(), email: data.email || "", role: data.role, active: data.active === true, createdAt: data.createdAt || "", updatedAt: data.updatedAt || "" };
  });
}
async function assignStaff(env, actor, body) {
  const uid = String(body.uid || "");
  const role = String(body.role || "");
  if (!validUid(uid)) throw Object.assign(new Error("Enter a valid Firebase user UID"), { status: 400 });
  if (uid === env.OWNER_UID) throw Object.assign(new Error("Owner account cannot be assigned as staff"), { status: 400 });
  if (!validRole(role)) throw Object.assign(new Error("Choose a valid staff role"), { status: 400 });
  const existing = await fs(env, docPath("adminRoles", uid));
  if (existing.response.status !== 404) throw Object.assign(new Error("This UID already has a staff record. Use update instead."), { status: 409 });
  const fields = { email: str(String(body.email || "").slice(0, 160)), role: str(role), active: bool(true), createdBy: str(actor.uid), createdAt: stamp(), updatedAt: stamp() };
  await fs(env, docPath("adminRoles", uid) + "?currentDocument.exists=false", { method: "PATCH", body: JSON.stringify({ fields }) });
  await audit(env, actor, "staff.assigned", uid, { role });
  return { uid, role, active: true };
}
async function updateStaff(env, actor, uid, body) {
  if (!validUid(uid) || uid === env.OWNER_UID) throw Object.assign(new Error("Invalid staff UID"), { status: 400 });
  const current = await fs(env, docPath("adminRoles", uid));
  if (current.response.status === 404) throw Object.assign(new Error("Staff record not found"), { status: 404 });
  const old = decode(current.data);
  const nextRole = body.role === undefined ? old.role : String(body.role);
  const nextActive = body.active === undefined ? old.active === true : body.active;
  if (!validRole(nextRole) || typeof nextActive !== "boolean") throw Object.assign(new Error("Invalid role or status"), { status: 400 });
  const fields = { role: str(nextRole), active: bool(nextActive), updatedAt: stamp() };
  await fs(env, docPath("adminRoles", uid) + "?updateMask.fieldPaths=role&updateMask.fieldPaths=active&updateMask.fieldPaths=updatedAt&currentDocument.updateTime=" + encodeURIComponent(current.data.updateTime), {
    method: "PATCH", body: JSON.stringify({ fields })
  });
  await audit(env, actor, nextActive ? "staff.updated" : "staff.disabled", uid, { previousRole: old.role, role: nextRole, active: nextActive });
  return { uid, role: nextRole, active: nextActive };
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ success: true, service: "FastMoney Owner Staff RBAC API", auth: "Firebase email verification", ownerControl: true }, 200, headers);
      }
      const actor = await authenticate(request, env);
      if (request.method === "GET" && url.pathname === "/api/admin/me") {
        return json({ success: true, uid: actor.uid, email: actor.email, role: actor.role, permissions: actor.permissions }, 200, headers);
      }
      if (url.pathname === "/api/admin/staff") {
        if (actor.role !== "owner") throw Object.assign(new Error("Only Owner can manage staff"), { status: 403 });
        if (request.method === "GET") return json({ success: true, staff: await listStaff(env, actor) }, 200, headers);
        if (request.method === "POST") return json({ success: true, staff: await assignStaff(env, actor, await readBody(request)) }, 201, headers);
      }
      const match = url.pathname.match(/^\/api\/admin\/staff\/([A-Za-z0-9_-]{20,128})$/);
      if (match && request.method === "PATCH") {
        if (actor.role !== "owner") throw Object.assign(new Error("Only Owner can manage staff"), { status: 403 });
        return json({ success: true, staff: await updateStaff(env, actor, match[1], await readBody(request)) }, 200, headers);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/permissions") {
        return json({ success: true, roles: Object.fromEntries(Object.entries(ROLE_PERMISSIONS).filter(([role]) => role !== "owner")) }, 200, headers);
      }
      return json({ success: false, error: "Not found" }, 404, headers);
    } catch (error) {
      const status = error.status || 500;
      return json({ success: false, error: status >= 500 ? "Server error. Please try again later." : error.message }, status, headers);
    }
  }
};
