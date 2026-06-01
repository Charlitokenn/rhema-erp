export const AppConfig ={
    name: "Rhema ERP",
    description: "Internal finance workflow",
    version: "1.0.0",
    logo: "/next.svg",
    oneSignal: {
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    },
    categories: ["finance", "business", "productivity"],
}