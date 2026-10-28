# Cloudinary notes

Cloudinary এখন ঐচ্ছিক। শুরুতে সাইটটি logo ও method icons ছাড়াই চলে।

- Cloudinary account: https://cloudinary.com/
- শুধু image upload প্রয়োজন হলে unsigned upload preset ব্যবহার করার আগে allowed formats, size limits এবং folder restrictions সেট করুন।
- API Secret বা private credential কখনো `index.html`, `app.js`, GitHub repository বা public Firebase config-এ রাখবেন না।
- ভবিষ্যতে admin upload-এর জন্য server-side signed upload endpoint ব্যবহার করুন।
