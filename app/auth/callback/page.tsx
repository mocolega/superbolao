'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      // Get the token from URL
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (token && type === 'magiclink') {
        // Extract email from session if possible
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!error && session) {
          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          // Fallback to home
          router.push('/');
        }
      } else {
        router.push('/');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p>Verifying your email...</p>
    </div>
  );
}