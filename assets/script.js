// Menu mobile
const burger=document.querySelector('.burger'),menu=document.querySelector('.menu-bar');
if(burger)burger.addEventListener('click',()=>menu.classList.toggle('buka'));
// Tahun otomatis di footer
document.querySelectorAll('.tahun').forEach(e=>e.textContent=new Date().getFullYear());
// Filter galeri
document.querySelectorAll('.filter button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.filter button').forEach(x=>x.classList.remove('aktif'));b.classList.add('aktif');
  const k=b.dataset.k;document.querySelectorAll('.galeri figure').forEach(f=>{f.style.display=(k==='semua'||f.dataset.k===k)?'':'none'});
}));
// Lightbox galeri (hanya untuk foto asli)
const lb=document.querySelector('.lightbox');
if(lb){document.querySelectorAll('.galeri figure img').forEach(i=>i.parentElement.addEventListener('click',()=>{lb.querySelector('img').src=i.src;lb.classList.add('buka')}));
lb.addEventListener('click',()=>lb.classList.remove('buka'));}
// Formulir: kirim lewat WhatsApp (gratis, tanpa server)
document.querySelectorAll('form[data-wa]').forEach(f=>f.addEventListener('submit',e=>{
  e.preventDefault();const d=new FormData(f);let t=f.dataset.judul+'\n';
  for(const [k,v] of d.entries())t+=`${k}: ${v}\n`;
  window.open('https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(t),'_blank');
}));
// Filter galeri dari alamat (?k=kegiatan)
(function(){const k=new URLSearchParams(location.search).get('k');if(!k)return;const b=document.querySelector('.filter button[data-k="'+k+'"]');if(b)b.click();})();
// Slider banner beranda
(function(){const sl=[...document.querySelectorAll('.slider .slide')],dots=[...document.querySelectorAll('.slider .titik button')];if(sl.length<2)return;let i=0,t;
function go(n){sl[i].classList.remove('aktif');dots[i]&&dots[i].classList.remove('aktif');i=(n+sl.length)%sl.length;sl[i].classList.add('aktif');dots[i]&&dots[i].classList.add('aktif');}
function auto(){clearInterval(t);t=setInterval(()=>go(i+1),6000);}dots.forEach((d,n)=>d.addEventListener('click',()=>{go(n);auto();}));auto();})();
// Karusel testimoni
document.querySelectorAll('[data-geser]').forEach(b=>b.addEventListener('click',()=>{const k=b.closest('section').querySelector('.karusel');if(k)k.scrollBy({left:k.clientWidth*parseInt(b.dataset.geser),behavior:'smooth'});}));
// Angka berjalan (count-up)
(function(){const el=[...document.querySelectorAll('[data-angka]')];if(!('IntersectionObserver' in window))return;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const raw=e.target.dataset.angka,m=raw.match(/\d+/);if(!m)return;const n=parseInt(m[0]),pre=raw.slice(0,m.index),post=raw.slice(m.index+m[0].length);let s=null;
const step=ts=>{s=s||ts;const p=Math.min((ts-s)/1500,1);e.target.textContent=pre+Math.round(n*p)+post;if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}),{threshold:.4});el.forEach(x=>io.observe(x));})();
