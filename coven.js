(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const tg=window.Telegram?.WebApp;
 const config=window.COVEN_CONFIG||{};
 const base=(config.apiUrl||'').replace(/\/$/,'');
 const ready=!!(base&&tg?.initData);
 let self=null, currentCategory='',onlyFollowing=false,feedOffset=0,moreFeed=false,feedBusy=false;
 let currentProfileId=null,currentPostId=null,previewUrl=null,fileToUpload=null;
 const esc=(s)=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const avatar=(person,large=false)=>`<div class="coven-avatar${large?' lg':''}">${person?.photo_url?`<img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(person.photo_url)}" onerror="this.remove()">`:esc((person?.display_name||'✦').slice(0,1).toUpperCase())}</div>`;
 const notify=(s)=>{if(typeof window.covenToast==='function')window.covenToast(s);else alert(s);};
 const show=(id)=>window.covenGo?.(id);
 const time=(v)=>{try{return new Date(v).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return ''}};
 function block(message,kind=''){return `<div class="coven-status ${kind}">${message}</div>`;}
 const setupMsg= !base ? 'Для общей ленты нужно подключить COVEN API. Исходный Гримуар и личный дневник работают без сервера. Настройка описана в README.' : !tg?.initData?'Чтобы войти в социальную сеть, открой COVEN из меню Telegram-бота @Grimoire1111Bot. В обычном браузере доступна энциклопедия и личная Книга Теней.':'';
 if(!ready){['feedStatus','peopleStatus','composeStatus','profileStatus'].forEach(id=>$(id).innerHTML=block(esc(setupMsg)));}
 async function request(path,opts={}){
  if(!ready)throw new Error(setupMsg);
  const headers={'X-Telegram-Init-Data':tg.initData,...opts.headers};
  if(opts.body && typeof opts.body==='string')headers['Content-Type']='application/json';
  let response;
  try{response=await fetch(base+path,{...opts,headers});}catch{throw new Error('Не удаётся подключиться к серверу COVEN');}
  let result;try{result=await response.json();}catch{throw new Error('Ошибка ответа сервера');}
  if(!response.ok)throw new Error(result.error||'Не удалось выполнить действие');
  return result;
 }
 function formatPost(post){
  const owner=String(post.author_id)===String(self?.id);
  return `<article class="coven-feed-card" data-post="${esc(post.id)}">
   <div class="coven-byline">${avatar(post)}<div style="flex:1;min-width:0"><button class="coven-author" data-user="${esc(post.author_id)}">${esc(post.display_name)}</button><div class="coven-meta">${esc(post.element)} · ${esc(time(post.created_at))}</div></div>
   <span class="coven-tag">${esc(post.category)}</span></div>
   ${post.body?`<div class="coven-body">${esc(post.body)}</div>`:''}
   ${post.media_url?`<img class="coven-image" src="${esc(post.media_url)}" alt="Фотография из публикации" loading="lazy">`:''}
   <div class="coven-actions"><button class="coven-action ${post.liked?'liked':''}" data-like="${esc(post.id)}" data-liked="${post.liked?'1':'0'}" aria-label="${post.liked?'Убрать отметку':'Нравится'}">${post.liked?'♥':'♡'} <span>${Number(post.likes_count)||0}</span></button>
   <button class="coven-action" data-comments="${esc(post.id)}">♧ <span>${Number(post.comments_count)||0}</span></button>
   <button class="coven-action more" data-report-post="${esc(post.id)}">Пожаловаться</button>${owner?`<button class="coven-action" data-delete-post="${esc(post.id)}">Удалить</button>`:''}
   </div></article>`;
 }
 async function bootstrap(){
  if(!ready)return;
  try{
   const data=await request('/api/me');self=data.profile;
   $('feedStatus').textContent='';$('peopleStatus').textContent='';$('composeStatus').textContent='';$('profileStatus').textContent='';
   $('welcomeName').textContent=(self.display_name||'ведьма').split(' ')[0];
   $('postAvatar').innerHTML=avatar(self);
   renderSelf();loadFeed(true);
  }catch(e){['feedStatus','peopleStatus','composeStatus','profileStatus'].forEach(id=>$(id).innerHTML=block(esc(e.message),'error'));}
 }
 async function loadFeed(reset=false){
  if(!ready||feedBusy)return;
  feedBusy=true;
  if(reset){feedOffset=0;$('feedList').innerHTML='<div class="coven-loading">Загружаем ленту ковена…</div>';}
  try{
   const q=new URLSearchParams({offset:String(feedOffset)});if(currentCategory)q.set('category',currentCategory);if(onlyFollowing)q.set('following','1');
   const data=await request('/api/feed?'+q);
   if(reset)$('feedList').innerHTML='';
   $('feedList').insertAdjacentHTML('beforeend',data.items.map(formatPost).join(''));
   feedOffset=data.next_offset;moreFeed=data.has_more;
   $('morePosts').classList.toggle('coven-hidden',!moreFeed);
   if(!feedOffset)$('feedList').innerHTML=`<div class="coven-empty">✨ В этом разделе пока тихо.<br>Опубликуй первую историю — пусть начнётся магия общения.</div>`;
  }catch(e){$('feedList').innerHTML=block(esc(e.message),'error');}
  finally{feedBusy=false;}
 }
 async function loadPeople(q=''){
  if(!ready)return;
  $('peopleList').innerHTML='<div class="coven-loading">Ищем единомышленников…</div>';
  try{
   const data=await request('/api/people?q='+encodeURIComponent(q));
   $('peopleList').innerHTML=data.items.length?data.items.map(p=>`<div class="coven-people-card">${avatar(p)}<div class="info"><button class="coven-author" data-user="${esc(p.id)}">${esc(p.display_name)}</button><p>${esc(p.element)} · ${Number(p.followers_count)||0} подписчиков</p></div><button class="secondary" data-follow="${esc(p.id)}" data-following="${p.following?'1':'0'}">${p.following?'Вы подписаны':'Подписаться'}</button></div>`).join(''):'<div class="coven-empty">Пользователей пока нет. Пригласи друзей в COVEN!</div>';
  }catch(e){$('peopleList').innerHTML=block(esc(e.message),'error');}
 }
 function stats(p){return `<div class="coven-stats"><div><strong>${Number(p.posts_count)||0}</strong>публикаций</div><div><strong>${Number(p.followers_count)||0}</strong>читателей</div><div><strong>${Number(p.following_count)||0}</strong>подписок</div></div>`;}
 function renderSelf(){if(!self)return;
  $('myProfile').innerHTML=`<div class="coven-profile-cover"><div class="coven-profile-top">${avatar(self,true)}<div><h2>${esc(self.display_name)}</h2><p>✦ ${esc(self.element)}${self.telegram_username?' · @'+esc(self.telegram_username):''}</p></div></div>${stats(self)}<div class="coven-profile-bio">${esc(self.bio||'Напиши пару слов о своей магической стороне…')}</div><div class="coven-profile-btns"><button class="primary" data-go="edit-profile">Редактировать профиль</button><button class="secondary" data-go="book">Моя Книга Теней</button></div></div>`;
  $('editName').value=self.display_name||'';$('editBio').value=self.bio||'';$('editElement').value=self.element||'Луна';
  $('myProfile').querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.go)));
 }
 async function loadMyPosts(){if(!ready||!self)return;
  try{const data=await request('/api/profiles/'+self.id);$('myPosts').innerHTML=data.posts.length?data.posts.map(formatPost).join(''):'<div class="coven-empty">Пока нет публикаций.</div>';}catch(e){$('myPosts').innerHTML=block(esc(e.message),'error');}}
 async function loadProfile(id){if(!ready)return;
  currentProfileId=id;
  try{
   const {profile:p,posts}=await request('/api/profiles/'+id);
   const own=String(id)===String(self?.id);
   $('otherProfile').innerHTML=`<div class="coven-profile-cover"><div class="coven-profile-top">${avatar(p,true)}<div><h2>${esc(p.display_name)}</h2><p>✦ ${esc(p.element)}${p.telegram_username?' · @'+esc(p.telegram_username):''}</p></div></div>${stats(p)}<div class="coven-profile-bio">${esc(p.bio||'Эта участница пока ничего не рассказала о себе.')}</div><div class="coven-profile-btns">${own?'<button class="primary" data-go="profile">Мой профиль</button>':`<button class="primary" data-follow="${esc(p.id)}" data-following="${p.following?'1':'0'}">${p.following?'Отписаться':'Подписаться'}</button><button class="secondary" data-block="${esc(p.id)}">Заблокировать</button><button class="secondary" data-report-user="${esc(p.id)}">Жалоба</button>`}</div></div>`;
   $('otherPosts').innerHTML=posts.length?posts.map(formatPost).join(''):'<div class="coven-empty">Здесь пока нет публикаций.</div>';
   $('otherProfile').querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.go)));
   show('user-profile');
  }catch(e){notify(e.message);}
 }
 async function loadComments(id){if(!ready)return;
  currentPostId=id;show('comments');$('commentsList').innerHTML='<div class="coven-loading">Загружаем комментарии…</div>';
  try{const data=await request('/api/posts/'+id+'/comments');$('commentsList').innerHTML=data.items.length?data.items.map(c=>`<div class="coven-comment-card"><div class="coven-byline">${avatar(c)}<div style="flex:1"><button class="coven-author" data-user="${esc(c.author_id)}">${esc(c.display_name)}</button><div class="coven-meta">${esc(time(c.created_at))}</div></div>${String(c.author_id)===String(self?.id)?`<button class="coven-linkbtn" data-del-comment="${esc(c.id)}">Удалить</button>`:''}</div><div class="coven-body">${esc(c.body)}</div></div>`).join(''):'<div class="coven-empty">Комментариев пока нет. Начни разговор!</div>';}catch(e){$('commentsList').innerHTML=block(esc(e.message),'error');}
 }
 async function loadBlocked(){if(!ready)return;$('blockedList').innerHTML='<div class="coven-loading">Загружаем список…</div>';try{const data=await request('/api/blocks');$('blockedList').innerHTML=data.items.length?data.items.map(p=>`<div class="coven-people-card">${avatar(p)}<div class="info"><strong>${esc(p.display_name)}</strong><p>${esc(p.element)}</p></div><button class="secondary" data-unblock="${esc(p.id)}">Разблокировать</button></div>`).join(''):'<div class="coven-empty">Заблокированных пользователей нет.</div>';}catch(e){$('blockedList').innerHTML=block(esc(e.message),'error');}}
 // COVEN Free: resize locally; no third-party image store or Cloudflare R2 subscription.
 async function prepareFreePhoto(file){
  if(!file.type.startsWith('image/'))throw new Error('Выбери фотографию');
  if(file.size>5*1024*1024)throw new Error('Исходное фото должно быть до 5 МБ');
  const objectUrl=URL.createObjectURL(file);
  try {
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Не удалось открыть фотографию'));img.src=objectUrl;});
   const canvas=document.createElement('canvas');
   const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Обработка фотографий недоступна');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const toBlob=(type,quality)=>new Promise(r=>canvas.toBlob(r,type,quality));
   for(let i=0;i<12;i++){
    const quality=Math.max(.35,.79-(i%4)*.13);
    let out=await toBlob('image/webp',quality);
    if(!out||out.type!=='image/webp')out=await toBlob('image/jpeg',quality);
    if(out&&out.size<=240*1024&&out.size>=16)return out;
    if(i%4===3){canvas.width=Math.max(1,Math.round(canvas.width*.82));canvas.height=Math.max(1,Math.round(canvas.height*.82));ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);}
   }
   throw new Error('Слишком сложное изображение. Выбери фото поменьше.');
  }finally{URL.revokeObjectURL(objectUrl);}
 }
 function resetCompose(){fileToUpload=null; if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('postText').value='';$('postImage').value='';$('postPreview').innerHTML='';}
 $('postImage').addEventListener('change',e=>{fileToUpload=e.target.files?.[0]||null;if(previewUrl)URL.revokeObjectURL(previewUrl);if(fileToUpload){previewUrl=URL.createObjectURL(fileToUpload);$('postPreview').innerHTML=`<img class="coven-media-preview" alt="Предпросмотр" src="${previewUrl}"><p class="coven-tiny">Фотографии в ленте будут доступны всем участникам.</p>`;}else $('postPreview').innerHTML='';});
 $('publishPost').onclick=async()=>{
  const body=$('postText').value.trim(),category=$('postCategory').value;
  if(!ready)return notify(setupMsg);
  if(!body&&!fileToUpload)return notify('Добавь текст или фотографию');
  if(body.length>2500)return notify('Максимум 2500 символов');
  $('publishPost').disabled=true;$('publishPost').textContent='Публикуем…';
  try{
   let media_key=null;
   if(fileToUpload){const compact=await prepareFreePhoto(fileToUpload);
    const uploaded=await request('/api/media',{method:'POST',headers:{'Content-Type':compact.type},body:compact});media_key=uploaded.key;
   }
   await request('/api/posts',{method:'POST',body:JSON.stringify({body,category,media_key})});
   resetCompose();notify('Публикация появилась в ковене ✦');show('feed');await loadFeed(true);await refreshMe();
  }catch(e){notify(e.message);}finally{$('publishPost').disabled=false;$('publishPost').textContent='Опубликовать в COVEN ✦';}
 };
 async function refreshMe(){if(!ready)return;try{self=(await request('/api/me')).profile;renderSelf();$('postAvatar').innerHTML=avatar(self);}catch(e){notify(e.message);}}
 $('saveProfile').onclick=async()=>{
  if(!ready)return notify(setupMsg);
  $('saveProfile').disabled=true;
  try{await request('/api/me',{method:'PUT',body:JSON.stringify({display_name:$('editName').value,bio:$('editBio').value,element:$('editElement').value})});await refreshMe();notify('Профиль обновлён');show('profile');}catch(e){notify(e.message);}finally{$('saveProfile').disabled=false;}
 };
 $('sendComment').onclick=async()=>{if(!currentPostId)return;const body=$('commentText').value.trim();if(!body)return notify('Напиши комментарий');$('sendComment').disabled=true;try{await request('/api/posts/'+currentPostId+'/comments',{method:'POST',body:JSON.stringify({body})});$('commentText').value='';await loadComments(currentPostId);}catch(e){notify(e.message);}finally{$('sendComment').disabled=false;}};
 $('morePosts').onclick=()=>loadFeed(false);
 $('deleteAccount').onclick=async()=>{if(!ready)return notify(setupMsg);if(prompt('Чтобы удалить аккаунт COVEN навсегда, напиши УДАЛИТЬ')!=='УДАЛИТЬ')return;try{await request('/api/account',{method:'DELETE'});self=null;$('myProfile').innerHTML='';$('myPosts').innerHTML='';notify('Аккаунт и данные COVEN удалены');show('home');}catch(e){notify(e.message);}};
 $('followingToggle').onclick=()=>{onlyFollowing=!onlyFollowing;$('followingToggle').textContent=onlyFollowing?'✓ Мои подписки':'Мои подписки';$('followingToggle').classList.toggle('active',onlyFollowing);loadFeed(true);};
 $('refreshFeed').onclick=()=>loadFeed(true);
 let searchTimer;
 $('peopleSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadPeople($('peopleSearch').value.trim()),250);};
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{currentCategory=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x===b));loadFeed(true);});
 document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.user){loadProfile(button.dataset.user);return;}
  if(button.dataset.comments){loadComments(button.dataset.comments);return;}
  const id=button.dataset.like;
  if(id){if(!ready)return notify(setupMsg);const was=button.dataset.liked==='1';button.disabled=true;try{await request('/api/posts/'+id+'/like',{method:was?'DELETE':'POST'});button.dataset.liked=was?'0':'1';button.classList.toggle('liked',!was);button.innerHTML=(was?'♡':'♥')+' <span>'+Math.max(0,(Number(button.querySelector('span')?.textContent)||0)+(was?-1:1))+'</span>';}catch(e){notify(e.message);}finally{button.disabled=false;}return;}
  if(button.dataset.follow){if(!ready)return notify(setupMsg);const id=button.dataset.follow;const was=button.dataset.following==='1';button.disabled=true;try{await request('/api/profiles/'+id+'/follow',{method:was?'DELETE':'POST'});button.dataset.following=was?'0':'1';button.textContent=was?'Подписаться':'Отписаться';if($('user-profile').classList.contains('active'))loadProfile(id);}catch(e){notify(e.message);}finally{button.disabled=false;}return;}
  if(button.dataset.deletePost){if(!confirm('Удалить публикацию без возможности восстановления?'))return;try{await request('/api/posts/'+button.dataset.deletePost,{method:'DELETE'});notify('Публикация удалена');if($('profile').classList.contains('active'))loadMyPosts();else if($('user-profile').classList.contains('active'))loadProfile(currentProfileId);else loadFeed(true);await refreshMe();}catch(e){notify(e.message);}return;}
  if(button.dataset.delComment){if(!confirm('Удалить комментарий?'))return;try{await request('/api/comments/'+button.dataset.delComment,{method:'DELETE'});await loadComments(currentPostId);}catch(e){notify(e.message);}return;}
  if(button.dataset.unblock){try{await request('/api/profiles/'+button.dataset.unblock+'/block',{method:'DELETE'});notify('Пользователь разблокирован');await loadBlocked();}catch(e){notify(e.message);}return;}
  if(button.dataset.block){if(!confirm('Заблокировать пользователя? Вы больше не будете видеть друг друга в COVEN.'))return;try{await request('/api/profiles/'+button.dataset.block+'/block',{method:'POST'});notify('Пользователь заблокирован');show('people');loadPeople();}catch(e){notify(e.message);}return;}
  if(button.dataset.reportPost||button.dataset.reportUser){const target_type=button.dataset.reportPost?'post':'user',target_id=button.dataset.reportPost||button.dataset.reportUser;const reason=prompt('Почему ты хочешь пожаловаться? Опиши причину (не менее 5 символов).');if(reason===null)return;try{await request('/api/reports',{method:'POST',body:JSON.stringify({target_type,target_id,reason})});notify('Жалоба отправлена модерации');}catch(e){notify(e.message);}return;}
 });
 window.onCovenView=(id)=>{
  if(id==='feed' && ready && !feedOffset)loadFeed(true);
  if(id==='people')loadPeople($('peopleSearch').value.trim());
  if(id==='blocked-users')loadBlocked();
  if(id==='profile'){refreshMe().then(loadMyPosts);}
  if(id==='compose'){$('postText').focus();}
 };
 bootstrap();
})();
