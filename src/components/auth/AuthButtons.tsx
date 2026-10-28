'use client';

import { ChefHat, FolderHeart, Heart, LogIn, LogOut, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUser } from '@/lib/auth-client';

const MENU_ITEM =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors';

// #22: Clerk's UserButton is replaced by a small menu with sign-out.
// Registration is closed, so there is no Register button.
export function AuthButtons() {
  const { isSignedIn, isLoaded, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <Link href="/sign-in">
        <Button variant="ghost" size="sm">
          <LogIn className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      </Link>
    );
  }

  // UI hint only; admin pages re-check users.is_admin on the server.
  const isAdmin = user.publicMetadata.isAdmin === 'true';
  const label = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'Account';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-muted"
        >
          {user.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: tiny remote avatar; next/image needs a domain allowlist
            <img src={user.imageUrl} alt="" className="h-8 w-8 object-cover" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{label}</div>
        <Link href="/profile/edit" className={MENU_ITEM}>
          <User className="h-4 w-4" /> My Profile
        </Link>
        <Link href="/recipes/upload" className={MENU_ITEM}>
          <ChefHat className="h-4 w-4" /> Share Recipe
        </Link>
        <Link href="/profile/recipes" className={MENU_ITEM}>
          <Heart className="h-4 w-4" /> My Recipes
        </Link>
        <Link href="/profile/collections" className={MENU_ITEM}>
          <FolderHeart className="h-4 w-4" /> My Collections
        </Link>
        <Link href="/favorites" className={MENU_ITEM}>
          <Heart className="h-4 w-4" /> Favorites
        </Link>
        {isAdmin && (
          <Link href="/admin" className={MENU_ITEM}>
            <Shield className="h-4 w-4" /> Admin Dashboard
          </Link>
        )}
        <button
          type="button"
          className={`${MENU_ITEM} w-full`}
          onClick={() => {
            void signOut({ callbackUrl: '/' });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
