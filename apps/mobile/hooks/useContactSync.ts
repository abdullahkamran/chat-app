import { useQueryClient } from '@tanstack/react-query';
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { getLocales } from 'expo-localization';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { SUGGESTIONS_KEY } from '@/hooks/useFriends';
import { api } from '@/lib/api';

/** Most numbers one sync sends; the server refuses more. */
const MAX_NUMBERS = 3000;

/** Contacts are checked at most once per app launch. The server also caps checks per day. */
let syncedThisLaunch = false;

/**
 * Every number in the phone's contacts, in E.164. Numbers saved without a country code
 * (0300 1234567) are read as being from the phone's region.
 */
async function readContactNumbers(): Promise<string[]> {
  const region = (getLocales()[0]?.regionCode ?? undefined) as CountryCode | undefined;
  const contacts = await Contact.getAllDetails([ContactField.PHONES]);
  const numbers = new Set<string>();
  for (const contact of contacts) {
    for (const phone of contact.phones ?? []) {
      const parsed = phone.number ? parsePhoneNumberFromString(phone.number, region) : undefined;
      if (parsed?.isValid()) numbers.add(parsed.number);
    }
  }
  return [...numbers].slice(0, MAX_NUMBERS);
}

/** Where contact access stands: not known yet, granted, can be asked, or refused for good (only Settings can change it). */
export type ContactAccess = 'unknown' | 'granted' | 'ask' | 'blocked';

/**
 * Find friends from the phone's contacts. Once access is granted, the numbers are sent to
 * the server, which keeps only who matched (for Quick Add). Syncs on its own once per launch.
 */
export function useContactSync() {
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<ContactAccess>('unknown');

  const sync = useCallback(async () => {
    syncedThisLaunch = true;
    try {
      await api.post('/api/v1/friends/contacts/sync', { phoneNumbers: await readContactNumbers() });
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
    } catch (e) {
      // Refused (e.g. today's cap) or offline: Quick Add keeps the last matches.
      console.warn('Contact sync failed', e);
    }
  }, [queryClient]);

  useEffect(() => {
    getPermissionsAsync().then((p) => {
      setAccess(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked');
      if (p.granted && !syncedThisLaunch) sync();
    });
  }, [sync]);

  /** Ask for access and sync, or open Settings when the system won't ask again. */
  const allow = useCallback(async () => {
    if (access === 'blocked') {
      Linking.openSettings();
      return;
    }
    const p = await requestPermissionsAsync();
    setAccess(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked');
    if (p.granted) sync();
  }, [access, sync]);

  return { access, allow };
}
