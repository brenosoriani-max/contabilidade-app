"use client"

import { Bell } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { alertService } from "@/lib/api/services"
import useSWR, { mutate } from "swr"


interface AppHeaderProps {
  title: string
  description?: string
}

export function AppHeader({ title, description }: AppHeaderProps) {
  const { data } = useSWR("alertas", () => alertService.list())

  const notifications = data?.alertas ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2">
                <h3 className="font-semibold">Notificacoes</h3>
              </div>
              <Separator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificacao
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start gap-2 p-3"
                  >
                    <div className="flex items-start gap-2 w-full">
                      <span
                        className={`mt-1 h-2 w-2 rounded-full ${
                          notification.read ? "bg-muted" : "bg-primary"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">
                            {notification.title}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {notification.message}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7"
                        onClick={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          await alertService.markAsRead(notification.id)
                          void mutate('alertas')
                        }}
                      >
                        Marcar como lida
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7"
                        onClick={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          await alertService.resolve(notification.id)
                          void mutate('alertas')
                        }}
                      >
                        Resolver
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
