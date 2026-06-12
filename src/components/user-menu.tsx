import { useEffect, useState } from "react";
import { LogOut, User, ShieldUser, UserPen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listMyCaptainTeams } from "@/lib/admin.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email?: string | null;
  onSignOut: () => void;
}

export function UserMenu({ email, onSignOut }: UserMenuProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setIsCaptain(false);
        }
        return;
      }
      const [adminRes, captainRes] = await Promise.all([
        supabase.from("admins").select("id").eq("id", user.id).maybeSingle(),
        listMyCaptainTeams().catch(() => [] as { id: string }[]),
      ]);
      if (cancelled) return;
      setIsAdmin(!!adminRes.data);
      setIsCaptain(Array.isArray(captainRes) && captainRes.length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Account menu"
        >
          <User className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-foreground">Account</p>
            {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isCaptain && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/captain">
              <UserPen className="mr-2 h-4 w-4" />
              Captain View
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/admin">
              <ShieldUser className="mr-2 h-4 w-4" />
              Admin View
            </Link>
          </DropdownMenuItem>
        )}
        {(isCaptain || isAdmin) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
