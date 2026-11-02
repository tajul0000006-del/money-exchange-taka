/* Reliable five-step exchange wizard controller. */
(function () {
  "use strict";
  function initExchangeWizard() {
    const form = document.getElementById("exchangeForm");
    if (!form || form.dataset.wizardReady === "yes") return;
    form.dataset.wizardReady = "yes";
    const $ = (id) => document.getElementById(id);
    let currentStep = 1;
    const panels = Array.from(form.querySelectorAll("[data-step-panel]"));
    const indicators = Array.from(form.querySelectorAll("[data-step-indicator]"));
    const modes = Array.from(form.querySelectorAll("[data-mode]"));

    function selectedText(id) {
      const el = $(id);
      return el && el.selectedOptions && el.selectedOptions[0]
        ? el.selectedOptions[0].textContent.trim() : "—";
    }
    function updateReview() {
      const from = selectedText("fromWallet");
      const to = selectedText("toWallet");
      const amountEl = $("amount");
      const amount = amountEl ? amountEl.value || "—" : "—";
      const currency = $("amountCurrency") ? $("amountCurrency").textContent : "";
      const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
      set("stepReviewSend", from);
      set("stepReviewReceive", to);
      set("finalRoute", from + " → " + to);
      set("finalSend", amount + " " + currency);
      set("finalReceive", $("receivePreview") ? $("receivePreview").textContent : "—");
      set("finalAccount", $("account") ? $("account").value.trim() || "Not entered" : "Not entered");
      const info = window.metGetPaymentInfo ? window.metGetPaymentInfo($("fromWallet")?.value) : null;
      set("payMethodDisplay", info?.name || from);
      set("payAmountDisplay", $("payPreview")?.textContent || "—");
      set("payAddressDisplay", info?.address || "পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি।");
      set("proofMethodDisplay", info?.name || from);
      set("proofAmountDisplay", $("payPreview")?.textContent || "—");
    }
    function showStep(step) {
      currentStep = Math.max(1, Math.min(5, Number(step) || 1));
      panels.forEach(panel => {
        const active = Number(panel.dataset.stepPanel) === currentStep;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
      });
      indicators.forEach(item => {
        const n = Number(item.dataset.stepIndicator);
        item.classList.toggle("active", n === currentStep);
        item.classList.toggle("done", n < currentStep);
      });
      form.classList.toggle("step-one-no-scroll", currentStep === 1);
      if (currentStep >= 2) updateReview();
      const viewport = form.querySelector(".exchange-step-viewport");
      if (viewport) viewport.scrollTop = 0;
    }
    function setMode(mode) {
      const direction = $("direction");
      if (direction) {
        direction.value = mode;
        direction.dispatchEvent(new Event("change", { bubbles: true }));
      }
      modes.forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
      const hints = {
        buy: "bKash, Nagad, Rocket অথবা Upay BDT দিয়ে USD / USDT কিনুন.",
        sell: "USD / USDT পাঠিয়ে bKash, Nagad, Rocket অথবা Upay এ BDT নিন.",
        exchange: ""
      };
      if ($("exchangeModeHint")) { $("exchangeModeHint").textContent = hints[mode] || hints.buy; $("exchangeModeHint").hidden = mode === "exchange"; }
      showStep(1);
    }
    function isValidContact() {
      const method = $("contactMethod")?.value || "whatsapp";
      const value = $("contact")?.value.trim() || "";
      if (method === "whatsapp") return /^\d{11}$/.test(value);
      return /^\d{11}$/.test(value) || /^@?[A-Za-z0-9_]{5,32}$/.test(value) || /^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/[A-Za-z0-9_]{5,32}\/?$/.test(value);
    }
    function updateContactMode() {
      const method = $("contactMethod")?.value || "whatsapp";
      const input = $("contact"), label = $("contactLabel"), help = $("contactHelp"), error = $("contactError");
      if (!input) return;
      const whatsapp = method === "whatsapp";
      label.textContent = whatsapp ? "WhatsApp Number" : "Telegram Number / Profile Link";
      input.inputMode = whatsapp ? "numeric" : "text";
      input.placeholder = whatsapp ? "১১ ডিজিটের WhatsApp নম্বর লিখুন" : "Telegram নম্বর, @username অথবা t.me profile link দিন";
      help.textContent = whatsapp ? "উদাহরণ: 12345678901 (শুধু ১১টি সংখ্যা)" : "Telegram নম্বর (১১ ডিজিট), @username অথবা https://t.me/username দিন।";
      error.textContent = "";
      input.classList.remove("invalid");
    }
    function validateContact(showMessage) {
      const input = $("contact"), error = $("contactError");
      const value = input?.value.trim() || "";
      const valid = isValidContact();
      if (showMessage && input) input.classList.toggle("invalid", !valid);
      if (valid && input) input.classList.remove("invalid");
      if (error) error.textContent = valid || !showMessage ? "" : ($("contactMethod").value === "whatsapp" ? "সঠিক ১১ ডিজিটের WhatsApp নম্বর লিখুন।" : "সঠিক Telegram নম্বর, @username অথবা t.me profile link লিখুন।");
      return valid;
    }
    function nextStep(step) {
      const target = Number(step);
      if (currentStep === 1) {
        const from = $("fromWallet"), to = $("toWallet"), amount = $("amount");
        if (!from || !to || !from.value || !to.value || from.value === to.value) {
          alert("Send এবং Receive—দুটি আলাদা Currency নির্বাচন করুন।");
          return false;
        }
        if (!amount || !amount.value || !Number.isFinite(Number(amount.value)) || Number(amount.value) <= 0) {
          if (window.metValidateExchangeAmount) window.metValidateExchangeAmount();
          else alert("আগে সঠিক Amount লিখুন।");
          if (amount) amount.focus();
          return false;
        }
        if (typeof window.metValidateExchangeAmount === "function" && !window.metValidateExchangeAmount()) {
          if (amount) amount.focus();
          return false;
        }
      }
      if (currentStep === 3) {
        for (const id of ["customerName", "contact", "account"]) {
          const field = $(id);
          if (field && !field.value.trim()) {
            if (id === "contact") validateContact(true);
            else alert("আপনার নাম, যোগাযোগ এবং Receive Account পূরণ করুন।");
            field.focus();
            return false;
          }
        }
        if (!validateContact(true)) { $("contact").focus(); return false; }
      }
      if (currentStep === 4 && $("terms") && !$("terms").checked) {
        alert("পরবর্তী ধাপে যাওয়ার আগে শর্তাবলিতে সম্মতি দিন।");
        $("terms").focus();
        return false;
      }
      if (target === 5 && typeof window.metPrepareExchangeRequest === "function") {
        if (!window.metPrepareExchangeRequest()) return false;
      }
      updateReview();
      showStep(target);
      return true;
    }
    window.metNextExchangeStep = nextStep;
    window.metPreviousExchangeStep = showStep;
    window.metShowExchangeStep = showStep;

    modes.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
    // Explicit handlers on each control avoid mobile event-delegation issues.
    form.querySelectorAll("[data-next-step]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        nextStep(button.dataset.nextStep);
      });
    });
    form.querySelectorAll("[data-prev-step]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        showStep(button.dataset.prevStep);
      });
    });
    $("contactMethod")?.addEventListener("change", updateContactMode);
    $("contact")?.addEventListener("input", () => {
      const error = $("contactError");
      // Do not show errors while the user is typing. If Next already showed an
      // error, keep it visible until the contact becomes valid.
      if (error?.textContent && isValidContact()) validateContact(false);
    });
    updateContactMode();
    ["fromWallet", "toWallet", "amount", "account"].forEach(id => {
      $(id)?.addEventListener("change", updateReview);
      $(id)?.addEventListener("input", updateReview);
    });
    $("copyExchangeAddress")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("payAddressDisplay").textContent);
        $("copyExchangeAddress").textContent = "কপি হয়েছে";
      } catch (_) {
        $("copyExchangeAddress").textContent = "কপি করা যায়নি";
      }
    });
    setMode("buy");
    showStep(1);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExchangeWizard, { once: true });
  } else {
    initExchangeWizard();
  }
})();