import { Redirect } from 'expo-router';

import { useAuth } from '@/context/auth.context';

/**
 * `/`, where the app opens. It sits outside the Stack.Protected guards so it always matches, and sends
 * you to the rooms tab or the login screen. Signing in or out also lands here (it's the first screen the
 * guards allow either way), so it redirects again.
 */
export default function Index() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? '/conversations' : '/login'} />;
}
