import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom root HTML for MergeDeck Web / PWA.
 * Injects PWA manifest, theme colors, Apple touch tags, and Service Worker registration.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1, user-scalable=no"
        />

        <title>MergeDeck — Reel-based Code Reviews</title>
        <meta
          name="description"
          content="Reel-based code review app. Swipe through pull requests, inspect diffs with syntax highlighting, and review changes on the go."
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Chrome, Firefox OS and Opera theme color */}
        <meta name="theme-color" content="#050505" />
        <meta name="color-scheme" content="dark" />

        {/* Universal Mobile PWA support (iOS Safari & Android Chrome) */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MergeDeck" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />

        {/* Standard Favicons */}
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[PWA] ServiceWorker registration failed:', err);
                    });
                });
              }
            `,
          }}
        />

        {/* Snappy Reel Card Physics & PWA Overrides */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-snap-feed="true"],
              [data-snap-feed="true"] > div {
                scroll-snap-type: y mandatory !important;
                -webkit-scroll-snap-type: y mandatory !important;
                overscroll-behavior-y: contain !important;
                -webkit-overflow-scrolling: touch !important;
                scroll-behavior: auto !important;
              }
              [data-snap-card="true"] {
                scroll-snap-align: start !important;
                -webkit-scroll-snap-align: start !important;
                scroll-snap-stop: always !important;
                -webkit-scroll-snap-stop: always !important;
              }
              /* Prevent pull-to-refresh interference with vertical reel swipe */
              body {
                overscroll-behavior-y: none;
                user-select: none;
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent;
              }
            `,
          }}
        />

        {/* Expo ScrollView style reset */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
