// Menu mobile
const burger=document.querySelector('.burger'),menu=document.querySelector('.menu');
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
