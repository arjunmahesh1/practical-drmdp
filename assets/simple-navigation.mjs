const more=document.querySelector('.nav-more');
more?.addEventListener('click',e=>{if(e.target.closest('a'))more.open=false;});
document.addEventListener('click',e=>{if(more&&!more.contains(e.target))more.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&more?.open){more.open=false;more.querySelector('summary').focus();}});
