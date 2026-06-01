import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    sw: "sw.js",                     // the PWA SW filename
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
        runtimeCaching: [
            // Supabase API — always try network first, fall back to cache
            {
                urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                handler: "NetworkFirst",
                options: {
                    cacheName: "supabase-api",
                    expiration: { maxEntries: 64, maxAgeSeconds: 5 * 60 },
                    networkTimeoutSeconds: 10,
                },
            },
            // Clerk auth endpoints — never cache
            {
                urlPattern: /^https:\/\/(.*\.clerk\.accounts\.dev|clerk\..*)\/.*/i,
                handler: "NetworkOnly",
            },
            // Next.js static assets — cache aggressively
            {
                urlPattern: /\/_next\/static\/.*/i,
                handler: "CacheFirst",
                options: {
                    cacheName: "next-static",
                    expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 365 },
                },
            },
            // Next.js image optimisation
            {
                urlPattern: /\/_next\/image\?.*/i,
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "next-image",
                    expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
                },
            },
            // App pages — StaleWhileRevalidate, but skip auth pages
            {
                urlPattern: ({ url }: { url: URL }) =>
                    url.origin === self.location.origin &&
                    !url.pathname.startsWith("/sign-in") &&
                    !url.pathname.startsWith("/api/"),
                handler: "StaleWhileRevalidate",
                options: {
                    cacheName: "pages",
                    expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
                },
            },
        ],
    },
});

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/oneSignal/OneSignalSDKWorker.js",
                headers: [
                    { key: "Service-Worker-Allowed", value: "/oneSignal/" }, // ← scoped, not /
                    { key: "Content-Type", value: "text/javascript" },
                ],
            },
            // Allow the PWA SW to control all paths
            {
                source: "/sw.js",
                headers: [
                    { key: "Service-Worker-Allowed", value: "/" },
                    { key: "Content-Type", value: "text/javascript" },
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                ],
            },
        ];
    },
    turbopack: {}
};

export default withPWA(nextConfig);