// State of Dance — Edge Function: manage-staff
// ----------------------------------------------------------------------------
// One secure helper for staff administration. The service-role key (the "master
// key") stays here on Supabase's servers and is NEVER sent to the browser
// (spec §7). Every call is authorized against the caller's own login + role.
//
// Actions:
//   create        — add a login. CEO or COO. (A COO may not create a CEO.)
//   delete        — remove a login. CEO only. (Cannot delete yourself.)
//   set_password  — reset someone's password. CEO only.
//
// Self password changes do NOT use this function — the app calls
// supabase.auth.updateUser({ password }) directly for the signed-in user.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// Supabase automatically — no secrets to set by hand.
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

    // --- Identify the caller ---
    const asCaller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser()
    if (uErr || !user) return json({ error: 'You must be signed in.' }, 401)

    const { data: prof } = await asCaller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const callerRole = prof?.role
    const isCeo = callerRole === 'ceo'
    const isCoo = callerRole === 'coo'

    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'create'
    const admin = createClient(url, service)

    // ---- CREATE (CEO or COO) ----
    if (action === 'create') {
      if (!isCeo && !isCoo)
        return json({ error: 'Only the CEO or COO can add staff.' }, 403)

      const email = (body.email ?? '').trim()
      const password = body.password ?? ''
      const full_name = (body.full_name ?? '').trim()
      const role = ROLES.includes(body.role) ? body.role : 'admin_staff'
      const branch = body.branch || null

      if (!email) return json({ error: 'Email is required.' }, 400)
      if (!password || password.length < 6)
        return json({ error: 'Password must be at least 6 characters.' }, 400)
      if (role === 'ceo' && !isCeo)
        return json({ error: 'Only the CEO can create another CEO.' }, 403)

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, branch },
      })
      if (cErr) return json({ error: cErr.message }, 400)
      return json({ ok: true, id: created.user?.id })
    }

    // ---- DELETE (CEO only) ----
    if (action === 'delete') {
      if (!isCeo) return json({ error: 'Only the CEO can delete staff.' }, 403)
      const userId = body.user_id
      if (!userId) return json({ error: 'Missing user_id.' }, 400)
      if (userId === user.id)
        return json({ error: 'You cannot delete your own account.' }, 400)

      const { error: dErr } = await admin.auth.admin.deleteUser(userId)
      if (dErr) return json({ error: dErr.message }, 400)
      return json({ ok: true })
    }

    // ---- SET PASSWORD (CEO only) ----
    if (action === 'set_password') {
      if (!isCeo) return json({ error: 'Only the CEO can reset passwords.' }, 403)
      const userId = body.user_id
      const password = body.password ?? ''
      if (!userId) return json({ error: 'Missing user_id.' }, 400)
      if (!password || password.length < 6)
        return json({ error: 'Password must be at least 6 characters.' }, 400)

      const { error: pErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (pErr) return json({ error: pErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
