import { redirect } from 'next/navigation';

// #22: Clerk's account page is gone; the app profile editor replaces it.
export default function UserProfilePage() {
  redirect('/profile/edit');
}
