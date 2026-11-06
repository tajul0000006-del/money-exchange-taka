/* Render the public FastMoney network from the same settings managed in Owner Admin. */
(() => {
  "use strict";
  const section = document.querySelector(".fm-network-v2");
  const root = section?.querySelector("[data-network-live]");
  if (!root) return;
  const SETTINGS_API = "https://moneyexchange-admin.taijulsheikh60.workers.dev/api/exchange-settings";
  const groups = [
    {type:"crypto", label:"DIGITAL CURRENCIES", note:"USDT and other supported digital currency networks"},
    {type:"global", label:"INTERNATIONAL E-WALLETS", note:"Global online wallets and e-payment services"},
    {type:"bdt", label:"BANGLADESH PAYMENT SERVICES", note:"Local mobile financial and payment services"}
  ];
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
  const renderCurrencyCodes = () => {
    if (root.querySelector(".fm-currency-code-panel")) return;
    const panel = make("div","fm-network-group fm-currency-code-panel");
    const heading = make("div","fm-network-label");
    heading.append(make("span","fm-network-label-text","CURRENCY CODES"));
    heading.append(make("b","fm-network-count",currencyCodes.length + " CURRENCIES"));
    panel.append(heading);
    const list = make("div","fm-currency-code-grid");
    currencyCodes.forEach(([code,name,flag]) => {
      const card = make("div","fm-currency-code-card");
      card.append(make("span","fm-currency-flag",flag));
      const details = make("span","fm-currency-code-copy");
      details.append(make("b","",code),make("small","",name));
      card.append(details);
      list.append(card);
    });
    panel.append(list);
    root.append(panel);
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
  const render = currencies => {
    const active = currencies.filter(c => c && c.enabled !== false && c.hidden !== true && String(c.id || "").trim());
    const sections = groups.map(group => {
      const items = active.filter(c => group.type === "global" ? !["crypto","bdt"].includes(String(c.type || "").toLowerCase()) : String(c.type || "").toLowerCase() === group.type);
      if (!items.length) return null;
      const row = make("div","fm-network-group");
      const groupLabel = make("span","fm-network-label");
      const groupName = make("span","fm-network-label-text",group.label);
      groupName.setAttribute("data-content-key", "network.group." + group.type);
      groupLabel.append(groupName);
      if (group.type === "crypto") groupLabel.append(make("b","fm-network-count","100+ CURRENCIES"));
      row.append(groupLabel);
      const list = make("div","fm-network-logos");
      items.forEach(item => {
        const entry = make("span","fm-network-method");
        const mark = make("b","fm-logo-mark",String(item.short || item.name || item.id || "FM").slice(0,3));
        const imageUrl = safeImage(item.logo);
        if (imageUrl) {
          const img = document.createElement("img");
          img.src = imageUrl;
          img.alt = "";
          img.loading = "lazy";
          img.onerror = () => { img.remove(); mark.textContent = String(item.short || item.name || item.id || "FM").slice(0,3); };
          mark.textContent = "";
          mark.append(img);
        }
        const copy = make("span","fm-network-method-copy");
        copy.append(make("span","fm-network-method-name",String(item.name || item.id)));
        let meta = String(item.currency || "").toUpperCase();
        if (String(item.type || "").toLowerCase() === "bdt") meta = "PERSONAL BDT";
        else if (String(item.type || "").toLowerCase() === "crypto" && /TRC20|TRON/i.test(String(item.subtitle || ""))) meta += " · TRC20";
        copy.append(make("small","",meta));
        entry.append(mark,copy);
        list.append(entry);
      });
      row.append(list);
      return row;
    }).filter(Boolean);
    if (!sections.length) return;
    root.replaceChildren(...sections);
    renderCurrencyCodes();
    root.dataset.source = "admin-settings";
    applyTextOverrides();
  };
  renderCurrencyCodes();
  fetch(SETTINGS_API,{cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("Exchange settings unavailable"); return response.json(); })
    .then(data => { if (Array.isArray(data?.settings?.currencies)) render(data.settings.currencies); })
    .catch(() => { /* Keep the built-in public fallback if settings cannot be reached. */ });
})();
