/* =====================================================
   MoneyExchangeTaka - Frontend JavaScript
   Client-side code never approves requests or edits balances.
   ===================================================== */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";


/* =====================================================
   1. GLOBAL VARIABLES AND HELPERS
   ===================================================== */

const $ = (selector) => document.querySelector(selector);

let auth;
let db;
let currentUser = null;
let signupMode = false;
let toastTimer;

const trackingPrefix = "MET";

const TRACKING_API =
  "https://calm-field-e3f8.taijulsheikh60.workers.dev";

const safeText = (value, max = 300) =>
  String(value || "").trim().slice(0, max);


/* =====================================================
   2. TOAST NOTIFICATION
   ===================================================== */

function toast(message) {
  const element = $("#toast");

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3400);
}


/* =====================================================
   3. FIREBASE CONFIGURATION CHECK
   ===================================================== */

function firebaseConfigured() {
  return Boolean(
    firebaseConfig?.apiKey &&
    !firebaseConfig.apiKey.startsWith("PASTE_") &&
    firebaseConfig?.projectId &&
    !firebaseConfig.projectId.startsWith("YOUR_")
  );
}


/* =====================================================
   4. GENERATE TRACKING CODE
   ===================================================== */

function makeTrackingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(7);

  crypto.getRandomValues(bytes);

  return `${trackingPrefix}-${Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length]
  ).join("")}`;
}


/* =====================================================
   5. USER-FRIENDLY FIREBASE ERRORS
   ===================================================== */

function friendlyError(error) {
  const code = (error?.code || "").replace("auth/", "");

  const messages = {
    "email-already-in-use":
      "এই ইমেইল দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে।",

    "invalid-email":
      "সঠিক ইমেইল লিখুন।",

    "weak-password":
      "আরও শক্তিশালী পাসওয়ার্ড দিন (কমপক্ষে ৮ অক্ষর)।",

    "invalid-credential":
      "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",

    "network-request-failed":
      "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",

    "permission-denied":
      "Firebase Rules বা অনুমতি পরীক্ষা করতে হবে।"
  };

  return messages[code] ||
    "কাজটি সম্পন্ন হয়নি। সেটিংস পরীক্ষা করে আবার চেষ্টা করুন।";
}


/* =====================================================
   6. LOGIN AND SIGNUP MODAL
   ===================================================== */

function showAuth(isSignup) {
  signupMode = isSignup;

  $("#authModal").hidden = false;

  $("#authTitle").textContent = isSignup
    ? "অ্যাকাউন্ট খুলুন"
    : "লগইন করুন";

  $("#authHelp").textContent = isSignup
    ? "আপনার নিজের ইমেইল ব্যবহার করুন।"
    : "আপনার অ্যাকাউন্টে প্রবেশ করুন।";

  $("#displayNameWrap").hidden = !isSignup;
  $("#displayName").required = isSignup;

  $("#authPassword").autocomplete = isSignup
    ? "new-password"
    : "current-password";

  $("#authSubmit").textContent = isSignup
    ? "অ্যাকাউন্ট তৈরি করুন"
    : "লগইন করুন";

  $("#switchLine").innerHTML = isSignup
    ? 'আগে থেকেই অ্যাকাউন্ট আছে? <button type="button" id="switchMode">লগইন করুন</button>'
    : 'নতুন ব্যবহারকারী? <button type="button" id="switchMode">অ্যাকাউন্ট খুলুন</button>';

  $("#switchMode").addEventListener("click", () => {
    showAuth(!signupMode);
  });
}


/* =====================================================
   7. INITIAL PAGE SETUP AND NAVIGATION
   ===================================================== */

$("#year").textContent = new Date().getFullYear();

$("#menuToggle").addEventListener("click", () => {
  const opened = $("#mainNav").classList.toggle("open");

  $("#menuToggle").setAttribute(
    "aria-expanded",
    String(opened)
  );
});

$("#mainNav").querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    $("#mainNav").classList.remove("open");

    $("#menuToggle").setAttribute(
      "aria-expanded",
      "false"
    );
  });
});


/* =====================================================
   8. AUTH BUTTONS AND MODAL EVENTS
   ===================================================== */

$("#loginBtn").addEventListener("click", () => {
  showAuth(false);
});

$("#signupBtn").addEventListener("click", () => {
  showAuth(true);
});

$("#referralSignupBtn").addEventListener("click", () => {
  showAuth(true);
});

