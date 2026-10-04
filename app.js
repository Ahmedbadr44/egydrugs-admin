const CONFIG={url:"https://lfxdgtbsmomafyaolndh.supabase.co",key:"sb_publishable_A9K53JorCDERk7MtJG5wiw_z_Jm0bX0"};
const PAGE_SIZE=40,INGREDIENT_PAGE_SIZE=60;
let client,drugPage=0,ingredientPage=0,drugHasMore=false,ingredientHasMore=false,drugSearchTimer,ingredientSearchTimer,missingArabicOnly=false,databasePage=0,databaseHasMore=false,databaseRows=[];
const $=id=>document.getElementById(id),toast=$("toast");

function icons(){window.lucide?.createIcons()}
function say(message,error=false){
  toast.textContent=message;toast.className="toast show"+(error?" error":"");
  clearTimeout(say.timer);say.timer=setTimeout(()=>toast.className="toast",3200);
}
function html(v){
  return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function lines(v){return String(v||"").split("\n").map(x=>x.trim()).filter(Boolean)}
function num(v){return new Intl.NumberFormat("ar-EG").format(Number(v||0))}
async function isAdmin(userId){
  const r=await client.from("drug_admins").select("user_id").eq("user_id",userId).maybeSingle();
  if(r.error) return {ok:false,error:r.error};
  return {ok:true,isAdmin:Boolean(r.data)};
}
async function openApp(session){
  if(!session?.user){
    $("login-error").textContent="تم تسجيل الدخول لكن لم يتم إنشاء جلسة.";
    return;
  }
  const admin=await isAdmin(session.user.id);
  if(!admin.ok){
    console.error("Admin check failed:",admin.error);
    $("login-error").textContent="تم تسجيل الدخول، لكن فحص صلاحية المدير فشل: "+admin.error.message;
    return;
  }
  if(!admin.isAdmin){
    await client.auth.signOut();
    $("login-error").textContent="الحساب صحيح، لكنه غير موجود في قائمة المدراء.";
    $("login-view").hidden=false;$("app").hidden=true;return;
  }
  $("account-email").textContent=session.user.email||"";
  $("login-view").hidden=true;$("app").hidden=false;await loadDashboard();
}
function setView(view){
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active-view"));
  $("view-"+view).classList.add("active-view");
  const meta={
    dashboard:["الرئيسية","نظرة سريعة على قاعدة بيانات الأدوية."],
    drugs:["الأدوية","إدارة المنتجات التجارية وبياناتها الأساسية."],
    ingredients:["المواد الفعالة","إدارة المعلومات الطبية المشتركة لكل مادة فعالة."],
    quality:["جودة البيانات","مراجعة النواقص التي تؤثر على جودة قاعدة البيانات."],
    database:["قاعدة البيانات","تعديل بيانات الأدوية مباشرة في جدول شبيه بـ Excel."]
  }[view];
  $("page-title").textContent=meta[0];$("page-subtitle").textContent=meta[1];
  if(view==="dashboard")loadDashboard();
  if(view==="drugs")loadDrugs();
  if(view==="ingredients")loadIngredients();
  if(view==="quality")loadQuality();
  if(view==="database")loadDatabase();
  icons();
}
async function stats(){
  const r=await client.rpc("get_admin_dashboard_stats");
  if(r.error)throw r.error;return r.data;
}
function statCard(icon,label,value,note){
  return '<div class="stat-card"><div class="stat-head"><span class="stat-label">'+html(label)+'</span><span class="stat-icon"><i data-lucide="'+icon+'"></i></span></div><div class="stat-value">'+num(value)+'</div><div class="stat-note">'+html(note)+'</div></div>';
}
async function exportArabicNames(){
  try{
    say("جاري تجهيز ملف الأسماء...");
    const rows=[];
    let from=0;
    const size=1000;
    while(true){
      const r=await client.from("drugs").select("id,commercial_name_en,commercial_name_ar").order("id",{ascending:true}).range(from,from+size-1);
      if(r.error)throw r.error;
      rows.push(...(r.data||[]));
      if((r.data||[]).length<size)break;
      from+=size;
    }
    const esc=v=>'"'+String(v??"").replaceAll('"','""')+'"';
    const csv="\uFEFF"+[
      ["id","commercial_name_en","commercial_name_ar"].map(esc).join(","),
      ...rows.map(r=>[r.id,r.commercial_name_en,r.commercial_name_ar].map(esc).join(","))
    ].join("\r\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    a.download="egydrugs_arabic_names.csv";
    document.body.appendChild(a);a.click();a.remove();
    URL.revokeObjectURL(a.href);
    say("تم تجهيز "+num(rows.length)+" اسم دواء.");
  }catch(e){say("تعذر التصدير: "+e.message,true)}
}
async function loadDashboard(){
  try{
    const s=await stats();
    $("stats-grid").innerHTML=[
      statCard("database","إجمالي الأدوية",s.total_drugs,"منتج تجاري في القاعدة"),
      statCard("flask-conical","المواد الفعالة",s.total_ingredients,"مادة فعالة مستخرجة من البيانات"),
      statCard("heart-pulse","مكونات لها معلومات طبية",s.ingredients_with_medical,"استخدامات أو أعراض جانبية محفوظة"),
      statCard("file-check-2","أدوية لها بيانات طبية",s.drugs_with_medical,"بيانات خاصة محفوظة على مستوى المنتج")
    ].join("");
    $("quality-summary").innerHTML=[
      ["أسماء عربية ناقصة",s.missing_arabic,"missing"],
      ["مواد فعالة ناقصة",s.missing_scientific,"missing"],
      ["أسعار ناقصة",s.missing_price,"warn"]
    ].map(x=>'<div class="quality-row"><span class="quality-name">'+x[0]+'</span><span class="badge '+x[2]+'">'+num(x[1])+'</span></div>').join("");
    const r=await client.rpc("list_active_ingredients",{p_search:null,p_limit:6,p_offset:0});
    if(r.error)throw r.error;
    $("top-ingredients").innerHTML=(r.data||[]).map(x=>'<div class="mini-row"><span>'+html(x.display_name||x.ingredient_key)+'</span><strong>'+num(x.product_count)+'</strong></div>').join("")||'<div class="empty-state">لا توجد مواد فعالة.</div>';
    icons();
  }catch(e){say("تعذر تحميل لوحة المعلومات: "+e.message,true)}
}
async function loadDrugs(){
  const term=$("drug-search").value.trim(),from=drugPage*PAGE_SIZE;
  let q=client.from("drugs").select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,price_egp,dosage").order("id",{ascending:false}).range(from,from+PAGE_SIZE);
  if(term){
    const p="%"+term+"%";
    q=q.or("commercial_name_en.ilike."+p+",commercial_name_ar.ilike."+p+",scientific_name.ilike."+p);
  }
  if(missingArabicOnly) q=q.is("commercial_name_ar",null);
  const r=await q;
  if(r.error){say("تعذر تحميل الأدوية: "+r.error.message,true);return}
  drugHasMore=r.data.length>PAGE_SIZE;
  const rows=r.data.slice(0,PAGE_SIZE);
  $("drugs-body").innerHTML=rows.map(d=>'<tr><td class="medicine-name">'+html(d.commercial_name_en)+(d.commercial_name_ar?'<small>'+html(d.commercial_name_ar)+"</small>":"")+'</td><td><div class="quick-arabic"><input class="arabic-inline" data-id="'+d.id+'" value="'+html(d.commercial_name_ar||"")+'" placeholder="اكتب الاسم العربي..."><button class="icon-button save-inline" data-action="save-arabic" data-id="'+d.id+'" title="حفظ الاسم العربي"><i data-lucide="check"></i></button></div></td><td>'+html(d.scientific_name||"-")+'</td><td>'+html(d.manufacturer||"-")+'</td><td class="price">'+(d.price_egp==null?"-":new Intl.NumberFormat("ar-EG",{maximumFractionDigits:2}).format(d.price_egp)+" ج.م")+'</td><td><div class="row-actions"><button class="icon-button" data-action="edit-drug" data-id="'+d.id+'" title="تعديل كامل"><i data-lucide="pencil"></i></button><button class="icon-button delete" data-action="delete-drug" data-id="'+d.id+'" title="حذف"><i data-lucide="trash-2"></i></button></div></td></tr>').join("");
  $("drugs-empty").hidden=rows.length>0;
  $("drug-page").textContent="صفحة "+(drugPage+1);$("drug-prev").disabled=drugPage===0;$("drug-next").disabled=!drugHasMore;
  $("drug-result-note").textContent=term?"نتائج البحث عن \""+term+"\"":"آخر الأدوية في القاعدة";icons();
}
async function loadDatabase(){
  const term=$("database-search").value.trim(),from=databasePage*100;
  let q=client.from("drugs").select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp").order("id",{ascending:true}).range(from,from+100);
  if(term){
    const p="%"+term+"%";
    q=q.or("commercial_name_en.ilike."+p+",commercial_name_ar.ilike."+p+",scientific_name.ilike."+p+",manufacturer.ilike."+p+",drug_class.ilike."+p);
  }
  const r=await q;
  if(r.error){say("تعذر تحميل قاعدة البيانات: "+r.error.message,true);return}
  databaseHasMore=r.data.length>100;
  databaseRows=r.data.slice(0,100);
  const body=$("database-body");
  body.innerHTML="";
  const fields=["commercial_name_en","commercial_name_ar","scientific_name","manufacturer","drug_class","route","price_egp"];
  databaseRows.forEach(d=>{
    const tr=document.createElement("tr");
    tr.dataset.id=d.id;
    const idCell=document.createElement("td");
    idCell.className="db-id";
    idCell.textContent=d.id;
    tr.appendChild(idCell);
    fields.forEach(field=>{
      const td=document.createElement("td");
      const input=document.createElement("input");
      input.dataset.field=field;
      if(field==="price_egp"){
        input.type="number";
        input.min="0";
        input.step="0.01";
        input.value=d[field]??"";
      }else{
        input.value=d[field]||"";
      }
      td.appendChild(input);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  $("database-page").textContent="صفحة "+(databasePage+1);
  $("database-prev").disabled=databasePage===0;
  $("database-next").disabled=!databaseHasMore;
  icons();
}
async function saveDatabase(){
  const rows=[...$("database-body").querySelectorAll("tr[data-id]")];
  let count=0;
  for(const row of rows){
    const id=row.dataset.id,p={};
    row.querySelectorAll("input[data-field]").forEach(input=>{const v=input.value.trim();p[input.dataset.field]=input.dataset.field==="price_egp"?(v===""?null:Number(v)):v});
    const r=await client.from("drugs").update(p).eq("id",id);
    if(r.error){say("تعذر حفظ الدواء رقم "+id+": "+r.error.message,true);return}
    count++;
  }
  say("تم حفظ "+num(count)+" دواء بنجاح.");
  await loadDashboard();await loadDatabase();
}
async function loadIngredients(){
  const term=$("ingredient-search").value.trim();
  const r=await client.rpc("list_active_ingredients",{p_search:term||null,p_limit:INGREDIENT_PAGE_SIZE,p_offset:ingredientPage*INGREDIENT_PAGE_SIZE});
  if(r.error){say("تعذر تحميل المواد الفعالة: "+r.error.message,true);return}
  ingredientHasMore=r.data.length===INGREDIENT_PAGE_SIZE;
  $("ingredients-body").innerHTML=(r.data||[]).map(x=>'<tr><td class="medicine-name">'+html(x.display_name||x.ingredient_key)+'<small>'+html(x.ingredient_key)+'</small></td><td>'+num(x.product_count)+'</td><td>'+(x.has_medical_info?'<span class="badge ok">مكتملة</span>':'<span class="badge missing">تحتاج بيانات</span>')+'</td><td><button class="secondary-button" data-action="edit-ingredient" data-key="'+html(x.ingredient_key)+'"><i data-lucide="pencil"></i> إدارة</button></td></tr>').join("");
  $("ingredients-empty").hidden=(r.data||[]).length>0;
  $("ingredient-page").textContent="صفحة "+(ingredientPage+1);$("ingredient-prev").disabled=ingredientPage===0;$("ingredient-next").disabled=!ingredientHasMore;
  $("ingredient-result-note").textContent=term?"نتائج البحث عن \""+term+"\"":"المواد مرتبة حسب عدد المنتجات";icons();
}
async function openDrug(id){
  const r=await client.from("drugs").select("id,commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,price_egp,dosage").eq("id",id).single();
  if(r.error){say("تعذر تحميل الدواء: "+r.error.message,true);return}
  const d=r.data;$("drug-dialog-title").textContent="تعديل دواء";
  $("drug-id").value=d.id;$("name-en").value=d.commercial_name_en||"";$("name-ar").value=d.commercial_name_ar||"";
  $("scientific-name").value=d.scientific_name||"";$("manufacturer").value=d.manufacturer||"";$("drug-class").value=d.drug_class||"";
  $("route").value=d.route||"";$("price").value=d.price_egp??"";$("dosage").value=d.dosage||"";$("drug-error").textContent="";$("drug-dialog").showModal();
}
function resetDrug(){
  $("drug-dialog-title").textContent="إضافة دواء";$("drug-id").value="";
  ["name-en","name-ar","scientific-name","manufacturer","drug-class","route","price","dosage"].forEach(id=>$(id).value="");
  $("drug-error").textContent="";$("drug-dialog").showModal();
}
async function saveDrug(e){
  e.preventDefault();
  const raw=$("price").value.trim(),price=raw===""?null:Number(raw);
  if(price!==null&&(!Number.isFinite(price)||price<0)){$("drug-error").textContent="السعر غير صحيح.";return}
  const p={
    commercial_name_en:$("name-en").value.trim(),commercial_name_ar:$("name-ar").value.trim(),
    scientific_name:$("scientific-name").value.trim(),manufacturer:$("manufacturer").value.trim(),
    drug_class:$("drug-class").value.trim(),route:$("route").value.trim(),price_egp:price,dosage:$("dosage").value.trim()
  };
  const id=$("drug-id").value,r=id?await client.from("drugs").update(p).eq("id",id):await client.from("drugs").insert(p);
  if(r.error){$("drug-error").textContent="تعذر الحفظ: "+r.error.message;return}
  $("drug-dialog").close();say(id?"تم تعديل الدواء.":"تمت إضافة الدواء.");await loadDrugs();await loadDashboard();
}
async function saveArabicInline(id,input){
  const value=input.value.trim();
  input.disabled=true;
  const r=await client.from("drugs").update({commercial_name_ar:value}).eq("id",id);
  input.disabled=false;
  if(r.error){say("تعذر حفظ الاسم العربي: "+r.error.message,true);return}
  say("تم حفظ الاسم العربي.");
  await loadDrugs();
  await loadDashboard();
}
async function deleteDrug(id){
  const r=await client.from("drugs").select("commercial_name_en").eq("id",id).maybeSingle();
  if(!r.data||!confirm("حذف \""+r.data.commercial_name_en+"\" نهائيًا؟"))return;
  const x=await client.from("drugs").delete().eq("id",id);
  if(x.error){say("تعذر الحذف: "+x.error.message,true);return}
  say("تم حذف الدواء.");await loadDrugs();await loadDashboard();
}
async function openIngredient(key){
  const r=await client.from("active_ingredient_medical_info").select("ingredient_key,display_name,uses,dosage,side_effects,contraindications,source_url,source_name").eq("ingredient_key",key).maybeSingle();
  if(r.error){say("تعذر تحميل المعلومات الطبية: "+r.error.message,true);return}
  const list=await client.rpc("list_active_ingredients",{p_search:key,p_limit:200,p_offset:0});
  const m=(list.data||[]).find(x=>x.ingredient_key===key);
  $("ingredient-dialog-title").textContent=r.data?.display_name||key;$("ingredient-key").value=key;
  $("ingredient-display-name").value=r.data?.display_name||key;$("ingredient-uses").value=(r.data?.uses||[]).join("\n");$("ingredient-dosage").value=(r.data?.dosage||[]).join("\n");
  $("ingredient-side-effects").value=(r.data?.side_effects||[]).join("\n");$("ingredient-contraindications").value=(r.data?.contraindications||[]).join("\n");$("ingredient-source-url").value=r.data?.source_url||"";
  $("ingredient-source-name").value=r.data?.source_name||"";$("ingredient-product-count").textContent=m?num(m.product_count)+" منتج يستخدم هذه المادة الفعالة":"";
  $("ingredient-error").textContent="";$("ingredient-dialog").showModal();
}
async function saveIngredient(e){
  e.preventDefault();
  const key=$("ingredient-key").value.trim(),name=$("ingredient-display-name").value.trim();
  if(!key||!name){$("ingredient-error").textContent="اسم المادة الفعالة مطلوب.";return}
  const r=await client.from("active_ingredient_medical_info").upsert({
    ingredient_key:key,display_name:name,uses:lines($("ingredient-uses").value),dosage:lines($("ingredient-dosage").value),side_effects:lines($("ingredient-side-effects").value),contraindications:lines($("ingredient-contraindications").value),
    source_url:$("ingredient-source-url").value.trim()||null,source_name:$("ingredient-source-name").value.trim()||null
  },{onConflict:"ingredient_key"});
  if(r.error){$("ingredient-error").textContent="تعذر حفظ المادة الفعالة: "+r.error.message;return}
  $("ingredient-dialog").close();say("تم حفظ المادة الفعالة وتحديثها مركزيًا.");await loadIngredients();await loadDashboard();
}
async function loadQuality(){
  try{
    const s=await stats();
    $("quality-stats").innerHTML=[
      statCard("languages","أسماء عربية ناقصة",s.missing_arabic,"تحتاج إضافة اسم عربي"),
      statCard("flask-conical","مواد فعالة ناقصة",s.missing_scientific,"تحتاج مراجعة المادة الفعالة"),
      statCard("tag","أسعار ناقصة",s.missing_price,"تحتاج تحديث السعر"),
      statCard("heart-pulse","مكونات بمعلومات طبية",s.ingredients_with_medical,"المعلومات المركزية المكتملة")
    ].join("");
    $("quality-table").innerHTML=[
      ["أسماء عربية ناقصة",s.missing_arabic,"إضافة الاسم العربي تحسن البحث والعرض في التطبيق.","warn"],
      ["مواد فعالة ناقصة",s.missing_scientific,"لا يمكن ربط المنتج بمادة فعالة بدون قيمة واضحة.","warn"],
      ["أسعار ناقصة",s.missing_price,"المنتج سيظهر بدون سعر مسجل.","warn"],
      ["معلومات طبية مركزية مكتملة",s.ingredients_with_medical,"هذه هي المعلومات المشتركة التي يمكن عرضها لكل المنتجات التابعة للمادة.","ok"]
    ].map(x=>'<div class="quality-item"><div><strong>'+x[0]+'</strong><span>'+x[2]+'</span></div><strong>'+num(x[1])+'</strong><span class="badge '+x[3]+'">'+(x[3]==="ok"?"جيد":"مراجعة")+"</span></div>").join("");
    icons();
  }catch(e){say("تعذر تحميل جودة البيانات: "+e.message,true)}
}
function attach(){
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  document.querySelectorAll("[data-go-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.goView)));
  $("refresh-all").addEventListener("click",()=>setView(document.querySelector(".nav-item.active")?.dataset.view||"dashboard"));
  $("refresh-quality").addEventListener("click",loadQuality);$("export-arabic-names").addEventListener("click",exportArabicNames);
  $("database-search").addEventListener("input",()=>{clearTimeout(drugSearchTimer);drugSearchTimer=setTimeout(()=>{databasePage=0;loadDatabase()},250)});
  $("database-save-all").addEventListener("click",saveDatabase);
  $("database-prev").addEventListener("click",()=>{if(databasePage>0){databasePage--;loadDatabase()}});
  $("database-next").addEventListener("click",()=>{if(databaseHasMore){databasePage++;loadDatabase()}});
  $("add-drug").addEventListener("click",resetDrug);$("add-drug-2").addEventListener("click",resetDrug);
  $("drug-form").addEventListener("submit",saveDrug);
  $("drug-prev").addEventListener("click",()=>{if(drugPage>0){drugPage--;loadDrugs()}});
  $("drug-next").addEventListener("click",()=>{if(drugHasMore){drugPage++;loadDrugs()}});
  $("clear-drug-search").addEventListener("click",()=>{$("drug-search").value="";$("missing-arabic-only").checked=false;missingArabicOnly=false;drugPage=0;loadDrugs()});
  $("missing-arabic-only").addEventListener("change",e=>{missingArabicOnly=e.target.checked;drugPage=0;loadDrugs()});
  $("drug-search").addEventListener("input",()=>{clearTimeout(drugSearchTimer);drugSearchTimer=setTimeout(()=>{drugPage=0;loadDrugs()},250)});
  $("sign-out").addEventListener("click",async()=>{await client.auth.signOut();$("app").hidden=true;$("login-view").hidden=false});
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
  $("drugs-body").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;if(b.dataset.action==="edit-drug")openDrug(b.dataset.id);if(b.dataset.action==="delete-drug")deleteDrug(b.dataset.id);if(b.dataset.action==="save-arabic"){const input=$("drugs-body").querySelector(`.arabic-inline[data-id="${b.dataset.id}"]`);if(input)saveArabicInline(b.dataset.id,input)}});
  $("login-form").addEventListener("submit",async e=>{e.preventDefault();$("login-error").textContent="";const r=await client.auth.signInWithPassword({email:$("login-email").value.trim(),password:$("login-password").value});if(r.error){$("login-error").textContent="تعذر تسجيل الدخول. راجع البريد وكلمة المرور.";return}await openApp(r.data.session)})
}
async function start(){client=window.supabase.createClient(CONFIG.url,CONFIG.key);attach();icons();const r=await client.auth.getSession();if(r.error){$("login-error").textContent="تعذر استعادة الجلسة.";return}if(r.data.session)await openApp(r.data.session)}
start();