import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const line of (fs.existsSync(path.join(root,'.env'))?fs.readFileSync(path.join(root,'.env'),'utf8'):'').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)process.env[line.slice(0,i).trim()]??=line.slice(i+1).trim();}
const names=['Завтрак в постель','Уборка без напоминаний','Ужин от детей','Семейный киновечер','День отдыха','Семейное желание'];
const stateFile=path.join(root,'redeemed.json');
let used=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):[];let busy=false;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{try{
const pass=process.env.SITE_PASSWORD;if(pass&&req.headers.authorization!== 'Basic '+Buffer.from('mama:'+pass).toString('base64')){res.writeHead(401,{'WWW-Authenticate':'Basic realm="MAMA"'});return res.end('Private family site');}
const url=new URL(req.url,'http://localhost');
if(url.pathname==='/api/coupons'&&req.method==='GET')return json(res,200,{used});
if(url.pathname==='/api/redeem'&&req.method==='POST'){
if(busy)return json(res,409,{error:'Попробуйте ещё раз'});busy=true;try{let body='';for await(const chunk of req){body+=chunk;if(body.length>1000)return json(res,413,{error:'Too large'});}const {id}=JSON.parse(body);if(!Number.isInteger(id)||!names[id])return json(res,400,{error:'Неизвестный сертификат'});if(used.includes(id))return json(res,409,{error:'Уже активирован'});
if(!process.env.BOT_TOKEN||!process.env.CHAT_ID)return json(res,503,{error:'Telegram пока не настроен'});
const response=await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.CHAT_ID,text:'MAMA Premium: активирован сертификат «'+names[id]+'»\n'+new Date().toLocaleString('ru-RU',{timeZone:'Europe/Samara'})}),signal:AbortSignal.timeout(10000)});const result=await response.json();if(!result.ok)return json(res,502,{error:'Не удалось отправить уведомление'});used.push(id);fs.writeFileSync(stateFile,JSON.stringify(used));return json(res,200,{used});}finally{busy=false;}}
if(req.method!=='GET')return json(res,405,{});const base=path.join(root,'public');const file=path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{});res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
}catch(e){json(res,500,{error:'Ошибка сервера'});}}).listen(process.env.PORT||3000,()=>console.log('MAMA: http://localhost:'+(process.env.PORT||3000)));
