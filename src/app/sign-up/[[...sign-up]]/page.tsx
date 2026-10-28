import { redirect } from 'next/navigation';

// #22: registration is closed and Google is the only provider; /sign-up is an alias.
export default function SignUpPage() {
  redirect('/sign-in');
}
