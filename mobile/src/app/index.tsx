import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/providers/auth-provider';

export default function IndexRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  return <Redirect href={user ? '/(tabs)/forum' : '/(auth)/login'} />;
}
