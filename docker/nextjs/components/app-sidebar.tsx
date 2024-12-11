"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ModelSelector } from "./model-selector";
import { TopKSelector } from "./top-k-selector";
import { TopPSelector } from "./top-p-selector";
import { Input } from "./ui/input";
import { TemperatureSelector } from "./temperature-selector";
import { TokenSelector } from "./token-selector";
import { useMetadataParam } from "@/store/useBedrockParam";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const metadata = useMetadataParam((state) => state.metadata);
  const setMetadata = useMetadataParam((state) => state.setMetadata);

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
          <TopKSelector />
          <TopPSelector />
        </div>
      </SidebarHeader>
      <SidebarRail />
    </Sidebar>
  );
}
