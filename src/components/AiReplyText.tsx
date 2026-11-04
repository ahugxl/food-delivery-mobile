import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

export function AiReplyText({ text }: { text: string }) {
  const [length, setLength] = useState(0);
  const previous = useRef('');
  useEffect(() => {
    if (!text.startsWith(previous.current)) setLength(0);
    previous.current = text;
    const timer = setInterval(() => setLength(current => {
      const next = Math.min(current + 3, text.length);
      if (next >= text.length) clearInterval(timer);
      return next;
    }), 16);
    return () => clearInterval(timer);
  }, [text]);
  return <Text selectable style={{ color: '#18251D', fontSize: 15, lineHeight: 23 }}>{text.slice(0, length)}{length < text.length ? '▍' : ''}</Text>;
}
