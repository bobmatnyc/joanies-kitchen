import { redirect } from 'next/navigation';

/**
 * Registration page — sign-up is now open.
 * This page previously blocked registration during alpha.
 * Redirect anyone who lands here directly to the sign-up page.
 */
export default function RegistrationClosedPage() {
  redirect('/sign-up');
}
