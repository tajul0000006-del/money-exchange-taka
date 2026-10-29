// MoneyExchangeTaka frontend starter.
// Client-side code never approves requests or edits wallet balances.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, limit } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
let auth, db, currentUser = null, signupMode = false, unsubscribeRequests = null;
let toastTimer;
const trackingPrefix = "MET";
const safeText = (value, max = 300) => String(value || "").trim().slice(0, max);
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3400);
}
function firebaseConfigured() {
  return firebaseConfig?.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_")
    && firebaseConfig?.projectId && !firebaseConfig.projectId.startsWith("YOUR_");
}
function makeTrackingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return `${trackingPrefix}-${Array.from(bytes, b => alphabet[b % alphabet.length]).join("")}`;
}
function friendlyError(error) {
  const code = (error?.code || "").replace("auth/", "");
  const messages = {
    "email-already-in-use": "এই ইমেইল দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে।",
    "invalid-email": "সঠিক ইমেইল লিখুন।",
    "weak-password": "আরও শক্তিশালী পাসওয়ার্ড দিন (কমপক্ষে ৮ অক্ষর)।",
    "invalid-credential": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
    "network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
    "permission-denied": "Firebase Rules বা অনুমতি পরীক্ষা করতে হবে।"
  };
  return messages[code] || "কাজটি সম্পন্ন হয়নি। সেটিংস পরীক্ষা করে আবার চেষ্টা করুন।";
}
function showAuth(isSignup) {
  signupMode = isSignup;
  $("#authModal").hidden = false;
  $("#authTitle").textContent = isSignup ? "অ্যাকাউন্ট খুলুন" : "লগইন করুন";
  $("#authHelp").textContent = isSignup ? "আপনার নিজের ইমেইল ব্যবহার করুন।" : "আপনার অ্যাকাউন্টে প্রবেশ করুন।";
  $("#displayNameWrap").hidden = !isSignup;
  $("#displayName").required = isSignup;
  $("#authPassword").autocomplete = isSignup ? "new-password" : "current-password";
  $("#authSubmit").textContent = isSignup ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন";
  $("#switchLine").innerHTML = isSignup
    ? 'আগে থেকেই অ্যাকাউন্ট আছে? <button type="button" id="switchMode">লগইন করুন</button>'
    : 'নতুন ব্যবহারকারী? <button type="button" id="switchMode">অ্যাকাউন্ট খুলুন</button>';
  $("#switchMode").addEventListener("click", () => showAuth(!signupMode));
}
$("#year").textContent = new Date().getFullYear();
$("#menuToggle").addEventListener("click", () => {
  const opened = $("#mainNav").classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(opened));
});
$("#mainNav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  $("#mainNav").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
}));
$("#loginBtn").addEventListener("click", () => showAuth(false));
$("#signupBtn").addEventListener("click", () => showAuth(true));
$("#referralSignupBtn").addEventListener("click", () => showAuth(true));
$("#closeModal").addEventListener("click", () => $("#authModal").hidden = true);
$("#authModal").addEventListener("click", e => { if (e.target === $("#authModal")) $("#authModal").hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#authModal").hidden = true; });

document.querySelectorAll(".segment").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".segment").forEach(b => b.classList.toggle("active", b === button));
  $("#direction").value = button.dataset.direction;
  $("#amountHelp").textContent = button.dataset.direction === "sell"
    ? "আপনি যে পরিমাণ USD বিক্রি করতে চান তা লিখুন।"
    : "আপনি যে পরিমাণ USD কিনতে চান তা লিখুন।";
}));

if (!firebaseConfigured()) {
  $("#trackResult").textContent = "Firebase সেটআপের পর ট্র্যাকিং চালু হবে।";
  $("#authHelp").textContent = "Firebase সেটআপের পর লগইন ব্যবহার করা যাবে।";
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user => {
    currentUser = user;
    $("#logoutBtn").hidden = !user;
    $("#loginBtn").hidden = !!user;
    $("#signupBtn").hidden = !!user;
    if (unsubscribeRequests) { unsubscribeRequests(); unsubscribeRequests = null; }
    if (user) {
      toast(`স্বাগতম, ${user.displayName || "ব্যবহারকারী"}!`);
      loadMemberRequests(user.uid);
    }
  });
}
$("#logoutBtn").addEventListener("click", async () => {
  if (!auth) return toast("আগে Firebase সেটআপ করুন।");
  try { await signOut(auth); toast("আপনি লগআউট করেছেন।"); }
  catch (error) { toast(friendlyError(error)); }
});
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth) return toast("আগে README_SETUP.md অনুযায়ী Firebase সেটআপ করুন।");
  const email = safeText($("#authEmail").value, 150);
  const password = $("#authPassword").value;
  try {
    if (signupMode) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const name = safeText($("#displayName").value, 80);
      if (name) await updateProfile(credential.user, { displayName: name });
      toast("অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাইয়ের ব্যবস্থা পরবর্তী ধাপে যোগ করুন।");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast("লগইন সফল হয়েছে।");
    }
    $("#authModal").hidden = true;
    $("#authForm").reset();
  } catch (error) { toast(friendlyError(error)); }
});

