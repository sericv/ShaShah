import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Shared secret token to authorize Next.js backend to Cloudflare Worker communications
const WORKER_SHARED_SECRET = process.env.WORKER_SHARED_SECRET || 'shasha_push_secret_token_123';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://shasha-push.2falilh2.workers.dev';

export async function POST(request: Request) {
  try {
    // 1. Authenticate sender session (Next.js server side validation via Bearer token)
    const authHeader = request.headers.get('Authorization');
    let sessionUser: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        sessionUser = user;
      }
    }

    if (!sessionUser) {
      console.warn('[Notify API] Auth failed. Missing or invalid Bearer token.');
      return NextResponse.json({ success: false, message: 'Unauthenticated request' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { recipientId, title, body: text, type, data } = body;

    // If no recipientId is specified, default to sending to current authenticated user (for testing)
    const targetUserId = recipientId || sessionUser.id;

    // 3. Relay payload directly to Cloudflare Worker
    // The Worker uses the SUPABASE_SERVICE_ROLE_KEY to query settings and subscriptions.
    const workerPayload = {
      user_id: targetUserId,
      title: title,
      body: text,
      type: type,
      data: data || {},
    };

    console.log(`[Notify API] Relaying push payload to Cloudflare Worker for recipient ${targetUserId}`);

    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_SHARED_SECRET}`
      },
      body: JSON.stringify(workerPayload)
    });

    const responseText = await response.text();
    
    // REQUIREMENT: Print the full Cloudflare Worker response in Next.js console
    console.log('[Notify API] Cloudflare Worker Full Response:', responseText);

    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cloudflare Worker invocation failed', 
        details: responseText 
      }, { status: 502 });
    }

    let workerResult: any = {};
    try {
      workerResult = JSON.parse(responseText);
    } catch (e) {
      workerResult = { text: responseText };
    }

    // Check if worker reported at least one successful push delivery (status 201 or 202)
    const hasSubscriptions = (workerResult.processed ?? 0) > 0;
    const hasSuccessfulDelivery = workerResult.results?.some((r: any) => r.status === 200 || r.status === 201 || r.status === 202);

    if (!hasSubscriptions || hasSuccessfulDelivery) {
      return NextResponse.json({ success: true, workerResult });
    } else {
      console.warn('[Notify API] Push delivery failed to reach any active device. Worker result:', workerResult);
      
      const errorMsg = workerResult.message || 'فشلت خدمة الإرسال في تسليم الإشعارات للأجهزة النشطة.';
      return NextResponse.json({ 
        success: false, 
        message: errorMsg, 
        workerResult 
      }, { status: 502 });
    }
  } catch (err: any) {
    console.error('[Notify API] Unexpected error handling proxy request:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