$("#closeModal").addEventListener("click", () => {
  $("#authModal").hidden = true;
});

$("#authModal").addEventListener("click", (event) => {
  if (event.target === $("#authModal")) {
    $("#authModal").hidden = true;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    $("#authModal").hidden = true;
  }
});


/* =====================================================
   9. BUY / SELL SEGMENT BUTTONS
   ===================================================== */

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    $("#direction").value = button.dataset.direction;

    $("#amountHelp").textContent =
      button.dataset.direction === "sell"
        ? "আপনি যে পরিমাণ USD বিক্রি করতে চান তা লিখুন।"
        : "আপনি যে পরিমাণ USD কিনতে চান তা লিখুন।";
  });
});


/* =====================================================
   10. INITIALIZE FIREBASE AND WATCH LOGIN STATE
   ===================================================== */

if (!firebaseConfigured()) {
  $("#trackResult").textContent =
    "Firebase সেটআপের পর ট্র্যাকিং চালু হবে।";

  $("#authHelp").textContent =
    "Firebase সেটআপের পর লগইন ব্যবহার করা যাবে।";

} else {
  const app = initializeApp(firebaseConfig);

  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    $("#logoutBtn").hidden = !user;
    $("#loginBtn").hidden = !!user;
    $("#signupBtn").hidden = !!user;

    if (user) {
      toast(`স্বাগতম, ${user.displayName || "ব্যবহারকারী"}!`);

      // ব্যক্তিগত ইতিহাসের ফিচার পরে যোগ করা হবে।
      loadMemberRequests(user.uid);
    }
  });
}


/* =====================================================
   11. LOGOUT
   ===================================================== */

$("#logoutBtn").addEventListener("click", async () => {
  if (!auth) {
    return toast("আগে Firebase সেটআপ করুন।");
  }

  try {
    await signOut(auth);
    toast("আপনি লগআউট করেছেন।");
  } catch (error) {
    toast(friendlyError(error));
  }
});


/* =====================================================
   12. LOGIN AND SIGNUP FORM
   ===================================================== */

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!auth) {
    return toast("আগে README_SETUP.md অনুযায়ী Firebase সেটআপ করুন।");
  }

  const email = safeText($("#authEmail").value, 150);
  const password = $("#authPassword").value;

  try {
    if (signupMode) {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const name = safeText($("#displayName").value, 80);

      if (name) {
        await updateProfile(credential.user, {
          displayName: name
        });
      }

      toast(
        "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাইয়ের ব্যবস্থা পরবর্তী ধাপে যোগ করুন।"
      );

    } else {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      toast("লগইন সফল হয়েছে।");
    }

    $("#authModal").hidden = true;
    $("#authForm").reset();

  } catch (error) {
    toast(friendlyError(error));
  }
});


/* =====================================================
   13. EXCHANGE REQUEST FORM
   Saves a request only; does not transfer money.
   ===================================================== */

