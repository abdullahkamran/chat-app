import Constants from 'expo-constants';
import { Platform, Share } from 'react-native';

/** `expo.extra.invite` in app.json. `{username}` and `{link}` in the message are filled in. */
interface InviteConfig {
  message: string;
  androidUrl: string;
  iosUrl: string;
}

const config = Constants.expoConfig?.extra?.invite as InviteConfig | undefined;

/** Open the native share sheet with an invite to the app that names the user, so friends can add them. */
export async function shareInvite(username: string): Promise<void> {
  if (!config) return;
  // An empty iOS link (no App Store listing yet) falls back to the Play Store one.
  const link = (Platform.OS === 'ios' && config.iosUrl) || config.androidUrl;
  const message = config.message.replaceAll('{username}', username).replaceAll('{link}', link);
  await Share.share({ message });
}
