MoneyExchangeTaka - Updated Frontend

Files:
- index.html
- style.css
- app.js

Updates in this version:
- BDT wallets show a Personal BDT label in wallet selection.
- Contact field accepts WhatsApp, Telegram username, or email.
- Receiving-wallet instructions adapt to the selected wallet/currency.
- Per-request amount limits are enforced using BDT equivalent: minimum BDT 500, maximum BDT 10,000.
- Payment/proof steps are labeled 1/3 and 2/3; the confirmation popup is the final step.
- The payment proof flow can continue when an address has not yet been entered in settings, for interface testing. Do not accept real payments until correct payment addresses and server-side validation are configured.
- Admin rates and payment addresses are currently saved in this browser only. They are not shared across devices and are not secure server storage.

Before going live:
1. Implement Firebase/server-side storage and authentication.
2. Protect admin access with server-side authorization.
3. Validate limits and exchange rates on the server, not only in browser JavaScript.
4. Upload payment screenshots to secure storage and validate file type/size.
5. Set and verify real payment addresses and cryptocurrency networks.
6. Test every buy, sell, and exchange flow end-to-end.


LOGO CHANGE (IMPORTANT):
All wallet/currency logo image files are in assets/logos/.
The current PNGs are replaceable placeholder icons, not official logos.
To use your own logos, upload/replace the PNG file with the same filename:
bkash.png, nagad.png, rocket.png, upay.png, paypal.png, perfectmoney.png,
webmoney.png, volet.png, binance.png, kucoin.png, bybit.png, epay.png, tunepay.png.
Keep the same filename and PNG format so the website updates without editing app.js.

UPDATE: Header-এর নিচে এবং scrolling ticker-এর উপরে Login / Sign Up buttons যুক্ত করা হয়েছে। Authentication backend পূর্বের প্রজেক্টে নেই; বোতামগুলো আপাতত এ বিষয়ে জানায়।

ADMIN PANEL (INITIAL UI)
------------------------
Open admin.html to view the initial Green Premium admin panel interface.
This is a UI scaffold only. Login, request moderation, wallet changes, user
management and Cloudinary uploads are intentionally disabled until trusted
Firebase Authentication role checks, Firestore Security Rules and server-side
Cloud Functions are deployed. Never grant admin rights from browser JavaScript.
