import { useEffect, useMemo, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import type { MapPanelProps } from './MapPanel.types';
import { LeafletFrame } from './LeafletFrame';
import { useLeafletMap } from '../../hooks/useLeafletMap';
import { MAP_COPYRIGHT_URL, mapUpdateScript } from '../../features/location/leafletProtocol';

export default function LeafletMapNative(props: MapPanelProps) {
  const web = useRef<WebView>(null);
  const map = useLeafletMap(props);
  const source = useMemo(() => ({ html: map.html }), [map.html]);
  useEffect(() => {
    if (map.ready) web.current?.injectJavaScript(mapUpdateScript(map.scene, map.token));
  }, [map.ready, map.scene, map.token]);
  const packageName = Constants.expoConfig?.android?.package || 'com.ahugxl.fooddelivery';
  const userAgent = `FoodDelivery/${Constants.expoConfig?.version || '1.0.0'} (${Platform.OS}; ${packageName})`;
  return <LeafletFrame status={map.status} retry={map.retry} mapProps={props}>
    <WebView key={map.token} ref={web} source={source} style={{ flex: 1, backgroundColor: '#EAF7EF' }}
      accessibilityLabel="Bản đồ OpenStreetMap" originWhitelist={['*']} javaScriptEnabled
      userAgent={userAgent} cacheEnabled cacheMode="LOAD_DEFAULT" incognito={false}
      geolocationEnabled={false} domStorageEnabled={false} thirdPartyCookiesEnabled={false} sharedCookiesEnabled={false}
      mixedContentMode="never" allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
      scrollEnabled={false} bounces={false} nestedScrollEnabled
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'about:srcdoc'}
      onMessage={event => {
        const message = map.accept(event.nativeEvent.data);
        if (message?.type === 'attribution') void Linking.openURL(MAP_COPYRIGHT_URL).catch(() => {});
      }}
      onLoadEnd={() => web.current?.injectJavaScript('window.FoodDeliveryMap && window.FoodDeliveryMap.refresh();true;')}
      onError={map.fail} onHttpError={map.fail} onRenderProcessGone={map.fail} onContentProcessDidTerminate={map.fail}
    />
  </LeafletFrame>;
}
