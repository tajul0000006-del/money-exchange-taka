"use strict";

/* ==========================================
   MONEYEXCHANGETAKA.COM
   Main JavaScript
   Header, Navigation, Animation & Footer
========================================== */


/* ==========================================
   1. SELECT HTML ELEMENTS
========================================== */

const header = document.getElementById("mainHeader");
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");

const desktopLinks = document.querySelectorAll(
  ".desktop-nav .nav-link"
);

const mobileLinks = document.querySelectorAll(
  ".mobile-nav-link"
);

const allNavLinks = document.querySelectorAll(
  ".desktop-nav .nav-link, .mobile-nav-link"
);


/* ==========================================
   2. MOBILE MENU OPEN / CLOSE
========================================== */

function setMenuState(isOpen) {

  // Required elements available কিনা যাচাই
  if (!menuToggle || !mobileMenu) {
    return;
  }

  // Menu button animation
  menuToggle.classList.toggle("active", isOpen);

  // Dropdown animation
  mobileMenu.classList.toggle("open", isOpen);

  // Accessibility attributes
  menuToggle.setAttribute(
    "aria-expanded",
    String(isOpen)
  );

  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"
  );

  mobileMenu.setAttribute(
    "aria-hidden",
    String(!isOpen)
  );
}


/* ==========================================
   3. MENU BUTTON CLICK
========================================== */

if (menuToggle && mobileMenu) {

  menuToggle.addEventListener("click", function () {

    const isOpen =
      menuToggle.getAttribute("aria-expanded") === "true";

    setMenuState(!isOpen);

  });

}


/* ==========================================
   4. CLOSE MENU AFTER NAVIGATION
========================================== */

mobileLinks.forEach(function (link) {

  link.addEventListener("click", function () {

    setMenuState(false);

  });

});


/* ==========================================
   5. CLICK OUTSIDE TO CLOSE MENU
========================================== */

document.addEventListener("click", function (event) {

  if (!header) {
    return;
  }

  // Header-এর বাইরে ক্লিক করলে Menu বন্ধ হবে
  if (!header.contains(event.target)) {
    setMenuState(false);
  }

});


/* ==========================================
   6. ESCAPE KEY TO CLOSE MENU
========================================== */

document.addEventListener("keydown", function (event) {

  if (event.key === "Escape") {

    const menuIsOpen =
      menuToggle &&
      menuToggle.getAttribute("aria-expanded") === "true";

    if (menuIsOpen) {
      setMenuState(false);
      menuToggle.focus();
    }

  }

});


/* ==========================================
   7. ACTIVE NAVIGATION
========================================== */

function setActiveNavigation(targetId) {

  allNavLinks.forEach(function (link) {

    const linkTarget = link.getAttribute("href");

    const isActive = linkTarget === targetId;

    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }

  });

}


// Navigation-এ ক্লিক করলে Active Style পরিবর্তন
allNavLinks.forEach(function (link) {

  link.addEventListener("click", function () {

    const targetId = link.getAttribute("href");

    if (targetId && targetId.startsWith("#")) {
      setActiveNavigation(targetId);
    }

  });

});


/* ==========================================
   8. ACTIVE NAVIGATION WHILE SCROLLING
========================================== */

const pageSections = document.querySelectorAll(
  "main section[id]"
);

let scrollTicking = false;

function updateActiveSection() {

  if (pageSections.length === 0) {
    return;
  }

  const headerHeight = header
    ? header.offsetHeight
    : 0;

  const activationPoint = headerHeight + 100;

  let currentSection = pageSections[0].id;

  pageSections.forEach(function (section) {

    const sectionTop =
      section.getBoundingClientRect().top;

    if (sectionTop <= activationPoint) {
      currentSection = section.id;
    }

  });

  setActiveNavigation("#" + currentSection);

}

window.addEventListener(
  "scroll",
  function () {

    if (!scrollTicking) {

      window.requestAnimationFrame(function () {

        updateActiveSection();

        scrollTicking = false;

      });

      scrollTicking = true;
    }

  },
  { passive: true }
);


/* ==========================================
   9. HEADER SCROLL EFFECT
========================================== */

function updateHeaderOnScroll() {

  if (!header) {
    return;
  }

  header.classList.toggle(
    "scrolled",
    window.scrollY > 20
  );

}

window.addEventListener(
  "scroll",
  updateHeaderOnScroll,
  { passive: true }
);


/* ==========================================
   10. CLOSE MOBILE MENU ON RESIZE
========================================== */

const mobileBreakpoint = window.matchMedia(
  "(min-width: 761px)"
);

function handleScreenResize(event) {

  if (event.matches) {
    setMenuState(false);
  }

}

if (mobileBreakpoint.addEventListener) {

  mobileBreakpoint.addEventListener(
    "change",
    handleScreenResize
  );

} else {

  // পুরোনো Browser support
  mobileBreakpoint.addListener(handleScreenResize);

}


/* ==========================================
   11. FOOTER CURRENT YEAR
========================================== */

const currentYearElement =
  document.getElementById("currentYear");

if (currentYearElement) {

  currentYearElement.textContent =
    new Date().getFullYear();

}


/* ==========================================
   12. INITIALIZE HEADER
========================================== */

document.addEventListener("DOMContentLoaded", function () {

  // Page load-এর সময় Menu বন্ধ থাকবে
  setMenuState(false);

  // প্রথম Active Navigation
  setActiveNavigation("#home");

  // Header-এর প্রাথমিক Scroll Style
  updateHeaderOnScroll();

  // Page-এর বর্তমান Section অনুযায়ী Active Link
  updateActiveSection();

});


/* ==========================================
   END OF MAIN JAVASCRIPT
========================================== */
















