import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyCollections, mergeCollectionEvent, mergeCollectionSnapshots, normalizeProfile } from '../utils/tinderCollectionsModel';
let current = { data:null, own:null, loading:false, syncing:false, error:null, syncError:null, lastSyncedAt:0 };
let token=null, generation=0, baseUrl=null, serial=Promise.resolve(), activation=null, syncTimer=null;
const listeners=new Set();
const publish=patch=>{current={...current,...patch};listeners.forEach(fn=>fn(current));};
const key=id=>'@flint_collections_v1:'+id;
async function request(url, sessionToken, options={}) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try { const r=await fetch(url,{...options,signal:controller.signal,headers:{'Content-Type':'application/json','x-auth-token':sessionToken,...options.headers}}); if(!r.ok)throw new Error('Request failed ('+r.status+')');return await r.json(); } finally {clearTimeout(timer);}
}
export const getCollections=()=>current;
export const subscribeCollections=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export function configureCollectionBackend(url) {
  // Never send a Tinder credential to a plaintext remote server.
  if(!url){baseUrl=null;return;}
  try {const parsed=new URL(url);baseUrl=parsed.protocol==='https:'||['localhost','127.0.0.1','10.0.2.2'].includes(parsed.hostname)?url.replace(/\/$/,''):null;}catch{baseUrl=null;}
}
export function disconnectCollections(){generation++;token=null;activation=null;clearTimeout(syncTimer);publish({data:null,own:null,loading:false,syncing:false,error:null,syncError:null,lastSyncedAt:0});}
export async function activateCollections(sessionToken) {
  if(!sessionToken){disconnectCollections();return;}
  if(token===sessionToken&&activation)return activation;
  if(token===sessionToken&&current.data)return;
  token=sessionToken;const run=++generation;publish({data:null,own:null,loading:true,error:null,syncError:null,lastSyncedAt:0});
  activation=(async()=>{
    try {
      const payload=await request('https://api.gotinder.com/v2/profile?include=user',sessionToken);
      const own=normalizeProfile(payload?.data?.user);if(!own)throw new Error('No account ID');
      const stored=await AsyncStorage.getItem(key(own.id));let data=emptyCollections(own.id);
      if(stored){try {const saved=JSON.parse(stored);if(saved.version===1&&saved.ownerId===own.id)data=saved;}catch{}}
      if(run!==generation)return;
      publish({data,own,loading:false,error:null});
      if(baseUrl) {
        try {const remote=await request(baseUrl+'/session-collections',sessionToken,{headers:{'x-tinder-token':sessionToken}});
          if(run!==generation)return;
          const merged=mergeCollectionSnapshots(current.data,remote.snapshot);
          await AsyncStorage.setItem(key(own.id),JSON.stringify(merged));if(run===generation)publish({data:merged});
        }catch{if(run===generation)publish({syncError:'Backend restore unavailable. Local data is still available.'});}
      }
      await refreshConversations();
    }catch{if(run===generation)publish({loading:false,error:'Unable to load your Tinder collections. Connect Tinder and try again.'});}
    finally{if(run===generation)activation=null;}
  })();return activation;
}
export function ingestCollectionEvent(event, sessionToken=token) {
  const run=generation;
  serial=serial.catch(()=>{}).then(async()=>{
    if(!current.data||sessionToken!==token||run!==generation)return;
    const data=mergeCollectionEvent(current.data,event);
    try {await AsyncStorage.setItem(key(data.ownerId),JSON.stringify(data));if(run!==generation)return;publish({data,error:null});clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCollections(),2000);}
    catch{if(run===generation)publish({error:'Could not save collection data on this device. Please free storage and retry.'});}
  });return serial;
}
export async function refreshConversations() {
  const run=generation, t=token;if(!current.data||!t)return;
  publish({loading:true,error:null});
  try {
    let pageToken=null,pages=0;const activeIds=[];
    do {
      const query='count=60&message=1'+(pageToken?'&page_token='+encodeURIComponent(pageToken):'');
      const result=await request('https://api.gotinder.com/v2/matches?'+query,t);
      if(run!==generation)return;
      const matches=result?.data?.matches;if(!Array.isArray(matches))throw new Error('Unsupported match response');
      activeIds.push(...matches.map(m=>m._id||m.id).filter(Boolean));
      await ingestCollectionEvent({kind:'matches',matches},t);
      pageToken=result?.data?.next_page_token;pages++;
    }while(pageToken&&pages<5);
    if(!pageToken&&run===generation)await ingestCollectionEvent({kind:'match_index',ids:activeIds},t);
    if(run===generation)publish({error:pageToken?'Showing the first 300 matches. Open additional Tinder conversations to capture their recent messages.':null});
    await syncCollections();
  }catch{if(run===generation)publish({error:'Could not refresh Tinder conversations. Saved data is still available; try again after reconnecting.'});}
  finally{if(run===generation)publish({loading:false});}
}
export async function syncCollections(){
  if(!current.data||!token||current.syncing)return;
  if(!baseUrl){publish({syncError:'Saved on this device. Configure an HTTPS backend to sync collections.'});return;}
  const run=generation, snapshot=current.data,t=token;
  publish({syncing:true,syncError:null});
  try {const response=await request(baseUrl+'/session-collections',t,{method:'POST',headers:{'x-tinder-token':t},body:JSON.stringify(snapshot)});if(!response.success)throw new Error('Sync failed');if(run===generation)publish({lastSyncedAt:Date.now(),syncError:null});}
  catch{if(run===generation)publish({syncError:'Saved on this device. Backend sync failed; tap Retry sync.'});}
  finally{if(run===generation)publish({syncing:false});}
}
