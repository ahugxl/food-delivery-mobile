import { leafletCss, leafletJavaScript } from './leafletBundle';
import { MAP_CHANNEL, MAP_COPYRIGHT_URL, scriptJson, type MapScene } from './leafletProtocol';

const DEFAULT_MAP_TILES = { template: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', origin: 'https://tile.openstreetmap.de', credit: 'OSM Deutschland' };

export function mapTilesConfig() {
  const template = process.env.EXPO_PUBLIC_MAP_TILE_URL || DEFAULT_MAP_TILES.template;
  try {
    const url = new URL(template.replace(/\{[zxy]\}/g, '0'));
    if (url.protocol !== 'https:' || url.username || url.password || !['{z}', '{x}', '{y}'].every(part => template.includes(part))) throw new Error();
    return { template, origin: url.origin, credit: process.env.EXPO_PUBLIC_MAP_TILE_CREDIT || (url.origin === DEFAULT_MAP_TILES.origin ? DEFAULT_MAP_TILES.credit : '') };
  } catch { return { ...DEFAULT_MAP_TILES }; }
}

export function leafletDocument(initial: MapScene, token: string) {
  const tiles = mapTilesConfig();
  const css = leafletCss.replace(/<\/style/gi, '<\\/style');
  const js = leafletJavaScript.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${tiles.origin} data: blob:; connect-src 'none'; font-src data:; base-uri 'none'; form-action 'none';" />
<style>${css}
html,body,#map{height:100%;width:100%;margin:0;padding:0;overflow:hidden;background:#EAF7EF;font-family:Arial,sans-serif}
.pin{background:transparent;border:0}.pin span{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px #0004;color:white;font-size:21px}
.leaflet-control-attribution{font-size:10px!important;max-width:90%;white-space:normal}.leaflet-control-attribution a{color:#005E30}.leaflet-control-zoom a{color:#005E30}
</style></head><body><div id="map" role="application" aria-label="Bản đồ chọn vị trí giao hàng"></div>
<script>${js}</script><script>
(function(){'use strict';
var token=${scriptJson(token)},channel=${scriptJson(MAP_CHANNEL)},scene=${scriptJson(initial)},tileConfig=${scriptJson(tiles)};
function send(type,coordinate){var value={channel:channel,token:token,type:type};if(coordinate)value.coordinate=coordinate;
 if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(value));else window.parent.postMessage(value,'*');}
function valid(p){return p&&typeof p.latitude==='number'&&typeof p.longitude==='number'&&isFinite(p.latitude)&&isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;}
function latlng(p){return [p.latitude,p.longitude];}
function equal(a,b){return a===b||!!a&&!!b&&a.latitude===b.latitude&&a.longitude===b.longitude;}
function icon(color,text){return L.divIcon({className:'pin',html:'<span style="background:'+color+'">'+text+'</span>',iconSize:[42,42],iconAnchor:[21,21]});}
try{
 var map=L.map('map',{zoomControl:false,attributionControl:true,zoom:15,center:latlng(scene.coordinate),maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1});
 L.control.zoom({zoomInTitle:'Phóng to',zoomOutTitle:'Thu nhỏ'}).addTo(map);
 map.attributionControl.setPrefix(false);
 var credit='&copy; <a href="${MAP_COPYRIGHT_URL}" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
 if(tileConfig.credit){var text=document.createElement('span');text.textContent=' · '+tileConfig.credit;credit+=text.innerHTML;}
 var layer=L.tileLayer(tileConfig.template,{maxZoom:19,minZoom:2,attribution:credit,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false}).addTo(map);
 var anyTiles=false;
 layer.on('tileload',function(){anyTiles=true;send('tiles-ready');});
 layer.on('load',function(){if(!anyTiles)send('tiles-error');});
 document.addEventListener('click',function(event){var anchor=event.target.closest&&event.target.closest('a');if(anchor&&window.ReactNativeWebView){event.preventDefault();send('attribution');}});
 var destination=L.marker(latlng(scene.coordinate),{draggable:scene.selectable,icon:icon('#FF6B55','●'),title:'Điểm giao hàng'}).addTo(map).bindTooltip('Điểm giao hàng');
 var restaurant=null,vehicle=null,route=null,animation=null;
 function select(point){if(!scene.selectable)return;point=point.wrap();var p={latitude:point.lat,longitude:point.lng};if(!valid(p))return;
  scene=Object.assign({},scene,{coordinate:p});destination.setLatLng(latlng(p));send('select',p);}
 destination.on('dragend',function(){select(destination.getLatLng());});
 map.on('click',function(event){select(event.latlng);});
 function routePoints(driver){return [latlng(scene.origin)].concat(driver?[driver]:[],[latlng(scene.coordinate)]);}
 function positionVehicle(point){if(vehicle)vehicle.setLatLng(point);if(route&&scene.origin)route.setLatLngs(routePoints(point));}
 function moveVehicle(point,animate){if(animation)cancelAnimationFrame(animation);var from=vehicle.getLatLng(),start=performance.now();
  if(!animate){positionVehicle(latlng(point));return;}
  function step(now){var t=Math.min((now-start)/900,1);positionVehicle([from.lat+(point.latitude-from.lat)*t,from.lng+(point.longitude-from.lng)*t]);if(t<1)animation=requestAnimationFrame(step);else animation=null;}
  animation=requestAnimationFrame(step);}
 function update(next,secret,first){if(secret!==token||!next||!valid(next.coordinate)||next.origin&&!valid(next.origin)||next.driver&&!valid(next.driver))return;
  var previous=scene;scene=next;
  destination.setLatLng(latlng(scene.coordinate));if(scene.selectable)destination.dragging.enable();else destination.dragging.disable();
  if(scene.origin){if(!restaurant)restaurant=L.marker(latlng(scene.origin),{icon:icon('#008B45','⌂'),title:'Nhà hàng'}).addTo(map).bindTooltip('Nhà hàng');else restaurant.setLatLng(latlng(scene.origin));
   if(!route)route=L.polyline(routePoints(scene.driver?latlng(scene.driver):null),{color:'#008B45',weight:4}).addTo(map);else route.setLatLngs(routePoints(scene.driver?latlng(scene.driver):null));
  }else{if(restaurant){map.removeLayer(restaurant);restaurant=null;}if(route){map.removeLayer(route);route=null;}}
  if(scene.driver){if(!vehicle)vehicle=L.marker(latlng(scene.driver),{icon:icon('#FFFFFF','🏍️'),title:'Xe mô phỏng',zIndexOffset:1000}).addTo(map).bindTooltip('Xe mô phỏng');moveVehicle(scene.driver,!first);}
  else{if(animation)cancelAnimationFrame(animation);if(vehicle){map.removeLayer(vehicle);vehicle=null;}}
  if(first||!equal(previous.origin,scene.origin)||!equal(previous.coordinate,scene.coordinate)){
   if(scene.origin)map.fitBounds(L.latLngBounds(latlng(scene.origin),latlng(scene.coordinate)),{padding:[40,45],maxZoom:16,animate:false});
   else map.panTo(latlng(scene.coordinate),{animate:!first});}
 }
 function refresh(){send('ready');if(anyTiles)send('tiles-ready');}
 window.FoodDeliveryMap={update:update,refresh:refresh};
 window.addEventListener('message',function(event){var message=event.data;if(event.source===window.parent&&message&&message.channel===channel&&message.token===token){if(message.type==='update')update(message.scene,token,false);if(message.type==='handshake')refresh();}});
 update(scene,token,true);map.invalidateSize();
 window.addEventListener('resize',function(){map.invalidateSize();});
 window.addEventListener('pagehide',function(){if(animation)cancelAnimationFrame(animation);map.remove();});
 send('ready');
}catch(error){send('error');}
})();</script></body></html>`;
}
