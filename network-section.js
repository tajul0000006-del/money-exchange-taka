/* Render the public FastMoney network from the same settings managed in Owner Admin. */
(() => {
  "use strict";
  const section = document.querySelector(".fm-network-v2");
  const root = section?.querySelector("[data-network-live]");
  if (!root) return;
  const SETTINGS_API = "https://moneyexchange-admin.taijulsheikh60.workers.dev/api/exchange-settings";
  const currencyCodes = [
    ["USD","US Dollar","🇺🇸"],["BDT","Bangladeshi Taka","🇧🇩"],["EUR","Euro","🇪🇺"],["GBP","British Pound","🇬🇧"],
    ["INR","Indian Rupee","🇮🇳"],["AED","UAE Dirham","🇦🇪"],["SAR","Saudi Riyal","🇸🇦"],["MYR","Malaysian Ringgit","🇲🇾"],
    ["SGD","Singapore Dollar","🇸🇬"],["JPY","Japanese Yen","🇯🇵"],["CNY","Chinese Yuan","🇨🇳"],["HKD","Hong Kong Dollar","🇭🇰"],
    ["AUD","Australian Dollar","🇦🇺"],["CAD","Canadian Dollar","🇨🇦"],["CHF","Swiss Franc","🇨🇭"],["NZD","New Zealand Dollar","🇳🇿"],
    ["PKR","Pakistani Rupee","🇵🇰"],["NPR","Nepalese Rupee","🇳🇵"],["LKR","Sri Lankan Rupee","🇱🇰"],["THB","Thai Baht","🇹🇭"],
    ["IDR","Indonesian Rupiah","🇮🇩"],["PHP","Philippine Peso","🇵🇭"],["KRW","South Korean Won","🇰🇷"],["VND","Vietnamese Dong","🇻🇳"],
    ["TRY","Turkish Lira","🇹🇷"],["RUB","Russian Ruble","🇷🇺"],["UAH","Ukrainian Hryvnia","🇺🇦"],["KZT","Kazakhstani Tenge","🇰🇿"],
    ["UZS","Uzbekistani Som","🇺🇿"],["GEL","Georgian Lari","🇬🇪"],["AZN","Azerbaijani Manat","🇦🇿"],["AMD","Armenian Dram","🇦🇲"],
    ["ILS","Israeli New Shekel","🇮🇱"],["QAR","Qatari Riyal","🇶🇦"],["KWD","Kuwaiti Dinar","🇰🇼"],["BHD","Bahraini Dinar","🇧🇭"],
    ["OMR","Omani Rial","🇴🇲"],["JOD","Jordanian Dinar","🇯🇴"],["EGP","Egyptian Pound","🇪🇬"],["ZAR","South African Rand","🇿🇦"],
    ["NGN","Nigerian Naira","🇳🇬"],["KES","Kenyan Shilling","🇰🇪"],["GHS","Ghanaian Cedi","🇬🇭"],["UGX","Ugandan Shilling","🇺🇬"],
    ["TZS","Tanzanian Shilling","🇹🇿"],["RWF","Rwandan Franc","🇷🇼"],["ETB","Ethiopian Birr","🇪🇹"],["MAD","Moroccan Dirham","🇲🇦"],
    ["TND","Tunisian Dinar","🇹🇳"],["DZD","Algerian Dinar","🇩🇿"],["XOF","West African CFA Franc","🌍"],["XAF","Central African CFA Franc","🌍"],
    ["MUR","Mauritian Rupee","🇲🇺"],["SCR","Seychellois Rupee","🇸🇨"],["BWP","Botswana Pula","🇧🇼"],["NAD","Namibian Dollar","🇳🇦"],
    ["ZMW","Zambian Kwacha","🇿🇲"],["MWK","Malawian Kwacha","🇲🇼"],["MZN","Mozambican Metical","🇲🇿"],["AOA","Angolan Kwanza","🇦🇴"],
    ["BRL","Brazilian Real","🇧🇷"],["ARS","Argentine Peso","🇦🇷"],["CLP","Chilean Peso","🇨🇱"],["COP","Colombian Peso","🇨🇴"],
    ["PEN","Peruvian Sol","🇵🇪"],["UYU","Uruguayan Peso","🇺🇾"],["PYG","Paraguayan Guarani","🇵🇾"],["BOB","Bolivian Boliviano","🇧🇴"],
    ["CRC","Costa Rican Colon","🇨🇷"],["DOP","Dominican Peso","🇩🇴"],["GTQ","Guatemalan Quetzal","🇬🇹"],["HNL","Honduran Lempira","🇭🇳"],
    ["NIO","Nicaraguan Cordoba","🇳🇮"],["PAB","Panamanian Balboa","🇵🇦"],["JMD","Jamaican Dollar","🇯🇲"],["TTD","Trinidad and Tobago Dollar","🇹🇹"],
    ["BBD","Barbadian Dollar","🇧🇧"],["BSD","Bahamian Dollar","🇧🇸"],["XCD","East Caribbean Dollar","🌎"],["MXN","Mexican Peso","🇲🇽"],
    ["FJD","Fijian Dollar","🇫🇯"],["PGK","Papua New Guinean Kina","🇵🇬"],["WST","Samoan Tala","🇼🇸"],["TOP","Tongan Paʻanga","🇹🇴"],
    ["VUV","Vanuatu Vatu","🇻🇺"],["SBD","Solomon Islands Dollar","🇸🇧"],["KHR","Cambodian Riel","🇰🇭"],["LAK","Lao Kip","🇱🇦"],
    ["MMK","Myanmar Kyat","🇲🇲"],["MNT","Mongolian Tugrik","🇲🇳"],["KGS","Kyrgyzstani Som","🇰🇬"],["TJS","Tajikistani Somoni","🇹🇯"],
    ["BYN","Belarusian Ruble","🇧🇾"],["MDL","Moldovan Leu","🇲🇩"],["RON","Romanian Leu","🇷🇴"],["BGN","Bulgarian Lev","🇧🇬"],
    ["CZK","Czech Koruna","🇨🇿"],["PLN","Polish Zloty","🇵🇱"],["HUF","Hungarian Forint","🇭🇺"],["DKK","Danish Krone","🇩🇰"],
    ["SEK","Swedish Krona","🇸🇪"],["NOK","Norwegian Krone","🇳🇴"],["ISK","Icelandic Krona","🇮🇸"],["RSD","Serbian Dinar","🇷🇸"],
    ["BAM","Convertible Mark","🇧🇦"],["MKD","Macedonian Denar","🇲🇰"],["ALL","Albanian Lek","🇦🇱"],["XPF","CFP Franc","🌊"],
    ["BND","Brunei Dollar","🇧🇳"],["MOP","Macanese Pataca","🇲🇴"],["TWD","New Taiwan Dollar","🇹🇼"],["KPW","North Korean Won","🇰🇵"],
    ["IRR","Iranian Rial","🇮🇷"],["IQD","Iraqi Dinar","🇮🇶"],["LBP","Lebanese Pound","🇱🇧"],["YER","Yemeni Rial","🇾🇪"],
    ["AFN","Afghan Afghani","🇦🇫"],["KMF","Comorian Franc","🇰🇲"],["DJF","Djiboutian Franc","🇩🇯"],["ERN","Eritrean Nakfa","🇪🇷"]
  ];
  const make = (tag, cls, value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const popularCryptocurrencies = [
    ["USDT","Tether"],
    ["USDC","USDC"],
    ["DAI","Dai"],
    ["FDUSD","First Digital USD"],
    ["TUSD","TrueUSD"],
    ["USDE","Ethena USDe"],
    ["USDS","Sky Dollar"],
    ["PYUSD","PayPal USD"],
    ["USDD","Decentralized USD"],
    ["FRAX","Frax"],
    ["USDP","Pax Dollar"],
    ["GUSD","Gemini Dollar"],
    ["EURC","Euro Coin"],
    ["EURS","STASIS EURO"],
    ["RLUSD","Ripple USD"]
  ];
  const popularEWallets = [
    {code:"VOLET",name:"Volet",logo:"https://cdn.simpleicons.org/volet"},
    {code:"REDOTPAY",name:"RedotPay",logo:"https://cdn.simpleicons.org/redotpay"},
    {code:"WEBMONEY",name:"WebMoney",logo:"https://cdn.simpleicons.org/webmoney"},
    {code:"SKRILL",name:"Skrill",logo:"https://cdn.simpleicons.org/skrill"},
    {code:"NETELLER",name:"Neteller",logo:"https://cdn.simpleicons.org/neteller"},
    {code:"PAYPAL",name:"PayPal",logo:"https://cdn.simpleicons.org/paypal"},
    {code:"WISE",name:"Wise",logo:"https://cdn.simpleicons.org/wise"},
    {code:"PAYONEER",name:"Payoneer",logo:"https://cdn.simpleicons.org/payoneer"},
    {code:"REVOLUT",name:"Revolut",logo:"https://cdn.simpleicons.org/revolut"},
    {code:"AIRTM",name:"Airtm",logo:"https://cdn.simpleicons.org/airtm"},
    {code:"EPAY",name:"ePay",logo:""}
  ];
  const renderDirectory = (className,title,items,kind) => {
    const panel = make("div","fm-network-group notranslate " + className);
    panel.setAttribute("translate","no");
    const heading = make("div","fm-network-label");
    heading.append(make("span","fm-network-label-text",title));
    heading.append(make("b","fm-network-count",items.length + " LISTED"));
    panel.append(heading);
    const list = make("div",(kind === "crypto" || kind === "wallet") ? "fm-crypto-code-grid" : "fm-currency-code-grid");
    items.forEach(item => {
      const code = Array.isArray(item) ? item[0] : item.code;
      const name = Array.isArray(item) ? item[1] : item.name;
      const flag = Array.isArray(item) ? item[2] : item.flag;
      const logo = kind === "crypto" ? ((!Array.isArray(item) && safeImage(item.logo)) || "https://assets.coincap.io/assets/icons/" + String(code).toLowerCase() + "@2x.png") : (!Array.isArray(item) ? safeImage(item.logo) : "");
      const card = make("div",(kind === "crypto" || kind === "wallet") ? "fm-crypto-code-card" : "fm-currency-code-card");
      if (logo) {
        const img = document.createElement("img"); img.src=logo; img.alt=""; img.loading="lazy"; const wrap=make("span","fm-currency-flag"); img.onerror=()=>{img.remove();wrap.textContent=String(code).slice(0,2)}; wrap.append(img); card.append(wrap);
      } else card.append(make("span","fm-currency-flag",flag || "◈"));
      const details = make("span",(kind === "crypto" || kind === "wallet") ? "fm-crypto-code-copy" : "fm-currency-code-copy");
      details.append(make("b","",code),make("small","",name));
      card.append(details); list.append(card);
    });
    panel.append(list); root.append(panel);
  };
  const renderCurrencyCodes = custom => {
    root.querySelector(".fm-currency-code-panel")?.remove();
    const items = Array.isArray(custom) ? custom.filter(x => x && (Array.isArray(x) || x.enabled !== false)) : currencyCodes;
    renderDirectory("fm-currency-code-panel","WE SUPPORT THESE CURRENCY CODES",items,"fiat");
  };
  const renderPopularEWallets = custom => {
    root.querySelector(".fm-wallet-code-panel")?.remove();
    const items = Array.isArray(custom) ? custom.filter(x => x && (Array.isArray(x) || x.enabled !== false)) : popularEWallets;
    renderDirectory("fm-wallet-code-panel","WE SUPPORT POPULAR E-WALLETS",items,"wallet");
  };
  const renderPopularCrypto = custom => {
    root.querySelector(".fm-crypto-code-panel")?.remove();
    const supportedCodes = new Set(popularCryptocurrencies.map(item => item[0]));
    const items = Array.isArray(custom) ? custom.filter(x => x && supportedCodes.has(String(Array.isArray(x) ? x[0] : x.code || "").toUpperCase()) && (Array.isArray(x) || x.enabled !== false)) : popularCryptocurrencies;
    renderDirectory("fm-crypto-code-panel","WE SUPPORT THESE CRYPTOCURRENCIES",items,"crypto");
  };
  const safeImage = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https:\/\//i.test(raw) || /^http:\/\//i.test(raw) || /^(\.\.\/|\.\/|\/)/.test(raw)) return raw;
    return "";
  };
  const applyTextOverrides = async () => {
    try {
      const response = await fetch("https://bold-surf-9356.taijulsheikh60.workers.dev/api/content", {cache:"no-store"});
      if (!response.ok) return;
      const data = await response.json();
      const entries = data && data.entries && typeof data.entries === "object" ? data.entries : {};
      section.querySelectorAll("[data-content-key]").forEach(el => {
        const item = entries[el.getAttribute("data-content-key")];
        if (item && typeof item.text === "string") { el.textContent = item.text; el.style.textDecoration = item.struck ? "line-through" : ""; }
      });
    } catch (_) {}
  };

  const setupNetworkCarousel = () => {
    const panels = [...root.querySelectorAll(".fm-network-group")];
    if (panels.length < 2) return;
    root.setAttribute("aria-label","Payment network categories. Swipe or use the arrows to browse.");
    const controls = make("div","fm-network-carousel-controls");
    const previous = make("button","fm-network-carousel-arrow","‹");
    const dots = make("div","fm-network-carousel-dots");
    const next = make("button","fm-network-carousel-arrow","›");
    previous.type = next.type = "button";
    previous.setAttribute("aria-label","Previous category");
    next.setAttribute("aria-label","Next category");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = 0, timer = null;
    const go = index => {
      active = (index + panels.length) % panels.length;
      panels[active].scrollIntoView({behavior:reduced ? "auto" : "smooth",block:"nearest",inline:"start"});
      dots.querySelectorAll("button").forEach((dot,i)=>dot.setAttribute("aria-current",String(i===active)));
    };
    panels.forEach((panel,i)=>{
      const dot=make("button","fm-network-carousel-dot");
      dot.type="button";dot.setAttribute("aria-label","Show category "+(i+1));
      dot.setAttribute("aria-current",String(i===0));
      dot.addEventListener("click",()=>{go(i);restart();});
      dots.append(dot);
    });
    const stop=()=>{if(timer)window.clearInterval(timer);timer=null;};
    const start=()=>{stop();if(!reduced&&!document.hidden)timer=window.setInterval(()=>go(active+1),5000);};
    const restart=()=>start();
    previous.addEventListener("click",()=>{go(active-1);restart();});
    next.addEventListener("click",()=>{go(active+1);restart();});
    root.addEventListener("scroll",()=>{
      const center=root.getBoundingClientRect().left+root.clientWidth/2;
      let closest=0,best=Infinity;
      panels.forEach((panel,i)=>{const r=panel.getBoundingClientRect();const d=Math.abs(r.left+r.width/2-center);if(d<best){best=d;closest=i;}});
      active=closest;
      dots.querySelectorAll("button").forEach((dot,i)=>dot.setAttribute("aria-current",String(i===active)));
    },{passive:true});
    controls.append(previous,dots,next);
    root.insertAdjacentElement("afterend",controls);
    root.addEventListener("mouseenter",stop);root.addEventListener("mouseleave",start);
    root.addEventListener("touchstart",stop,{passive:true});root.addEventListener("touchend",start,{passive:true});
    root.addEventListener("focusin",stop);root.addEventListener("focusout",e=>{if(!root.contains(e.relatedTarget))start();});
    document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
    start();
  };

  let directorySettings = {};
  const render = () => {
    root.replaceChildren();
    if (directorySettings.publicCurrencyDirectoryEnabled !== false) renderCurrencyCodes(directorySettings.publicCurrencyCodes);
    renderPopularCrypto(directorySettings.popularCryptocurrencies);
    renderPopularEWallets(directorySettings.popularEWallets);
    root.dataset.source = "admin-settings";
  };
  fetch(SETTINGS_API/,{cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("Exchange settings unavailable"); return response.json(); })
    .then(data => { directorySettings = data?.settings || {}; render(); })
    .catch(() => { /* Keep the built-in public fallback if settings cannot be reached. */ });
})();
