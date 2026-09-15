'use strict';
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(process.env.FLINT_COLLECTIONS_DIR || path.join(__dirname, '../../data/collections'));
const queues = new Map();
const str = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const time = value => Number.isFinite(value) && value >= 0 ? Math.min(value, Date.now() + 60000) : 0;
const items = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value).slice(0,500) : [];
function sanitize(input, ownerId) {
  const profiles={},swipes={},conversations={};
  for(const p of items(input.profiles)){const id=str(p.id,100);if(!id)continue;profiles[id]={id,name:str(p.name,100),bio:str(p.bio,500),photos:(p.photos||[]).filter(u=>typeof u==='string'&&u.startsWith('https://')).slice(0,3),interests:(p.interests||[]).filter(x=>typeof x==='string').slice(0,30).map(x=>str(x,80)),languages:(p.languages||[]).filter(x=>typeof x==='string').slice(0,30).map(x=>str(x,80)),lookingFor:str(p.lookingFor,100),seenAt:time(p.seenAt)};}
  for(const s of items(input.swipes)){const id=str(s.profileId,100);if(id&&['like','pass'].includes(s.action))swipes[id]={profileId:id,action:s.action,swipedAt:time(s.swipedAt),matched:!!s.matched};}
  for(const c of items(input.conversations)){const id=str(c.id,150),profileId=str(c.profileId,100);if(!id||!profileId)continue;conversations[id]={id,profileId,archived:!!c.archived,lastActivityAt:time(c.lastActivityAt),observedAt:time(c.observedAt),messages:(Array.isArray(c.messages)?c.messages:[]).slice(0,10).map(m=>({id:str(m.id,150),text:str(m.text,1000),senderId:str(m.senderId,100),sentAt:time(m.sentAt)})).filter(m=>m.id)};}
  return {version:1,ownerId,profiles,swipes,conversations,updatedAt:Date.now()};
}
function merge(previous, incoming) {
 const next={...incoming};
 for(const [field,stamp] of [['profiles','seenAt'],['swipes','swipedAt'],['conversations','observedAt']]){
  const combined={...previous[field]};for(const [id,value]of Object.entries(incoming[field]))if(!combined[id]||(value[stamp]||0)>=(combined[id][stamp]||0))combined[id]=value;
  next[field]=Object.fromEntries(Object.entries(combined).sort((a,b)=>(b[1][stamp]||0)-(a[1][stamp]||0)).slice(0,500));
 }return next;
}
async function authenticate(token) {
 if(!token||token.length>2048)throw new Error('Unauthorized');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try {const response=await fetch('https://api.gotinder.com/v2/profile?include=user',{headers:{'x-auth-token':token},signal:controller.signal});if(!response.ok)throw new Error('Unauthorized');const data=await response.json();const id=data?.data?.user?._id;if(typeof id!=='string'||!id)throw new Error('Unauthorized');return id;}finally{clearTimeout(timer);}
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)throw new Error('Too large');body+=chunk;}return JSON.parse(body);}
async function handleSessionCollections(req,res) {
 let owner;try{owner=await authenticate(req.headers['x-tinder-token']);}catch{return send(res,401,{success:false,error:'A valid Tinder session is required.'});}
 const filename=path.join(root,crypto.createHash('sha256').update(owner).digest('hex')+'.json');
 if(req.method==='GET'){
  try {const data=JSON.parse(await fs.readFile(filename,'utf8'));return send(res,200,{success:true,snapshot:data});}catch(e){return send(res,e.code==='ENOENT'?200:500,{success:e.code==='ENOENT',snapshot:null});}
 }
 if(req.method!=='POST')return send(res,405,{success:false});
 let data;try{const body=await readBody(req);if(body.ownerId!==owner)return send(res,403,{success:false,error:'Account mismatch.'});data=sanitize(body,owner);}catch{return send(res,400,{success:false,error:'Invalid collection data.'});}
 const previous=queues.get(owner)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  await fs.mkdir(root,{recursive:true,mode:0o700});let old={};try{old=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const snapshot=merge(old,data),temp=filename+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(snapshot),{mode:0o600});await fs.rename(temp,filename);}finally{await fs.unlink(temp).catch(()=>{});}
 });queues.set(owner,task);
 try{await task;send(res,200,{success:true,savedAt:Date.now()});}catch{send(res,500,{success:false,error:'Could not persist collections.'});}finally{if(queues.get(owner)===task)queues.delete(owner);}
}
module.exports={handleSessionCollections,sanitize,merge};

