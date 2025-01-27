"use client";

import * as React from "react";
import { LogOut, Sparkles } from "lucide-react";
import cookie from "js-cookie";
import { useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ModelSelector } from "./model-selector";
import { TopPSelector } from "./top-p-selector";
import { Input } from "./ui/input";
import { TemperatureSelector } from "./temperature-selector";
import { TokenSelector } from "./token-selector";
import { useMetadataParam } from "@/store/useBedrockParam";
import { useAuthStore } from "@/store/useAuthStore";
import { signOutHandler } from "@/lib/utils";
import { ErrorMessage } from "./new-password-form";
import { useToast } from "@/hooks/use-toast";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const metadata = useMetadataParam((state) => state.metadata);
  const setMetadata = useMetadataParam((state) => state.setMetadata);
  const user = useAuthStore((state) => state.user);
  const { toast } = useToast();
  const router = useRouter();
  const submitSignout = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    try {
      await signOutHandler({ username: user! });
      // const data = await response!.json();
      // console.log(data);
      cookie.remove("jwtToken");
      router.push("/login");
    } catch (error) {
      const errorContent = error as ErrorMessage;
      toast({
        variant: "destructive",
        title: "Sign-out error",
        description: errorContent.message,
      });
    }
  };

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="flex aspect-square size-5 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles />
              </div>
              <span className="truncate font-semibold">AI Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Input
          placeholder="User (SID) filter search"
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
        />
        <div className="px-4">
          <ModelSelector />
          <TemperatureSelector />
          <TokenSelector />
          <TopPSelector />
        </div>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter>
        <SidebarMenu className="px-4 py-4 ">
          <SidebarMenuItem>
            <div
              className="flex row rounded-sm  cursor-pointer hover:bg-slate-200 dark:hover:bg-stone-700"
              onClick={(e) => submitSignout(e)}
            >
              <LogOut />
              <div className="px-2">Sign out</div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
