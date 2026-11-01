"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("requestTrackForm");
  const statusBox = document.getElementById("trackStatus");
  const resultBox = document.getElementById("trackResult");
  const button = document.getElementById("trackButton");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    resultBox.replaceChildren();
    statusBox.classList.remove("error");
    const trackingCode = document.getElementById("trackingCode").value.trim().toUpperCase();
    const phoneLast4 = document.getElementById("phoneLast4").value.trim();
    if (!/^MET-[A-Z0-9]{4,20}$/.test(trackingCode)) {
      statusBox.textContent = "সঠিক Tracking Code লিখুন (যেমন MET-ABC123)।";
      statusBox.classList.add("error");
      return;
    }
    if (!/^\d{4}$/.test(phoneLast4)) {
      statusBox.textContent = "ফোন নম্বরের শেষ ৪টি সংখ্যা লিখুন।";
      statusBox.classList.add("error");
      return;
    }
    button.disabled = true;
    button.textContent = "যাচাই হচ্ছে...";
    statusBox.textContent = "আপনার রিকোয়েস্ট খোঁজা হচ্ছে...";
    try {
      const response = await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingCode, phoneLast4 })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "রিকোয়েস্ট পাওয়া যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।");
      const labels = {
        pending: "Pending · যাচাই চলছে",
        approved: "Approved · অনুমোদিত",
        rejected: "Rejected · বাতিল"
      };
      const card = document.createElement("div");
      card.className = "track-result";
      const title = document.createElement("h2");
      title.textContent = data.trackingCode || trackingCode;
      const state = document.createElement("p");
      state.textContent = labels[data.status] || "Pending";
      const detail = document.createElement("p");
      detail.textContent = (data.direction === "sell" ? "Sell" : data.direction === "buy" ? "Buy" : "Exchange") + " · " + (data.paymentMethod || "Payment method");
      const amount = document.createElement("p");
      amount.textContent = data.amount == null ? "পরিমাণ: —" : "পরিমাণ: " + Number(data.amount).toLocaleString("en-US") + " " + (data.currency || "");
      card.append(title, state, detail, amount);
      resultBox.append(card);
      statusBox.textContent = "আপনার রিকোয়েস্ট পাওয়া গেছে।";
    } catch (error) {
      statusBox.textContent = error.message || "এই মুহূর্তে স্ট্যাটাস দেখা যাচ্ছে না। পরে আবার চেষ্টা করুন।";
      statusBox.classList.add("error");
    } finally {
      button.disabled = false;
      button.textContent = "স্ট্যাটাস দেখুন";
    }
  });
});