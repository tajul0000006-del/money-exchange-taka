# MoneyExchangeTaka — বাংলা স্টার্টার

এটি একটি responsive বাংলা frontend + Firebase Authentication/Firestore starter। ডোমেইন বা paid hosting এখন দরকার নেই। GitHub ও Cloudflare Pages দিয়ে পরে প্রকাশ করা যাবে।

## এখন কী কাজ করে
- বাংলা responsive homepage ও exchange request form
- ডলার কিনুন/বিক্রি করুন UI
- Guest এবং logged-in member request-এর কাঠামো
- Firebase Email/Password signup/login
- Referral code field (bonus calculation এখনো নেই)
- Firebase সংযুক্ত না থাকলে demo-only UI
- Firestore Rules: client থেকে status change, admin approval, wallet/ledger update নিষিদ্ধ

## এখনো কী কাজ করে না
- প্রকৃত টাকা/ডলার ট্রান্সফার বা পেমেন্ট gateway
- Admin dashboard ও secure approval endpoint
- নিরাপদ public tracking lookup endpoint
- Wallet balance/ledger, live exchange rates, referral bonus calculation
- Currency/payment method admin management
- Production-grade abuse prevention, App Check, server-side rate limiting

## ধাপ ১ — Firebase Web App config
1. https://console.firebase.google.com/ খুলুন।
2. আপনার প্রজেক্টে গিয়ে Project settings > General > Your apps থেকে Web app তৈরি করুন।
3. `firebase-config.example.js`-এর কপি করে `firebase-config.js` নাম দিন।
4. Firebase web config-এর মানগুলো `firebase-config.js`-এ বসান।
5. Firebase web config হলো browser client configuration; এটি সাধারণত ওয়েবসাইটের কোডে দেখা যায়। তবে Service Account private key, Cloudinary API secret বা অন্য server secret কখনো এই ফাইলে/GitHub-এ দেবেন না।
6. এই static starter-এর জন্য `firebase-config.js` repository-তে রাখা যেতে পারে, যাতে Cloudflare Pages deploy-এ ফাইলটি পাওয়া যায়। নিরাপত্তা Firestore Rules, Authentication এবং server-side checks দিয়ে নিশ্চিত করতে হবে।

## ধাপ ২ — Authentication
Firebase Console > Authentication > Get started > Sign-in method > Email/Password চালু করুন।
প্রোডাকশনের আগে email verification, password reset, abuse prevention এবং Firebase App Check যোগ করুন।

## ধাপ ৩ — Firestore
1. Build > Firestore Database > Create database।
2. Rules ট্যাবে `firestore.rules`-এর নিয়ম প্রকাশ করুন।
3. Rules Emulator/Firestore Rules Playground দিয়ে পরীক্ষা করুন।
4. এই starter-এ guest request public create করতে পারে—এটি abuse/spam ঝুঁকি তৈরি করতে পারে। production-এ App Check, server-side validation, rate limiting এবং abuse monitoring যোগ করুন।
5. `exchangeRequests` ডকুমেন্টে কেবল request জমা হয়; status বা wallet balance browser থেকে বদলানো যায় না।

## ধাপ ৪ — GitHub
1. নতুন repository তৈরি করুন, যেমন `money-exchange-taka`।
2. ZIP extract করে ফাইলগুলো repository-তে upload করুন।
3. `firebase-config.js` ফাইলটিও আপলোড করুন, কারণ এই static starter-এ Cloudflare Pages-এর browser code সেটি import করে।
4. কখনো Service Account key বা private API secret আপলোড করবেন না। Firebase web config-কে secret ধরে নিরাপত্তা নিশ্চিত করা যাবে না; Firestore Rules ঠিকমতো প্রকাশ ও পরীক্ষা করতে হবে।

## ধাপ ৫ — Cloudflare Pages
1. https://pages.cloudflare.com/ খুলুন।
2. GitHub repository connect করুন।
3. Plain static site হলে build command ফাঁকা রাখুন এবং output directory `/` বা repository root সেট করুন।
4. Firebase config deploy করার উপযুক্ত ব্যবস্থা না করলে live site-এ authentication/Firestore চলবে না। production-ready config injection এবং environment handling পরের ধাপে করতে হবে।
5. custom domain পরে সংযুক্ত করা যাবে।

## Cloudinary
শুধু লোগো/ছবি দরকার হলে পরে ব্যবহার করুন। Public unsigned upload preset ছাড়া secret frontend-এ রাখবেন না।

## আর্থিক নিরাপত্তা
আসল অর্থ বা ডলার exchange চালুর আগে প্রযোজ্য আইন, লাইসেন্স/অনুমোদন ও payment provider terms যাচাই করুন। Admin approval অবশ্যই trusted server/Cloud Functions/Worker-এ হবে। Wallet credit immutable ledger, atomic server transaction, idempotency key এবং audit log দিয়ে বাস্তবায়ন করুন। Frontend-কে কখনো balance বা approval-এর source of truth বানাবেন না.
