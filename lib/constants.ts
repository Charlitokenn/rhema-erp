export const AppConfig ={
    name: "Rhema ERP",
    description: "Internal finance workflow",
    version: "1.0.0",
    logo: "/next.svg",
    oneSignal: {
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
    }
}