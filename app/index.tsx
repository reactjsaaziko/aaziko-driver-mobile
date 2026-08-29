import { Redirect } from 'expo-router';

import { isSignedIn } from '@/services/auth';

// Entry point: the session is restored in _layout before this renders, so a
// signed-in driver goes straight to Orders on reload; otherwise, to login.
export default function Index() {
  return <Redirect href={isSignedIn() ? '/orders' : '/login'} />;
}
