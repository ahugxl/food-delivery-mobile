import { useCallback, useEffect, useMemo, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import type { MapPanelProps } from '../components/maps/MapPanel.types';
import { leafletDocument } from '../features/location/leafletDocument';
import { mapScene, parseMapEvent } from '../features/location/leafletProtocol';

export function useLeafletMap(props: MapPanelProps) {
  const scene = useMemo(() => mapScene(props), [props.coordinate.latitude, props.coordinate.longitude, props.origin?.latitude, props.origin?.longitude, props.driver?.latitude, props.driver?.longitude, !!props.onSelect, props.simulation]);
  const [session, setSession] = useState(() => ({ token: randomUUID(), initial: scene }));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const html = useMemo(() => leafletDocument(session.initial, session.token), [session]);
  const fail = useCallback(() => setStatus('failed'), []);
  const accept = useCallback((raw: unknown) => {
    const event = parseMapEvent(raw, session.token, scene.selectable);
    if (!event) return;
    if (event.type === 'ready') setReady(true);
    if (event.type === 'tiles-ready') setStatus(previous => previous === 'failed' ? previous : 'ready');
    if (event.type === 'error' || event.type === 'tiles-error') fail();
    if (event.type === 'select') props.onSelect?.(event.coordinate);
    return event;
  }, [session.token, scene.selectable, props.onSelect, fail]);
  useEffect(() => {
    if (status !== 'loading') return;
    const timeout = setTimeout(fail, 20000);
    return () => clearTimeout(timeout);
  }, [session.token, status, fail]);
  const retry = () => { setReady(false); setStatus('loading'); setSession({ token: randomUUID(), initial: scene }); };
  return { scene, token: session.token, html, ready, status, accept, fail, retry };
}
