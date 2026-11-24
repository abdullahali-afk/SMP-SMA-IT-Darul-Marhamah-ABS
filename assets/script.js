// Menu mobile
const burger=document.querySelector('.burger'),menu=document.querySelector('.menu-bar');
if(burger)burger.addEventListener('click',()=>menu.classList.toggle('buka'));
// Tahun otomatis di footer
document.querySelectorAll('.tahun').forEach(e=>e.textContent=new Date().getFullYear());
// Filter (galeri: kategori & program; halaman Program & Sekolah: program). Item tanpa program = kedua program.
document.querySelectorAll('.filter').forEach(g=>g.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
  g.querySelectorAll('button').forEach(x=>x.classList.remove('aktif'));b.classList.add('aktif');
  const w=g.closest('section')||document,grup=[...w.querySelectorAll('.filter')];
  w.querySelectorAll('.galeri figure,.saring').forEach(el=>{
    const ok=grup.every(f=>{const a=f.querySelector('button.aktif'),v=a?a.dataset.k:'semua',kn=f.dataset.kunci||'k',isi=el.dataset[kn]||'';
      return v==='semua'||isi===v||(kn==='p'&&isi==='');});
    el.style.display=ok?'':'none';});
})));
// Lightbox galeri (hanya untuk foto asli)
const lb=document.querySelector('.lightbox');
if(lb){document.querySelectorAll('.galeri figure img').forEach(i=>i.parentElement.addEventListener('click',()=>{lb.querySelector('img').src=i.src;lb.classList.add('buka')}));
lb.addEventListener('click',()=>lb.classList.remove('buka'));}
// Formulir: kirim lewat WhatsApp (gratis, tanpa server)
document.querySelectorAll('form[data-wa]').forEach(f=>f.addEventListener('submit',e=>{
  e.preventDefault();const d=new FormData(f);let t=f.dataset.judul+'\n';
  for(const [k,v] of d.entries())t+=`${k}: ${v}\n`;
  const tj=f.querySelector('[data-tujuan]');
  window.open('https://wa.me/'+(tj&&tj.value?tj.value:f.dataset.wa)+'?text='+encodeURIComponent(t),'_blank');
}));
// Filter dari alamat (?k=kegiatan, ?p=tahfizh)
(function(){const q=new URLSearchParams(location.search),k=q.get('k'),p=q.get('p');
if(k){const b=document.querySelector('.filter:not([data-kunci]) button[data-k="'+CSS.escape(k)+'"]');if(b)b.click();}
if(p)document.querySelectorAll('.filter[data-kunci="p"] button[data-k="'+CSS.escape(p)+'"]').forEach(b=>b.click());})();
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
// Tombol WhatsApp mengambang dengan beberapa kontak person
document.querySelectorAll('.wa-pilih').forEach(w=>{const b=w.querySelector('button'),d=w.querySelector('.wa-daftar');
b.addEventListener('click',e=>{e.stopPropagation();d.hidden=!d.hidden;b.setAttribute('aria-expanded',String(!d.hidden));});
document.addEventListener('click',e=>{if(!w.contains(e.target)){d.hidden=true;b.setAttribute('aria-expanded','false');}});});
/* Video testimoni: diputar langsung di halaman saat diklik */
document.querySelectorAll('.video-fasad').forEach(b=>b.addEventListener('click',()=>{const f=document.createElement('iframe');const s=b.dataset.embed;
f.src=s+(s.includes('?')?'&':'?')+'autoplay=1';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.title=b.getAttribute('aria-label')||'Video';b.replaceWith(f);}));
