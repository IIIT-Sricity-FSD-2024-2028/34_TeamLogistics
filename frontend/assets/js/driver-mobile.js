
document.addEventListener('click', (e) => {
  const acc = e.target.closest('[data-accept]');
  if(acc){ window.location.href = acc.getAttribute('data-accept'); }
  const rej = e.target.closest('[data-reject]');
  if(rej){ alert('Order rejected in prototype.'); }
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
