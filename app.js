/* MoneyExchangeTaka frontend interactions. Server-side verification is required before live transactions. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SETTINGS_API_BASE = "https://moneyexchange-admin.taijulsheikh60.workers.dev";
  let globalFeePercent = 1;
  let exchangeLimits = {minBdt:500,maxBdt:10000};
  const DEFAULT_WALLETS = [
    {id:"bkash",name:"bKash Personal",subtitle:"Personal BDT · Mobile Financial Service",currency:"BDT",type:"bdt",logo:"assets/logos/bkash.png",buy:0,sell:0,short:"bK"},
    {id:"nagad",name:"Nagad Personal",subtitle:"Personal BDT · Mobile Financial Service",currency:"BDT",type:"bdt",logo:"assets/logos/nagad.png",buy:0,sell:0,short:"NG"},
    {id:"rocket",name:"Rocket Personal",subtitle:"Personal BDT · DBBL Mobile Banking",currency:"BDT",type:"bdt",logo:"assets/logos/rocket.png",buy:0,sell:0,short:"RK"},
    {id:"upay",name:"Upay Personal",subtitle:"Personal BDT · Mobile Financial Service",currency:"BDT",type:"bdt",logo:"assets/logos/upay.png",buy:0,sell:0,short:"UP"},
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
    const available = wallets.filter(w => w.enabled !== false && w.hidden !== true &&
      (side === "from" ? w.sendEnabled !== false : w.receiveEnabled !== false));
    if (direction === "buy") {
      return side === "from"
        ? available.filter(w=>w.type==="bdt")
        : available.filter(w=>w.type!=="bdt" && w.buyEnabled !== false);
    }
    if (direction === "sell") {
      return side === "from"
        ? available.filter(w=>w.type!=="bdt" && w.sellEnabled !== false)
        : available.filter(w=>w.type==="bdt");
    }
    return available;
  }
  function fillWalletSelect(selectId, side, preserve=true){
    const select = $(selectId), direction = $("direction").value, old = preserve ? select.value : "";
    const list = allowedWallets(side, direction);
    select.innerHTML = list.length ? list.map(w=>`<option value="${w.id}">${escapeHtml(w.name)} · ${w.currency}${w.type === "bdt" ? " · পার্সোনাল BDT" : ""}</option>`).join("") : '<option value="">এই অপশনে কোনো Currency চালু নেই</option>';
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
    $("amountHelp").textContent="";
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
  function getAmountBdtEquivalent(){
    const from=walletById($("fromWallet").value);
    const amount=Number($("amount").value);
    if(!from || !Number.isFinite(amount) || amount<=0) return null;
    const rate=from.type==="bdt" ? 1 : Number(from.sell);
    if(!Number.isFinite(rate)||rate<=0) return null;
    return {bdt:amount*rate, rate, from};
  }
  function updateAmountLimitFeedback(){
    const amountEl=$("amount"), help=$("amountHelp");
    if(!amountEl || !help) return false;
    const value=amountEl.value.trim();
    const result=getAmountBdtEquivalent();
    amountEl.classList.remove("invalid");
    help.classList.remove("amount-limit-error");
    let message="";
    if(!value || !result){
      message="Limit: ৳"+exchangeLimits.minBdt.toLocaleString("en-US")+"–৳"+exchangeLimits.maxBdt.toLocaleString("en-US")+" BDT";
    } else if(result.bdt<exchangeLimits.minBdt || result.bdt>exchangeLimits.maxBdt){
      if(result.from.type==="bdt"){
        message="Limit: ৳"+exchangeLimits.minBdt.toLocaleString("en-US")+"–৳"+exchangeLimits.maxBdt.toLocaleString("en-US")+" BDT";
      } else {
        const minAmount=exchangeLimits.minBdt/result.rate;
        const maxAmount=exchangeLimits.maxBdt/result.rate;
        const fmt=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
        message="Limit: "+fmt(minAmount)+"–"+fmt(maxAmount)+" "+result.from.currency+" (৳"+exchangeLimits.minBdt.toLocaleString("en-US")+"–৳"+exchangeLimits.maxBdt.toLocaleString("en-US")+" BDT)";
      }
    }
    if(message){
      help.textContent=message;
      help.classList.add("amount-limit-error");
      amountEl.classList.add("invalid");
      return false;
    }
    return true;
  }
  window.metValidateExchangeAmount=updateAmountLimitFeedback;
  function updateCalculation(){
    const from=walletById($("fromWallet").value), to=walletById($("toWallet").value);
    const amount=Number($("amount").value);
    const r=rateFor(from,to);
    if(!from||!to||!r||!Number.isFinite(amount)||amount<=0){
      $("payPreview").textContent="—"; $("receivePreview").textContent="—"; $("ratePreview").textContent=r?r.text:"—"; $("feePreview").textContent="—";
      $("calcMessage").textContent=(!from||!to) ? "দেওয়ার ও পাওয়ার ওয়ালেট নির্বাচন করুন।" : (from.id===to.id ? "দুটি আলাদা ওয়ালেট নির্বাচন করুন।" : "পরিমাণ ০-এর বেশি লিখুন।"); return;
    }
    const gross = amount * r.rate;
    const feePercent = to.feePercent !== null && to.feePercent !== undefined && Number.isFinite(Number(to.feePercent)) ? Number(to.feePercent) : (from.feePercent !== null && from.feePercent !== undefined && Number.isFinite(Number(from.feePercent)) ? Number(from.feePercent) : globalFeePercent);
    const fee=gross*feePercent/100, receive=Math.max(0,gross-fee);
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
  window.metGetPaymentInfo=(walletId)=>{const wallet=walletById(walletId);return wallet?{name:wallet.name,address:wallet.paymentAddress||paymentAddresses[walletId]||"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি",instruction:wallet.paymentInstruction||"",placeholder:wallet.paymentPlaceholder||""}:null;};
  window.metGetWalletSettings=(walletId)=>walletById(walletId)||null;
  let pendingRequest=null;
  function renderPaymentEditor(){const root=$("adminPaymentEditor");if(!root)return;root.innerHTML=wallets.map(w=>`<div class="admin-payment-row"><label for="address-${w.id}">${escapeHtml(w.name)}<small>${escapeHtml(w.currency)} · পেমেন্ট ঠিকানা</small></label><input id="address-${w.id}" value="${escapeHtml(paymentAddresses[w.id]||"")}" maxlength="220" placeholder="পেমেন্ট নম্বর / ID / ঠিকানা"></div>`).join("");}
  function openModal(id){$(id).classList.add("open");$(id).setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
  function closeModal(id){$(id).classList.remove("open");$(id).setAttribute("aria-hidden","true");if(!document.querySelector(".modal-backdrop.open"))document.body.style.overflow="";}
  document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.closeModal)));
  document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));
  $("copyPaymentAddress").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("paymentAddress").textContent);$("copyPaymentAddress").textContent="কপি হয়েছে";}catch(_){$("paymentAddress").focus?.();}});
  let firestoreReadyPromise=null;
  async function getFirebaseServices(){
    if(!firestoreReadyPromise){
      firestoreReadyPromise=(async()=>{
        const [{initializeApp,getApps},{getFirestore,collection,addDoc,serverTimestamp}] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js")
        ]);
        const {firebaseConfig}=await import("./firebase-config.js");
        const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
        return {db:getFirestore(app),collection,addDoc,serverTimestamp};
      })();
    }
    return firestoreReadyPromise;
  }
  function waitForFirebaseResult(promise, timeoutMs, label){
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" নির্ধারিত সময়ের মধ্যে শেষ হয়নি। ইন্টারনেট/Firebase সংযোগ পরীক্ষা করুন।")),timeoutMs);})
    ]).finally(()=>clearTimeout(timer));
  }
  async function saveRequestToFirestore(item){
    const fb=await getFirebaseServices();
    const from=walletById(item.fromId),to=walletById(item.toId);
    const isDigitalWallet=wallet=>wallet?.type==="usd"||wallet?.type==="crypto";
    const isUsdSell=isDigitalWallet(from) && to?.type==="bdt";
    const isUsdBuy=from?.type==="bdt" && isDigitalWallet(to);
    const direction=isUsdSell?"sell":isUsdBuy?"buy":"exchange";
    const paymentMethod=(isUsdSell?to?.name:from?.name)||"Other";
    const allowedMethods=["bKash","Nagad","Rocket","Upay","ePay","TunePay","Bank","Other"];
    const method=allowedMethods.includes(paymentMethod)?paymentMethod:"Other";
    return waitForFirebaseResult(fb.addDoc(fb.collection(fb.db,"exchangeRequests"),{
      trackingCode:item.code,direction,currency:from?.currency==="USDT"||to?.currency==="USDT"?"USDT":from?.currency==="USD"||to?.currency==="USD"?"USD":"BDT",
      amount:Number(item.amount),paymentMethod:method,
      contactMethod:String($("contactMethod")?.value||"whatsapp"),
      contact:String($("contact").value.trim()).slice(0,160),
      paymentAccount:String($("account").value.trim()).slice(0,80),
      note:String(item.note||"").slice(0,500),
      affiliateCode:String(item.affiliateCode||item.reference||"").slice(0,40),
      transactionReference:String(item.proofReference||"").slice(0,160),
      proofEmail:String(item.proofEmail||"").slice(0,160),
      proofScreenshotUrl:String(item.proofScreenshotUrl||""),
      proofFileName:String(item.proofFileName||"").slice(0,200),
      uid:null,requestType:"guest",status:"pending",createdAt:fb.serverTimestamp(),proofSubmittedAt:fb.serverTimestamp()
    }),60000,"Firestore-এ Request Save");
  }
  $("proofScreenshot").addEventListener("change",()=>{
    const file=$("proofScreenshot").files[0];
    const wrap=$("proofPreviewWrap"),img=$("proofPreviewImage"),name=$("proofPreviewName");
    if(!file){wrap.hidden=true;img.removeAttribute("src");name.textContent="";return;}
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){
      $("proofScreenshot").value="";wrap.hidden=true;img.removeAttribute("src");
      showError("শুধু JPG, PNG অথবা WEBP ছবি দিন এবং ফাইল ৫ MB-এর কম রাখুন।");return;
    }
    img.src=URL.createObjectURL(file);name.textContent=file.name;wrap.hidden=false;
  });
  $("submitPaymentProof").addEventListener("click",async e=>{
    e.preventDefault();if(!pendingRequest)return;
    const submitButton=$("submitPaymentProof");
    if(! $("proofReference").value.trim()){showError("Transaction ID / Reference লিখুন।");$("proofReference").focus();return;}
    if(!$("proofScreenshot").files[0]){showError("পেমেন্ট Screenshot নির্বাচন করুন।");$("proofScreenshot").focus();return;}
    if(submitButton){submitButton.disabled=true;submitButton.dataset.originalText=submitButton.textContent;submitButton.textContent="জমা হচ্ছে...";}
    let submissionStage="প্রস্তুতি";
    try{
      submissionStage="Firebase সংযোগ";
      pendingRequest.proofReference=$("proofReference").value.trim();
      pendingRequest.proofEmail=$("proofEmail").value.trim();
      const proofFile=$("proofScreenshot").files[0];
      if(!pendingRequest.proofReference) throw new Error("Transaction ID / Reference লিখুন।");
      if(!proofFile) throw new Error("পেমেন্টের Screenshot নির্বাচন করুন।");
      if(!["image/jpeg","image/png","image/webp"].includes(proofFile.type)) throw new Error("শুধু JPG, PNG অথবা WEBP Screenshot দিন।");
      if(proofFile.size>5*1024*1024) throw new Error("Screenshot ৫ MB-এর কম হতে হবে।");
      submissionStage="Cloudinary Screenshot upload";
      $("formStatus").classList.remove("error");
      $("formStatus").textContent="Payment Screenshot Cloudinary-তে আপলোড হচ্ছে...";
      const uploadForm=new FormData();
      uploadForm.append("file",proofFile);
      uploadForm.append("trackingCode",pendingRequest.code);
      const uploadResponse=await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/upload-proof",{
        method:"POST",
        body:uploadForm
      });
      const uploadResult=await uploadResponse.json().catch(()=>({ok:false,error:"সার্ভার থেকে সঠিক JSON পাওয়া যায়নি।"}));
      if(!uploadResponse.ok||!uploadResult.ok||!uploadResult.secure_url){
        throw new Error(uploadResult.error||"Cloudinary Screenshot upload ব্যর্থ হয়েছে। HTTP "+uploadResponse.status);
      }
      pendingRequest.proofScreenshotUrl=uploadResult.secure_url;
      pendingRequest.proofFileName=proofFile.name.slice(0,200);
      submissionStage="Firestore Request Save";
      $("formStatus").textContent="ধাপ ৩/৩: আপনার Exchange Request Firebase-এ সংরক্ষণ হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন...";
      if(submitButton)submitButton.textContent="৩/৩ — Request Save হচ্ছে...";
      await saveRequestToFirestore(pendingRequest);
      let items=[];try{items=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch(_){}
      items.push(pendingRequest);localStorage.setItem(HISTORY_KEY,JSON.stringify(items));renderHistory();
      $("successTrackingCode").textContent=pendingRequest.code;openModal("successModal");
      $("formStatus").textContent="সফল! আপনার অনুরোধ Firestore-এ জমা হয়েছে।";$("formStatus").classList.remove("error");
      pendingRequest=null;$("proofReference").value="";$("proofEmail").value="";$("proofScreenshot").value="";$("proofPreviewWrap").hidden=true;$("proofPreviewImage").removeAttribute("src");$("proofPreviewName").textContent="";$("exchangeForm").reset();updateWalletOptions();
    }catch(error){
      console.error("Firestore request submission failed:",error);
      const code=String(error?.code||"");
      const detail=code.includes("storage/unauthorized")?"Payment Screenshot আপলোডের অনুমতি নেই (storage/unauthorized)। Storage Rules ও bucket যাচাই করুন।":code.includes("storage/bucket-not-found")?"Firebase Storage bucket পাওয়া যায়নি। Firebase Console-এ Storage চালু আছে কি না যাচাই করুন।":code.includes("permission-denied")||code.includes("firestore/permission-denied")?"রিকোয়েস্ট সংরক্ষণের অনুমতি নেই (permission-denied)। Firestore Rules-এর সঙ্গে পাঠানো তথ্য মিলছে না।":(error?.message||"রিকোয়েস্ট জমা হয়নি।")+" ["+(code||"unknown error")+"]";
      showError("ব্যর্থ ধাপ: "+submissionStage+"। "+detail);
    }finally{
      if(submitButton){submitButton.disabled=false;submitButton.textContent=submitButton.dataset.originalText||"জমা দিন";}
    }
  });
  $("copyTrackingCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("successTrackingCode").textContent);$("copyTrackingCode").textContent="কপি হয়েছে";}catch(_){}});
  $("successDone").addEventListener("click",()=>{closeModal("successModal");$("history").scrollIntoView({behavior:"smooth",block:"start"});});

  // Public request tracking through the Cloudflare Worker.
  $("trackRequestForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("trackRequestButton");
    const statusBox = $("trackRequestStatus");
    const resultBox = $("trackRequestResult");
    const trackingCode = $("trackCode").value.trim().toUpperCase();
    const phoneLast4 = $("trackPhoneLast4").value.replace(/[^0-9]/g, "");

    resultBox.innerHTML = "";
    statusBox.classList.remove("error");
    statusBox.textContent = "";

    if (!/^MET-[A-Z0-9]{4,20}$/.test(trackingCode) || ! /^[0-9]{4}$/.test(phoneLast4)) {
      statusBox.textContent = "সঠিক Tracking Code এবং ফোন নম্বরের শেষ ৪ ডিজিট লিখুন।";
      statusBox.classList.add("error");
      return;
    }

    button.disabled = true;
    button.textContent = "খোঁজা হচ্ছে...";

    try {
      const response = await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingCode, phoneLast4 })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "রিকোয়েস্ট খুঁজে পাওয়া যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।");
      }

      const statusInfo = {
        pending: { label: "Pending · যাচাই চলছে", bg: "#fef3c7", color: "#92400e" },
        approved: { label: "Approved · অনুমোদিত", bg: "#dcfce7", color: "#166534" },
        rejected: { label: "Rejected · বাতিল", bg: "#fee2e2", color: "#991b1b" }
      }[data.status] || { label: "Pending", bg: "#fef3c7", color: "#92400e" };

      const card = document.createElement("div");
      card.className = "history-item";
      card.style.marginTop = "16px";

      const details = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = data.trackingCode;
      const badge = document.createElement("span");
      badge.className = "status-pill";
      badge.textContent = statusInfo.label;
      badge.style.background = statusInfo.bg;
      badge.style.color = statusInfo.color;
      details.append(heading, badge);

      const meta = document.createElement("p");
      meta.className = "history-meta";
      const directionLabel = data.direction === "sell" ? "Sell" : data.direction === "buy" ? "Buy" : "Exchange";
      meta.textContent = directionLabel + " · " + (data.paymentMethod || "Payment method");
      details.append(meta);

      const amount = document.createElement("div");
      amount.className = "history-amount";
      amount.textContent = data.amount == null ? "—" : Number(data.amount).toLocaleString("en-US") + " " + (data.currency || "");
      card.append(details, amount);
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
        const method=$("contactMethod")?.value||"whatsapp";
        const isPhone=/^\d{11}$/.test(value);
        const isTelegramProfile=/^@?[A-Za-z0-9_]{5,32}$/.test(value)||/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/[A-Za-z0-9_]{5,32}\/?$/.test(value);
        invalid=method==="whatsapp"?!isPhone:!(isPhone||isTelegramProfile);
        const contactError=$("contactError");
        if(contactError) contactError.textContent=invalid?(method==="whatsapp"?"সঠিক ১১ ডিজিটের WhatsApp নম্বর লিখুন।":"সঠিক Telegram নম্বর, @username অথবা t.me profile link লিখুন."):"";
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
      if(!Number.isFinite(bdtEquivalent)||bdtEquivalent<exchangeLimits.minBdt||bdtEquivalent>exchangeLimits.maxBdt){
        showError("প্রতি রিকোয়েস্টের সীমা ৳"+exchangeLimits.minBdt.toLocaleString("bn-BD")+" থেকে ৳"+exchangeLimits.maxBdt.toLocaleString("bn-BD")+" (সমমূল্যের USD/USDT)। পরিমাণ পরিবর্তন করুন।");
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
    if($("amountHelp").classList.contains("amount-limit-error")) updateAmountLimitFeedback();
  });
  $("toWallet").addEventListener("change",()=>{
    if($("toWallet").value === $("fromWallet").value){
      const alternative = wallets.find(w => w.id !== $("toWallet").value);
      if(alternative) $("fromWallet").value = alternative.id;
    }
    updateAmountCurrency(); updateCalculation(); updateAmountLimitFeedback();
  });
  $("amount").addEventListener("input",updateCalculation);
  function preparePendingExchangeRequest(){
    if(!validate()) return false;
    const from=walletById($("fromWallet").value),to=walletById($("toWallet").value),amount=Number($("amount").value),r=rateFor(from,to);
    const gross=amount*r.rate;
    const feePercent = to.feePercent !== null && to.feePercent !== undefined && Number.isFinite(Number(to.feePercent)) ? Number(to.feePercent) : (from.feePercent !== null && from.feePercent !== undefined && Number.isFinite(Number(from.feePercent)) ? Number(from.feePercent) : globalFeePercent);
    const fee=gross*feePercent/100,receive=gross-fee;
    const item={
      code:"MET-"+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[b%36]).join(""),
      date:new Date().toLocaleString("bn-BD"),
      customer:$("customerName").value.trim(),fromName:from.name,toName:to.name,
      pay:money(amount,from.currency),receive:money(receive,to.currency),
      amount,fromId:from.id,toId:to.id,rate:r.rate,fee,affiliateCode:$("affiliateCode")?.value.trim()||"",note:$("note").value.trim()
    };
    pendingRequest=item;
    $("copyExchangeAddress").textContent="ঠিকানা কপি";
    return true;
  }
  window.metPrepareExchangeRequest=preparePendingExchangeRequest;
  $("exchangeForm").addEventListener("submit",event=>{event.preventDefault();if(preparePendingExchangeRequest()) window.metShowExchangeStep?.(5);});
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
  async function loadPublicExchangeSettings(){
    try {
      const response = await fetch(SETTINGS_API_BASE + "/api/exchange-settings", {cache:"no-store"});
      if (!response.ok) throw new Error("Settings API (" + response.status + ")");
      const data = await response.json();
      const settings = data && data.settings;
      if (!settings || !Array.isArray(settings.currencies)) throw new Error("Settings data format is not valid");

      const publicCurrencies = settings.currencies
        .filter(c => c && c.enabled !== false && c.hidden !== true)
        .map(c => {
          const type = ["bdt","usd","crypto"].includes(String(c.type || "").toLowerCase())
            ? String(c.type).toLowerCase() : (String(c.currency || c.code || "").toUpperCase()==="BDT" ? "bdt" : "other");
          return {
            id:String(c.id || "").trim(),
            name:String(c.name || c.id || "Currency"),
            subtitle:String(c.subtitle || ""),
            currency:String(c.currency || c.code || "USD").toUpperCase(),
            type,
            logo:String(c.logo || ""),
            buy:Number(c.buy || 0),
            sell:Number(c.sell || 0),
            short:String(c.short || c.name || c.id || "MET").slice(0,3),
            feePercent:c.feePercent === null || c.feePercent === "" || c.feePercent === undefined ? null : Number(c.feePercent),
            paymentAddress:String(c.paymentAddress || ""),
            paymentPlaceholder:String(c.paymentPlaceholder || ""),
            paymentInstruction:String(c.paymentInstruction || ""),
            enabled:c.enabled !== false,
            hidden:c.hidden === true,
            sendEnabled:c.sendEnabled !== false,
            receiveEnabled:c.receiveEnabled !== false,
            buyEnabled:c.buyEnabled !== false,
            sellEnabled:c.sellEnabled !== false
          };
        })
        .filter(c => /^[a-z0-9_-]{2,40}$/i.test(c.id));
      if (!publicCurrencies.length) throw new Error("No active currencies in Admin settings");

      wallets = publicCurrencies;
      globalFeePercent = Number.isFinite(Number(settings.feePercent)) ? Number(settings.feePercent) : 1;
      const minBdt = Number(settings.limits?.minBdt);
      const maxBdt = Number(settings.limits?.maxBdt);
      exchangeLimits = {
        minBdt:Number.isFinite(minBdt) && minBdt >= 0 ? minBdt : 500,
        maxBdt:Number.isFinite(maxBdt) && maxBdt > 0 ? maxBdt : 10000
      };
      paymentAddresses = {...DEFAULT_ADDRESSES};
      wallets.forEach(w => { if (w.paymentAddress) paymentAddresses[w.id] = w.paymentAddress; });

      renderRateTable();
      renderAdminEditor();
      renderPaymentEditor();
      updateWalletOptions();
      updateAmountLimitFeedback();
      updateCalculation();
      window.dispatchEvent(new CustomEvent("met:exchange-settings-loaded", {
        detail:{currencyCount:wallets.length,limits:{...exchangeLimits},feePercent:globalFeePercent}
      }));
      console.info("MoneyExchangeTaka public exchange settings loaded:", wallets.length);
    } catch (error) {
      console.warn("Admin exchange settings unavailable; using safe local defaults:", error);
    }
  }
  loadPublicExchangeSettings();


  // Load Owner-approved plain-text overrides for elements marked with data-content-key.
  (async function loadWebsiteTextOverrides(){
    try {
      const response = await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/content", {cache:"no-store"});
      if (!response.ok) return;
      const data = await response.json();
      const entries = data && data.entries && typeof data.entries === "object" ? data.entries : {};
      document.querySelectorAll("[data-content-key]").forEach(element => {
        const item = entries[element.getAttribute("data-content-key")];
        if (!item || typeof item.text !== "string") return;
        // Replace only the element's own text content, never parse admin text as HTML.
        element.textContent = item.text;
        element.style.textDecoration = item.struck ? "line-through" : "";
      });
    } catch (error) {
      console.warn("Website text overrides unavailable:", error);
    }
  })();
})();