(() => {
  'use strict';

  const DB_NAME = 'progress-console';
  const DB_VERSION = 4;
  const STORES = ['modules','groups','tags','timeEntries','weeklyTasks','habits','habitEntries','roadmapGroups','roadmapItems','goals','keyResults','quotes','quoteSelections','preferences'];
  const TODAY = toISODate(new Date());
  const state = { page: 'today', data: {}, zoom: 0.78, timer: null, timerTick: null, lang: 'zh' };

  // Custom page-copy placeholders. Put your own lines here later.
  // Keep both languages if you want the copy to switch with the UI.
  const CUSTOM_COPY = {
    weekSubtitle: { zh: '', en: '' },
    roadmapSubtitle: { zh: '', en: '' },
    insightsSubtitle: { zh: '', en: '' },
  };

  const tr = (zh, en) => state.lang === 'en' ? en : zh;
  const customCopy = key => CUSTOM_COPY[key]?.[state.lang] || '';
  let db;

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = (s='') => String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const nowISO = () => new Date().toISOString();
  const uid = (p='id') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

  function toISODate(d) {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
  function addDays(s,n){ const d=parseDate(s); d.setDate(d.getDate()+n); return toISODate(d); }
  function addMonths(s,n){ const d=parseDate(s); d.setMonth(d.getMonth()+n); return toISODate(d); }
  function mondayOf(d){ const x=new Date(d); const dow=x.getDay(); x.setDate(x.getDate()+(dow===0?-6:1-dow)); x.setHours(0,0,0,0); return x; }
  function weekDates(m){ return Array.from({length:7},(_,i)=>{const d=new Date(m); d.setDate(d.getDate()+i); return toISODate(d);}); }
  function daysBetween(a,b){ const A=parseDate(a), B=parseDate(b); return Math.round((Date.UTC(B.getFullYear(),B.getMonth(),B.getDate())-Date.UTC(A.getFullYear(),A.getMonth(),A.getDate()))/86400000); }
  function minsLabel(n){ n=Math.max(0,Math.round(n||0)); if(n<60)return `${n}m`; const h=Math.floor(n/60),m=n%60; return m?`${h}h ${m}m`:`${h}h`; }
  function dateLabel(s){ return s ? s.replaceAll('-','/') : ''; }
  function paceClass(pct, expected){ if(pct>=1)return'done'; if(pct>=expected)return'good'; if(pct>=Math.max(0,expected-.2))return'warn'; return'behind'; }

  async function openDB(){
    db = await new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const d=req.result;
        for(const name of STORES) if(!d.objectStoreNames.contains(name)) d.createObjectStore(name,{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  function tx(store,mode='readonly'){ return db.transaction(store,mode).objectStore(store); }
  function reqP(req){ return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);}); }
  const all = store => reqP(tx(store).getAll());
  const put = (store,row) => reqP(tx(store,'readwrite').put(row));
  const del = (store,id) => reqP(tx(store,'readwrite').delete(id));
  const clear = store => reqP(tx(store,'readwrite').clear());

  async function seedIfEmpty(){
    const stamp=nowISO();
    const weekOf=toISODate(mondayOf(new Date()));
    const base=TODAY;

    // Starter content is intentionally generic. Replace or delete it in Settings.
    const defaultQuotes = [
      ['quote-1','Small steps still change the shape of a week.',''],
      ['quote-2','Protect the hours that move the work forward.',''],
      ['quote-3','Leave enough room to notice what is working.',''],
      ['quote-4','A plan is useful when it can be revised.','']
    ].map(([id,text,source])=>({id,text,source,createdAt:stamp,updatedAt:stamp}));
    if(!(await all('quotes')).length){ for(const row of defaultQuotes) await put('quotes',row); }
    if((await all('modules')).length) return;

    const rows = {
      groups:[
        {id:'study',label:'Study',createdAt:stamp,updatedAt:stamp}
      ],
      modules:[
        ['work','Work',600,null,'work'],
        ['language','Language',300,null,'time'],
        ['personal-project','Personal Project',360,null,'time'],
        ['admin','Admin',120,null,'time'],
        ['exercise','Exercise',240,null,'time'],
        ['course-a','Course A',180,'study','time'],
        ['course-b','Course B',180,'study','time']
      ].map(([id,label,targetPerWeek,groupId,kind])=>({id,label,targetPerWeek,groupId,kind,createdAt:stamp,updatedAt:stamp})),
      tags:[
        ['reading','Reading'],['drawing','Drawing'],['writing','Writing'],['research','Research'],['planning','Planning'],['other','Other']
      ].map(([id,label])=>({id:`work-${id}`,moduleId:'work',label,createdAt:stamp,updatedAt:stamp})),
      habits:[
        {id:'exercise-days',label:'Exercise',targetDaysPerWeek:4,createdAt:stamp,updatedAt:stamp},
        {id:'reading-days',label:'Read',targetDaysPerWeek:5,createdAt:stamp,updatedAt:stamp}
      ],
      roadmapGroups:[
        ['projects','Projects'],['learning','Learning'],['career','Career']
      ].map(([id,label])=>({id,label,createdAt:stamp,updatedAt:stamp})),
      roadmapItems:[
        ['rm1','projects','Discovery / scope',base,addDays(base,28),'range','confirmed','personal-project'],
        ['rm2','projects','Build v1',addDays(base,21),addDays(base,84),'range','estimate','personal-project'],
        ['rm3','projects','Release v1',addDays(base,105),null,'point','hard','personal-project'],
        ['rm4','learning','Current level',base,null,'point','dim','language'],
        ['rm5','learning','Progress check',addMonths(base,3),null,'point','estimate','language'],
        ['rm6','career','Portfolio / profile refresh',addMonths(base,4),addMonths(base,6),'range','estimate','work']
      ].map(([id,groupId,title,start,end,type,status,linkedModuleId])=>({id,groupId,title,start,end,type,status,linkedModuleId,createdAt:stamp,updatedAt:stamp})),
      goals:[
        {id:'goal-project',title:'Ship a personal project',start:base,end:addDays(base,105),memo:'Example objective. Replace it with a real outcome you care about.',createdAt:stamp,updatedAt:stamp},
        {id:'goal-learning',title:'Build a sustainable learning routine',start:base,end:addMonths(base,6),memo:'Example objective using measurable key results.',createdAt:stamp,updatedAt:stamp}
      ],
      keyResults:[
        ['kr-project-1','goal-project','Prototype complete','◌',1,'milestone',''],
        ['kr-project-2','goal-project','User feedback sessions','◌',5,'sessions',''],
        ['kr-project-3','goal-project','Public release','◌',1,'release',''],
        ['kr-learning-1','goal-learning','Focused study sessions','◌',40,'sessions',''],
        ['kr-learning-2','goal-learning','Progress reviews','◌',6,'reviews',''],
        ['kr-learning-3','goal-learning','Practice tests / checkpoints','◌',2,'checks','']
      ].map(([id,goalId,title,emoji,objectiveValue,unit,memo])=>({id,goalId,title,emoji,initialValue:0,objectiveValue,currentValue:0,unit,method:'manual',linkedModuleId:null,memo,createdAt:stamp,updatedAt:stamp})),
      weeklyTasks:[
        ['work','Choose one priority outcome for the week'],
        ['language','Complete three focused sessions'],
        ['personal-project','Ship one visible increment'],
        ['admin','Clear one maintenance task'],
        ['exercise','Schedule four exercise sessions']
      ].map(([moduleId,text],i)=>({id:`starter-${i}`,moduleId,weekOf,text,done:false,todayDate:null,createdAt:stamp,updatedAt:stamp}))
    };
    for(const [store,list] of Object.entries(rows)) for(const row of list) await put(store,row);
  }

  async function refresh(){
    for(const s of STORES) state.data[s]=await all(s);
    const languagePref=(state.data.preferences||[]).find(x=>x.id==='language');
    state.lang=languagePref?.value==='en'?'en':'zh';
    await ensureWeeklyQuoteSelection();
  }
  async function ensureWeeklyQuoteSelection(){
    const quotes=(state.data.quotes||[]).filter(q=>!q.deletedAt&&q.text?.trim());
    if(!quotes.length) return;
    const weekId=toISODate(mondayOf(new Date()));
    const selections=state.data.quoteSelections||[];
    const current=selections.find(x=>x.id===weekId);
    if(current && quotes.some(q=>q.id===current.quoteId)) return;
    let index=Math.floor(Math.random()*quotes.length);
    if(globalThis.crypto?.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); index=a[0]%quotes.length; }
    await put('quoteSelections',{id:weekId,quoteId:quotes[index].id,createdAt:current?.createdAt||nowISO(),updatedAt:nowISO()});
    state.data.quoteSelections=await all('quoteSelections');
  }
  function toast(msg){ const el=$('#toast'); el.textContent=msg; clearTimeout(el._t); el._t=setTimeout(()=>el.textContent='',2200); }

  const navs=[['today','⌂','今天','Today'],['week','✓','本周','Week'],['roadmap','▤','路线图','Roadmap'],['insights','↗','趋势','Insights'],['settings','⚙','设置','Settings']];
  function renderNav(){
    const navLabel = item => state.lang==='en' ? item[3] : item[2];
    $('#sideNav').innerHTML=`<ul>${navs.map(item=>{const [p,i]=item,l=navLabel(item);return `<li><button class="nav-button ${state.page===p?'active':''}" data-page="${p}"><span class="nav-icon">${i}</span><span>${esc(l)}</span></button></li>`;}).join('')}</ul>`;
    const mobile=[navs[0],navs[1],['gap','','','',''],navs[2],navs[3]];
    $('#bottomNav').innerHTML=`<ul>${mobile.map(item=>{const [p,i]=item;if(p==='gap')return '<li class="bottom-gap" aria-hidden="true"></li>';const l=navLabel(item);return `<li><button class="nav-button ${state.page===p?'active':''}" data-page="${p}"><span class="nav-icon">${i}</span><span>${esc(l)}</span></button></li>`;}).join('')}</ul>`;
    document.documentElement.lang=state.lang==='en'?'en':'zh-CN';
    $('#sideNav').setAttribute('aria-label',tr('主导航','Primary navigation'));
    $('#bottomNav').setAttribute('aria-label',tr('移动端导航','Mobile navigation'));
    $('#mobileFab').setAttribute('aria-label',tr('快速记录','Quick log'));
    const toggle=$('#languageToggle');
    toggle.textContent=state.lang==='en'?'中':'EN';
    toggle.setAttribute('aria-label',state.lang==='en'?'切换到中文':'Switch to English');
    toggle.title=state.lang==='en'?'切换到中文':'Switch to English';
    $('#sidebarFoot').innerHTML=`<span class="status-dot"></span> ${tr('本地优先 · 可离线','Local-first · Offline ready')}`;
    $$('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page; render();});
    toggle.onclick=toggleLanguage;
  }

  async function toggleLanguage(){
    state.lang=state.lang==='en'?'zh':'en';
    await put('preferences',{id:'language',value:state.lang,updatedAt:nowISO()});
    state.data.preferences=await all('preferences');
    render();
  }

  function header(kicker,title,subtitle='',action=''){
    return `<header class="page-header"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${action?`<div class="page-actions">${action}</div>`:''}</header>`;
  }
  function metric(label,value,sub){ return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`; }

  function getWeek(){ const monday=mondayOf(new Date()), mondayISO=toISODate(monday), dates=weekDates(monday), dayIndex=(new Date().getDay()+6)%7, expected=(dayIndex+1)/7; return {monday,mondayISO,dates,expected}; }
  function activeEntries(){ return state.data.timeEntries.filter(e=>!e.deletedAt); }
  function weekEntries(){ const w=getWeek(); return activeEntries().filter(e=>w.dates.includes(e.date)); }
  function weekTasks(){ const w=getWeek(); return state.data.weeklyTasks.filter(t=>t.weekOf===w.mondayISO&&!t.deletedAt); }
  function weeklyQuote(){
    const list=(state.data.quotes||[]).filter(q=>!q.deletedAt&&q.text?.trim());
    if(!list.length) return null;
    const selected=(state.data.quoteSelections||[]).find(x=>x.id===getWeek().mondayISO);
    return list.find(q=>q.id===selected?.quoteId) || list[0];
  }
  function quoteHTML(){
    const q=weeklyQuote();
    return q ? `<section class="weekly-quote reveal"><span class="panel-kicker">${tr('本周一句','WEEKLY LINE')}</span><div class="quote-row"><blockquote>${esc(q.text)}</blockquote><cite>${esc(q.source||'')}</cite></div></section>` : '';
  }

  async function render(){
    renderNav();
    const main=$('#main');
    if(state.page==='today') main.innerHTML=renderToday();
    if(state.page==='week') main.innerHTML=renderWeek();
    if(state.page==='roadmap') main.innerHTML=renderRoadmap();
    if(state.page==='insights') main.innerHTML=renderInsights();
    if(state.page==='settings') main.innerHTML=renderSettings();
    bindPage();
  }

  function renderToday(){
    const w=getWeek(), entries=weekEntries(), todayEntries=activeEntries().filter(e=>e.date===TODAY), tasks=weekTasks(), todayTasks=tasks.filter(t=>t.todayDate===TODAY), modules=state.data.modules;
    const stats=modules.map(m=>{const mins=entries.filter(e=>e.moduleId===m.id).reduce((a,e)=>a+e.minutes,0),pct=m.targetPerWeek?mins/m.targetPerWeek:0;return {...m,mins,pct,status:paceClass(pct,w.expected)};});
    const suggestions=stats.filter(s=>s.targetPerWeek>0&&s.pct<w.expected).sort((a,b)=>a.pct-b.pct).slice(0,3);
    const weekTotal=entries.reduce((a,e)=>a+e.minutes,0), weekTarget=modules.reduce((a,m)=>a+(m.targetPerWeek||0),0), done=tasks.filter(t=>t.done).length;
    const upcoming=state.data.roadmapItems.filter(i=>i.type!=='background'&&daysBetween(TODAY,i.start)>=0).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,3);
    const dateTitle=new Intl.DateTimeFormat(state.lang==='en'?'en-CA':'zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
    const todayLog=[...todayEntries].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,6);
    return `${header('TODAY',dateTitle,'',`<button class="primary-button" id="quickTop">＋ ${tr('快速记录','Quick log')}</button>`)}${quoteHTML()}
      <section class="metric-strip reveal">${metric(tr('今日累计','Today'),minsLabel(todayEntries.reduce((a,e)=>a+e.minutes,0)),`${todayEntries.length} ${tr('条记录','entries')}`)}${metric(tr('本周累计','This week'),minsLabel(weekTotal),`${tr('目标','target')} ${minsLabel(weekTarget)}`)}${metric(tr('本周任务','Weekly tasks'),`${done}/${tasks.length}`,tr('已完成','completed'))}${metric(tr('节奏','Pace'),`${Math.round(w.expected*100)}%`,tr('按周内日期','by day of week'))}</section>
      <div class="today-grid reveal">
        <section class="panel today-plan"><div class="panel-heading"><div><span class="panel-kicker">NEXT</span><h2>${tr('今天做什么','Today')}</h2></div><span class="count-badge">${todayTasks.length}</span></div>
          ${todayTasks.length?`<div class="task-stack">${todayTasks.map(taskLine).join('')}</div>`:`<div class="empty-block compact">${tr('今天还没安排具体任务。可以从下方建议中选，或去 Week 页把本周任务安排到今天。','Nothing is scheduled for today yet. Pick from the suggestions below, or assign a weekly task to today from Week.')}</div>`}
          <div class="subsection-title">${tr('需要注意','ATTENTION')}</div><div class="suggestion-list">${suggestions.length?suggestions.map(s=>`<div class="suggestion-row"><div class="status-pill ${s.status}">${Math.round(s.pct*100)}%</div><div class="suggestion-copy"><strong>${esc(s.label)}</strong><span>${minsLabel(s.mins)} / ${minsLabel(s.targetPerWeek)}</span></div><button class="small-button" data-suggest="${esc(s.id)}">${tr('安排今天','Add today')}</button></div>`).join(''):`<div class="quiet-copy">${tr('本周各模块目前都在节奏线上。','All weekly modules are currently on pace.')}</div>`}</div>
        </section>
        <section class="panel quick-panel"><div class="panel-heading"><div><span class="panel-kicker">QUICK LOG</span><h2>${tr('刚刚做了什么','What did you just do?')}</h2></div></div>${quickLogHTML('inline')}<div class="subsection-title log-title">${tr('今日记录','TODAY LOG')}</div><div class="compact-log">${todayLog.length?todayLog.map(e=>{const m=modules.find(x=>x.id===e.moduleId);const tag=state.data.tags.find(x=>x.id===e.tagId);return `<div class="compact-log-row"><span>${esc(m?.label||e.moduleId)}${tag?` · ${esc(tag.label)}`:''}</span><b>${minsLabel(e.minutes)}</b>${e.note?`<small>${esc(e.note)}</small>`:''}</div>`;}).join(''):`<div class="quiet-copy">${tr('今天还没有时间记录。','No time logged today yet.')}</div>`}</div></section>
      </div>
      <div class="today-grid lower reveal">${habitHTML()}<section class="panel"><div class="panel-heading"><div><span class="panel-kicker">UPCOMING</span><h2>${tr('临近节点','Upcoming')}</h2></div></div><div class="upcoming-list">${upcoming.map(i=>{const m=modules.find(x=>x.id===i.linkedModuleId),d=daysBetween(TODAY,i.start);return `<div class="upcoming-row"><div class="road-dot ${i.status}"></div><div><strong>${esc(i.title)}</strong><span>${dateLabel(i.start)} · ${d===0?tr('今天','today'):`${d} ${tr('天后','days')}`}${m?` · ${esc(m.label)}`:''}</span></div><span>›</span></div>`;}).join('')}</div></section></div>`;
  }

  function taskLine(t,showToday=false){
    const m=state.data.modules.find(x=>x.id===t.moduleId);
    return `<div class="task-line ${t.done?'is-done':''}"><button class="check-button ${t.done?'checked':''}" data-task-toggle="${t.id}">${t.done?'✓':''}</button><div class="task-copy"><span>${esc(t.text)}</span><small>${esc(m?.label||t.moduleId)}</small></div>${showToday?`<button class="today-chip ${t.todayDate===TODAY?'selected':''}" data-task-today="${t.id}">${t.todayDate===TODAY?tr('今天','Today'):`+ ${tr('今天','Today')}`}</button>`:''}</div>`;
  }

  function quickLogHTML(prefix){
    const mods=state.data.modules, tags=state.data.tags.filter(t=>t.moduleId==='work');
    return `<div class="quick-log-body" data-quick="${prefix}"><label class="field-label">${tr('模块','Module')}</label><select class="control q-module">${mods.map(m=>`<option value="${m.id}" ${m.id==='french'?'selected':''}>${esc(m.label)}</option>`).join('')}</select><div class="quick-minutes">${[15,30,45,60].map(v=>`<button type="button" class="q-chip ${v===45?'active':''}" data-min="${v}">${v}m</button>`).join('')}<input class="control minute-input q-min" type="number" min="1" max="1440" value="45" /></div><select class="control q-tag" style="display:none"><option value="">${tr('Work 类型（可选）','Work type (optional)')}</option>${tags.map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select><input class="control q-note" placeholder="${tr('备注（可选）','Note (optional)')}" /><button class="primary-button wide q-save">＋ ${tr('记录','Log')} 45m</button></div>`;
  }

  function habitHTML(){
    const w=getWeek(), labels=state.lang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['一','二','三','四','五','六','日'];
    return `<section class="panel"><div class="panel-heading"><div><span class="panel-kicker">HABITS</span><h2>${tr('本周频率','Weekly frequency')}</h2></div></div><div class="habit-stack">${state.data.habits.map(h=>{const set=new Set(state.data.habitEntries.filter(e=>e.habitId===h.id&&e.done).map(e=>e.date)),count=w.dates.filter(d=>set.has(d)).length;return `<div class="habit-row"><div class="habit-top"><strong>${esc(h.label)}</strong><span>${count} / ${h.targetDaysPerWeek}</span></div><div class="habit-days">${w.dates.map((d,i)=>`<button ${d!==TODAY?'disabled':''} class="${set.has(d)?'done':''} ${d===TODAY?'today':''}" data-habit="${h.id}" data-date="${d}"><span>${set.has(d)?'✓':''}</span><small>${labels[i]}</small></button>`).join('')}</div></div>`;}).join('')}</div></section>`;
  }

  function renderWeek(){
    const w=getWeek(), entries=weekEntries(), tasks=weekTasks(), modules=state.data.modules, groups=state.data.groups;
    const card=m=>{const mins=entries.filter(e=>e.moduleId===m.id).reduce((a,e)=>a+e.minutes,0),pct=m.targetPerWeek?mins/m.targetPerWeek:0,status=paceClass(pct,w.expected),ts=tasks.filter(t=>t.moduleId===m.id); return `<div class="week-card"><div class="week-card-top"><div><strong>${esc(m.label)}</strong><span>${ts.filter(t=>t.done).length}/${ts.length} ${tr('任务','tasks')}</span></div><div class="week-hours ${status}">${minsLabel(mins)} <span>/ ${minsLabel(m.targetPerWeek)}</span></div></div><div class="progress-track"><div class="progress-fill ${status}" style="width:${Math.min(100,pct*100)}%"></div><div class="pace-marker" style="left:${w.expected*100}%"></div></div><div class="week-card-meta"><span>${Math.round(pct*100)}%</span><span>${tr('应到','expected')} ${Math.round(w.expected*100)}%</span></div>${ts.length?`<div class="module-task-list">${ts.map(t=>taskLine(t,true)).join('')}</div>`:''}</div>`;};
    const standalone=modules.filter(m=>!m.groupId), grouped=groups.map(g=>({g,members:modules.filter(m=>m.groupId===g.id)})).filter(x=>x.members.length);
    return `${header('THIS WEEK',`${tr('本周','Week')} · ${w.mondayISO.slice(5).replace('-','/')} – ${addDays(w.mondayISO,6).slice(5).replace('-','/')}`,customCopy('weekSubtitle'))}
    <section class="panel add-task-bar"><select id="taskModule" class="control">${modules.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('')}</select><input id="taskText" class="control" placeholder="${tr('添加本周任务…','Add a weekly task…')}"><button id="taskAdd" class="primary-button">＋ ${tr('添加','Add')}</button></section>
    <div class="week-grid">${standalone.map(card).join('')}</div>${grouped.map(({g,members})=>{const target=members.reduce((a,m)=>a+m.targetPerWeek,0),mins=entries.filter(e=>members.some(m=>m.id===e.moduleId)).reduce((a,e)=>a+e.minutes,0);return `<section class="group-section"><div class="group-heading"><div><span class="panel-kicker">GROUP</span><h2>${esc(g.label)}</h2></div><span>${minsLabel(mins)} / ${minsLabel(target)}</span></div><div class="week-grid">${members.map(card).join('')}</div></section>`;}).join('')}`;
  }

  function renderRoadmap(){
    const goals=state.data.goals;
    return `${header('ROADMAP',tr('长期路线图','Long-term roadmap'),customCopy('roadmapSubtitle'))}
      <section class="panel roadmap-panel"><div class="roadmap-toolbar"><div class="roadmap-legend"><span><i class="legend-dot confirmed"></i>${tr('确认 / 目标明确','Confirmed / clear target')}</span><span><i class="legend-dot estimate"></i>${tr('估算 / 可调整','Estimate / adjustable')}</span><span><i class="legend-dot hard"></i>${tr('硬节点','Hard milestone')}</span><span><i class="legend-dot dim"></i>${tr('当前状态','Current state')}</span></div><div class="timeline-controls"><button data-zoom="0.52">${tr('年','Year')}</button><button data-zoom="0.78" class="active">${tr('季度','Quarter')}</button><button data-zoom="1.35">${tr('月','Month')}</button><button id="roadAdd">＋ ${tr('节点','Item')}</button></div></div>${timelineHTML()}<div class="roadmap-hint">${tr('拖动条目可整体平移日期；点击/双击编辑。手机端更建议直接在编辑面板改日期。','Drag an item to shift its dates; click or double-click to edit. On mobile, editing dates in the panel is easier.')}</div></section>
      <section class="objectives-section"><div class="section-heading"><div><span class="panel-kicker">OBJECTIVES</span><h2>${tr('长期进程','Long-term progress')}</h2></div><span class="quiet-copy">${tr('沿用 Vis 的 Key Results + Memo 结构','Uses the Key Results + Memo structure from Vis')}</span></div><div class="goal-grid">${goals.map(goalCard).join('')}</div></section>`;
  }

  function timelineHTML(){
    const min='2026-06-01', max='2029-12-31', total=daysBetween(min,max), px=Math.max(0.45,state.zoom), contentW=Math.max(980,total*px), groups=state.data.roadmapGroups, items=state.data.roadmapItems;
    const months=[]; let cur=parseDate(min); cur.setDate(1); while(toISODate(cur)<=max){ months.push(toISODate(cur)); cur.setMonth(cur.getMonth()+1); }
    const labelMode=state.zoom<0.65?'year':state.zoom<1.1?'quarter':'month';
    const axisPoints=months.filter(m=>{const month=Number(m.slice(5,7));return labelMode==='month'||(labelMode==='quarter'&&[1,4,7,10].includes(month))||(labelMode==='year'&&month===1);});
    if(labelMode==='year' && !axisPoints.length) axisPoints.push(min);
    const axis=axisPoints.map((m,i)=>{const next=axisPoints[i+1]||max,left=daysBetween(min,m)*px,w=Math.max(52,daysBetween(m,next)*px),d=parseDate(m),month=d.getMonth()+1,year=d.getFullYear();const label=labelMode==='year'?String(year):labelMode==='quarter'?`${year} · Q${Math.floor((month-1)/3)+1}`:(state.lang==='en'?(month===1?`${year} · Jan`:new Intl.DateTimeFormat('en',{month:'short'}).format(d)):(month===1?`${year} · 1月`:`${month}月`));return `<div class="timeline-month ${labelMode}" style="left:${left}px;width:${w}px">${label}</div>`;}).join('');
    const grid=months.map(m=>{const month=Number(m.slice(5,7)),major=month===1||month===4||month===7||month===10;return `<i class="timeline-gridline ${major?'major':''}" style="left:${daysBetween(min,m)*px}px"></i>`;}).join('');
    const rows=groups.map(g=>{
      const its=items.filter(i=>i.groupId===g.id);
      const foreground=its.filter(i=>i.type!=='background').sort((a,b)=>a.start.localeCompare(b.start));
      const laneEnds=[]; const lanes=new Map();
      foreground.forEach(i=>{const end=i.end||i.start;let lane=laneEnds.findIndex(last=>daysBetween(last,i.start)>5);if(lane<0){lane=laneEnds.length;laneEnds.push(end);}else laneEnds[lane]=end;lanes.set(i.id,lane);});
      const laneCount=Math.max(1,laneEnds.length), rowH=54+(laneCount-1)*38;
      const html=its.map(i=>{const left=daysBetween(min,i.start)*px,dur=i.end?Math.max(1,daysBetween(i.start,i.end)+1):1,w=Math.max(i.type==='point'?18:24,dur*px),point=i.type==='point',lane=lanes.get(i.id)||0,top=i.type==='background'?7:11+lane*38;return `<div class="timeline-item ${i.status} ${i.type==='background'?'background':''} ${point?'timeline-point':''}" data-road-id="${i.id}" data-start="${i.start}" data-end="${i.end||''}" style="left:${left}px;width:${w}px;top:${top}px;${i.type==='background'?`height:${rowH-14}px;`:''}" ${point?`data-label="${esc(i.title)}"`:''}>${point?'':esc(i.title)}</div>`;}).join('');
      return `<div class="timeline-row" style="height:${rowH}px"><div class="timeline-label">${esc(g.label)}</div><div class="timeline-track" style="width:${contentW}px">${grid}${html}${TODAY>=min&&TODAY<=max?`<i class="timeline-today" style="left:${daysBetween(min,TODAY)*px}px"></i>`:''}</div></div>`;
    }).join('');
    return `<div class="timeline-canvas" data-pxday="${px}" data-min="${min}"><div class="timeline-inner" style="width:${contentW+170}px"><div class="timeline-axis" style="width:${contentW}px">${axis}</div>${rows}</div></div>`;
  }

  function goalCard(g){
    const krs=state.data.keyResults.filter(k=>k.goalId===g.id), vals=krs.map(kr=>krProgress(kr,g)), p=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0, days=Math.max(0,daysBetween(TODAY,g.end));
    return `<button class="goal-card-static" data-goal="${g.id}"><div class="goal-top"><div><span class="panel-kicker">${dateLabel(g.start)} – ${dateLabel(g.end)}</span><h3>${esc(g.title)}</h3></div><div class="goal-ring" style="--pct:${Math.round(p*100)*3.6}deg"><span>${Math.round(p*100)}%</span></div></div><div class="goal-meta"><span>◷ ${days} ${tr('天剩余','days left')}</span><span>${krs.length} ${tr('个 Key Results','key results')}</span></div><div class="goal-progress"><span style="width:${p*100}%"></span></div><div class="kr-preview">${krs.slice(0,4).map(k=>`<span>${esc(k.emoji||'•')} ${esc(k.title)}</span>`).join('')}</div></button>`;
  }
  function krCurrent(kr,g){ if(kr.method==='linked_minutes'&&kr.linkedModuleId) return activeEntries().filter(e=>e.moduleId===kr.linkedModuleId&&e.date>=g.start&&e.date<=g.end).reduce((a,e)=>a+e.minutes,0); return Number(kr.currentValue||0); }
  function krProgress(kr,g){ const cur=krCurrent(kr,g), den=Number(kr.objectiveValue)-Number(kr.initialValue||0); return den>0?Math.min(1,Math.max(0,(cur-Number(kr.initialValue||0))/den)):0; }

  function renderInsights(){
    const mods=state.data.modules, entries=activeEntries(), tags=state.data.tags.filter(t=>t.moduleId==='work'), currentMonday=mondayOf(new Date());
    const weeks=Array.from({length:8},(_,i)=>{const d=new Date(currentMonday); d.setDate(d.getDate()-7*(7-i)); const start=toISODate(d),end=addDays(start,6),mins=entries.filter(e=>e.date>=start&&e.date<=end).reduce((a,e)=>a+e.minutes,0); return {start,mins};});
    const max=Math.max(1,...weeks.map(w=>w.mins)), totals=mods.map(m=>({...m,mins:entries.filter(e=>e.moduleId===m.id).reduce((a,e)=>a+e.minutes,0)})).sort((a,b)=>b.mins-a.mins), work=tags.map(t=>({...t,mins:entries.filter(e=>e.tagId===t.id).reduce((a,e)=>a+e.minutes,0)})).filter(x=>x.mins>0);
    const rank=list=>`<div class="rank-list">${list.map((x,i)=>`<div class="rank-row"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(x.label)}</strong><b>${minsLabel(x.mins)}</b></div>`).join('')}</div>`;
    return `${header('INSIGHTS',tr('长期趋势','Long-term trends'),customCopy('insightsSubtitle'))}<section class="panel insight-chart"><div class="panel-heading"><div><span class="panel-kicker">8 WEEKS</span><h2>${tr('每周总投入','Weekly total')}</h2></div></div><div class="bar-chart">${weeks.map(w=>`<div class="bar-col"><div class="bar-value">${minsLabel(w.mins)}</div><div class="bar-shell"><span style="height:${w.mins/max*100}%"></span></div><small>${w.start.slice(5).replace('-','/')}</small></div>`).join('')}</div></section><div class="insight-grid"><section class="panel"><div class="panel-heading"><div><span class="panel-kicker">ALL TIME</span><h2>${tr('模块累计','Module totals')}</h2></div></div>${rank(totals)}</section><section class="panel"><div class="panel-heading"><div><span class="panel-kicker">WORK</span><h2>${tr('Work 内部分布','Work breakdown')}</h2></div></div>${work.length?rank(work):`<div class="empty-block">${tr('还没有带 Work 标签的记录。','No Work-tagged entries yet.')}</div>`}</section></div>`;
  }

  function renderSettings(){
    const mods=state.data.modules, groups=state.data.groups;
    return `${header('SETTINGS',tr('设置与数据','Settings & data'),tr('第一版使用 IndexedDB，本机离线优先。未来可以在不推翻数据结构的前提下接 Supabase 同步。','This version uses IndexedDB and works local-first/offline. Supabase sync can be added later without replacing the data model.'))}<section class="panel settings-section"><div class="panel-heading"><div><span class="panel-kicker">MODULES</span><h2>${tr('每周小时目标','Weekly time targets')}</h2></div></div><div class="settings-list">${mods.map(m=>`<div class="settings-row"><input class="control module-label" data-mid="${m.id}" value="${esc(m.label)}"><input class="control target-input module-target" data-mid="${m.id}" type="number" min="0" value="${m.targetPerWeek}"><select class="control group-input module-group" data-mid="${m.id}"><option value="">${tr('无分组','No group')}</option>${groups.map(g=>`<option value="${g.id}" ${m.groupId===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div>`).join('')}</div><div class="add-module-row"><input id="newModuleLabel" class="control" placeholder="${tr('新模块','New module')}"><input id="newModuleTarget" class="control target-input" type="number" min="0" value="120"><button id="newModuleAdd" class="secondary-button">＋ ${tr('添加','Add')}</button></div><p class="settings-help">${tr('目标单位是分钟/周。比如 420 代表 7 小时。','Targets are minutes per week. For example, 420 means 7 hours.')}</p></section>
    <section class="panel settings-section"><div class="panel-heading"><div><span class="panel-kicker">WEEKLY LINE</span><h2>${tr('每周诗句库','Weekly line library')}</h2></div><span class="count-badge">${(state.data.quotes||[]).length}</span></div><div class="quote-settings-list">${(state.data.quotes||[]).map(q=>`<div class="quote-settings-row" data-qid="${q.id}"><input class="control quote-text" value="${esc(q.text)}"><input class="control quote-source" value="${esc(q.source||'')}" placeholder="${tr('作者 / 出处','Author / source')}"><button class="action-icon quote-delete" title="${tr('删除','Delete')}">×</button></div>`).join('')}</div><div class="quote-add-row"><input id="newQuoteText" class="control" placeholder="${tr('添加一句诗','Add a line')}"><input id="newQuoteSource" class="control" placeholder="${tr('作者 / 出处','Author / source')}"><button id="newQuoteAdd" class="secondary-button">＋ ${tr('添加','Add')}</button></div><p class="settings-help">${tr('每周从这里选一条并固定显示在 Today。你可以全部替换成自己的句子。','One line is selected here each week and stays fixed on Today. Replace the library with your own lines whenever you want.')}</p></section>
    <section class="panel settings-section"><div class="panel-heading"><div><span class="panel-kicker">DATA</span><h2>${tr('备份与迁移','Backup & migration')}</h2></div></div><div class="data-actions"><button id="exportData" class="secondary-button">⇩ ${tr('导出 JSON','Export JSON')}</button><label class="secondary-button upload-label">⇧ ${tr('导入 JSON','Import JSON')}<input id="importData" type="file" accept="application/json"></label><button id="resetData" class="danger-button">↻ ${tr('重置本地数据','Reset local data')}</button></div><p class="settings-help">${tr('PWA 删除、清除浏览器网站数据或更换设备都可能移除 IndexedDB，所以在启用云同步前建议偶尔导出备份。','Removing the PWA, clearing site data, or changing devices can remove IndexedDB. Export a backup occasionally until cloud sync is enabled.')}</p></section>
    <section class="panel settings-section install-note"><div class="panel-heading"><div><span class="panel-kicker">PWA</span><h2>${tr('安装到设备','Install on device')}</h2></div></div><p>${tr('Mac Chrome / Edge：部署后打开站点，使用地址栏或浏览器菜单里的“安装应用”。iPhone：Safari → 分享 →“添加到主屏幕”。安装后会以 standalone 模式启动，并缓存核心静态资源供离线使用。','Mac Chrome / Edge: after deployment, open the site and choose Install app from the address bar or browser menu. iPhone: Safari → Share → Add to Home Screen. The installed PWA launches standalone and caches core assets for offline use.')}</p></section>`;
  }

  function bindPage(){
    $('#quickTop')?.addEventListener('click', openQuickModal);
    $('#mobileFab').onclick=openQuickModal;
    bindQuick($('#main'));
    $$('[data-task-toggle]').forEach(b=>b.onclick=async()=>{const t=state.data.weeklyTasks.find(x=>x.id===b.dataset.taskToggle); t.done=!t.done;t.updatedAt=nowISO();await put('weeklyTasks',t);await refresh();render();});
    $$('[data-task-today]').forEach(b=>b.onclick=async()=>{const t=state.data.weeklyTasks.find(x=>x.id===b.dataset.taskToday);t.todayDate=t.todayDate===TODAY?null:TODAY;t.updatedAt=nowISO();await put('weeklyTasks',t);await refresh();render();});
    $$('[data-suggest]').forEach(b=>b.onclick=async()=>{const m=state.data.modules.find(x=>x.id===b.dataset.suggest),w=getWeek();await put('weeklyTasks',{id:uid('task'),moduleId:m.id,weekOf:w.mondayISO,text:`${tr('补足','Catch up')} ${m.label} ${tr('本周进度','this week')}`,done:false,todayDate:TODAY,createdAt:nowISO(),updatedAt:nowISO()});await refresh();toast(tr('已加入今天','Added to today'));render();});
    $$('[data-habit]').forEach(b=>b.onclick=async()=>{if(b.dataset.date!==TODAY)return; const ex=state.data.habitEntries.find(e=>e.habitId===b.dataset.habit&&e.date===TODAY); if(ex){ex.done=!ex.done;ex.updatedAt=nowISO();await put('habitEntries',ex);}else await put('habitEntries',{id:uid('habit'),habitId:b.dataset.habit,date:TODAY,done:true,createdAt:nowISO(),updatedAt:nowISO()});await refresh();render();});
    $('#taskAdd')?.addEventListener('click', addWeekTask); $('#taskText')?.addEventListener('keydown',e=>{if(e.key==='Enter')addWeekTask();});
    $('#roadAdd')?.addEventListener('click',()=>openRoadEditor());
    $$('[data-zoom]').forEach(b=>b.onclick=()=>{state.zoom=Number(b.dataset.zoom)||.78;render();});
    $$('[data-road-id]').forEach(bindTimelineItem);
    $$('[data-goal]').forEach(b=>b.onclick=()=>openGoalEditor(b.dataset.goal));
    bindSettings();
  }

  function bindQuick(root){
    $$('[data-quick]',root).forEach(box=>{
      const mod=$('.q-module',box), min=$('.q-min',box), tag=$('.q-tag',box), note=$('.q-note',box), save=$('.q-save',box);
      const update=()=>{ const v=Math.max(1,Number(min.value)||1); min.value=v; save.textContent=`＋ ${tr('记录','Log')} ${minsLabel(v)}`; $$('.q-chip',box).forEach(c=>c.classList.toggle('active',Number(c.dataset.min)===v)); tag.style.display=mod.value==='work'?'block':'none'; if(mod.value!=='work')tag.value=''; };
      mod.onchange=update; min.oninput=update; $$('.q-chip',box).forEach(c=>c.onclick=()=>{min.value=c.dataset.min;update();});
      save.onclick=async()=>{const minutes=Math.max(1,Math.min(1440,Number(min.value)||1)), m=state.data.modules.find(x=>x.id===mod.value); await put('timeEntries',{id:uid('entry'),moduleId:mod.value,minutes,date:TODAY,note:note.value.trim(),tagId:tag.value||null,createdAt:nowISO(),updatedAt:nowISO(),deletedAt:null}); note.value='';await refresh();toast(`${tr('已记录','Logged')} ${m?.label||''} · ${minsLabel(minutes)}`); if(state.page==='today')render();};
    });
  }

  async function addWeekTask(){
    const text=$('#taskText')?.value.trim(); if(!text)return; const w=getWeek(),moduleId=$('#taskModule').value; await put('weeklyTasks',{id:uid('task'),moduleId,weekOf:w.mondayISO,text,done:false,todayDate:null,createdAt:nowISO(),updatedAt:nowISO()}); await refresh();toast(tr('已添加本周任务','Weekly task added'));render();
  }

  function openQuickModal(){
    const modal=openModal(`<div class="modal-head"><div><span class="panel-kicker">QUICK LOG</span><h2>${tr('记录一段时间','Log a time session')}</h2></div><button class="icon-button modal-close">×</button></div>${quickLogHTML('modal')}<div class="modal-divider"></div><div class="timer-box"><div><span class="panel-kicker">OPTIONAL TIMER</span><div id="timerDisplay" class="timer-display">00:00:00</div></div><select id="timerModule" class="control">${state.data.modules.map(m=>`<option value="${m.id}">${esc(m.label)}</option>`).join('')}</select><button id="timerStart" class="secondary-button wide">▶ ${tr('开始计时','Start timer')}</button><button id="timerFinish" class="danger-button wide" style="display:none">■ ${tr('结束并保存','Finish & save')}</button><p class="quiet-copy">${tr('这是补充功能。你继续用 iPhone 番茄钟也完全可以。','This is optional. You can keep using your iPhone Pomodoro timer.')}</p></div>`,'sheet-modal');
    bindQuick(modal); $('.modal-close',modal).onclick=closeModal;
    const display=$('#timerDisplay',modal),start=$('#timerStart',modal),finish=$('#timerFinish',modal),sel=$('#timerModule',modal);
    start.onclick=()=>{state.timer={startedAt:Date.now(),moduleId:sel.value};sel.disabled=true;start.style.display='none';finish.style.display='flex'; state.timerTick=setInterval(()=>{const sec=Math.floor((Date.now()-state.timer.startedAt)/1000);display.textContent=`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);};
    finish.onclick=async()=>{if(!state.timer)return; const minutes=Math.max(1,Math.round((Date.now()-state.timer.startedAt)/60000));await put('timeEntries',{id:uid('entry'),moduleId:state.timer.moduleId,minutes,date:TODAY,note:'Timer',tagId:null,createdAt:nowISO(),updatedAt:nowISO(),deletedAt:null});clearInterval(state.timerTick);state.timer=null;await refresh();toast(`${tr('计时完成','Timer finished')} · ${minsLabel(minutes)}`);closeModal();render();};
  }

  function openModal(content,cls='sheet-modal'){
    closeModal(); const back=document.createElement('div');back.id='modalBackdrop';back.className='modal-backdrop';back.innerHTML=`<div class="${cls}">${content}</div>`;document.body.append(back);back.addEventListener('mousedown',e=>{if(e.target===back)closeModal();});return back.firstElementChild;
  }
  function closeModal(){ const el=$('#modalBackdrop'); if(el)el.remove(); if(state.timerTick&& !state.timer){clearInterval(state.timerTick);state.timerTick=null;} }

  function openRoadEditor(id=null){
    const item=id?state.data.roadmapItems.find(x=>x.id===id):null, groups=state.data.roadmapGroups, mods=state.data.modules;
    const d=item||{title:'',groupId:groups[0]?.id||'',start:TODAY,end:'',type:'range',status:'estimate',linkedModuleId:'',note:''};
    const modal=openModal(`<div class="modal-head"><div><span class="panel-kicker">ROADMAP ITEM</span><h2>${item?tr('编辑节点','Edit item'):tr('新增节点','New item')}</h2></div><button class="icon-button modal-close">×</button></div><label class="field-label">${tr('名称','Name')}</label><input id="rTitle" class="control" value="${esc(d.title)}"><div class="form-grid"><label><span class="field-label">${tr('分组','Group')}</span><select id="rGroup" class="control">${groups.map(g=>`<option value="${g.id}" ${d.groupId===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></label><label><span class="field-label">${tr('状态','Status')}</span><select id="rStatus" class="control">${[['confirmed',tr('确认 / 明确','Confirmed / clear')],['estimate',tr('估算 / 可调整','Estimate / adjustable')],['hard',tr('硬节点','Hard milestone')],['dim',tr('当前状态','Current state')]].map(([v,l])=>`<option value="${v}" ${d.status===v?'selected':''}>${l}</option>`).join('')}</select></label><label><span class="field-label">${tr('类型','Type')}</span><select id="rType" class="control"><option value="range" ${d.type==='range'?'selected':''}>${tr('时间段','Range')}</option><option value="point" ${d.type==='point'?'selected':''}>${tr('节点','Milestone')}</option><option value="background" ${d.type==='background'?'selected':''}>${tr('持续背景','Background')}</option></select></label><label><span class="field-label">${tr('关联模块','Linked module')}</span><select id="rModule" class="control"><option value="">${tr('不关联','None')}</option>${mods.map(m=>`<option value="${m.id}" ${d.linkedModuleId===m.id?'selected':''}>${esc(m.label)}</option>`).join('')}</select></label><label><span class="field-label">${tr('开始','Start')}</span><input id="rStart" class="control" type="date" value="${d.start}"></label><label id="rEndLabel"><span class="field-label">${tr('结束','End')}</span><input id="rEnd" class="control" type="date" value="${d.end||d.start}"></label></div><label class="field-label">Memo</label><textarea id="rNote" class="control textarea">${esc(d.note||'')}</textarea><div class="modal-actions">${item?`<button id="rDelete" class="danger-button">${tr('删除','Delete')}</button>`:'<span></span>'}<span></span><button class="secondary-button modal-close2">${tr('取消','Cancel')}</button><button id="rSave" class="primary-button">${tr('保存','Save')}</button></div>`,'sheet-modal roadmap-editor');
    const type=$('#rType',modal),endLabel=$('#rEndLabel',modal);const sync=()=>endLabel.style.display=type.value==='point'?'none':'block';sync();type.onchange=sync; $$('.modal-close,.modal-close2',modal).forEach(b=>b.onclick=closeModal);
    $('#rSave',modal).onclick=async()=>{const title=$('#rTitle',modal).value.trim(),start=$('#rStart',modal).value;if(!title||!start)return toast(tr('请填写名称和日期','Enter a name and date'));const row={id:item?.id||uid('roadmap'),title,groupId:$('#rGroup',modal).value,status:$('#rStatus',modal).value,type:type.value,start,end:type.value==='point'?null:($('#rEnd',modal).value||start),linkedModuleId:$('#rModule',modal).value||null,note:$('#rNote',modal).value.trim(),createdAt:item?.createdAt||nowISO(),updatedAt:nowISO()};await put('roadmapItems',row);await refresh();closeModal();toast(item?tr('节点已更新','Item updated'):tr('节点已添加','Item added'));render();};
    $('#rDelete',modal)?.addEventListener('click',async()=>{if(confirm(tr('删除这个 Roadmap 节点？','Delete this Roadmap item?'))){await del('roadmapItems',item.id);await refresh();closeModal();toast(tr('节点已删除','Item deleted'));render();}});
  }

  function bindTimelineItem(el){
    let startX=0, originalLeft=0, moved=false;
    el.addEventListener('click',()=>{ if(!moved)openRoadEditor(el.dataset.roadId); });
    el.addEventListener('dblclick',()=>openRoadEditor(el.dataset.roadId));
    el.addEventListener('pointerdown',e=>{ if(e.pointerType==='touch')return; startX=e.clientX;originalLeft=parseFloat(el.style.left)||0;moved=false;el.classList.add('is-dragging');el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove',e=>{ if(!el.hasPointerCapture(e.pointerId))return; const dx=e.clientX-startX;if(Math.abs(dx)>3)moved=true;el.style.left=`${originalLeft+dx}px`; });
    el.addEventListener('pointerup',async e=>{ if(!el.hasPointerCapture(e.pointerId))return;el.releasePointerCapture(e.pointerId);el.classList.remove('is-dragging');if(!moved)return;const canvas=el.closest('.timeline-canvas'),px=Number(canvas.dataset.pxday),dx=parseFloat(el.style.left)-originalLeft,shift=Math.round(dx/px),item=state.data.roadmapItems.find(x=>x.id===el.dataset.roadId);if(!shift||!item){render();return;}item.start=addDays(item.start,shift);if(item.end)item.end=addDays(item.end,shift);item.updatedAt=nowISO();await put('roadmapItems',item);await refresh();toast(`${tr('已平移','Shifted')} ${shift>0?'+':''}${shift} ${tr('天','days')}`);render(); });
  }

  function openGoalEditor(id){
    const g=state.data.goals.find(x=>x.id===id),krs=state.data.keyResults.filter(k=>k.goalId===id),mods=state.data.modules;if(!g)return;
    const rows=krs.map(kr=>{const cur=krCurrent(kr,g),p=krProgress(kr,g);return `<div class="kr-row" data-kr="${kr.id}"><div class="kr-main"><div class="kr-title"><span>${esc(kr.emoji||'◎')}</span><input class="kr-edit-title" value="${esc(kr.title)}"></div><div class="kr-progress-track"><span style="width:${p*100}%"></span></div><div class="kr-caption"><span>${kr.method==='linked_minutes'?minsLabel(cur):`${cur} / ${kr.objectiveValue}${kr.unit?` ${esc(kr.unit)}`:''}`}</span><span>${Math.round(p*100)}%</span></div>${kr.memo?`<div class="kr-memo">${esc(kr.memo)}</div>`:''}</div><div class="kr-controls"><select class="mini-control kr-method"><option value="manual" ${kr.method==='manual'?'selected':''}>${tr('手动计数','Manual count')}</option><option value="linked_minutes" ${kr.method==='linked_minutes'?'selected':''}>${tr('关联时长','Linked time')}</option></select><select class="mini-control kr-module" ${kr.method==='linked_minutes'?'':'style="display:none"'}><option value="">${tr('选择模块','Choose module')}</option>${mods.map(m=>`<option value="${m.id}" ${kr.linkedModuleId===m.id?'selected':''}>${esc(m.label)}</option>`).join('')}</select><div class="bump-controls" ${kr.method==='manual'?'':'style="display:none"'}><button data-bump="-1">−</button><button data-bump="1">＋1</button></div></div></div>`;}).join('');
    const modal=openModal(`<div class="modal-head"><div><span class="panel-kicker">OBJECTIVE</span><h2>${esc(g.title)}</h2><p>${dateLabel(g.start)} – ${dateLabel(g.end)}</p></div><button class="icon-button modal-close">×</button></div><div class="kr-list">${rows}</div><div class="add-kr"><input id="newKr" class="control" placeholder="${tr('添加 Key Result','Add Key Result')}"><button id="addKr" class="secondary-button">＋ ${tr('添加','Add')}</button></div>${g.memo?`<div class="memo-box"><span class="panel-kicker">MEMO</span><p>${esc(g.memo)}</p></div>`:''}`,'large-modal'); $('.modal-close',modal).onclick=closeModal;
    $$('.kr-row',modal).forEach(row=>{const kr=state.data.keyResults.find(k=>k.id===row.dataset.kr),method=$('.kr-method',row),mod=$('.kr-module',row),bumps=$('.bump-controls',row),title=$('.kr-edit-title',row);title.onchange=async()=>{kr.title=title.value.trim()||kr.title;kr.updatedAt=nowISO();await put('keyResults',kr);await refresh();};method.onchange=async()=>{kr.method=method.value;kr.updatedAt=nowISO();await put('keyResults',kr);mod.style.display=kr.method==='linked_minutes'?'block':'none';bumps.style.display=kr.method==='manual'?'grid':'none';await refresh();};mod.onchange=async()=>{kr.linkedModuleId=mod.value||null;kr.updatedAt=nowISO();await put('keyResults',kr);await refresh();closeModal();openGoalEditor(id);};$$('[data-bump]',row).forEach(b=>b.onclick=async()=>{const next=Math.max(kr.initialValue,Math.min(kr.objectiveValue,Number(kr.currentValue||0)+Number(b.dataset.bump)));kr.currentValue=next;kr.updatedAt=nowISO();await put('keyResults',kr);await refresh();closeModal();openGoalEditor(id);});});
    $('#addKr',modal).onclick=async()=>{const title=$('#newKr',modal).value.trim();if(!title)return;await put('keyResults',{id:uid('kr'),goalId:id,title,emoji:'◎',initialValue:0,objectiveValue:1,currentValue:0,unit:tr('项','item'),method:'manual',linkedModuleId:null,memo:'',createdAt:nowISO(),updatedAt:nowISO()});await refresh();closeModal();openGoalEditor(id);toast(tr('Key Result 已添加','Key Result added'));};
  }

  function bindSettings(){
    $$('.module-label').forEach(el=>el.onchange=async()=>{const m=state.data.modules.find(x=>x.id===el.dataset.mid);m.label=el.value.trim()||m.label;m.updatedAt=nowISO();await put('modules',m);await refresh();});
    $$('.module-target').forEach(el=>el.onchange=async()=>{const m=state.data.modules.find(x=>x.id===el.dataset.mid);m.targetPerWeek=Math.max(0,Number(el.value)||0);m.updatedAt=nowISO();await put('modules',m);await refresh();});
    $$('.module-group').forEach(el=>el.onchange=async()=>{const m=state.data.modules.find(x=>x.id===el.dataset.mid);m.groupId=el.value||null;m.updatedAt=nowISO();await put('modules',m);await refresh();});
    $('#newModuleAdd')?.addEventListener('click',async()=>{const label=$('#newModuleLabel').value.trim();if(!label)return;await put('modules',{id:uid('module'),label,targetPerWeek:Math.max(0,Number($('#newModuleTarget').value)||0),groupId:null,kind:'time',createdAt:nowISO(),updatedAt:nowISO()});await refresh();toast(tr('模块已添加','Module added'));render();});
    $$('.quote-settings-row').forEach(row=>{const q=state.data.quotes.find(x=>x.id===row.dataset.qid),text=$('.quote-text',row),source=$('.quote-source',row);const save=async()=>{if(!q)return;q.text=text.value.trim()||q.text;q.source=source.value.trim();q.updatedAt=nowISO();await put('quotes',q);await refresh();};text.onchange=save;source.onchange=save;$('.quote-delete',row).onclick=async()=>{await del('quotes',q.id);await refresh();toast(tr('诗句已删除','Line deleted'));render();};});
    $('#newQuoteAdd')?.addEventListener('click',async()=>{const text=$('#newQuoteText').value.trim(),source=$('#newQuoteSource').value.trim();if(!text)return toast(tr('先写一句诗','Enter a line first'));await put('quotes',{id:uid('quote'),text,source,createdAt:nowISO(),updatedAt:nowISO()});await refresh();toast(tr('已加入诗句库','Added to line library'));render();});
    $('#exportData')?.addEventListener('click',async()=>{const data={version:4,exportedAt:nowISO()};for(const s of STORES)data[s]=state.data[s];const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`progress-console-${TODAY}.json`;a.click();URL.revokeObjectURL(a.href);});
    $('#importData')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());for(const s of STORES)if(Array.isArray(data[s])){await clear(s);for(const r of data[s])await put(s,r);}await refresh();toast(tr('数据已导入','Data imported'));render();}catch{toast(tr('导入失败：JSON 格式不正确','Import failed: invalid JSON'));}});
    $('#resetData')?.addEventListener('click',async()=>{if(!confirm(tr('清空本地数据库并恢复初始模板？此操作不可撤销。','Clear the local database and restore the starter template? This cannot be undone.')))return;for(const s of STORES)await clear(s);await seedIfEmpty();await refresh();toast(tr('已恢复初始模板','Starter template restored'));render();});
  }

  async function init(){
    try{
      await openDB(); await seedIfEmpty(); await refresh(); render();
      if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }catch(err){ console.error(err); $('#main').innerHTML=`<div class="panel"><h2>${tr('加载失败','Failed to load')}</h2><p class="quiet-copy">${tr('IndexedDB 初始化失败。请刷新页面，或检查浏览器是否禁用了网站存储。','IndexedDB could not initialize. Refresh the page or check whether site storage is disabled.')}</p></div>`; }
  }

  init();
})();
