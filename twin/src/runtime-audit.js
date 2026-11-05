// Read-only diagnostics for offline handoff. Never suppress browser errors.
(()=>{
 const entries=[];
 function record(entry){entries.push({...entry,at:new Date().toISOString()});if(entries.length>30)entries.shift();let el=document.getElementById('req013-runtime-errors');if(!el){el=document.createElement('script');el.id='req013-runtime-errors';el.type='application/json';(document.body||document.documentElement)?.append(el);}if(el)el.textContent=JSON.stringify(entries);}
 window.addEventListener('error',event=>{if(event.message)record({message:event.message,file:event.filename,line:event.lineno,stack:event.error?.stack||''});});
 window.addEventListener('unhandledrejection',event=>record({message:String(event.reason?.message||event.reason),stack:event.reason?.stack||''}));
})();
