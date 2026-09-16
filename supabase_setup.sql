-- ========================================================
-- SMART TRADING - SUPABASE DATABASE SETUP SCRIPT
-- Project: txonlwaldbqybcywauuz
-- ========================================================
-- How to run this:
-- 1. Go to: https://supabase.com/dashboard/project/txonlwaldbqybcywauuz/sql/new
-- 2. Paste this entire code into the SQL Editor
-- 3. Click "Run" (or Ctrl+Enter)
-- ========================================================

-- 1. Create TASKS table
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    assigned_to TEXT,
    assigned_to_name TEXT,
    deadline TEXT DEFAULT '-',
    status TEXT DEFAULT 'Pending',
    date TEXT,
    employee_note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create NOTICES table (also stores cloud employee registry)
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT,
    target_emp_id TEXT,
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create HOLIDAYS table
CREATE TABLE IF NOT EXISTS public.holidays (
    date TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_bn TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allow web app (anon & authenticated) full access
-- ========================================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access to tasks" ON public.tasks;
CREATE POLICY "Allow anon full access to tasks"
    ON public.tasks
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to notices" ON public.notices;
CREATE POLICY "Allow anon full access to notices"
    ON public.notices
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to holidays" ON public.holidays;
CREATE POLICY "Allow anon full access to holidays"
    ON public.holidays
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
