'use client';

import { useEffect } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInitializer() {
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
          },
        });
        console.log('OneSignal Initialized');
      } catch (err) {
        console.error('OneSignal Init Error:', err);
      }
    };

    if (typeof window !== 'undefined') {
      initOneSignal();
    }
  }, []);

  return null;
}
