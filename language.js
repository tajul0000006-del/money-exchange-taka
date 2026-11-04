/* FastMoney multilingual website selector — 27 languages, page-wide machine translation */
(function () {
  "use strict";
  var languageOptions = [
    ["en","English"],["bn","বাংলা"],["ar","العربية"],["zh-CN","中文（简体）"],["zh-TW","中文（繁體）"],
    ["fr","Français"],["de","Deutsch"],["hi","हिन्दी"],["id","Bahasa Indonesia"],["it","Italiano"],
    ["ja","日本語"],["ko","한국어"],["ms","Bahasa Melayu"],["ne","नेपाली"],["fa","فارسی"],
    ["pt","Português"],["ru","Русский"],["si","සිංහල"],["es","Español"],["sw","Kiswahili"],
    ["th","ไทย"],["tr","Türkçe"],["ur","اردو"],["vi","Tiếng Việt"],["fil","Filipino"],
    ["nl","Nederlands"],["pl","Polski"]
  ];
  var selectors = [], initialized = false, sourceLanguage = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
  function optionsMarkup(){return languageOptions.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>';}).join("");}
  function mountControls(){
    var desktop=document.querySelector(".desktop-nav");
    var mobile=document.querySelector(".mobile-nav");
    if(desktop&&!desktop.querySelector(".fm-language-select")){
      var wrap=document.createElement("label");wrap.className="fm-language-control";wrap.setAttribute("aria-label","Select website language");
      wrap.innerHTML='<i class="fa-solid fa-globe" aria-hidden="true"></i><select class="fm-language-select" aria-label="Website language">'+optionsMarkup()+'</select><i class="fa-solid fa-chevron-down fm-language-chevron" aria-hidden="true"></i>';
      desktop.appendChild(wrap);
    }
    if(mobile&&!mobile.querySelector(".fm-language-select")){
      var row=document.createElement("div");row.className="fm-mobile-language";
      row.innerHTML='<label><i class="fa-solid fa-globe" aria-hidden="true"></i><span>Website language</span></label><select class="fm-language-select" aria-label="Website language">'+optionsMarkup()+'</select>';
      mobile.appendChild(row);
    }
    if(!desktop&&!mobile&&!document.querySelector(".fm-language-float")){
      var floating=document.createElement("label");floating.className="fm-language-float";floating.innerHTML='<i class="fa-solid fa-globe" aria-hidden="true"></i><select class="fm-language-select" aria-label="Website language">'+optionsMarkup()+'</select>';
      document.body.appendChild(floating);
    }
  }
  function readSavedLanguage(){
    var match=document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
    if(!match)return "en";
    try{var code=decodeURIComponent(match[1]).split("/").pop();return languageOptions.some(function(x){return x[0]===code;})?code:"en";}
    catch(_){return "en";}
  }
  function sync(code){selectors.forEach(function(s){if(s)s.value=code;});}
  function apply(code){
    if(!languageOptions.some(function(x){return x[0]===code;}))code="en";
    document.cookie="googtrans="+(code===sourceLanguage?"/"+sourceLanguage+"/"+sourceLanguage:"/"+sourceLanguage+"/"+code)+";path=/;max-age=31536000;SameSite=Lax";
    try{localStorage.setItem("fastmoney-language",code);}catch(_){}
    sync(code);
    if(code===sourceLanguage){document.cookie="googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Lax";window.location.reload();return;}
    var combo=document.querySelector(".goog-te-combo");
    if(combo){combo.value=code;combo.dispatchEvent(new Event("change",{bubbles:true}));}
    else window.location.reload();
  }
  window.googleTranslateElementInit=function(){
    if(initialized||!window.google||!google.translate)return;
    initialized=true;
    new google.translate.TranslateElement({pageLanguage:sourceLanguage,includedLanguages:languageOptions.filter(function(x){return x[0]!=="en";}).map(function(x){return x[0];}).join(","),autoDisplay:false},"google_translate_element");
    var saved=readSavedLanguage();sync(saved);
    if(saved!=="en"){var tries=0,timer=window.setInterval(function(){var combo=document.querySelector(".goog-te-combo");tries++;if(combo){window.clearInterval(timer);combo.value=saved;combo.dispatchEvent(new Event("change",{bubbles:true}));}else if(tries>40)window.clearInterval(timer);},250);}
  };
  document.addEventListener("DOMContentLoaded",function(){
    mountControls();
    selectors=Array.prototype.slice.call(document.querySelectorAll(".fm-language-select"));
    sync(readSavedLanguage());
    selectors.forEach(function(s){s.addEventListener("change",function(){apply(s.value);});});
    if(!document.getElementById("google_translate_element")){var holder=document.createElement("div");holder.id="google_translate_element";holder.setAttribute("aria-hidden","true");document.body.appendChild(holder);}
    var script=document.createElement("script");script.src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";script.async=true;document.head.appendChild(script);
  });
}());