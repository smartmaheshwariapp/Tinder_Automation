// Injected before Tinder scripts. Observe only successful requests; never trigger swipes/messages.
export function installCollectionCapture() {
  if(window.__flintCollectionCapture)return;window.__flintCollectionCapture=true;
  const profiles=new Map();
  const emit=(event,sessionToken)=>{try{window.ReactNativeWebView?.postMessage(JSON.stringify({type:'FE_COLLECTION_EVENT',event,sessionToken}));}catch{}};
  const remember=raw=>{const p=raw?.user||raw?.person||raw;if(p?._id){profiles.set(p._id,p);if(profiles.size>500)profiles.delete(profiles.keys().next().value);}};
  const inspect=(url,method,data,sessionToken)=>{
    try {
      const parsed=new URL(url,location.href);if(parsed.hostname!=='api.gotinder.com')return;
      const path=parsed.pathname;
      if(path.includes('/recs'))(data?.data?.results||data?.results||[]).forEach(remember);
      if(path==='/v2/matches') {const matches=data?.data?.matches||[];matches.forEach(m=>remember(m.person));emit({kind:'matches',matches},sessionToken);}
      const messages=path.match(/^\/v2\/matches\/([^/]+)\/messages/);
      if(messages)emit({kind:'messages',matchId:messages[1],messages:data?.data?.messages||data?.messages||(data?._id?[data]:[])},sessionToken);
      const swipe=path.match(/^\/(like|pass)\/([^/]+)/);
      if(swipe&&data?.error==null&&data?.status!==429&&data?.rate_limited!==true)emit({kind:'swipe',action:swipe[1],profileId:swipe[2],profile:profiles.get(swipe[2])||{_id:swipe[2]},matched:Boolean(data.match),timestamp:Date.now()},sessionToken);
    }catch{}
  };
  const original=window.fetch;
  window.fetch=async function(input,init){const headers=new Headers(init?.headers||input?.headers||{});const sessionToken=headers.get('x-auth-token')||window.__tinderAuthToken;const response=await original.apply(this,arguments);if(response.ok){const url=typeof input==='string'?input:input?.url;response.clone().json().then(data=>inspect(url,init?.method||input?.method||'GET',data,sessionToken)).catch(()=>{});}return response;};
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(method,url){this.__flintCollectionRequest={method,url};return open.apply(this,arguments);};
  XMLHttpRequest.prototype.send=function(){const sessionToken=window.__tinderAuthToken;this.addEventListener('load',()=>{try{if(this.status>=200&&this.status<300){const data=this.responseType==='json'?this.response:JSON.parse(this.responseText);inspect(this.__flintCollectionRequest?.url,this.__flintCollectionRequest?.method,data,sessionToken);}}catch{}});return send.apply(this,arguments);};
}
export const collectionCaptureScript='('+installCollectionCapture.toString()+')();true;';
