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


CLOUDINARY CURRENCY LOGO UPLOAD
--------------------------------
Cloud name: rac2a5d3
Unsigned upload preset: moneyexchange_upload

The Admin Settings section now includes a currency-logo uploader. Choose a
PNG/JPG/WebP image up to 2 MB. The image is uploaded to Cloudinary and its
secure URL is saved in this browser's localStorage for the current device.

IMPORTANT SECURITY / DEPLOYMENT NOTES
- Never put the Cloudinary API Secret in browser code.
- This unsigned preset is public. Restrict allowed formats and maximum file
  size in Cloudinary preset settings, and monitor usage.
- The current Admin Settings panel is not protected by server-side admin
  authentication. Do not treat it as a secure production admin panel.
- Logo URL changes currently save only in this browser (localStorage); they
  are not yet synchronized to Firestore for other users/devices.
- Customer payment-proof images are not uploaded to Cloudinary in this
  frontend update. Add a trusted server-side upload flow before storing
  sensitive payment receipts.
