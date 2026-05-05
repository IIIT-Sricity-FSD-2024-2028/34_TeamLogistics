
document.addEventListener('click', (e) => {
  const acc = e.target.closest('[data-accept]');
  if(acc){ window.location.href = acc.getAttribute('data-accept'); }
  const rej = e.target.closest('[data-reject]');
  if(rej){ (function(m){var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;top:24px;right:24px;background:#1e1e2f;color:#fff;padding:14px 28px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.4);border-left:4px solid #facc15';document.body.appendChild(t);setTimeout(function(){t.remove()},2800)})('Order rejected in prototype.'); }
  const next = e.target.closest('[data-next]');
  if(next){ window.location.href = next.getAttribute('data-next'); }
});


// Logout handler (Profile page)
(function(){
  const logoutRow = document.querySelector('.danger-btn');
  if(!logoutRow) return;
  const txt = logoutRow.innerText || '';
  if(!/logout/i.test(txt)) return;
  logoutRow.style.cursor = 'pointer';
  logoutRow.addEventListener('click', function(){
    try{ localStorage.removeItem('driverLoggedIn'); localStorage.removeItem('driverEmail'); }catch(e){}
    try{ sessionStorage.removeItem('driverLoggedIn'); sessionStorage.removeItem('driverEmail'); }catch(e){}
    window.location.replace('../login.html');
  });
})();


// Notification icon -> notifications page
(function(){
  document.querySelectorAll('.notif').forEach(btn=>{
    btn.style.cursor='pointer';
    btn.addEventListener('click', function(){
      try{
        const here=(location.pathname||'').split('/').pop();
        if(here && /notifications\.html/i.test(here)) return;
      }catch(e){}
      window.location.href='notifications.html';
    });
  });
})();
