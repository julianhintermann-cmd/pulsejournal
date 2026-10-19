/**
 * Runs in <head> before the first paint (inline, so it cannot flash):
 * - `data-standalone` on <html> when the app was opened from the home screen,
 * - `--dt`: the iOS Dynamic Type scale (user text size / 17 px, clamped), read from `font: -apple-system-body`,
 * - `data-reduce-transparency` when the in-app "Transparenz reduzieren" switch is on.
 */
export const IOS_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)d.setAttribute("data-standalone","");
if(window.CSS&&CSS.supports("font","-apple-system-body")){var p=document.createElement("span");
p.style.cssText="font:-apple-system-body;position:absolute;visibility:hidden";d.appendChild(p);
var s=parseFloat(getComputedStyle(p).fontSize)||17;p.remove();
d.style.setProperty("--dt",String(Math.min(1.35,Math.max(0.82,s/17))));}
try{if(localStorage.getItem("pulse.reduceTransparency")==="1")d.setAttribute("data-reduce-transparency","");}catch(e){}
}catch(e){}})();`;
