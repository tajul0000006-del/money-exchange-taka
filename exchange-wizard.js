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
      const paymentIntro = $("paymentIntro");
      if (paymentIntro) paymentIntro.textContent = info?.instruction || "নিচের ঠিকানার তথ্য যাচাই করুন।";
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
      help.textContent = whatsapp ? "উদাহরণ: 12345678901 (শুধু ১১টি সংখ্যা)" : "";
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
    function accountRule(walletId) {
      const rules = {
        bkash: {hint:"bKash Personal-এর ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"bKash-এর সঠিক ১১ ডিজিটের নম্বর দিন (01 দিয়ে শুরু)।"},
        nagad: {hint:"Nagad Personal-এর ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Nagad-এর সঠিক ১১ ডিজিটের নম্বর দিন (01 দিয়ে শুরু)।"},
        rocket: {hint:"Rocket Personal-এর ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Rocket-এর সঠিক ১১ ডিজিটের নম্বর দিন (01 দিয়ে শুরু)।"},
        upay: {hint:"Upay Personal-এর ১১ ডিজিটের সঠিক মোবাইল নম্বর দিন।", valid:v=>/^01[3-9]\d{8}$/.test(v), error:"Upay-এর সঠিক ১১ ডিজিটের নম্বর দিন (01 দিয়ে শুরু)।"},
        paypal: {hint:"আপনার PayPal account-এর সঠিক email address দিন।", valid:v=>/^[A-Z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(v), error:"সঠিক PayPal account email address দিন।"},
        perfectmoney: {hint:"আপনার Perfect Money USD account ID দিন (যেমন: U12345678)।", valid:v=>/^U\d{7,8}$/i.test(v), error:"Perfect Money ID অবশ্যই U দিয়ে শুরু হওয়া ৮–৯ অক্ষরের হতে হবে (যেমন U12345678)।"},
        webmoney: {hint:"আপনার WebMoney WMZ wallet/purse দিন (যেমন: Z123456789012)।", valid:v=>/^Z\d{12}$/i.test(v), error:"সঠিক WebMoney WMZ purse দিন: Z-এর পরে ১২টি সংখ্যা।"},
        volet: {hint:"আপনার Volet account-এর email অথবা registered phone number দিন।", valid:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||/^\+?\d{10,15}$/.test(v), error:"সঠিক Volet account email অথবা ১০–১৫ ডিজিটের registered phone number দিন।"},
        binance: {hint:"Binance USDT TRC20 deposit address দিন (TRON network)।", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"সঠিক Binance TRC20 address দিন (T দিয়ে শুরু, মোট ৩৪ অক্ষর)।"},
        kucoin: {hint:"KuCoin USDT TRC20 deposit address দিন (TRON network)।", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"সঠিক KuCoin TRC20 address দিন (T দিয়ে শুরু, মোট ৩৪ অক্ষর)।"},
        bybit: {hint:"Bybit USDT TRC20 deposit address দিন (TRON network)।", valid:v=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v), error:"সঠিক Bybit TRC20 address দিন (T দিয়ে শুরু, মোট ৩৪ অক্ষর)।"},
        epay: {hint:"আপনার ePay account-এর registered ID / email দিন।", valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@+-]{3,63}$/.test(v), error:"সঠিক ePay account ID অথবা email দিন (কমপক্ষে ৪ অক্ষর)।"},
        tunepay: {hint:"আপনার TunePay account-এর registered ID / email দিন।", valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@+-]{3,63}$/.test(v), error:"সঠিক TunePay account ID অথবা email দিন (কমপক্ষে ৪ অক্ষর)।"}
      };
      return rules[walletId] || {hint:"নির্বাচিত Wallet-এর সঠিক account ID / address দিন।",valid:v=>/^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,159}$/.test(v),error:"নির্বাচিত Wallet-এর সঠিক account ID / address দিন।"};
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
        if (!$("customerName")?.value.trim()) {
          alert("আপনার নাম লিখুন।");
          $("customerName")?.focus();
          return false;
        }
        if (!validateContact(true)) { $("contact").focus(); return false; }
        if (!validateAccount(true)) { $("account").focus(); return false; }
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