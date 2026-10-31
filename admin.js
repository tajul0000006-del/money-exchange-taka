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
