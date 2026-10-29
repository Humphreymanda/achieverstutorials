-- ============================================================
-- achievers tutorials — schema, RLS, storage
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  student_number text unique,
  faculty text not null default 'School of Mathematics and Natural Sciences',
  year int not null default 1,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(new.raw_user_meta_data->>'student_number'), '')
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.student_number_taken(sn text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where student_number = sn);
$$;

grant execute on function public.student_number_taken(text) to anon, authenticated;

-- ---------- courses ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null unique,
  faculty text not null default 'School of Mathematics and Natural Sciences',
  year int not null default 1,
  department text,
  description text,
  thumbnail_url text,
  cover_url text,
  enrollment_mode text not null default 'open' check (enrollment_mode in ('open','code')),
  is_published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- lessons ----------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  video_url text,
  video_source text not null default 'storage' check (video_source in ('storage','external')),
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  file_url text not null,
  file_size bigint,
  file_type text,
  created_at timestamptz not null default now()
);

-- ---------- enrollments ----------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id)
);

-- ---------- lesson_progress ----------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique(user_id, lesson_id)
);

-- ---------- enrollment_codes ----------
create table if not exists public.enrollment_codes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code text not null unique,
  max_uses int,
  uses_used int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- course_views ----------
create table if not exists public.course_views (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.documents enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.enrollment_codes enable row level security;
alter table public.course_views enable row level security;

-- profiles
create policy profiles_read on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- courses
create policy courses_read on public.courses for select using (is_published = true or public.is_admin());
create policy courses_admin on public.courses for all using (public.is_admin()) with check (public.is_admin());

-- lessons
create policy lessons_read on public.lessons for select using (public.is_admin() or exists (select 1 from public.courses c where c.id = lessons.course_id and c.is_published));
create policy lessons_admin on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- documents
create policy documents_read on public.documents for select using (public.is_admin() or exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id where l.id = documents.lesson_id and c.is_published));
create policy documents_admin on public.documents for all using (public.is_admin()) with check (public.is_admin());

-- enrollments
create policy enroll_read on public.enrollments for select using (auth.uid() = user_id or public.is_admin());
create policy enroll_insert on public.enrollments for insert with check (auth.uid() = user_id);
create policy enroll_delete on public.enrollments for delete using (auth.uid() = user_id or public.is_admin());

-- progress
create policy progress_read on public.lesson_progress for select using (auth.uid() = user_id or public.is_admin());
create policy progress_insert on public.lesson_progress for insert with check (auth.uid() = user_id);
create policy progress_update on public.lesson_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- codes
create policy codes_admin on public.enrollment_codes for all using (public.is_admin()) with check (public.is_admin());

-- views
create policy views_insert on public.course_views for insert with check (auth.uid() is not null);
create policy views_read on public.course_views for select using (public.is_admin());

-- ============================================================
-- Storage buckets
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('thumbnails', 'thumbnails', true),
  ('videos',     'videos',     true),
  ('documents',  'documents',  true)
on conflict (id) do nothing;

do $$
declare b text;
begin
  for b in select unnest(array['thumbnails','videos','documents']) loop
    execute format($f$
      drop policy if exists "admin write %1$s" on storage.objects;
      create policy "admin write %1$s" on storage.objects for all to authenticated
        using (bucket_id = %1$L and public.is_admin())
        with check (bucket_id = %1$L and public.is_admin());
    $f$, b);
  end loop;
end $$;