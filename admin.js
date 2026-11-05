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
    setupExchangeSettingsEditor();
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
        transactionReference: "Reference Number", paymentAccount: "Payment Account",
        proofScreenshotUrl: "Payment Proof Screenshot", proofFileName: "Proof File Name",
        trackingCode: "Tracking Code", requestId: "Request ID", documentId: "Document ID",
        contactMethod: "Contact Method", paymentMethod: "Payment Method", direction: "Exchange Type",
        amount: "Amount", currency: "Currency", status: "Request Status", createdAt: "Submitted At",
        statusUpdatedAt: "Last Status Update", statusUpdatedBy: "Updated By",
        affiliateCode: "Affiliate Code", proofEmail: "Proof Email", contact: "Contact",
        note: "Note", uid: "User Account ID", requestType: "Request Type",
        customer: "Customer", type: "Request Type", proofSubmittedAt: "Proof Submitted At"
      };
      const safeText = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
      const prettyDate = value => {
        if (value && typeof value === "object" && value._seconds) value = value._seconds * 1000;
        const date = typeof value === "number" ? new Date(value) : new Date(value);
        return Number.isNaN(date.getTime()) ? String(value ?? "—") : date.toLocaleString("bn-BD");
      };
      const status = String(request.status || "unknown").toLowerCase();
      const statusColor = status === "approved" ? "#087443" : status === "rejected" ? "#b42318" : "#9a6700";
      content.replaceChildren();

      const summary = document.createElement("div");
      summary.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:9px;margin-bottom:16px";
      const summaryCard = (title, value, color) => {
        const card = document.createElement("div");
        card.style.cssText = "padding:12px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;min-width:0";
        const small = document.createElement("div"); small.textContent = title;
        small.style.cssText = "font-size:12px;color:#64748b;margin-bottom:5px";
        const strong = document.createElement("strong"); strong.textContent = value;
        strong.style.cssText = "font-size:15px;color:" + (color || "#172033") + ";overflow-wrap:anywhere";
        card.append(small, strong); summary.append(card);
      };
      summaryCard("Tracking Code", request.trackingCode || request.requestId || "—");
      summaryCard("Request Status", status.toUpperCase(), statusColor);
      summaryCard("Request Type", request.requestType || (request.uid ? "Registered" : "Guest"));
      content.appendChild(summary);

      const addSection = title => {
        const heading = document.createElement("h3");
        heading.textContent = title;
        heading.style.cssText = "font-size:15px;margin:18px 0 4px;color:#1769aa";
        content.appendChild(heading);
      };
      const addRow = (key, rawValue) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;flex-direction:column;gap:5px;padding:11px 0;border-bottom:1px solid #e7eaf0;min-width:0";
        const label = document.createElement("strong");
        label.textContent = labels[key] || key;
        label.style.cssText = "font-size:13px;color:#64748b;overflow-wrap:anywhere";
        const value = document.createElement("div");
        value.style.cssText = "font-size:14px;color:#172033;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;min-width:0";
        let display = rawValue;
        if (rawValue && typeof rawValue === "object") {
          if (rawValue._seconds) display = prettyDate(rawValue);
          else display = JSON.stringify(rawValue, null, 2);
        } else if (/(At|Date|createdAt|UpdatedAt)$/i.test(key) && rawValue) display = prettyDate(rawValue);
        if (key === "proofScreenshotUrl" && typeof rawValue === "string" && /^https:\/\//i.test(rawValue)) {
          const previewLink = document.createElement("a");
          previewLink.href = rawValue; previewLink.target = "_blank"; previewLink.rel = "noopener noreferrer";
          previewLink.style.cssText = "display:block;max-width:100%";
          const preview = document.createElement("img");
          preview.src = rawValue; preview.alt = "Payment proof screenshot"; preview.loading = "lazy";
          preview.style.cssText = "display:block;width:100%;max-width:320px;max-height:420px;object-fit:contain;border:1px solid #dbe3ec;border-radius:10px;background:#f8fafc";
          preview.onerror = () => { previewLink.remove(); value.textContent = "ছবি লোড হয়নি — নিচের লিংক দিয়ে খুলুন।"; };
          previewLink.appendChild(preview); value.appendChild(previewLink);
          const link = document.createElement("a"); link.href = rawValue; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = "ছবি আলাদা করে খুলুন"; link.style.cssText = "display:inline-block;margin-top:8px;color:#1769aa;text-decoration:underline;font-weight:600";
          value.appendChild(link);
        } else {
          value.textContent = display == null || display === "" ? "—" : String(display);
        }
        if (["trackingCode", "requestId", "documentId"].includes(key) && rawValue) {
          const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Copy";
          copy.className = "outline"; copy.style.cssText = "align-self:flex-start;margin-top:5px;padding:5px 10px";
          copy.addEventListener("click", async () => {
            try { await navigator.clipboard.writeText(String(rawValue)); copy.textContent = "Copied ✓"; }
            catch (_) { copy.textContent = "Copy unavailable"; }
          });
          row.append(label, value, copy);
        } else row.append(label, value);
        content.appendChild(row);
      };

      addSection("Customer & Request");
      const primaryKeys = ["customer", "contact", "contactMethod", "uid", "requestType", "type", "direction", "amount", "currency", "createdAt", "proofSubmittedAt"];
      primaryKeys.forEach(key => { if (request[key] !== undefined) addRow(key, request[key]); });
      addSection("Payment Information");
      ["paymentMethod", "paymentAccount", "transactionReference", "proofEmail", "proofFileName", "proofScreenshotUrl", "note", "affiliateCode"].forEach(key => {
        if (request[key] !== undefined) addRow(key, request[key]);
      });
      addSection("Tracking & Admin");
      ["trackingCode", "requestId", "documentId", "status", "statusUpdatedAt", "statusUpdatedBy"].forEach(key => {
        if (request[key] !== undefined) addRow(key, request[key]);
      });
      const known = new Set([...primaryKeys, "paymentMethod", "paymentAccount", "transactionReference", "proofEmail", "proofFileName", "proofScreenshotUrl", "note", "affiliateCode", "trackingCode", "requestId", "documentId", "status", "statusUpdatedAt", "statusUpdatedBy", "statusHistory"]);
      const extra = Object.entries(request).filter(([key]) => !known.has(key));
      if (extra.length) {
        addSection("Other Information");
        extra.forEach(([key, value]) => addRow(key, value));
      }

      if (Array.isArray(request.statusHistory) && request.statusHistory.length) {
        addSection("Status History");
        const timeline = document.createElement("div");
        timeline.style.cssText = "border-left:2px solid #cbd5e1;margin:8px 0 4px 8px;padding-left:14px;display:grid;gap:12px";
        request.statusHistory.forEach(item => {
          const event = document.createElement("div");
          event.style.cssText = "position:relative;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#fff";
          const dot = document.createElement("span");
          dot.style.cssText = "position:absolute;width:10px;height:10px;border-radius:50%;background:#1769aa;left:-20px;top:15px";
          const transition = document.createElement("strong");
          transition.textContent = (item.from || "new").toUpperCase() + " → " + (item.to || "unknown").toUpperCase();
          transition.style.cssText = "font-size:13px;color:#172033";
          const when = document.createElement("div"); when.textContent = item.at ? prettyDate(item.at) : "সময় পাওয়া যায়নি";
          when.style.cssText = "font-size:12px;color:#64748b;margin-top:4px";
          const by = document.createElement("div"); by.textContent = "Admin UID: " + (item.by || "—");
          by.style.cssText = "font-size:12px;color:#64748b;overflow-wrap:anywhere";
          event.append(dot, transition, when, by);
          if (item.message) { const note = document.createElement("p"); note.textContent = item.message; note.style.cssText = "font-size:13px;margin:6px 0 0;white-space:pre-wrap"; event.appendChild(note); }
          timeline.appendChild(event);
        });
        content.appendChild(timeline);
      }
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


  // Owner-controlled currency, rate and payment configuration via the separate Admin Worker.
  function setupExchangeSettingsEditor() {
    const currencyPanel = $("panel-currencies");
    const paymentPanel = $("panel-payments");
    if (!currencyPanel || $("exchangeSettingsEditor")) return;
    const root = document.createElement("div");
    root.id = "exchangeSettingsEditor";
    root.className = "info-strip";
    root.style.cssText = "margin-top:18px;background:#f7fbff;border:1px solid #cfe0ef;padding:15px;border-radius:12px;color:#263b50";
    root.innerHTML = `
      <h3 style="margin:0 0 6px">Live Currency & Payment Control</h3>
      <p style="margin:0 0 12px">এখানে Currency Name, Logo URL, fallback mark, subtitle, currency code, group type, rate, payment address এবং visibility পরিবর্তন করুন। একই Active/Visible settings Homepage-এর FastMoney Network section-এও দেখাবে। সব পরিবর্তন Firestore-এর exchangeSettings/global ডকুমেন্টে Save All Settings চাপলে সংরক্ষিত হবে।</p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <label>Global Fee (%)<input id="exGlobalFee" type="number" min="0" max="100" step="0.01"></label>
        <label>Minimum BDT<input id="exMinBdt" type="number" min="0" step="0.01"></label>
        <label>Maximum BDT<input id="exMaxBdt" type="number" min="0" step="0.01"></label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px">
        <button type="button" id="exReload" class="outline">Reload Settings</button>
        <button type="button" id="exSaveAll">Save All Settings</button>
      </div>
      <div id="exCurrencyCards" style="display:grid;gap:12px"></div>
      <h3 style="margin:18px 0 8px">Add New Currency</h3><p style="margin:0 0 10px;font-size:12px;color:#526579">নতুন Currency যোগ করলে আগে Editor-এ যুক্ত হবে। Homepage-এ প্রকাশ করতে Save All Settings চাপুন। Remove করলেও স্থায়ীভাবে সরাতে Save All Settings প্রয়োজন।</p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
        <label>Unique ID<input id="exNewId" placeholder="e.g. newwallet"></label>
        <label>Currency Name<input id="exNewName" placeholder="e.g. New Wallet USD"></label>
        <label>Currency Code<input id="exNewCode" placeholder="USD / BDT / USDT"></label>
        <label>Type<select id="exNewType"><option value="usd">USD</option><option value="bdt">BDT</option><option value="crypto">Crypto</option><option value="other">Other</option></select></label>
      </div>
      <button type="button" class="outline" id="exAddCurrency">Add Currency to Editor</button>
      <p id="exSettingsStatus" role="status" aria-live="polite" style="margin:10px 0 0"></p>`;
    currencyPanel.appendChild(root);
    if (paymentPanel) {
      const note = document.createElement("div");
      note.className = "info-strip";
      note.innerHTML = "<b>Payment account settings</b><p>Edit each currency’s payment address, address label, accepted payment type, and additional instructions in its Currency Control card. Select Save All Settings to save your changes.";
      paymentPanel.appendChild(note);
    }
    const status = $("exSettingsStatus");
    const cards = $("exCurrencyCards");
    let settings = null;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const api = async (method, path, body) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Admin session পাওয়া যায়নি। আবার লগইন করুন।");
      const token = await user.getIdToken(true);
      const response = await fetch(REQUEST_API_BASE + path, {
        method,
        headers: { Authorization: "Bearer " + token, ...(body ? {"content-type":"application/json"} : {}) },
        ...(body ? {body: JSON.stringify(body)} : {}),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Settings API error (" + response.status + ")");
      return data;
    };
    const field = (index, key, label, value, type = "text", step = "") => {
      const safe = esc(value);
      return '<label style="display:block;margin:5px 0;font-size:13px">' + label +
        '<input data-currency-index="' + index + '" data-currency-field="' + key + '" type="' + type + '" value="' + safe + '"' +
        (step ? ' step="' + step + '"' : "") + ' style="width:100%;padding:8px;border:1px solid #d5e0e8;border-radius:7px;background:#fff;color:#172033"></label>';
    };
    const toggle = (index, key, label, checked) =>
      '<label style="display:flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:12px"><input data-currency-index="' + index + '" data-currency-field="' + key + '" type="checkbox" ' + (checked ? "checked" : "") + ' style="width:auto;margin:0">' + label + '</label>';
    function render() {
      cards.replaceChildren();
      if (!settings || !Array.isArray(settings.currencies)) return;
      $("exGlobalFee").value = settings.feePercent ?? 1;
      $("exMinBdt").value = settings.limits?.minBdt ?? 500;
      $("exMaxBdt").value = settings.limits?.maxBdt ?? 10000;
      settings.currencies.forEach((c, i) => {
        const card = document.createElement("article");
        card.style.cssText = "background:#fff;border:1px solid #dbe5ec;border-radius:10px;padding:12px;min-width:0";
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              ${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.style.display='none'" style="width:38px;height:38px;object-fit:contain;background:#f2f6fa;border:1px solid #e1e8ef;border-radius:9px;padding:4px">` : ""}
              <div><strong>${esc(c.name || c.id)}</strong><div style="font-size:11px;color:#64748b">${esc(c.currency || "")} · ${esc(c.type || "other")}</div></div>
            </div>
            <button type="button" class="danger exRemoveCurrency" data-index="${i}" style="padding:5px 9px">Remove</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px">
            ${field(i,"id","Currency ID",c.id)}
            ${field(i,"name","Display Name",c.name)}
            ${field(i,"subtitle","Subtitle",c.subtitle)}
            ${field(i,"currency","Currency Code",c.currency)}
            <label style="font-size:13px;margin:5px 0">Currency Type<select data-currency-index="${i}" data-currency-field="type" style="width:100%;padding:8px;border:1px solid #d5e0e8;border-radius:7px"><option value="bdt" ${c.type==="bdt"?"selected":""}>BDT</option><option value="usd" ${c.type==="usd"?"selected":""}>USD</option><option value="crypto" ${c.type==="crypto"?"selected":""}>Crypto</option><option value="other" ${c.type==="other"?"selected":""}>Other</option></select></label>
            ${field(i,"buy","Buy Rate",c.buy,"number","0.000001")}
            ${field(i,"sell","Sell Rate",c.sell,"number","0.000001")}
            ${field(i,"feePercent","Individual Fee %",c.feePercent ?? "","number","0.01")}
            ${field(i,"logo","Logo URL (Cloudinary / HTTPS)",c.logo)}
            ${field(i,"short","Logo Fallback Text",c.short || c.name || c.id)}
            ${field(i,"paymentAddress","Payment Address / ID",c.paymentAddress)}
            ${field(i,"paymentAddressLabel","Payment Address Label (e.g. bKash Agent Number)",c.paymentAddressLabel || (c.name + " Number / Wallet Address"))}
            ${field(i,"paymentPlaceholder","Address Placeholder",c.paymentPlaceholder)}
            <label style="grid-column:1/-1;font-size:13px;margin:5px 0">Accepted Payment Type<select data-currency-index="${i}" data-currency-field="paymentRule" style="width:100%;padding:8px;border:1px solid #d5e0e8;border-radius:7px"><option value="send_money_only" ${c.paymentRule==="send_money_only"?"selected":""}>Only Send Money Accepted</option><option value="cash_out_only" ${c.paymentRule==="cash_out_only"?"selected":""}>Only Cash Out Accepted</option><option value="both" ${c.paymentRule==="both"?"selected":""}>Send Money and Cash Out Accepted</option><option value="custom" ${!c.paymentRule || c.paymentRule==="custom"?"selected":""}>Custom Instruction</option></select></label>
            <label style="grid-column:1/-1;font-size:13px;margin:5px 0">Additional / Custom Payment Instruction<textarea data-currency-index="${i}" data-currency-field="paymentInstruction" rows="2" placeholder="Write any extra payment instructions in English" style="width:100%;padding:8px;border:1px solid #d5e0e8;border-radius:7px">${esc(c.paymentInstruction)}</textarea></label>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:3px 8px;border-top:1px solid #edf1f4;margin-top:8px;padding-top:8px">
            ${toggle(i,"enabled","Enabled",c.enabled !== false)}
            ${toggle(i,"hidden","Hide from public list",c.hidden === true)}
            ${toggle(i,"sendEnabled","Send Payment",c.sendEnabled !== false)}
            ${toggle(i,"receiveEnabled","Receive Payment",c.receiveEnabled !== false)}
            ${toggle(i,"buyEnabled","Buy",c.buyEnabled !== false)}
            ${toggle(i,"sellEnabled","Sell",c.sellEnabled !== false)}
          </div>`;
        cards.appendChild(card);
      });
    }
    function collect() {
      cards.querySelectorAll("[data-currency-index][data-currency-field]").forEach(el => {
        const item = settings.currencies[Number(el.dataset.currencyIndex)];
        if (!item) return;
        const key = el.dataset.currencyField;
        if (el.type === "checkbox") item[key] = el.checked;
        else if (el.type === "number") item[key] = el.value.trim() === "" && key === "feePercent" ? null : Number(el.value);
        else item[key] = el.value;
      });
      settings.feePercent = Number($("exGlobalFee").value);
      settings.limits = {minBdt:Number($("exMinBdt").value),maxBdt:Number($("exMaxBdt").value)};
    }
    async function load() {
      status.textContent = "Exchange settings Firestore থেকে লোড হচ্ছে...";
      try {
        const data = await api("GET","/api/admin/exchange-settings");
        settings = data.settings;
        render();
        status.textContent = "সফল! " + settings.currencies.length + "টি currency settings লোড হয়েছে।";
      } catch (error) { status.textContent = "Settings লোড হয়নি: " + error.message; }
    }
    async function save() {
      collect();
      status.textContent = "সব Currency ও Payment Settings সংরক্ষণ হচ্ছে...";
      try {
        const data = await api("PUT","/api/admin/exchange-settings",{settings});
        settings = data.settings;
        render();
        status.textContent = "সফল! " + settings.currencies.length + "টি currency/payment settings Firestore-এ সংরক্ষিত হয়েছে।";
      } catch (error) { status.textContent = "সংরক্ষণ হয়নি: " + error.message; }
    }
    $("exReload").addEventListener("click",load);
    $("exSaveAll").addEventListener("click",save);
    $("exAddCurrency").addEventListener("click",() => {
      if (!settings) return;
      const id = $("exNewId").value.trim().toLowerCase();
      const name = $("exNewName").value.trim();
      const currency = $("exNewCode").value.trim().toUpperCase();
      const type = $("exNewType").value;
      if (!/^[a-z0-9_-]{2,40}$/.test(id) || !name || !/^[A-Z0-9]{2,12}$/.test(currency)) {
        status.textContent = "সঠিক ID, Name ও Currency Code লিখুন।"; return;
      }
      if (settings.currencies.some(c => c.id === id)) { status.textContent = "এই Currency ID আগে থেকেই আছে।"; return; }
      collect();
      settings.currencies.push({id,name,subtitle:"",currency,type,logo:"",buy:1,sell:1,enabled:true,hidden:false,sendEnabled:true,receiveEnabled:true,buyEnabled:true,sellEnabled:true,feePercent:null,paymentAddress:"",paymentAddressLabel:"",paymentPlaceholder:"",paymentRule:"send_money_only",paymentInstruction:"",short:name.slice(0,3)});
      $("exNewId").value = $("exNewName").value = $("exNewCode").value = "";
      render(); status.textContent = "নতুন Currency যোগ হয়েছে। স্থায়ী করতে Save All Settings চাপুন।";
    });
    cards.addEventListener("click",event => {
      const button = event.target.closest(".exRemoveCurrency");
      if (!button || !settings) return;
      const index = Number(button.dataset.index);
      const item = settings.currencies[index];
      if (!item || !confirm((item.name || item.id) + " মুছে ফেলবেন? Save All Settings চাপলে পরিবর্তন স্থায়ী হবে।")) return;
      collect();
      settings.currencies.splice(index,1); render();
      status.textContent = "Currency সরানো হয়েছে। স্থায়ী করতে Save All Settings চাপুন।";
    });
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
