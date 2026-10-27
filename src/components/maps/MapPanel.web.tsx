import { useEffect, useRef } from 'react';
import type { MapPanelProps } from './MapPanel.types';
import { LeafletFrame } from './LeafletFrame';
import { useLeafletMap } from '../../hooks/useLeafletMap';
import { MAP_CHANNEL } from '../../features/location/leafletProtocol';

export default function MapPanel(props: MapPanelProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const map = useLeafletMap(props);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      map.accept(event.data);
    };
    window.addEventListener('message', receive);
    frame.current?.contentWindow?.postMessage({ channel: MAP_CHANNEL, token: map.token, type: 'handshake' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, [map.accept]);
  useEffect(() => {
    if (map.ready) frame.current?.contentWindow?.postMessage({ channel: MAP_CHANNEL, token: map.token, type: 'update', scene: map.scene }, window.location.origin);
  }, [map.ready, map.scene, map.token]);
  return <LeafletFrame status={map.status} retry={map.retry} mapProps={props}>
    <iframe key={map.token} ref={frame} title="Bản đồ OpenStreetMap" srcDoc={map.html}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin" onError={map.fail}
      onLoad={() => frame.current?.contentWindow?.postMessage({ channel: MAP_CHANNEL, token: map.token, type: 'handshake' }, window.location.origin)}
      style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
  </LeafletFrame>;
}
