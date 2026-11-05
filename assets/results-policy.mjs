export const archivedStudies=new Set(['td3_kl_physical_walker','td3_kl_context_walker','td3_kl_physical_halfcheetah']);
export const visibleStudy=study=>!archivedStudies.has(typeof study==='string'?study:study.id);
export const suppliedEnvironments=[
  {id:'doublependulum',name:'DoublePendulum',dataset:'json'},
  {id:'pendulum',name:'Pendulum',dataset:'json 2'}
].map(e=>({...e,framework:'Version / algorithm unconfirmed',simulator:'Backend unconfirmed',taskIds:[e.name],stage:'supplied',cohorts:[],recordingPending:true,videoSelections:0,
  report:'reports/return-reliability/index.html?v=20261104-flow1&dataset='+encodeURIComponent(e.dataset)+'&view=returns&embed=1'}));
