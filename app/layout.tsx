import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import {ClerkProvider} from "@clerk/nextjs";
import { shadcn } from '@clerk/ui/themes'
import {AppConfig} from "@/lib/constants";
import {OneSignalProvider} from "@/components/providers/onesignal-provider";
import React from "react";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: AppConfig.name,
    template: `%s | \`${AppConfig.name}\``,
  },
  description: AppConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
      <ClerkProvider
          appearance={{
            theme: shadcn,
          }}
      >
        <OneSignalProvider>
          {children}
        </OneSignalProvider>
      </ClerkProvider>
      </body>
    </html>
  );
}
