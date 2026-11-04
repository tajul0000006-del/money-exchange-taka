document.addEventListener("DOMContentLoaded",()=>{
  const section=document.querySelector(".about-premium");
  if(!section)return;
  const intro=section.querySelector(".about-intro");
  if(intro){
    const title=intro.querySelector("h2");
    const copy=intro.querySelector("p");
    if(title)title.textContent="Smarter Digital Payments. Seamless Exchange Experiences.";
    if(copy)copy.textContent="FastMoney provides a streamlined platform for buying, selling and exchanging supported digital currencies and payment wallet balances. Our focus is to simplify digital transactions through transparent processes, clear payment instructions and verified request handling.";
  }
  const features=[...section.querySelectorAll(".about-feature")];
  const content=[
    ["EFFICIENT EXCHANGE EXPERIENCE","A streamlined request process designed to make digital exchanges simple and convenient. Each request is reviewed before processing."],
    ["CONNECTED PAYMENT NETWORK","Explore a growing range of supported digital wallets, local payment services and digital currency options in one place."],
    ["VERIFICATION & SECURITY","Payment details and submitted information are checked against the instructions before an exchange request is processed."],
    ["DEDICATED CUSTOMER ASSISTANCE","Get help with exchange requests, payment instructions and transaction updates through the available support channels."]
  ];
  features.forEach((card,i)=>{
    const index=card.querySelector(".about-index");
    const heading=card.querySelector("h3");
    const paragraph=card.querySelector("p");
    if(index)index.textContent=["01 / EXPERIENCE","02 / NETWORK","03 / VERIFICATION","04 / SUPPORT"][i]||index.textContent;
    if(heading&&content[i])heading.textContent=content[i][0];
    if(paragraph&&content[i]&&i!==1)paragraph.textContent=content[i][1];
  });
  const currencyTags=section.querySelector(".currency-tags");
  if(currencyTags){
    const methods=["Binance USDT TRC20","BingX USDT TRC20","KuCoin USDT TRC20","Bybit USDT TRC20","Perfect Money","WebMoney","PayPal","ePay USD","Volet USD","RedotPay USD","TunePay USD","bKash Personal BDT","Nagad Personal BDT","Rocket Personal BDT","Upay Personal BDT"];
    currencyTags.replaceChildren(...methods.map(name=>{const tag=document.createElement("span");tag.textContent=name;return tag;}));
  }
  const network=section.querySelector(".about-bottom");
  if(network){
    const eyebrow=network.querySelector(".about-eyebrow");
    const heading=network.querySelector("h3");
    const paragraph=network.querySelector("p");
    if(eyebrow)eyebrow.textContent="EXCHANGE NETWORK";
    if(heading)heading.textContent="One Platform. Multiple Payment Networks.";
    if(paragraph){
      paragraph.textContent="Supported options include digital wallets, local payments and selected cryptocurrency networks.";
    }
    const fee=network.querySelector(".about-fee");
    if(fee){
      const strong=fee.querySelector("strong");
      const amount=fee.querySelector("span");
      const note=fee.querySelector("small");
      if(strong)strong.textContent="BINANCE PAY ID";
      if(amount)amount.textContent="0 Transaction Fee*";
      if(note)note.textContent="*Applies only to eligible Binance Pay ID transfers. Final fees, where applicable, will be confirmed before order placement.";
    }
  }
  const items=section.querySelectorAll(".reveal-about");
  if(!("IntersectionObserver" in window)){items.forEach(item=>item.classList.add("is-visible"));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.1});
  items.forEach(item=>observer.observe(item));
});