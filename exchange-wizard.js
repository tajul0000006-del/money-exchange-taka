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
      set("payAddressDisplay", info?.address || "Payment address has not been added yet.");
      const paymentIntro = $("paymentIntro");
      if (paymentIntro) paymentIntro.textContent = info?.instruction || "Please verify the payment address below.";
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
        buy: "Buy USD / USDT with bKash, Nagad, Rocket, or Upay Personal BDT.",
        sell: "Send USD / USDT and receive BDT through bKash, Nagad, Rocket, or Upay Personal.",
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
      input.placeholder = whatsapp ? "Enter your 11-digit WhatsApp number" : "Enter Telegram number, @username, or t.me profile link";
      help.textContent = whatsapp ? "Example: 12345678901 (11 digits only)" : "";
      error.textContent = "";
      input.classList.remove("invalid");
    }
    function validateContact(showMessage) {
      const input = $("contact"), error = $("contactError");
      const value = input?.value.trim() || "";
      const valid = isValidContact();
      if (showMessage && input) input.classList.toggle("invalid", !valid);
      if (valid && input) input.classList.remove("invalid");
      if (error) error.textContent = valid || !showMessage ? "" : ($("contactMethod").value === "whatsapp" ? "Enter a valid 11-digit WhatsApp number." : "Enter a valid Telegram number, @username, or t.me profile link.");
      return valid;
    }
    function accountRule(walletId) {
      const rules = {
        bkash: {hint:"Enter a valid 11-digit bKash Personal mobile number.", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Enter a valid 11-digit bKash number starting with 01."},
        nagad: {hint:"Enter a valid 11-digit Nagad Personal mobile number.", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Enter a valid 11-digit Nagad number starting with 01."},
        rocket: {hint:"Enter a valid 11-digit Rocket Personal mobile number.", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Enter a valid 11-digit Rocket number starting with 01."},
        upay: {hint:"Enter a valid 11-digit Upay Personal mobile number.", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Enter a valid 11-digit Upay number starting with 01."},
        paypal: {hint:"Enter your correct PayPal account email address.", valid:v=>/^[A-Z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(v), error:"Enter a valid PayPal account email address."},
        perfectmoney: {hint:"Enter your Perfect Money USD account ID (e.g. U12345678).", valid:v=>/^U\d{7,8}$/i.test(v), error:"Perfect Money ID must be 8–9 characters and start with U (e.g. U12345678)."},
        webmoney: {hint:"Enter your WebMoney WMZ wallet/purse (e.g. Z123456789012).", valid:v=>/^Z\d{12}$/i.test(v), error:"Enter a valid WebMoney WMZ purse: Z followed by 12 digits."},
        volet: {hint:"Enter your Volet account email or registered phone number.", valid:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||/^\+?\d{10,15}$/.test(v), error:"Enter a valid Volet account email or registered phone number (10–15 digits)."},
        binance: {hint:"Enter your Binance USDT TRC20 deposit address (TRON network).", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"Enter a valid Binance TRC20 address (starts with T, 34 characters)."},
        kucoin: {hint:"Enter your KuCoin USDT TRC20 deposit address (TRON network).", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"Enter a valid KuCoin TRC20 address (starts with T, 34 characters)."},
        bybit: {hint:"Enter your Bybit USDT TRC20 deposit address (TRON network).", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"Enter a valid Bybit TRC20 address (starts with T, 34 characters)."},
        epay: {hint:"Enter your registered ePay account ID / email.", valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@+-]{3,63}$/.test(v), error:"Enter a valid ePay account ID or email (at least 4 characters)."},
        tunepay: {hint:"Enter your registered TunePay account ID / email.", valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@+-]{3,63}$/.test(v), error:"Enter a valid TunePay account ID or email (at least 4 characters)."}
      };
      return rules[walletId] || {hint:"Enter the correct account ID / address for the selected wallet.",valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,159}$/.test(v),error:"Enter the correct account ID / address for the selected wallet."};
    }
    function updateAccountMode() {
      const input=$("account"), help=$("accountHelp"), error=$("accountError");
      if(!input) return;
      const wallet = window.metGetWalletSettings ? window.metGetWalletSettings($("toWallet")?.value) : null;
      const rule=accountRule($("toWallet")?.value);
      input.placeholder=wallet?.paymentPlaceholder || rule.hint;
      if(help) help.textContent=wallet?.paymentInstruction || rule.hint;
      if(error) error.textContent="";
      input.classList.remove("invalid");
    }
    function validateAccount(showMessage) {
      const input=$("account"), error=$("accountError");
      const value=input?.value.trim()||"";
      const rule=accountRule($("toWallet")?.value);
      const valid=!!value && rule.valid(value);
      if(showMessage && input) input.classList.toggle("invalid",!valid);
      if(valid && input) input.classList.remove("invalid");
      if(error) error.textContent=valid||!showMessage?"":rule.error;
      return valid;
    }
    function nextStep(step) {
      const target = Number(step);
      if (currentStep === 1) {
        const from = $("fromWallet"), to = $("toWallet"), amount = $("amount");
        if (!from || !to || !from.value || !to.value || from.value === to.value) {
          alert("Select two different currencies for Send and Receive.");
          return false;
        }
        if (!amount || !amount.value || !Number.isFinite(Number(amount.value)) || Number(amount.value) <= 0) {
          if (window.metValidateExchangeAmount) window.metValidateExchangeAmount();
          else alert("Please enter a valid amount.");
          if (amount) amount.focus();
          return false;
        }
        if (typeof window.metValidateExchangeAmount === "function" && !window.metValidateExchangeAmount()) {
          if (amount) amount.focus();
          return false;
        }
      }
      if (currentStep === 3) {
        if (!$("customerName")?.value.trim()) {
          alert("Please enter your name.");
          $("customerName")?.focus();
          return false;
        }
        if (!validateContact(true)) { $("contact").focus(); return false; }
        if (!validateAccount(true)) { $("account").focus(); return false; }
      }
      if (currentStep === 4 && $("terms") && !$("terms").checked) {
        alert("Please agree to the terms before continuing.");
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
      if (error?.textContent && isValidContact()) validateContact(false);
    });
    $("toWallet")?.addEventListener("change", updateAccountMode);
    $("account")?.addEventListener("input", () => {
      const error = $("accountError");
      if (error?.textContent && validateAccount(false)) error.textContent = "";
    });
    updateContactMode();
    updateAccountMode();
    ["fromWallet", "toWallet", "amount", "account"].forEach(id => {
      $(id)?.addEventListener("change", updateReview);
      $(id)?.addEventListener("input", updateReview);
    });
    $("copyExchangeAddress")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("payAddressDisplay").textContent);
        $("copyExchangeAddress").textContent = "Copied";
      } catch (_) {
        $("copyExchangeAddress").textContent = "Unable to copy";
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