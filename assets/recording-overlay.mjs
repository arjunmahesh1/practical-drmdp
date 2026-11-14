let pending;
export function mergeRecordings(study,overlay){
  const additions=overlay.studies?.[study.id];if(!additions)return study;
  const replays={...study.replays};
  for(const [model,entries] of Object.entries(additions)){
    if(!study.models.includes(model))throw Error('Recording names an unavailable policy');
    for(const [key,path] of Object.entries(entries)){
      const [axisId,value]=key.split('|'),axis=study.axes.find(a=>a.id===axisId);
      if(!axis?.curves[model]?.some(p=>p.x===Number(value))||!['assets/isaac-recordings-20261105/','assets/isaac-recordings-20261114/'].some(prefix=>path.startsWith(prefix)))throw Error('Recording is outside the saved condition grid');
      if(replays[model]?.[key]&&replays[model][key]!==path)throw Error('Existing recording cannot be replaced by the overlay');
    }
    replays[model]={...replays[model],...entries};
  }
  return {...study,replays};
}
export async function recordingOverlay(){
  if(!pending)pending=fetch('data/recording-overlay.json?v=20261114-drawer1').then(r=>{if(!r.ok)throw Error('Recording index unavailable');return r.json();});
  return pending;
}
export async function withRecordings(study){return mergeRecordings(study,await recordingOverlay());}
export function libraryRecordingCoverage(library,overlay){
  return {...library,entries:library.entries.map(entry=>{
    const added=entry.cohorts.reduce((n,cohort)=>n+Object.values(overlay.studies?.[cohort.id]||{}).reduce((total,points)=>total+Object.keys(points).length,0),0);
    return added?{...entry,videoSelections:(entry.videoSelections||0)+added,recordingPending:false}:entry;
  })};
}
