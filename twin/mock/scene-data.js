export const DEMO_RULES={maxReportAgeMs:5*60*1000,climate:{temperatureMax:26,humidityMax:60},inspector:{plannedCount:4,schedule:['08:00','09:00','12:00','16:00']}};
// 本文件仅为演示数据。房间与节点标识均来自原 REQ013 data/iot-nodes.json，场景关联与结果为评审样例。
export const ROOM_NAMES={'101':'接待大厅','102':'智能样品室','103':'智能力学室','104':'控制室','105':'智能高压室','106':'无人化电缆试验区','107':'材料试验区','108':'环境试验区','109':'综合试验区','110':'数智化电气试验区'};
export const NODE_TYPES={motion:'人体感应',camera:'视觉',temperature:'温湿度',light:'光照',smoke:'烟雾',gas:'可燃气体',water:'水浸',switch:'开关量'};
// DEMO-CLIMATE-102-TEMP-01 explicitly links the two existing temperature records for this presentation only.
export const SCENES=[
 {id:'climate',purpose:'同时监测多个试验区域的温湿度，超出设定范围及时提醒，减少人工逐间检查。',name:'实验室恒温恒湿保障',short:'恒温恒湿',icon:'thermometer',subtitle:'稳定环境 · 保障试验条件',duration:28000,accent:'#1676e9',
 hero:{label:'符合要求的监测点',value:'4 / 4',unit:'个监测点',description:'所有演示监测点均处于设定范围内'},
 metrics:[['覆盖房间','4 间'],['异常监测点','0 个'],['最高温度','25.2℃'],['最高湿度','56%RH']],
 rules:[['温度要求',`不高于 ${DEMO_RULES.climate.temperatureMax}℃`],['湿度要求',`不高于 ${DEMO_RULES.climate.humidityMax}%RH`],['异常响应','超限提醒 / 记录']],conclusion:'当前演示中的四个监测点均符合配置要求。',
 footnote:'原工程共有 4 个温湿度节点；阈值、读数和规则结果为模拟。',
 rooms:[{id:'102',nodeIds:['IOT-102-TH-01'],result:'样品室 23.6℃ / 52%RH，满足演示阈值',eventTitle:'样品室温度超限',action:'模拟：App 预警通知'},{id:'106',nodeIds:['IOT-106-TH-02'],result:'电缆试验区 24.1℃ / 54%RH，满足演示阈值',eventTitle:'试验区温度超限',action:'模拟：App 预警通知'},{id:'107',nodeIds:['IOT-107-TH-03'],result:'材料试验区 25.2℃ / 56%RH，满足演示阈值',eventTitle:'材料区温度超限',action:'模拟：记录温度异常'},{id:'108',nodeIds:['IOT-108-TH-04'],result:'环境试验区 24.6℃ / 51%RH，满足演示阈值',eventTitle:'环境区湿度超限',action:'模拟：App 提醒并生成执行日志'}],
 history:[{incidentId:'DEMO-CLIMATE-102-TEMP-01',incidentStep:2,summary:'温度恢复至 25.1℃',room:'102',time:'10-23 10:06',title:'温度恢复至设定范围',detail:'此前温度超限演示事件结束，恢复值 25.1℃',type:'recovered',action:'模拟：通知已记录'},{incidentId:'DEMO-CLIMATE-102-TEMP-01',incidentStep:1,room:'102',time:'10-23 09:48',title:'样品室温度超限',detail:'温度达到 26.8℃，触发温度上限规则',type:'warning',action:'模拟：异常通知已记录'},{room:'108',time:'10-22 16:32',title:'湿度超限提醒',detail:'相对湿度达到 62%RH，超过示例上限',type:'warning',action:'模拟：异常通知已记录'}]},
 {id:'safety',purpose:'发现重点区域人员活动以及烟雾、可燃气体和浸水异常，及时提醒并保留记录。',name:'实验室智能安全防护',short:'智能安全防护',icon:'shield-check',subtitle:'人员活动 · 危险源监测',duration:32000,accent:'#2881db',
 hero:{label:'当前待关注风险',value:'0',unit:'项',description:'当前演示状态未发现待处理告警'},
 metrics:[['涉及房间','5 间'],['监测风险','4 类'],['人员活动提醒','未触发'],['需处理事件','0 条']],
 rules:[['危险源监测','烟雾 / 气体 / 浸水'],['重点区域','人员活动时提醒'],['规则执行','通知 / 拍照（按配置）']],conclusion:'当前无待处理的模拟风险告警；存在历史事件记录。',
 footnote:'人体感应只能检测活动，不支持判定访客身份或视觉电子围栏。',
 rooms:[{id:'104',nodeIds:['IOT-104-SMOKE-01'],result:'控制室未检测到烟雾',eventTitle:'控制室检测到烟雾',action:'模拟：通知提醒'},{id:'105',nodeIds:['IOT-105-PIR-02','IOT-105-CAM-02'],result:'高压区域人员活动监测中，关联视觉拍照条件可配',eventTitle:'高压室人员活动提醒',action:'模拟：语音提醒 / 拍照 / App 通知'},{id:'106',nodeIds:['IOT-106-GAS-01','IOT-106-CAM-03'],result:'电缆试验区可燃气体监测正常',eventTitle:'检测到可燃气体',action:'模拟：通知 / 现场画面记录'},{id:'108',nodeIds:['IOT-108-WATER-01'],result:'环境试验区未检测到浸水',eventTitle:'检测到浸水',action:'模拟：异常通知'},{id:'110',nodeIds:['IOT-110-SMOKE-02'],result:'电气试验区未检测到烟雾',eventTitle:'电气试验区烟雾报警',action:'模拟：异常通知'}],
 history:[{room:'105',time:'10-23 08:47',title:'高压室检测到人员活动',detail:'人体感应触发，关联拍照动作有演示执行记录',type:'record',action:'模拟：拍照 / App 通知'},{room:'106',time:'10-22 14:36',title:'可燃气体异常已恢复',detail:'试验区历史异常结束，恢复正常感知',type:'recovered',action:'模拟：恢复记录'},{room:'106',time:'10-22 14:22',title:'可燃气体异常提醒',detail:'试验区气体感应触发告警规则',type:'warning',action:'模拟：通知提醒'}]},
 {id:'visitor',purpose:'感知接待区域的人员活动并记录发生时间，便于了解入口使用情况。',name:'访客来访与出入留痕',short:'访客来访',icon:'contact-round',subtitle:'入口活动 · 来访留痕',duration:20000,accent:'#3b84d8',
 hero:{label:'入口感应状态',value:'在线',unit:'1 个点位',description:'接待大厅人体感应节点保持在线（模拟）'},
 metrics:[['入口活动记录','2 条'],['开门记录','待接入'],['门禁控制','待接入'],['身份识别','不支持']],
 rules:[['入口活动','有人移动时记录'],['通知动作','按规则通知（模拟）'],['门状态 / 开门','待接入门禁或门状态数据']],conclusion:'可演示入口活动留痕；开门控制与访客身份信息尚无现有数据源。',
 footnote:'当前 101 房间仅有人体和光照节点；人体感应次数不等于访客人数。',
 rooms:[{id:'101',nodeIds:['IOT-101-PIR-01'],result:'入口感应可记录人员活动；开门、授权和身份均待接入',eventTitle:'接待大厅出现人员活动',action:'模拟：记录活动时间、发出通知'}],
 history:[{room:'101',time:'10-23 13:42',title:'接待大厅入口有人活动',detail:'人体01 触发一次活动感应；不代表一位独立访客',type:'record',action:'模拟：入口活动记录'},{room:'101',time:'10-23 10:24',title:'入口活动感应记录',detail:'人体节点记录到现场移动，无人员身份信息',type:'record',action:'模拟：记录触发时间'}]},
 {id:'inspector',purpose:'按计划对重点试验区域进行现场抓拍并留痕，辅助远程查看与日常巡查。',name:'虚拟巡视员',short:'虚拟巡视员',icon:'scan-eye',subtitle:'定时巡视 · 远程留痕',duration:28000,accent:'#1884aa',
 hero:{label:'今日计划执行',value:'3 / 4',unit:'次',description:'演示计划执行 3 次，另 1 次尚未到达计划时间'},
 metrics:[['巡视点位','4 处'],['拍照记录','3 组'],['执行失败','0 次'],['下次计划','16:00']],
 rules:[['巡视方式','按时触发现场拍照'],['记录方式','照片 / 执行日志'],['异常情况','执行失败或状态异常提醒']],conclusion:'支持展示规则触发后的拍照与执行日志；不等同于 AI 自动读表或异常识别。',
 footnote:'巡视计划及执行数字均为演示，实际对接需读取真实规则与执行日志。',
 rooms:[{id:'103',nodeIds:['IOT-103-CAM-01'],result:'力学室关联视觉拍照点位',eventTitle:'力学室巡视拍照记录',action:'模拟：定时拍照并记录'},{id:'105',nodeIds:['IOT-105-CAM-02'],result:'高压室关联视觉拍照点位',eventTitle:'高压室定时抓拍记录',action:'模拟：定时拍照并记录'},{id:'106',nodeIds:['IOT-106-CAM-03'],result:'电缆试验区关联视觉拍照点位',eventTitle:'电缆试验区定时抓拍记录',action:'模拟：定时拍照并记录'},{id:'109',nodeIds:['IOT-109-CAM-04'],result:'综合试验区关联视觉拍照点位',eventTitle:'综合试验区定时抓拍记录',action:'模拟：定时拍照并记录'}],
 history:[{room:'109',time:'10-23 12:00',title:'综合试验区定时拍照完成',detail:'视觉04 已生成演示拍照记录',type:'record',execution:'success',action:'模拟：定时拍照执行成功'},{room:'106',time:'10-23 09:00',displayTitle:'电缆试验区定时拍照',title:'电缆试验区巡视记录',detail:'视觉03 完成演示定时拍照',type:'record',execution:'success',action:'模拟：定时拍照执行成功'},{room:'103',time:'10-23 08:00',displayTitle:'力学室定时拍照',title:'力学室巡视记录',detail:'视觉01 完成演示定时拍照',type:'record',execution:'success',action:'模拟：定时拍照执行成功'}]}
];
