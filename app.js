/* MoneyExchangeTaka frontend interactions. Server-side verification is required before live transactions. */
(() => {
  "use strict";
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
  import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
  import { firebaseConfig } from "./firebase-config.js";
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp);
  const $ = (id) => document.getElementById(id);
  const FEE_PERCENT = 1;
  const DEFAULT_WALLETS = [
    {id:"bkash",name:"bKash",subtitle:"মোবাইল ফাইন্যান্সিয়াল সার্ভিস",currency:"BDT",type:"bdt",logo:"assets/logos/bkash.png",buy:0,sell:0,short:"bK"},
    {id:"nagad",name:"Nagad",subtitle:"মোবাইল ফাইন্যান্সিয়াল সার্ভিস",currency:"BDT",type:"bdt",logo:"assets/logos/nagad.png",buy:0,sell:0,short:"NG"},
    {id:"rocket",name:"Rocket",subtitle:"DBBL Mobile Banking",currency:"BDT",type:"bdt",logo:"assets/logos/rocket.png",buy:0,sell:0,short:"RK"},
    {id:"upay",name:"Upay",subtitle:"মোবাইল ফাইন্যান্সিয়াল সার্ভিস",currency:"BDT",type:"bdt",logo:"assets/logos/upay.png",buy:0,sell:0,short:"UP"},
    {id:"paypal",name:"PayPal USD",subtitle:"USD Wallet",currency:"USD",type:"usd",logo:"assets/logos/paypal.png",buy:122,sell:118,short:"PP"},
    {id:"perfectmoney",name:"Perfect Money",subtitle:"USD Wallet",currency:"USD",type:"usd",logo:"assets/logos/perfectmoney.png",buy:125,sell:121,short:"PM"},
    {id:"webmoney",name:"WebMoney",subtitle:"USD Wallet",currency:"USD",type:"usd",logo:"assets/logos/webmoney.png",buy:124,sell:120,short:"WM"},
    {id:"volet",name:"Volet",subtitle:"USD Wallet",currency:"USD",type:"usd",logo:"assets/logos/volet.png",buy:123,sell:119,short:"VO"},
    {id:"binance",name:"Binance USDT TRC20",subtitle:"USDT · TRON network",currency:"USDT",type:"crypto",logo:"assets/logos/binance.png",buy:121,sell:118,short:"BN"},
    {id:"kucoin",name:"KuCoin USDT TRC20",subtitle:"USDT · TRON network",currency:"USDT",type:"crypto",logo:"assets/logos/kucoin.png",buy:121,sell:117,short:"KC"},
    {id:"bybit",name:"Bybit USDT TRC20",subtitle:"USDT · TRON network",currency:"USDT",type:"crypto",logo:"assets/logos/bybit.png",buy:122,sell:118,short:"BY"},
    {id:"epay",name:"ePay",subtitle:"USD / service wallet",currency:"USD",type:"usd",logo:"assets/logos/epay.png",buy:123,sell:119,short:"EP"},
    {id:"tunepay",name:"TunePay",subtitle:"USD / service wallet",currency:"USD",type:"usd",logo:"assets/logos/tunepay.png",buy:123,sell:119,short:"TP"}
  ];
  const RATE_KEY = "met_wallet_rates_v1";
  const HISTORY_KEY = "met_request_history_v1";
  let wallets = loadRates();

  function loadRates(){
    try {
      const saved = JSON.parse(localStorage.getItem(RATE_KEY) || "null");
      if (Array.isArray(saved)) return DEFAULT_WALLETS.map(w => ({...w, ...(saved.find(s => s.id === w.id) || {})}));
    } catch (_) {}
    return DEFAULT_WALLETS.map(w => ({...w}));
  }
  function saveRates(){ localStorage.setItem(RATE_KEY, JSON.stringify(wallets)); }
  function money(n, currency){ return `${Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`; }
  function walletById(id){ return wallets.find(w => w.id === id); }
  function logoMarkup(w){
    const fallback = `<span class="currency-logo" aria-hidden="true">${escapeHtml(w.short)}</span>`;
    if (!w.logo) return fallback;
    return `<span class="currency-logo"><img src="${escapeHtml(w.logo)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${escapeHtml(w.short)}'"></span>`;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function renderRateTable(){
    $("rateTableBody").innerHTML = wallets.map(w => `
      <tr>
        <td><div class="currency-cell">${logoMarkup(w)}<div><span class="currency-name">${escapeHtml(w.name)}</span><span class="currency-sub">${escapeHtml(w.subtitle)}</span></div></div></td>
        <td><b>${escapeHtml(w.currency)}</b></td>
        <td class="money buy-rate">${w.type === "bdt" ? "—" : `৳${Number(w.buy).toFixed(2)}`}</td>
        <td class="money sell-rate">${w.type === "bdt" ? "—" : `৳${Number(w.sell).toFixed(2)}`}</td>
      </tr>`).join("");
  }
  function allowedWallets(side, direction){
    if (direction === "buy") return side === "from" ? wallets.filter(w=>w.type==="bdt") : wallets.filter(w=>w.type!=="bdt");
    if (direction === "sell") return side === "from" ? wallets.filter(w=>w.type!=="bdt") : wallets.filter(w=>w.type==="bdt");
    return wallets;
  }
  function fillWalletSelect(selectId, side, preserve=true){
    const select = $(selectId), direction = $("direction").value, old = preserve ? select.value : "";
    const list = allowedWallets(side, direction);
    select.innerHTML = list.map(w=>`<option value="${w.id}">${escapeHtml(w.name)} · ${w.currency}${w.type === "bdt" ? " · পার্সোনাল BDT" : ""}</option>`).join("");
    if(list.some(w=>w.id===old)) select.value=old;
  }
  function updateWalletOptions(){
    fillWalletSelect("fromWallet","from");
    fillWalletSelect("toWallet","to");
    if($("fromWallet").value===$("toWallet").value){
      const alternate=allowedWallets("to","exchange").find(w=>w.id!==$("fromWallet").value);
      if(alternate) $("toWallet").value=alternate.id;
    }
    updateAmountCurrency(); updateCalculation();
  }
  function updateAmountCurrency(){
    const from=walletById($("fromWallet").value);
    const to=walletById($("toWallet").value);
    $("amountCurrency").textContent=from ? from.currency : "—";
    $("amountHelp").textContent=from ? `পরিমাণ ${from.currency}-এ লিখুন।` : "প্রতি লেনদেনের সীমা: ৳৫০০–৳১০,০০০ (সমমূল্যের USD/USDT)।";
    const account=$("account");
    const help=$("accountHelp");
    if(to){
      const hints={
        bkash:"যেমন: 01XXXXXXXXX (bKash নম্বর)",
        nagad:"যেমন: 01XXXXXXXXX (Nagad নম্বর)",
        rocket:"যেমন: 01XXXXXXXXX বা Rocket অ্যাকাউন্ট নম্বর",
        upay:"যেমন: 01XXXXXXXXX (Upay নম্বর)",
        paypal:"যেমন: আপনার PayPal ইমেইল ঠিকানা",
        perfectmoney:"যেমন: U12345678 (Perfect Money অ্যাকাউন্ট)",
        webmoney:"যেমন: WMZ purse / wallet ID",
        volet:"যেমন: আপনার Volet অ্যাকাউন্ট ইমেইল বা ID",
        binance:"যেমন: USDT TRC20 ডিপোজিট অ্যাড্রেস (T নেটওয়ার্ক ঠিকানা)",
        kucoin:"যেমন: KuCoin USDT TRC20 ডিপোজিট অ্যাড্রেস",
        bybit:"যেমন: Bybit USDT TRC20 ডিপোজিট অ্যাড্রেস",
        epay:"যেমন: আপনার ePay অ্যাকাউন্ট ID",
        tunepay:"যেমন: আপনার TunePay অ্যাকাউন্ট ID"
      };
      account.placeholder=hints[to.id] || `আপনার ${to.name} ${to.currency} অ্যাকাউন্ট নম্বর / ঠিকানা`;
      help.textContent = to.type === "bdt" ? `${to.name} পার্সোনাল BDT পেমেন্ট ঠিকানা দিন। যে নম্বর/অ্যাকাউন্টে টাকা গ্রহণ করবেন, সেটি সঠিকভাবে লিখুন।` : `${to.name} (${to.currency}) ওয়ালেটের সঠিক ইমেইল, অ্যাকাউন্ট ID বা ডিপোজিট অ্যাড্রেস দিন। ক্রিপ্টো হলে সঠিক নেটওয়ার্কের ঠিকানা ব্যবহার করুন।`;
    const contactLabel=$("contactLabel"); if(contactLabel) contactLabel.textContent="WhatsApp / Telegram / Email (যোগাযোগের ঠিকানা)";
    $("contact").placeholder="WhatsApp নম্বর, Telegram username বা ইমেইল দিন";
    } else {
      account.placeholder="প্রথমে যে ওয়ালেটে পাবেন সেটি নির্বাচন করুন";
      help.textContent="আপনার নির্বাচিত গ্রহণকারী ওয়ালেট অনুযায়ী নম্বর বা ঠিকানা লিখুন।";
    }
  }
  function rateFor(from,to){
    if(!from||!to||from.id===to.id) return null;
    // Convert every wallet through its approximate BDT value.
    // BDT wallet = 1 BDT; USD/USDT wallet uses its configured sell/buy rate.
    const fromSell = from.type === "bdt" ? 1 : Number(from.sell);
    const toBuy = to.type === "bdt" ? 1 : Number(to.buy);
    if(!Number.isFinite(fromSell)||!Number.isFinite(toBuy)||fromSell<=0||toBuy<=0) return null;
    const rate = fromSell / toBuy; // units received per 1 unit paid
    let text;
    if(from.type === "bdt" && to.type === "bdt") text = `1 ${from.currency} = 1 ${to.currency}`;
    else if(from.type === "bdt") text = `৳${to.buy.toFixed(2)} = 1 ${to.currency}`;
    else if(to.type === "bdt") text = `1 ${from.currency} = ৳${from.sell.toFixed(2)}`;
    else text = `1 ${from.currency} ≈ ${rate.toFixed(6)} ${to.currency}`;
    return {rate, text};
  }
  function updateCalculation(){
    const from=walletById($("fromWallet").value), to=walletById($("toWallet").value);
    const amount=Number($("amount").value);
    const r=rateFor(from,to);
    if(!from||!to||!r||!Number.isFinite(amount)||amount<=0){
      $("payPreview").textContent="—"; $("receivePreview").textContent="—"; $("ratePreview").textContent=r?r.text:"—"; $("feePreview").textContent="—";
      $("calcMessage").textContent=(!from||!to) ? "দেওয়ার ও পাওয়ার ওয়ালেট নির্বাচন করুন।" : (from.id===to.id ? "দুটি আলাদা ওয়ালেট নির্বাচন করুন।" : "পরিমাণ ০-এর বেশি লিখুন।"); return;
    }
    const gross = amount * r.rate;
    const fee=gross*FEE_PERCENT/100, receive=Math.max(0,gross-fee);
    $("payPreview").textContent=money(amount,from.currency);
    $("receivePreview").textContent=money(receive,to.currency);
    $("ratePreview").textContent=r.text;
    $("feePreview").textContent=money(fee,to.currency);
    $("calcMessage").textContent="হিসাবটি প্রদর্শিত রেট ও ফি অনুযায়ী করা হয়েছে। পেমেন্টের আগে রেট ও নেটওয়ার্ক যাচাই করুন।";
  }
  function renderHistory(){
    let items=[]; try{items=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch(_){}
    const root=$("historyList");
    if(!items.length){root.innerHTML='<div class="empty-state">এখনো কোনো অনুরোধ জমা হয়নি।</div>';return;}
    root.innerHTML=items.slice().reverse().map(item=>`<article class="history-item">
      <div><h3>${escapeHtml(item.code)} · ${escapeHtml(item.fromName)} → ${escapeHtml(item.toName)}</h3>
      <div class="history-meta">${escapeHtml(item.date)} · ${escapeHtml(item.customer)}</div>
      <span class="status-pill">অনুরোধ জমা হয়েছে</span></div>
      <div class="history-amount"><div>${escapeHtml(item.pay)}</div><div>↓ ${escapeHtml(item.receive)}</div></div>
    </article>`).join("");
  }
  function renderAdminEditor(){
    $("adminRateEditor").innerHTML=wallets.filter(w=>w.type!=="bdt").map(w=>`<div class="admin-rate-row">
      <div class="admin-currency"><b>${escapeHtml(w.name)}</b><div class="currency-sub">${w.currency}</div></div>
      <div><label for="buy-${w.id}">আমরা কিনি (৳)</label><input id="buy-${w.id}" type="number" min="0.01" step="0.01" value="${w.buy}"></div>
      <div><label for="sell-${w.id}">আমরা বিক্রি করি (৳)</label><input id="sell-${w.id}" type="number" min="0.01" step="0.01" value="${w.sell}"></div>
    </div>`).join("");
  }
  const ADDRESS_KEY="met_payment_addresses_v1";
  const DEFAULT_ADDRESSES={bkash:"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি",nagad:"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি",rocket:"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি",upay:"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি",paypal:"অ্যাকাউন্ট ইমেইল এখনো যুক্ত করা হয়নি",perfectmoney:"অ্যাকাউন্ট ID এখনো যুক্ত করা হয়নি",webmoney:"ওয়ালেট ID এখনো যুক্ত করা হয়নি",volet:"অ্যাকাউন্ট ID এখনো যুক্ত করা হয়নি",binance:"USDT নেটওয়ার্ক ঠিকানা এখনো যুক্ত করা হয়নি",kucoin:"USDT নেটওয়ার্ক ঠিকানা এখনো যুক্ত করা হয়নি",bybit:"USDT নেটওয়ার্ক ঠিকানা এখনো যুক্ত করা হয়নি",epay:"অ্যাকাউন্ট ID এখনো যুক্ত করা হয়নি",tunepay:"অ্যাকাউন্ট ID এখনো যুক্ত করা হয়নি"};
  let paymentAddresses={...DEFAULT_ADDRESSES};
  try{paymentAddresses={...paymentAddresses,...JSON.parse(localStorage.getItem(ADDRESS_KEY)||"{}")};}catch(_){}
  let pendingRequest=null;
  function renderPaymentEditor(){const root=$("adminPaymentEditor");if(!root)return;root.innerHTML=wallets.map(w=>`<div class="admin-payment-row"><label for="address-${w.id}">${escapeHtml(w.name)}<small>${escapeHtml(w.currency)} · পেমেন্ট ঠিকানা</small></label><input id="address-${w.id}" value="${escapeHtml(paymentAddresses[w.id]||"")}" maxlength="220" placeholder="পেমেন্ট নম্বর / ID / ঠিকানা"></div>`).join("");}
  function openModal(id){$(id).classList.add("open");$(id).setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
  function closeModal(id){$(id).classList.remove("open");$(id).setAttribute("aria-hidden","true");if(!document.querySelector(".modal-backdrop.open"))document.body.style.overflow="";}
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
  $("copyPaymentAddress").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("paymentAddress").textContent);$("copyPaymentAddress").textContent="কপি হয়েছে";}catch(_){$("paymentAddress").focus?.();}});
  $("goProof").addEventListener("click",()=>{closeModal("paymentModal");openModal("proofModal");});
  $("proofForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!pendingRequest)return;
    const submitButton=$("proofForm").querySelector('button[type="submit"]');
    if(submitButton){submitButton.disabled=true;submitButton.dataset.oldText=submitButton.textContent;submitButton.textContent="জমা হচ্ছে...";}
    try{
      const item=pendingRequest;
      const from=walletById(item.fromId),to=walletById(item.toId);
      const usdIds=["paypal","perfectmoney","webmoney","volet","epay","tunepay"];
      const isUsdSell=usdIds.includes(item.fromId)&&to?.type==="bdt";
      const isUsdBuy=from?.type==="bdt"&&usdIds.includes(item.toId);
      if(!isUsdSell&&!isUsdBuy) throw new Error("এই ধাপে শুধু USD থেকে BDT অথবা BDT থেকে USD রিকোয়েস্ট নেওয়া হচ্ছে।");
      const methodId=isUsdSell?item.toId:item.fromId;
      const methodNames={bkash:"bKash",nagad:"Nagad",rocket:"Rocket",upay:"Upay",epay:"ePay",tunepay:"TunePay"};
      const paymentMethod=methodNames[methodId];
      if(!paymentMethod) throw new Error("এই পেমেন্ট মাধ্যমটি এখনো Request জমার জন্য চালু হয়নি।");
      const proofReference=$("proofReference").value.trim();
      const proofEmail=$("proofEmail").value.trim();
      const note=[item.customer, item.note, item.reference?("Reference: "+item.reference):"", proofReference?("Payment reference: "+proofReference):"", proofEmail?("Proof contact: "+proofEmail):""].filter(Boolean).join(" | ").slice(0,500);
      const payload={
        trackingCode:item.code,
        direction:isUsdSell?"sell":"buy",
        currency:"USD",
        amount:Number(item.amount),
        paymentMethod,
        contact:String($("contact").value.trim()).slice(0,25),
        paymentAccount:String($("account").value.trim()).slice(0,80),
        note,
        referralCode:"",
        uid:null,
        requestType:"guest",
        status:"pending",
        createdAt:serverTimestamp()
      };
      await addDoc(collection(db,"exchangeRequests"),payload);
      item.proofReference=proofReference;
      item.proofEmail=proofEmail;
      item.proofFileName=$("proofScreenshot").files[0]?.name||"";
      item.status="pending";
      let items=[];try{items=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch(_){}
      items.push(item);localStorage.setItem(HISTORY_KEY,JSON.stringify(items));renderHistory();
      closeModal("proofModal");$("successTrackingCode").textContent=item.code;openModal("successModal");
      $("formStatus").textContent="আপনার অনুরোধ Firestore-এ জমা হয়েছে।";$("formStatus").classList.remove("error");
      pendingRequest=null;$("proofForm").reset();$("exchangeForm").reset();updateWalletOptions();
    }catch(error){
      console.error("Firestore request submission failed:",error);
      showError(error?.message==="Missing or insufficient permissions"?"Firestore অনুমতি দেয়নি। Firebase Rules পরীক্ষা করতে হবে।":(error?.message||"রিকোয়েস্ট জমা হয়নি। আবার চেষ্টা করুন।"));
    }finally{
      if(submitButton){submitButton.disabled=false;submitButton.textContent=submitButton.dataset.oldText||"জমা দিন";}
    }
  });
  $("copyTrackingCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("successTrackingCode").textContent);$("copyTrackingCode").textContent="কপি হয়েছে";}catch(_){}});
  $("successDone").addEventListener("click",()=>{closeModal("successModal");$("history").scrollIntoView({behavior:"smooth",block:"start"});});
  function showError(message){$("formStatus").textContent=message;$("formStatus").classList.add("error");}
  function clearError(){$("formStatus").textContent="";$("formStatus").classList.remove("error");}
  function validate(){
    document.querySelectorAll(".invalid").forEach(el=>el.classList.remove("invalid"));
    const required=["fromWallet","toWallet","amount","customerName","contact","account"];
    let first=null;
    for(const id of required){const el=$(id);let invalid=!el.value.trim();
      if(id==="amount") invalid=!Number.isFinite(Number(el.value))||Number(el.value)<=0||Number(el.value)>100000000;
      if(id==="customerName") invalid=el.value.trim().length<2||el.value.trim().length>80;
      if(id==="contact") {
        const value=el.value.trim();
        const isPhone=/^[0-9+\-()\s]{7,20}$/.test(value);
        const isEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isTelegram=/^@?[A-Za-z0-9_]{5,32}$/.test(value);
        invalid=!(isPhone||isEmail||isTelegram);
      }
      if(id==="account") invalid=el.value.trim().length<3||el.value.trim().length>120;
      if(invalid){el.classList.add("invalid");if(!first)first=el;}
    }
    if(!$("terms").checked){showError("শর্তাবলিতে সম্মতি দিন।");return false;}
    const from=walletById($("fromWallet").value),to=walletById($("toWallet").value);
    if(!from||!to||from.id===to.id||!rateFor(from,to)){showError("ভিন্ন ও বৈধ দুটি ওয়ালেট নির্বাচন করুন।");$("fromWallet").classList.add("invalid");$("toWallet").classList.add("invalid");return false;}
    if(Number.isFinite(Number($("amount").value)) && Number($("amount").value)>0){
      const amountValue=Number($("amount").value);
      const bdtEquivalent=from.type==="bdt" ? amountValue : amountValue*Number(from.sell);
      if(!Number.isFinite(bdtEquivalent)||bdtEquivalent<500||bdtEquivalent>10000){
        showError("প্রতি রিকোয়েস্টের সীমা ৳৫০০ থেকে ৳১০,০০০ (সমমূল্যের USD/USDT)। পরিমাণ পরিবর্তন করুন।");
        $("amount").classList.add("invalid");$("amount").focus();return false;
      }
    }
    if(first){showError("লাল চিহ্নিত ঘরগুলো সঠিকভাবে পূরণ করুন।");first.focus();return false;}
    clearError();return true;
  }
  $("direction").addEventListener("change",updateWalletOptions);
  // Keep the two wallet selections different so the calculator never gets stuck on dashes.
  $("fromWallet").addEventListener("change",()=>{
    if($("fromWallet").value === $("toWallet").value){
      const alternative = wallets.find(w => w.id !== $("fromWallet").value);
      if(alternative) $("toWallet").value = alternative.id;
    }
    updateAmountCurrency(); updateCalculation();
  });
  $("toWallet").addEventListener("change",()=>{
    if($("toWallet").value === $("fromWallet").value){
      const alternative = wallets.find(w => w.id !== $("toWallet").value);
      if(alternative) $("fromWallet").value = alternative.id;
    }
    updateAmountCurrency(); updateCalculation();
  });
  $("amount").addEventListener("input",updateCalculation);
  $("exchangeForm").addEventListener("submit",event=>{
    event.preventDefault();
    if(!validate()) return;
    const from=walletById($("fromWallet").value),to=walletById($("toWallet").value),amount=Number($("amount").value),r=rateFor(from,to);
    const gross=amount*r.rate;
    const fee=gross*FEE_PERCENT/100,receive=gross-fee;
    const item={
      code:"MET-"+Math.random().toString(36).slice(2,8).toUpperCase(),
      date:new Date().toLocaleString("bn-BD"),
      customer:$("customerName").value.trim(),fromName:from.name,toName:to.name,
      pay:money(amount,from.currency),receive:money(receive,to.currency),
      amount,fromId:from.id,toId:to.id,rate:r.rate,fee,reference:$("reference").value.trim(),note:$("note").value.trim()
    };
    pendingRequest=item;
    $("paymentIntro").textContent=`${from.name} (${from.currency}) দিয়ে ${money(amount,from.currency)} পাঠানোর নির্দেশনা। পেমেন্ট ঠিকানা ও পরিমাণ যাচাই করুন।`;
    $("paymentSummary").innerHTML=`<div class="preview-row"><span>আপনি পাঠাবেন</span><strong>${escapeHtml(money(amount,from.currency))}</strong></div><div class="preview-row"><span>আপনি পাবেন</span><strong>${escapeHtml(money(receive,to.currency))}</strong></div><div class="preview-row"><span>রিকোয়েস্ট রেফারেন্স</span><strong>${escapeHtml(item.code)}</strong></div>`;
    $("paymentAddress").textContent=paymentAddresses[from.id]||"পেমেন্ট নির্দেশনা প্রস্তুত করা হচ্ছে। অনুগ্রহ করে পরবর্তী ধাপে এগিয়ে তথ্য জমা দিন।";
    $("goProof").disabled=false;
    $("copyPaymentAddress").textContent="ঠিকানা কপি";
    openModal("paymentModal");
  });
  $("clearHistory").addEventListener("click",()=>{
    if(confirm("এই ডিভাইসে সংরক্ষিত সব রিকোয়েস্ট মুছে ফেলবেন?")){localStorage.removeItem(HISTORY_KEY);renderHistory();}
  });
  $("saveRates").addEventListener("click",()=>{
    let valid=true;
    wallets=wallets.map(w=>{
      if(w.type==="bdt")return w;
      const buy=Number($(`buy-${w.id}`).value),sell=Number($(`sell-${w.id}`).value);
      if(!Number.isFinite(buy)||!Number.isFinite(sell)||buy<=0||sell<=0){valid=false;return w;}
      return {...w,buy,sell};
    });
    if(!valid){$("adminStatus").textContent="সব রেট শূন্যের বেশি দিতে হবে।";$("adminStatus").classList.add("error");return;}
    saveRates();
    wallets.forEach(w=>{const el=$("address-"+w.id);if(el)paymentAddresses[w.id]=el.value.trim();});
    localStorage.setItem(ADDRESS_KEY,JSON.stringify(paymentAddresses));
    renderRateTable();renderAdminEditor();renderPaymentEditor();updateWalletOptions();
    $("adminStatus").classList.remove("error");$("adminStatus").textContent="রেট ও পেমেন্ট ঠিকানা সংরক্ষণ করা হয়েছে।";
  });
  renderRateTable();renderAdminEditor();renderPaymentEditor();updateWalletOptions();renderHistory();
})();