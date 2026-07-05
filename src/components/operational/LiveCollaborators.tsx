"use client";

import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function LiveCollaborators({ entityId }: { entityId: string }) {
  const { presence } = useStore();

  const activeUsers = Object.values(presence).filter(p => p.entityId === entityId && p.status === "online");

  if (activeUsers.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2 overflow-hidden px-2">
      <TooltipProvider>
        {activeUsers.map(user => (
          <Tooltip key={user.userId}>
            <TooltipTrigger>
              <Avatar className="h-8 w-8 inline-block border-2 border-background">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.userId}`} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                  {user.userId.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.userId} {user.role ? `(${user.role})` : ""}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