/* Guest/member request: only stores a request, never transfers money. */
$("#exchangeForm").addEventListener("submit", async e => {
  e.preventDefault();
  const direction = $("#direction").value;
  const currency = $("#currency").value;
  const amount = Number($("#amount").value);
  const paymentMethod = $("#paymentMethod").value;
  const contact = safeText($("#contact").value, 25);
  const paymentAccount = safeText($("#paymentAccount").value, 80);
  const note = safeText($("#note").value, 300);
  const referralCode = safeText($("#referralCode").value, 24).toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return toast("সঠিক পরিমাণ লিখুন।");
  if (currency !== "USD") return toast("এই কারেন্সি এখনো চালু হয়নি। আপাতত USD নির্বাচন করুন।");
  if (contact.length < 6 || paymentAccount.length < 3) return toast("যোগাযোগ ও পেমেন্টের প্রয়োজনীয় তথ্য যাচাই করুন।");
  if (!db) {
    const code = makeTrackingCode();
    $("#requestResult").hidden = false;
    $("#requestResult").innerHTML = `<strong>ডেমো রিকোয়েস্ট তৈরি হয়েছে</strong><span class="tracking-code">${code}</span><small>এটি শুধু এই ডেমো সেশনের কোড; Firebase সংযুক্ত না থাকায় সার্ভারে সংরক্ষিত হয়নি।</small>`;
    toast("ডেমো মোড: রিকোয়েস্ট সার্ভারে জমা হয়নি।");
    return;
  }
  const trackingCode = makeTrackingCode();
  try {
    const payload = {
      trackingCode, direction, currency, amount, paymentMethod, contact, paymentAccount,
      note: note || null, referralCode: referralCode || null,
      uid: currentUser?.uid || null,
      requestType: currentUser ? "member" : "guest",
      status: "pending",
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "exchangeRequests"), payload);
    $("#requestResult").hidden = false;
    $("#requestResult").innerHTML = `<strong>আপনার রিকোয়েস্ট জমা হয়েছে</strong><span class="tracking-code">${trackingCode}</span><small>কোডটি সংরক্ষণ করুন। যাচাই শেষ না হওয়া পর্যন্ত কোনো লেনদেন সম্পন্ন হয়েছে বলে ধরে নেবেন না।</small>`;
    $("#trackingCode").value = trackingCode;
    $("#exchangeForm").reset();
    $("#direction").value = "sell";
    document.querySelectorAll(".segment").forEach(b => b.classList.toggle("active", b.dataset.direction === "sell"));
    toast("রিকোয়েস্ট জমা হয়েছে। ট্র্যাকিং কোডটি সংরক্ষণ করুন।");
  } catch (error) {
    toast(friendlyError(error));
  }
});





/* ===== নিরাপদ পাবলিক Tracking API ===== */
const TRACKING_API =
  "https://calm-field-e3f8.taijulsheikh60.workers.dev";

$("#trackForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const code = safeText($("#trackingCode").value, 32).toUpperCase();
  const result = $("#trackResult");

  if (!/^MET-[A-Z0-9]{7}$/.test(code)) {
    result.textContent = "সঠিক ট্র্যাকিং কোড লিখুন। যেমন: MET-NVYQZK7";
    return;
  }

  result.textContent = "ট্র্যাকিং স্ট্যাটাস যাচাই হচ্ছে...";

  try {
    const response = await fetch(
      `${TRACKING_API}/track?code=${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: { "Accept": "application/json" }
      }
    );

    if (!response.ok) {
      throw new Error(`API_ERROR_${response.status}`);
    }

    const data = await response.json();

    if (!data.found) {
      result.textContent = "এই ট্র্যাকিং কোডটি পাওয়া যায়নি। কোডটি যাচাই করুন।";
      return;
    }

    const statusLabels = {
      pending: "অপেক্ষমাণ — আপনার রিকোয়েস্ট যাচাই করা হচ্ছে।",
      processing: "প্রক্রিয়াধীন — আপনার রিকোয়েস্ট নিয়ে কাজ চলছে।",
      completed: "সম্পন্ন — রিকোয়েস্ট সম্পন্ন হয়েছে।",
      rejected: "বাতিল — আপনার রিকোয়েস্ট বাতিল করা হয়েছে।",
      cancelled: "বাতিল — রিকোয়েস্টটি বন্ধ করা হয়েছে।"
    };

    const status = String(data.status || "").toLowerCase();
    const message = statusLabels[status];

    result.textContent = message
      ? `ট্র্যাকিং কোড: ${data.trackingCode || code}\nস্ট্যাটাস: ${message}`
      : `ট্র্যাকিং কোড: ${code}\nস্ট্যাটাস: ${status || "অজানা"} — বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।`;

  } catch (error) {
    console.error("Tracking API error:", error);
    result.textContent =
      "এখন স্ট্যাটাস দেখা যাচ্ছে না। ইন্টারনেট বা সার্ভার পরীক্ষা করে আবার চেষ্টা করুন।";
  }
});
/* ===== Tracking API শেষ ===== */



function loadMemberRequests(uid) {
  // Member history is intentionally not rendered until the collection/rules are tested.
  // A future query must only return records belonging to this authenticated UID.
  $("#trackResult").textContent = "লগইন করা হয়েছে। ব্যক্তিগত ইতিহাস পরবর্তী নিরাপদ ধাপে সংযুক্ত হবে।";
}
