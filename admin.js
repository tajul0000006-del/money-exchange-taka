/* Admin UI shell only. Do not enable client-side admin privileges. */
(() => {
  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = 'লগইন এখনো সক্রিয় নয়। Firebase Auth ও Firestore Admin role/server-side verification সংযোগ করতে হবে।';
  });
})();
