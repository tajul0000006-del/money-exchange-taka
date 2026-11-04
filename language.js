/* FastMoney multilingual website selector — Google Translate powered */
(function () {
  "use strict";
  var languages = ["en","bn","ar","zh-CN","zh-TW","fr","de","hi","id","it","ja","ko","ms","ne","fa","pt","ru","si","es","sw","th","tr","ur","vi","fil","nl","pl"];
  var selectors = [];
  var initialized = false;
  function readSavedLanguage() {
    var match = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
    if (!match) return "en";
    try { var code = decodeURIComponent(match[1]).split("/").pop(); return languages.indexOf(code) >= 0 ? code : "en"; }
    catch (_) { return "en"; }
  }
  function setCookie(code) {
    document.cookie = "googtrans=" + (code === "en" ? "/en/en" : "/en/" + code) + ";path=/;max-age=31536000;SameSite=Lax";
    try { localStorage.setItem("fastmoney-language", code); } catch (_) {}
  }
  function sync(code) { selectors.forEach(function (s) { if (s) s.value = code; }); }
  function apply(code) {
    if (languages.indexOf(code) < 0) code = "en";
    setCookie(code); sync(code);
    if (code === "en") {
      document.cookie = "googtrans=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Lax";
      window.location.reload(); return;
    }
    var combo = document.querySelector(".goog-te-combo");
    if (combo) { combo.value = code; combo.dispatchEvent(new Event("change", {bubbles:true})); }
    else window.location.reload();
  }
  window.googleTranslateElementInit = function () {
    if (initialized || !window.google || !google.translate) return;
    initialized = true;
    new google.translate.TranslateElement({pageLanguage:"en",includedLanguages:languages.filter(function(x){return x!=="en";}).join(","),autoDisplay:false}, "google_translate_element");
    var saved = readSavedLanguage(); sync(saved);
    if (saved !== "en") {
      var tries=0, timer=window.setInterval(function(){
        var combo=document.querySelector(".goog-te-combo"); tries++;
        if(combo){window.clearInterval(timer);combo.value=saved;combo.dispatchEvent(new Event("change",{bubbles:true}));}
        else if(tries>30) window.clearInterval(timer);
      },250);
    }
  };
  document.addEventListener("DOMContentLoaded", function () {
    selectors=Array.prototype.slice.call(document.querySelectorAll(".fm-language-select"));
    sync(readSavedLanguage());
    selectors.forEach(function(s){s.addEventListener("change",function(){apply(s.value);});});
    var script=document.createElement("script");
    script.src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";script.async=true;
    document.head.appendChild(script);
  });
}());