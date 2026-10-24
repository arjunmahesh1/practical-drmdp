export function segmentWindow(replay) {
  const start=replay.videoSegment?.start??0;
  const fps=replay.videoSegment?.fps??replay.fps;
  const duration=replay.videoSegment?.duration??replay.timeline.length/fps;
  if(!Number.isFinite(start)||start<0||!Number.isFinite(fps)||fps<=0||!Number.isFinite(duration)||duration<=0)throw Error('Invalid recorded-video segment');
  return {start,end:start+duration,fps};
}
export function segmentFrame(replay,time) {
  const {start,fps}=segmentWindow(replay);
  return Math.max(0,Math.min(replay.timeline.length-1,Math.floor((time-start)*fps+1e-5)));
}
export function segmentTime(replay,frame) {
  const {start,fps}=segmentWindow(replay);
  return start+Math.max(0,Math.min(replay.timeline.length-1,frame))/fps;
}
export function segmentSource(replay) {
  if(!replay.videoSegment)return replay.video;
  const {start,end}=segmentWindow(replay);
  return replay.video.split('#')[0]+'#t='+start.toFixed(6)+','+end.toFixed(6);
}
