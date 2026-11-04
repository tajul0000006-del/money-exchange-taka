/* MoneyExchangeTaka Admin Login
 * Firebase Auth signs in the user; the Cloudflare API independently checks the UID.
 * This does not implement exchange approvals or wallet changes.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

(() => {
  "use strict";
  const API_BASE = "https://bold-surf-9356.taijulsheikh60.workers.dev";
  const REQUEST_API_BASE = "https://moneyexchange-admin.taijulsheikh60.workers.dev";
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const $ = id => document.getElementById(id);
  const form = $("loginForm");
  const status = $("loginStatus");
  const loginCard = $("loginCard");
  const dashboard = $("dashboard");
  const submitButton = form?.querySelector('button[type="submit"]');
  const resendButton = $("resendVerification");

  function setStatus(message, error = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  function showDashboard(profile) {
    loginCard.hidden = true;
    dashboard.hidden = false;
    setupFirestoreTest();
    setupRequestList();
    setupWebsiteContentEditor();
    let identity = $("adminIdentity");
    if (!identity) {
      identity = document.createElement("p");
      identity.id = "adminIdentity";
      identity.className = "status";
      dashboard.querySelector(".heading")?.insertAdjacentElement("afterend", identity);
    }
    if (identity) identity.textContent = `যাচাইকৃত অ্যাকাউন্ট: ${profile.email || "Email unavailable"} · ভূমিকা: ${profile.role === "owner" ? "Owner" : "Admin"}`;
  }
  function showLogin(message = "", error = false) {
    dashboard.hidden = true;
    loginCard.hidden = false;
    if (message) setStatus(message, error);
  }

  // Read-only exchange request list and Overview pending count.
  function setupRequestList() {
    const section = $("panel-requests");
    if (!section || $("loadRequestsButton")) return;
    const head = section.querySelector(".module-head");
    const wrap = document.createElement("div");
    wrap.className = "info-strip";
    wrap.style.margin = "14px 0";
    wrap.innerHTML = '<button type="button" id="loadRequestsButton">রিকোয়েস্ট তালিকা লোড করুন</button><p id="requestListStatus" role="status" aria-live="polite">Firestore থেকে সর্বোচ্চ ৫০টি রেকর্ড পড়া হবে।</p>';
    head?.insertAdjacentElement("afterend", wrap);
    const table = section.querySelector("tbody");
    if (table) table.id = "requestTableBody";
    // Request details popup (read-only; no status or wallet changes).
    let detailModal = $("requestDetailModal");
    if (!detailModal) {
      detailModal = document.createElement("div");
      detailModal.id = "requestDetailModal";
      detailModal.hidden = true;
      detailModal.setAttribute("role", "dialog");
      detailModal.setAttribute("aria-modal", "true");
      detailModal.setAttribute("aria-labelledby", "requestDetailTitle");
      detailModal.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(8,15,30,.72);padding:18px;display:none;overflow:auto;align-items:center;justify-content:center";
      detailModal.innerHTML = '<div style="background:#fff;color:#172033;width:min(680px,100%);max-height:90vh;overflow:auto;border-radius:16px;padding:20px;box-shadow:0 20px 60px #0005"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2 id="requestDetailTitle" style="margin:0">রিকোয়েস্টের বিস্তারিত</h2><button type="button" id="closeRequestDetail" class="outline">বন্ধ করুন ✕</button></div><div id="requestDetailContent" style="margin-top:16px"></div></div>';
      document.body.appendChild(detailModal);
      const closeDetails = () => { detailModal.hidden = true; detailModal.style.display = "none"; };
      $("closeRequestDetail").addEventListener("click", closeDetails);
      detailModal.addEventListener("click", event => { if (event.target === detailModal) closeDetails(); });
      document.addEventListener("keydown", event => { if (event.key === "Escape" && !detailModal.hidden) closeDetails(); });
    }
    const safeText = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const showRequestDetails = request => {
      const content = $("requestDetailContent");
      const labels = {
        transactionReference: "Reference Number",
        paymentAccount: "Payment Account",
        proofScreenshotUrl: "Payment Proof Screenshot",
        proofFileName: "Proof File Name",
        trackingCode: "Tracking Code",
        requestId: "Request ID",
        documentId: "Document ID",
        contactMethod: "Contact Method",
        paymentMethod: "Payment Method",
        direction: "Exchange Type",
        amount: "Amount",
        currency: "Currency",
        status: "Request Status",
        createdAt: "Submitted At",
        statusUpdatedAt: "Last Status Update",
        statusUpdatedBy: "Updated By",
        affiliateCode: "Affiliate Code",
        proofEmail: "Proof Email",
        contact: "Contact",
        note: "Note",
        uid: "User Account ID",
        requestType: "Request Type"
      };
      content.replaceChildren();
      Object.entries(request).forEach(([key, rawValue]) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;flex-direction:column;gap:5px;padding:12px 0;border-bottom:1px solid #e7eaf0;min-width:0";
        const label = document.createElement("strong");
        label.textContent = labels[key] || key;
        label.style.cssText = "font-size:14px;color:#344054;overflow-wrap:anywhere";
        const value = document.createElement("div");
        value.style.cssText = "font-size:15px;color:#172033;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;min-width:0";
        let display = rawValue;
        if (rawValue && typeof rawValue === "object") {
          if (rawValue._seconds) display = new Date(rawValue._seconds * 1000).toLocaleString("bn-BD");
          else display = JSON.stringify(rawValue, null, 2);
        }
        if (key === "proofScreenshotUrl" && typeof rawValue === "string" && /^https:\/\//i.test(rawValue)) {
          const link = document.createElement("a");
          link.href = rawValue;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "প্রুফ ছবি দেখুন";
          link.style.cssText = "color:#1769aa;text-decoration:underline;font-weight:600";
          value.appendChild(link);
        } else {
          value.textContent = display == null || display === "" ? "—" : String(display);
        }
        row.append(label, value);
        content.appendChild(row);
      });
      detailModal.hidden = false;
      detailModal.style.display = "flex";
    };

    const btn = $("loadRequestsButton");
    btn.addEventListener("click", async () => {
      const user = auth.currentUser;
      const msg = $("requestListStatus");
      if (!user) { msg.textContent = "সেশন পাওয়া যায়নি। আবার লগইন করুন।"; return; }
      btn.disabled = true; btn.textContent = "লোড হচ্ছে...";
      msg.textContent = "Firestore থেকে নিরাপদে Request পড়া হচ্ছে...";
      try {
        const token = await user.getIdToken(true);
        const response = await fetch(`${REQUEST_API_BASE}/api/admin/requests?limit=50`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok || data.ok !== true || !Array.isArray(data.requests)) throw new Error(data.error || `API error (${response.status})`);
        const body = $("requestTableBody");
        if (!data.requests.length) {
          body.innerHTML = '<tr><td colspan="6">Firestore-এ কোনো Exchange Request পাওয়া যায়নি।</td></tr>';
        } else {
          body.innerHTML = data.requests.map(r => {
            const safe = v => String(v ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
            const detailIndex = data.requests.indexOf(r);
            return `<tr><td>${safe(r.requestId)}</td><td>${safe(r.customer)}</td><td>${safe(r.type)}</td><td>${safe(r.amount)}</td><td class="request-status-cell">${safe(r.status)}</td><td><button type="button" class="request-detail-button" data-request-index="${detailIndex}">Details / বিস্তারিত</button> <button type="button" class="request-status-button" data-document-id="${safe(r.documentId)}" data-status="approved" ${String(r.status).toLowerCase()==="approved"?"disabled":""}>Approve</button> <button type="button" class="request-status-button danger" data-document-id="${safe(r.documentId)}" data-status="rejected" ${String(r.status).toLowerCase()==="rejected"?"disabled":""}>Reject</button></td></tr>`;
          }).join("");
          body.querySelectorAll(".request-detail-button").forEach(detailButton => {
            detailButton.addEventListener("click", () => {
              const selected = data.requests[Number(detailButton.dataset.requestIndex)];
              if (selected) showRequestDetails(selected);
            });
          });
          body.querySelectorAll(".request-status-button").forEach(statusButton => {
            statusButton.addEventListener("click", async () => {
              const nextStatus = statusButton.dataset.status;
              const action = nextStatus === "approved" ? "Approve" : "Reject";
              if (!confirm(`${action} this request? This changes only request status, not wallet balance.`)) return;
              const currentUser = auth.currentUser;
              if (!currentUser) { msg.textContent = "সেশন পাওয়া যায়নি। আবার লগইন করুন।"; return; }
              statusButton.disabled = true;
              msg.textContent = "Request status update হচ্ছে...";
              try {
                const token = await currentUser.getIdToken(true);
                const updateResponse = await fetch(`${REQUEST_API_BASE}/api/admin/requests/status`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
                  body: JSON.stringify({ documentId: statusButton.dataset.documentId, status: nextStatus })
                });
                const updateData = await updateResponse.json().catch(() => ({}));
                if (!updateResponse.ok || updateData.ok !== true) throw new Error(updateData.error || `Update failed (${updateResponse.status})`);
                msg.textContent = `সফল! Request status ${nextStatus.toUpperCase()} করা হয়েছে। তালিকা আবার লোড করুন।`;
                statusButton.closest("tr")?.querySelector(".request-status-cell")?.replaceChildren(document.createTextNode(nextStatus));
                statusButton.closest("tr")?.querySelectorAll(".request-status-button").forEach(button => button.disabled = button.dataset.status === nextStatus);
              } catch (error) {
                msg.textContent = `Status update হয়নি: ${error.message || "অজানা সমস্যা"}`;
                statusButton.disabled = false;
              }
            });
          });
        }
        const pending = data.requests.filter(r => String(r.status || "").toLowerCase() === "pending").length;
        const statCards = document.querySelectorAll(".stats .stat");
        if (statCards[0]) statCards[0].querySelector("strong").textContent = String(data.total ?? data.requests.length);
        if (statCards[0]) statCards[0].querySelector("small").textContent = "Firestore থেকে পাওয়া রেকর্ড";
        if (statCards[1]) statCards[1].querySelector("strong").textContent = String(pending);
        if (statCards[1]) statCards[1].querySelector("small").textContent = "লোড করা রেকর্ডের মধ্যে Pending";
        const badge = section.querySelector(".module-head .pending-tag");
        if (badge) badge.textContent = "Read-only · সংযুক্ত";
        msg.textContent = `সফল! ${data.requests.length}টি Request লোড হয়েছে। Pending: ${pending}টি।`;
      } catch (error) {
        msg.textContent = `Request লোড হয়নি: ${error.message || "অজানা সমস্যা"}`;
      } finally {
        btn.disabled = false; btn.textContent = "আবার লোড করুন";
      }
    });
  }

  // Read-only Firestore connection test; this never changes exchange or wallet data.
  function setupFirestoreTest() {
    const overview = $("panel-overview");
    if (!overview || $("firestoreTestButton")) return;

    const area = document.createElement("div");
    area.className = "info-strip";
    area.style.marginTop = "16px";

    const button = document.createElement("button");
    button.id = "firestoreTestButton";
    button.type = "button";
    button.textContent = "Test Firestore Connection";

    const result = document.createElement("p");
    result.id = "firestoreTestResult";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    result.style.marginBottom = "0";
    result.textContent = "Firestore সংযোগ এখনো পরীক্ষা করা হয়নি।";

    button.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) {
        result.textContent = "সেশন পাওয়া যায়নি। আবার Admin Login করুন।";
        return;
      }

      button.disabled = true;
      button.textContent = "পরীক্ষা চলছে...";
      result.textContent = "Firebase token দিয়ে Firestore read-only সংযোগ পরীক্ষা হচ্ছে...";

      try {
        const token = await user.getIdToken(true);
        const response = await fetch(`${API_BASE}/api/admin/firestore-check`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });

        let data = {};
        try { data = await response.json(); } catch (_) {}

        if (!response.ok || data.ok !== true || data.firestore?.readable !== true) {
          throw new Error(data.error || `Firestore test failed (${response.status})`);
        }

        result.textContent = data.firestore.hasDocuments
          ? "সফল! Firestore-এর exchangeRequests collection পড়া যাচ্ছে এবং অন্তত ১টি রেকর্ড আছে।"
          : "সংযোগ সফল! Firestore-এর exchangeRequests collection পড়া যাচ্ছে, তবে এখনো কোনো রেকর্ড পাওয়া যায়নি।";
      } catch (error) {
        result.textContent = `সংযোগ পরীক্ষা ব্যর্থ: ${error.message || "অজানা সমস্যা"}`;
      } finally {
        button.disabled = false;
        button.textContent = "আবার পরীক্ষা করুন";
      }
    });

    area.append(button, result);
    overview.querySelector(".module-head")?.insertAdjacentElement("afterend", area);
  }
  async function verifyWithApi(user) {
    if (!user.emailVerified) throw new Error("আপনার ইমেইল এখনো Verified নয়। Gmail থেকে Verification Link-এ চাপ দিন।");
    const token = await user.getIdToken(true);
    const response = await fetch(`${API_BASE}/api/admin/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok || result.ok !== true) throw new Error(result.error || `API verification failed (${response.status})`);
    if (result.emailVerified !== true) throw new Error("আপনার Firebase ইমেইল এখনো Verified নয়। আগে ইমেইল Verify করুন।");
    if (result.uid !== user.uid || !["owner", "admin"].includes(result.role)) throw new Error("এই অ্যাকাউন্টের Admin অনুমতি নেই।");
    return result;
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;
    if (!email || !password) return setStatus("ইমেইল ও পাসওয়ার্ড লিখুন।", true);
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = "যাচাই হচ্ছে..."; }
    setStatus("Firebase Login ও Owner অনুমতি যাচাই হচ্ছে...");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user);
          setStatus("আপনার Gmail-এ নতুন Verification Email পাঠানো হয়েছে। Inbox ও Spam ফোল্ডার দেখুন।");
        } catch (mailError) {
          setStatus(mailError?.message || "Verification Email পাঠানো যায়নি। আবার চেষ্টা করুন।", true);
        }
        await signOut(auth);
        return;
      }
      const profile = await verifyWithApi(credential.user);
      showDashboard(profile);
      form.reset();
    } catch (error) {
      await signOut(auth).catch(() => {});
      showLogin(error?.message || "লগইন যাচাই করা যায়নি।", true);
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = "লগইন যাচাই"; }
    }
  });

  resendButton?.addEventListener("click", async () => {
    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;
    if (!email || !password) return setStatus("আগে ইমেইল ও পাসওয়ার্ড লিখুন, তারপর এই বাটনে চাপ দিন।", true);
    resendButton.disabled = true;
    setStatus("Verification Email পাঠানো হচ্ছে...");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (credential.user.emailVerified) {
        setStatus("এই ইমেইলটি ইতিমধ্যে Verified। এখন Login যাচাই বাটনে চাপ দিন।");
      } else {
        await sendEmailVerification(credential.user);
        setStatus("নতুন Verification Email পাঠানো হয়েছে। Gmail Inbox ও Spam ফোল্ডার দেখুন।");
      }
      await signOut(auth);
    } catch (error) {
      setStatus(error?.message || "Verification Email পাঠানো যায়নি।", true);
      await signOut(auth).catch(() => {});
    } finally {
      resendButton.disabled = false;
    }
  });



  // Owner-only website text editor. Text is stored as plain text; no HTML is executed.
  function setupWebsiteContentEditor() {
    const panel = $("panel-website");
    if (!panel || $("contentEditor")) return;
    const root = document.createElement("div");
    root.id = "contentEditor";
    root.className = "info-strip";
    root.style.cssText = "margin-top:18px;background:#f7fbff;border:1px solid #cfe0ef;padding:16px;border-radius:12px";
    root.innerHTML = '<h3 style="margin:0 0 8px">Website Text Control</h3><p>HTML-এর যেসব লেখায় data-content-key দেওয়া আছে, সেগুলো এখানে পরিবর্তন, Strike-through বা Restore করা যাবে।</p><div style="display:grid;gap:9px"><label>Text Key <input id="contentKey" maxlength="80" placeholder="যেমন: home.hero.title"></label><label>Website Text <textarea id="contentText" rows="3" maxlength="2000" placeholder="ওয়েবসাইটে যে লেখা দেখাতে চান"></textarea></label><label style="display:flex;gap:8px;align-items:center"><input id="contentStruck" type="checkbox"> Strike-through (লেখা কাটা দেখান)</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="contentSave">Save Text</button><button type="button" class="outline" id="contentLoad">Load Saved Text</button><button type="button" class="outline" id="contentRestore">Restore / Remove Strike-through</button></div><p id="contentStatus" role="status" aria-live="polite"></p><div id="contentEntries" style="display:grid;gap:8px"></div></div>';
    panel.appendChild(root);
    const status = $("contentStatus");
    const keyInput = $("contentKey"), textInput = $("contentText"), struckInput = $("contentStruck");
    let entries = {};
    const api = async (method, path, body) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin session পাওয়া যায়নি। আবার লগইন করুন।");
      const token = await user.getIdToken(true);
      const response = await fetch(API_BASE + path, {
        method, headers: { Authorization: "Bearer " + token, ...(body ? {"content-type":"application/json"} : {}) },
        ...(body ? {body: JSON.stringify(body)} : {}), cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Content API error (" + response.status + ")");
      return data;
    };
    const render = () => {
      const list = $("contentEntries");
      list.replaceChildren();
      Object.entries(entries).forEach(([key, item]) => {
        const row = document.createElement("div");
        row.style.cssText = "background:#fff;border:1px solid #dbe5ec;border-radius:9px;padding:10px;display:flex;justify-content:space-between;gap:10px;align-items:center";
        const info = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = key;
        const preview = document.createElement("div"); preview.textContent = item.text; preview.style.cssText = "font-size:13px;overflow-wrap:anywhere";
        if (item.struck) preview.style.textDecoration = "line-through";
        info.append(title, preview);
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        edit.addEventListener("click", () => { keyInput.value = key; textInput.value = item.text; struckInput.checked = !!item.struck; });
        row.append(info, edit); list.append(row);
      });
    };
    async function load() {
      status.textContent = "লোড হচ্ছে...";
      try { const data = await api("GET", "/api/admin/content"); entries = data.entries || {}; render(); status.textContent = "সংরক্ষিত লেখা লোড হয়েছে।"; }
      catch (e) { status.textContent = "লোড হয়নি: " + e.message; }
    }
    async function save(struck) {
      const key = keyInput.value.trim();
      const text = textInput.value;
      if (!/^[a-zA-Z0-9._-]{1,80}$/.test(key)) { status.textContent = "Text Key-তে শুধু English অক্ষর, সংখ্যা, dot, underscore ও hyphen ব্যবহার করুন।"; return; }
      if (!text.trim() || text.length > 2000) { status.textContent = "লেখা খালি রাখা যাবে না; সর্বোচ্চ ২০০০ অক্ষর।"; return; }
      status.textContent = "সংরক্ষণ হচ্ছে...";
      try {
        entries[key] = {text, struck: !!struck};
        const data = await api("POST", "/api/admin/content", {entries});
        entries = data.entries || entries; render(); status.textContent = "সফল! Website text সংরক্ষিত হয়েছে।";
      } catch (e) { status.textContent = "সংরক্ষণ হয়নি: " + e.message; }
    }
    $("contentSave").addEventListener("click", () => save(struckInput.checked));
    $("contentRestore").addEventListener("click", () => { struckInput.checked = false; save(false); });
    $("contentLoad").addEventListener("click", load);
    load();
  }

  // Dashboard section navigation (UI only; management actions remain disabled until APIs exist).
  const navItems = document.querySelectorAll(".nav-item[data-panel]");
  const modules = document.querySelectorAll(".module[id^='panel-']");
  navItems.forEach(item => item.addEventListener("click", () => {
    const target = item.dataset.panel;
    navItems.forEach(button => button.classList.toggle("active", button === item));
    modules.forEach(panel => panel.classList.toggle("active", panel.id === `panel-${target}`));
  }));

  $("logout")?.addEventListener("click", async () => {
    await signOut(auth);
    showLogin("আপনি নিরাপদে লগআউট করেছেন।");
  });

  onAuthStateChanged(auth, async user => {
    if (!user) return showLogin();
    setStatus("আগের Login-এর অনুমতি যাচাই হচ্ছে...");
    try {
      const profile = await verifyWithApi(user);
      showDashboard(profile);
    } catch (error) {
      await signOut(auth).catch(() => {});
      showLogin(error?.message || "Admin অনুমতি যাচাই করা যায়নি।", true);
    }
  });
})();
