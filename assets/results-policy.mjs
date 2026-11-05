export const archivedStudies=new Set(['td3_kl_physical_walker','td3_kl_context_walker','td3_kl_physical_halfcheetah']);
export const visibleStudy=study=>!archivedStudies.has(typeof study==='string'?study:study.id);
export const suppliedEnvironments=[
  {id:'doublependulum',name:'Inverted Double Pendulum',dataset:'json',settingCount:10,axisCount:8},
  {id:'pendulum',name:'Inverted Pendulum',dataset:'json 2',settingCount:10,axisCount:7}
].map(e=>({...e,framework:'',simulator:'',taskIds:[e.name.replaceAll(' ','')],stage:'supplied',cohorts:[],recordingPending:true,videoSelections:0,
  report:'reports/return-reliability/index.html?v=20261105-flat1&dataset='+encodeURIComponent(e.dataset)+'&view=returns&embed=1'}));
export const resultEnvironments=entries=>entries.filter(e=>e.cohorts.length||e.report);
