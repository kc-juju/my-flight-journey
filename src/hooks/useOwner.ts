import { useEffect, useState } from 'react';
import { useAuth } from './useSupabase';
import { amOwner } from '../lib/photos';

/**
 * Whether the current session may edit.
 *
 * Being signed in is not the same as being allowed: anyone who can open an
 * inbox can sign in, and only addresses on the owner list can change
 * anything. `null` means we have not asked yet.
 */
export function useOwner(): boolean | null {
  const { session } = useAuth();
  const [owner, setOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setOwner(false);
      return;
    }
    let live = true;
    setOwner(null);
    void amOwner().then((yes) => {
      if (live) setOwner(yes);
    });
    return () => {
      live = false;
    };
  }, [session]);

  return owner;
}
