"use client"

import {UserButton} from "@clerk/nextjs";
import {NotificationToggle} from "@/components/notifications-toggle";
import { Button } from "@/components/ui/button";
import {sendToClerkUser} from "@/lib/actions/send-push.action";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <UserButton />
        <NotificationToggle/>
        <Button
          onClick={() => sendToClerkUser("user_2zsxez8SYmKi0525GsCo9eXg05R")}
        >
          Send Push
        </Button>
      </main>
    </div>
  );
}
