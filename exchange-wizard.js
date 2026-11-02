/* Five-step exchange wizard controller. */
(function(){
  const form=document.getElementById("exchangeForm");
  if(!form)return;
  const $=(id)=>document.getElementById(id);
  let currentStep=1;
  const panels=[...form.querySelectorAll("[data-step-panel]")];
  const indicators=[...form.querySelectorAll("[data-step-indicator]")];
  const modes=[...form.querySelectorAll("[data-mode]")];
  function selectedText(id){const el=$(id);return el?.selectedOptions?.[0]?.textContent?.trim()||"—";}
  function updateReview(){
    const from=selectedText("fromWallet"),to=selectedText("toWallet");
    const amount=$("amount").value||"—",currency=$("amountCurrency").textContent||"";
    $("stepReviewSend").textContent=from;
    $("stepReviewReceive").textContent=to;
    $("finalRoute").textContent=from+" → "+to;
    $("finalSend").textContent=amount+" "+currency;
    $("finalReceive").textContent=$("receivePreview").textContent||"—";
    $("finalAccount").textContent=$("account").value.trim()||"Not entered";
    const info=window.metGetPaymentInfo?.($("fromWallet").value);
    $("payMethodDisplay").textContent=info?.name||from;
    $("payAmountDisplay").textContent=$("payPreview").textContent||"—";
    $("payAddressDisplay").textContent=info?.address||"পেমেন্ট ঠিকানা এখনো যুক্ত করা হয়নি।";
    $("proofMethodDisplay").textContent=info?.name||from;
    $("proofAmountDisplay").textContent=$("payPreview").textContent||"—";
  }
  function showStep(n){
    currentStep=Math.max(1,Math.min(5,n));
    panels.forEach(p=>{const active=Number(p.dataset.stepPanel)===currentStep;p.hidden=!active;p.classList.toggle("active",active);});
    indicators.forEach(i=>{const step=Number(i.dataset.stepIndicator);i.classList.toggle("active",step===currentStep);i.classList.toggle("done",step<currentStep);});
    if(currentStep>=2)updateReview();
  }
  function setMode(mode){
    $("direction").value=mode;
    $("direction").dispatchEvent(new Event("change",{bubbles:true}));
    modes.forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    const hints={buy:"bKash Personal, Nagad Personal, Rocket Personal অথবা Upay Personal দিয়ে USD / USDT কিনুন.",sell:"USD / USDT পাঠিয়ে bKash Personal, Nagad Personal, Rocket Personal অথবা Upay Personal-এ BDT নিন.",exchange:"Global Exchange-এ Send এবং Receive—দুই পাশের Currency নিজে নির্বাচন করুন."};
    $("exchangeModeHint").textContent=hints[mode];
    showStep(1);
  }
  function validateFields(ids){
    for(const id of ids){const el=$(id);if(el&&!el.checkValidity()){el.reportValidity();return false;}}
    return true;
  }
  modes.forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  form.querySelectorAll("[data-next-step]").forEach(b=>b.addEventListener("click",()=>{
    const next=Number(b.dataset.nextStep);
    if(currentStep===1&&!validateFields(["fromWallet","toWallet","amount"]))return;
    if(currentStep===3&&!validateFields(["customerName","contact","account"]))return;
    if(currentStep===4&&!$("terms").checked){$("terms").reportValidity();return;}
    updateReview();showStep(next);
  }));
  form.querySelectorAll("[data-prev-step]").forEach(b=>b.addEventListener("click",()=>showStep(Number(b.dataset.prevStep))));
  ["fromWallet","toWallet","amount","account"].forEach(id=>$(id)?.addEventListener("change",updateReview));
  $("amount")?.addEventListener("input",updateReview);
  $("copyExchangeAddress")?.addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText($("payAddressDisplay").textContent);$("copyExchangeAddress").textContent="কপি হয়েছে";}
    catch(_){$("copyExchangeAddress").textContent="কপি করা যায়নি";}
  });
  window.metShowExchangeStep=showStep;
  setMode("buy");
})();