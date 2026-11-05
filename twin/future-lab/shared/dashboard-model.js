const LabNodeCatalog=await (await fetch(new URL('../data/iot-nodes.json',import.meta.url))).json();
import {ROOM_NAMES,baselineSnapshots} from '../iot/monitoring-data.js';
import {SCENARIOS} from '../iot/demo-scenarios.js';
// Read-only monitoring snapshot. Replace createSnapshot/trendSeries with API adapters at integration.
export const DashboardModel = (() => {
  const types = ['温湿度','光照','可燃气体','烟雾','水浸','人体','开关量','视觉'];
  const groups = {'环境感知':['温湿度','光照'],'气体与烟雾':['可燃气体','烟雾'],'风险监测':['可燃气体','烟雾','水浸'],'行为联动':['人体','开关量']};
  // Internal prototype scope only. Production scope must follow monitoring configuration and active safety scenes.
  const mockMonitoringNodeIds = Object.freeze(LabNodeCatalog.nodes.map(n=>n.id));
  const pad = n => String(n).padStart(2,'0');
  const clockText = value => {const d=new Date(value);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const dateText = value => {const d=new Date(value);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const timestamp = value => `${dateText(value)} ${clockText(value)}:${pad(new Date(value).getSeconds())}`;
  const startOfDay = value => {const d=new Date(value);d.setHours(0,0,0,0);return d.getTime();};
  const isCurrentAlarm = n => n.online && n.dataState==='valid' && n.alarm;
  const status = n => !n.online ? '离线' : n.dataState!=='valid' ? '暂无数据' : isCurrentAlarm(n) ? '正在告警' : '正常';
  const stateClass = n => !n.online ? 'gray' : n.dataState!=='valid' ? 'amber' : isCurrentAlarm(n) ? 'red' : 'green';
  function valueText(n) {
    if(status(n)!=='正常') return isCurrentAlarm(n) ? (n.type==='水浸'?'检测到水浸':n.type==='烟雾'?'检测到烟雾':n.type==='可燃气体'?'浓度超限':'检测到异常') : status(n);
    if(n.type==='温湿度') return `${n.reading.temperature} ℃ / ${n.reading.humidity} % RH`;
    if(n.type==='光照') return `${n.reading.light} Lux`;
    if(n.type==='可燃气体') return n.values.exceeded?'浓度超限':'未检测到可燃气体';
    if(n.type==='烟雾') return n.values.detected?'检测到烟雾':'未检测到烟雾';
    if(n.type==='水浸') return '未检测到水浸';
    if(n.type==='人体') return n.values.activity?'检测到人体活动':'未检测到活动';
    if(n.type==='开关量') return switchChannelStates(n).map(({channel,state})=>`${channel} ${state}`).join(' · ');
    return videoStatus(n)==='画面正常'?'监控画面':videoStatus(n);
  }
  // Each channel has its own reported boolean; never infer four states from one contact.
  function switchChannelStates(n) {
    return ['IN1','IN2','OUT1','OUT2'].map(channel=>({channel,state:!n.online?'离线':n.dataState!=='valid'?'暂无数据':typeof n.values.channels?.[channel]==='boolean'?(n.values.channels[channel]?'开':'关'):'暂无数据'}));
  }
  // Channel labels belong to each event, not to inferred node readings.
  function switchEventText(channel,from,to) {
    if(!/^(IN[12]|OUT[12])$/.test(channel))return '';
    return `${channel} ${channel.startsWith('IN')?'输入':'输出'}由${from}变为${to}`;
  }
  function videoStatus(n) {
    if(!n.online) return '节点离线';
    if(n.videoState==='error') return '画面加载失败';
    if(n.dataState!=='valid') return '暂无视频数据';
    return n.videoState==='ready'?'画面正常':'暂无视频流';
  }
  function situation(nodes) {
    if(nodes.some(isCurrentAlarm)) return {key:'alarm',title:'发现安全告警',description:'检测到安全告警，请关注现场情况'};
    if(nodes.some(n=>n.keyMonitoring&&!n.online)) return {key:'offline',title:'监测设备异常',description:'部分监测节点离线，监测覆盖受影响'};
    if(nodes.some(n=>n.keyMonitoring&&n.dataState!=='valid')) return {key:'nodata',title:'监测数据异常',description:'部分监测数据未更新，请检查采集状态'};
    return {key:'normal',title:'运行正常',description:'重点风险监测正常，当前无安全告警'};
  }
  function metrics(nodes) {
    const total=nodes.length,online=nodes.filter(n=>n.online).length;
    return {total,online,offline:total-online,types:new Set(nodes.map(n=>n.type)).size,rate:total?online/total:0,alarms:nodes.filter(isCurrentAlarm)};
  }
  function filterNodes(nodes,type) {return nodes.filter(n=>type==='all'||(groups[type]||[type]).includes(n.type));}
  function applyGatewayConnectivity({gateways,nodes}) {
    const byId=new Map(gateways.map(g=>[g.id,g]));
    const connected=(id,visited=new Set())=>{
      const gateway=byId.get(id);
      if(!gateway||!gateway.online||visited.has(id))return false;
      visited.add(id);
      return !gateway.parentId||connected(gateway.parentId,visited);
    };
    // Loss of upstream communication invalidates children. Recovery requires fresh child communication,
    // never a blanket online=true when a parent returns. Preserve gatewayId/parentId and historical data.
    const unavailable=new Set(gateways.filter(g=>!connected(g.id)).map(g=>g.id));
    for(const gateway of gateways)if(unavailable.has(gateway.id))gateway.online=false;
    for(const node of nodes)if(!byId.has(node.gatewayId)||unavailable.has(node.gatewayId))node.online=false;
  }
  function markVideoFailed({nodes},index) {
    const node=nodes.find(n=>n.type==='视觉'&&n.cameraIndex===index);
    if(!node||node.videoState==='error')return false;
    node.videoState='error';
    return true;
  }
  function createSnapshot(requested='normal',now=Date.now(),{monitoringNodeIds=mockMonitoringNodeIds}={}) {
    const mode=['normal','alarm','offline','nodata'].includes(requested)?requested:'normal';
    const today=startOfDay(now),elapsed=now-today;
    const monitoringScope={nodeIds:[...monitoringNodeIds]},criticalIds=new Set(monitoringScope.nodeIds);
    const samples=new Map(baselineSnapshots(LabNodeCatalog.nodes,now).map(s=>[s.nodeId,s]));
    const cameras=LabNodeCatalog.nodes.filter(n=>n.type==='camera');
    const names={temperature:'温湿度',light:'光照',gas:'可燃气体',smoke:'烟雾',water:'水浸',motion:'人体',switch:'开关量',camera:'视觉'};
    const scenario=SCENARIOS.find(s=>s.id===(mode==='alarm'?'water':mode==='offline'?'offline':'reset'));
    if(scenario.nodeId){const sample=samples.get(scenario.nodeId);Object.assign(sample,{status:scenario.status,values:structuredClone(scenario.values)});}
    const nodes=LabNodeCatalog.nodes.map(source=>{
      const sample=samples.get(source.id),values=sample.values;
      const reading=source.type==='temperature'?{temperature:values.temperature,humidity:values.humidity}:source.type==='light'?{light:values.illuminance}:source.type==='switch'?{input:values.contact==='closed'}:source.type==='motion'?{activity:values.activity}:values;
      return {...structuredClone(source),type:names[source.type],nodeType:source.type,area:`${source.roomId} ${ROOM_NAMES[source.roomId]}`,values,reading,online:sample.status!=='offline',dataState:'valid',alarm:sample.status==='alarm',status:sample.status,keyMonitoring:criticalIds.has(source.id),lastUpdated:Date.parse(sample.updatedAt),dataSource:'mock',gatewayId:['106','107','108'].includes(source.roomId)?'gateway-sub':'gateway-main',...(source.type==='camera'?{cameraIndex:cameras.findIndex(n=>n.id===source.id),videoState:'ready',visualSource:{kind:'demo-image',streamUrl:null}}:{})};
    });
    if(mode==='nodata')Object.assign(nodes.find(n=>n.name==='温湿度01'),{dataState:'stale',lastUpdated:now-30*60*1000});
    const gateways=[{id:'gateway-main',name:'安全管家主网关01',kind:'主网关',online:true},{id:'gateway-sub',parentId:'gateway-main',name:'安全管家子网关01',kind:'子网关',online:true}];
    const events=[];
    const add=(id,at,name,type,content,eventStatus,kind='')=>{
      const n=nodes.find(n=>n.name===name);
      events.push({id,at:Math.floor(at),nodeId:n.id,nodeName:n.name,area:n.area,type,content,status:eventStatus,kind});
    };
    add('today-human',today+elapsed*.98,'人体01','人体感知事件','检测到人体活动','已记录');
    add('today-switch',today+elapsed*.87,'开关量01','开关量状态变化',switchEventText('IN1','闭合','断开'),'已记录');
    add('today-restore',today+elapsed*.76,'烟雾01','告警恢复','未检测到烟雾，告警已恢复','已恢复','ok');
    add('today-alarm',today+elapsed*.65,'烟雾01','安全告警','检测到烟雾，随后已恢复','已恢复','ok');
    add('today-motion2',today+elapsed*.54,'人体02','人体感知事件','检测到人体活动','已记录');
    add('today-switch2',today+elapsed*.43,'开关量01','开关量状态变化',switchEventText('OUT1','闭合','断开'),'已记录');
    add('today-restored2',today+elapsed*.32,'可燃气体01','告警恢复','未检测到可燃气体，告警已恢复','已恢复','ok');
    add('today-gas',today+elapsed*.21,'可燃气体01','安全告警','检测到可燃气体，随后已恢复','已恢复','ok');
    for(let day=1;day<=6;day++) {
      // Local calendar dates avoid UTC/daylight-saving day boundaries.
      const d=new Date(today);d.setDate(d.getDate()-day);d.setHours(15,20,0,0);
      add(`history-${day}-motion`,d.getTime(),'人体01','人体感知事件','检测到人体活动','已记录');
      d.setHours(11,8,0,0);add(`history-${day}-switch`,d.getTime(),'开关量01','开关量状态变化',switchEventText('IN1','闭合','断开'),'已记录');
    }
    if(mode==='alarm') add('current-alarm',now,'水浸01','安全告警','检测到水浸','正在告警','bad');
    if(mode==='offline') add('current-offline',now,'温湿度01','设备离线','节点通讯中断，监测覆盖受影响','离线','attn');
    if(mode==='nodata') add('current-nodata',now,'温湿度01','监测数据异常','监测数据持续未更新','待恢复','attn');
    events.sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
    const snapshot={mode,now,nodes,gateways,events,monitoringScope};
    applyGatewayConnectivity(snapshot);
    return snapshot;
  }
  function eventsInRange(events,range,now) {
    const from=new Date(startOfDay(now));if(range==='7days') from.setDate(from.getDate()-6);
    return events.filter(e=>e.at>=from.getTime()&&e.at<=now).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
  }
  function trendSeries(period,now,node) {
    const spec=period==='1小时'?{duration:3600000,count:13}:period==='7天'?{duration:7*86400000,count:29}:{duration:86400000,count:49};
    return Array.from({length:spec.count},(_,index)=>{
      const at=now-spec.duration+(spec.duration*index/(spec.count-1));
      const invalid=node&&(!node.online||node.dataState!=='valid')&&(at>node.lastUpdated||at===now);
      const temperature=+((node?.values?.temperature??23.6)+.65*Math.sin((at-now)/3600000*.7)).toFixed(1);
      const humidity=+((node?.values?.humidity??52)+2.1*Math.sin((at-now)/3600000*.53)).toFixed(1);
      return {at,temperature:invalid?null:temperature,humidity:invalid?null:humidity};
    });
  }
  function fitSize(width,height) {const scale=Math.min(width/1920,height/1080);return {scale,left:(width-1920*scale)/2,top:(height-1080*scale)/2};}
  return {roomNames:ROOM_NAMES,types,groups,clockText,dateText,timestamp,startOfDay,isCurrentAlarm,status,stateClass,valueText,switchChannelStates,switchEventText,videoStatus,situation,metrics,filterNodes,applyGatewayConnectivity,markVideoFailed,createSnapshot,eventsInRange,trendSeries,fitSize};
})();
