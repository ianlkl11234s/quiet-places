// Both native inactivity (including lock screen) and document visibility can
// arrive independently. Never resume audio or simulation on a foreground event.
export function createMobileLifecycle(onSuspend:()=>void,onForeground:()=>void){
 let nativeActive=true,visible=true,inactive=false,disposed=false;
 function update(){
  if(disposed)return;
  const next=!nativeActive||!visible;
  if(next===inactive)return;
  inactive=next;
  if(next)onSuspend();else onForeground();
 }
 return {
  get inactive(){return inactive;},
  native(active:boolean){nativeActive=active;update();},
  document(visibleNow:boolean){visible=visibleNow;update();},
  dispose(){disposed=true;},
 };
}
