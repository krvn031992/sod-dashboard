// State of Dance — Edge Function: create-staff
// ----------------------------------------------------------------------------
// Lets the CEO create a staff login from inside the dashboard. The service-role
// key (the "master key") stays here on Supabase's servers and is NEVER sent to
// the browser, per spec §7. The function:
//   1. Identifies the caller from their login token.
//   2. Refuses unless that caller is the CEO.
//   3. Creates the new user (email auto-confirmed) with name/role/branch.
// The handle_new_user trigger then mirrors them into public.profiles.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// Supabase automatically — there are no secrets to set by hand.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const ROLES = ['ceo', 'coo', 'admin_manager', 'admin_staff', 'marketing']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1. Who is calling?
    const asCaller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser()
    if (uErr || !user) return json({ error: 'You must be signed in.' }, 401)

    // 2. Are they the CEO?
    const { data: prof } = await asCaller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (prof?.role !== 'ceo') {
      return json({ error: 'Only the CEO can add staff.' }, 403)
    }

    // 3. Validate input
    const body = await req.json().catch(() => ({}))
    const email = (body.email ?? '').trim()
    const password = body.password ?? ''
    const full_name = (body.full_name ?? '').trim()
    const role = ROLES.includes(body.role) ? body.role : 'admin_staff'
    const branch = body.branch || null

    if (!email) return json({ error: 'Email is required.' }, 400)
    if (!password || password.length < 6)
      return json({ error: 'Password must be at least 6 characters.' }, 400)

    // 4. Create the account (admin privileges)
    const admin = createClient(url, service)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, branch },
    })
    if (cErr) return json({ error: cErr.message }, 400)

    return json({ ok: true, id: created.user?.id })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
