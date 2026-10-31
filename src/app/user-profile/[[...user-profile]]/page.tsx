import { redirect } from 'next/navigation';

// #22: the legacy /user-profile path redirects to the app profile editor.
export default function UserProfilePage() {
  redirect('/profile/edit');
}
