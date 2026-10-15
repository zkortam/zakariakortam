/**
 * The room light follows the real time in San Jose, whatever the visitor's timezone.
 *
 * Two numbers, written to <html> as custom properties before first paint and refreshed every five minutes:
 *   --tod-warm   0..1  amber in the light (peaks after sunrise, a little again at golden hour)
 *   --tod-night  0..1  how far the glow is turned down (deepest late at night)
 * Midday is 0 and 0, which is the room exactly as designed. CSS only ever mixes the existing pre-dithered
 * textures by opacity with these values, so there is no banding and no paint cost beyond an opacity change.
 *
 * Kept as a plain inline script (no React) so it runs before the first frame and never causes a flash.
 */

// [hour in America/Los_Angeles, warm, night]
const KEYS: [number, number, number][] = [
  [0, 0, 1],
  [4.5, 0, 1],
  [6, 0.55, 0.5],
  [7.5, 1, 0.1],
  [9.5, 0.55, 0],
  [11.5, 0, 0],
  [16, 0, 0],
  [18, 0.45, 0.12],
  [19.5, 0.2, 0.6],
  [21.5, 0, 1],
  [24, 0, 1],
]

export const TOD_SCRIPT = `(function(){var K=${JSON.stringify(KEYS)};var d=document.documentElement;var f;try{f=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'numeric',hourCycle:'h23'})}catch(e){return}
function hour(){var h=0,m=0;f.formatToParts(new Date()).forEach(function(p){if(p.type==='hour')h=+p.value%24;if(p.type==='minute')m=+p.value});return h+m/60}
function set(){var h=hour(),i=0;while(i<K.length-2&&h>=K[i+1][0])i++;var a=K[i],b=K[i+1],t=(h-a[0])/(b[0]-a[0]);t=t*t*(3-2*t);
d.style.setProperty('--tod-warm',(a[1]+(b[1]-a[1])*t).toFixed(3));d.style.setProperty('--tod-night',(a[2]+(b[2]-a[2])*t).toFixed(3));d.dataset.tod=h<5||h>=21?'night':h<10?'morning':h<17?'day':'evening'}
set();setInterval(set,300000);document.addEventListener('visibilitychange',function(){if(!document.hidden)set()})})();`
