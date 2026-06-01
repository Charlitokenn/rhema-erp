"use client"

import {UserButton, useUser} from "@clerk/nextjs";
import {NotificationToggle} from "@/components/notifications-toggle";
import { Button } from "@/components/ui/button";
import {sendToClerkUser} from "@/lib/actions/send-push.action";

export default function Home() {
  const { user, isLoaded } = useUser();

  const handleSendPush = async () => {
    if (!user?.id) return;

    try {
      const res = await sendToClerkUser(user.id);
      if (!res.ok) {
        console.error("Failed to send push notification");
      }
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <UserButton />
        <NotificationToggle/>
        <Button
          onClick={handleSendPush}
          disabled={!isLoaded || !user?.id}
        >
          Send Push
        </Button>
      </main>
    </div>
  );
}