$("#exchangeForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const direction = $("#direction").value;
  const currency = $("#currency").value;
  const amount = Number($("#amount").value);
  const paymentMethod = $("#paymentMethod").value;
  const contact = safeText($("#contact").value, 25);
  const paymentAccount = safeText(
    $("#paymentAccount").value,
    80
  );
  const note = safeText($("#note").value, 300);

  const referralCode = safeText(
    $("#referralCode").value,
    24
  ).toUpperCase();

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000
  ) {
    return toast("সঠিক পরিমাণ লিখুন।");
  }

  if (currency !== "USD") {
    return toast(
      "এই কারেন্সি এখনো চালু হয়নি। আপাতত USD নির্বাচন করুন।"
    );
  }

  if (contact.length < 6 || paymentAccount.length < 3) {
    return toast("যোগাযোগ ও পেমেন্টের প্রয়োজনীয় তথ্য যাচাই করুন।");
  }

  // Firebase unavailable: demo mode only.
  if (!db) {
    const code = makeTrackingCode();
    const requestResult = $("#requestResult");

    requestResult.hidden = false;
    requestResult.replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = "ডেমো রিকোয়েস্ট তৈরি হয়েছে";

    const tracking = document.createElement("span");
    tracking.className = "tracking-code";
    tracking.textContent = code;

    const noteText = document.createElement("small");
    noteText.textContent =
      "এটি শুধু এই ডেমো সেশনের কোড; Firebase সংযুক্ত না থাকায় সার্ভারে সংরক্ষিত হয়নি।";

    requestResult.append(heading, tracking, noteText);

    toast("ডেমো মোড: রিকোয়েস্ট সার্ভারে জমা হয়নি।");
    return;
  }

  const trackingCode = makeTrackingCode();

  try {
    const payload = {
      trackingCode,
      direction,
      currency,
      amount,
      paymentMethod,
      contact,
      paymentAccount,
      note: note || null,
      referralCode: referralCode || null,
      uid: currentUser?.uid || null,
      requestType: currentUser ? "member" : "guest",
      status: "pending",
      createdAt: serverTimestamp()
    };

    await addDoc(
      collection(db, "exchangeRequests"),
      payload
    );

    const requestResult = $("#requestResult");
    requestResult.hidden = false;
    requestResult.replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = "আপনার রিকোয়েস্ট জমা হয়েছে";

    const tracking = document.createElement("span");
    tracking.className = "tracking-code";
    tracking.textContent = trackingCode;

    const noteText = document.createElement("small");
    noteText.textContent =
      "কোডটি সংরক্ষণ করুন। যাচাই শেষ না হওয়া পর্যন্ত কোনো লেনদেন সম্পন্ন হয়েছে বলে ধরে নেবেন না।";

    requestResult.append(heading, tracking, noteText);

    $("#trackingCode").value = trackingCode;

    $("#exchangeForm").reset();
    $("#direction").value = "sell";

    document.querySelectorAll(".segment").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.direction === "sell"
      );
    });

    toast("রিকোয়েস্ট জমা হয়েছে। ট্র্যাকিং কোডটি সংরক্ষণ করুন।");

  } catch (error) {
    toast(friendlyError(error));
  }
});


/* =====================================================
   14. PUBLIC TRACKING API
   ===================================================== */

$("#trackForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = safeText(
    $("#trackingCode").value,
    32
  ).toUpperCase();

  const result = $("#trackResult");

  // Validate tracking code before sending the request.
  if (!/^MET-[A-Z0-9]{7}$/.test(code)) {
    result.textContent =
      "সঠিক ট্র্যাকিং কোড লিখুন। যেমন: MET-NVYQZK7";
    return;
  }

  result.textContent =
    "ট্র্যাকিং স্ট্যাটাস যাচাই হচ্ছে...";

  try {
    const response = await fetch(
      `${TRACKING_API}/track?code=${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API_ERROR_${response.status}`);
    }

    const data = await response.json();

    if (data.found !== true) {
      result.textContent =
        "এই ট্র্যাকিং কোডটি পাওয়া যায়নি। কোডটি যাচাই করুন।";
      return;
    }

    const status = String(
      data.status || ""
    ).toLowerCase();

    const statusLabels = {
      pending:
        "অপেক্ষমাণ — আপনার রিকোয়েস্ট যাচাই করা হচ্ছে।",

      processing:
        "প্রক্রিয়াধীন — আপনার রিকোয়েস্ট নিয়ে কাজ চলছে।",

      completed:
        "সম্পন্ন — রিকোয়েস্ট সম্পন্ন হয়েছে।",

      rejected:
        "বাতিল — আপনার রিকোয়েস্ট বাতিল করা হয়েছে।",

      cancelled:
        "বাতিল — রিকোয়েস্টটি বন্ধ করা হয়েছে।"
    };

    const message = statusLabels[status];

    if (message) {
      result.textContent =
        `ট্র্যাকিং কোড: ${data.trackingCode || code}\n` +
        `স্ট্যাটাস: ${message}`;

    } else {
      result.textContent =
        `ট্র্যাকিং কোড: ${code}\n` +
        `স্ট্যাটাস: ${status || "অজানা"} — বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।`;
    }

  } catch (error) {
    console.error("Tracking API error:", error);

    result.textContent =
      "এখন স্ট্যাটাস দেখা যাচ্ছে না। ইন্টারনেট বা সার্ভার পরীক্ষা করে আবার চেষ্টা করুন।";
  }
});


/* =====================================================
   15. MEMBER REQUEST HISTORY PLACEHOLDER
   Does not overwrite the tracking result.
   ===================================================== */

function loadMemberRequests(uid) {
  // ব্যক্তিগত রিকোয়েস্টের ইতিহাস পরে নিরাপদভাবে যুক্ত করা হবে।
  // এখানে Tracking ফলাফল পরিবর্তন করা হবে না।
  }
