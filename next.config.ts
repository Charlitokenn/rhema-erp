import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/oneSignal/OneSignalSDKWorker.js',
                headers: [
                    { key: 'Service-Worker-Allowed', value: '/' },
                    { key: 'Content-Type', value: 'text/javascript' },
                ],
            },
        ];
    },
};

export default nextConfig;