import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Html({ children }: PropsWithChildren) {
  return <html lang="vi">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>soopiFood</title>
      <ScrollViewStyleReset />
    </head>
    <body>{children}</body>
  </html>;
}
