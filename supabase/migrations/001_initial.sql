-- OGE Tutor: initial schema

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('student', 'tutor')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Tutors can view all student profiles
create policy "Tutors can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'tutor'
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Без имени'),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Tasks (problem bank)
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  oge_task_number int not null check (oge_task_number between 1 and 25),
  topic text not null,
  subtopic text,
  difficulty int not null default 1 check (difficulty between 1 and 3),
  question_text text not null,
  correct_answer text not null,
  hint text,
  solution text,
  source text,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;

-- All authenticated users can read tasks
create policy "Authenticated users can read tasks"
  on public.tasks for select
  using (auth.role() = 'authenticated');

-- Only tutors can insert/update/delete tasks
create policy "Tutors can manage tasks"
  on public.tasks for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'tutor'
    )
  );


-- Attempts (student answer history)
create table public.attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  student_answer text not null,
  is_correct boolean not null,
  time_spent_seconds int,
  created_at timestamptz default now()
);

alter table public.attempts enable row level security;

-- Students see only their own attempts
create policy "Students view own attempts"
  on public.attempts for select
  using (auth.uid() = user_id);

create policy "Students insert own attempts"
  on public.attempts for insert
  with check (auth.uid() = user_id);

-- Tutors see all attempts
create policy "Tutors view all attempts"
  on public.attempts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'tutor'
    )
  );


-- Indexes
create index attempts_user_id_idx on public.attempts(user_id);
create index attempts_task_id_idx on public.attempts(task_id);
create index tasks_topic_idx on public.tasks(topic);
create index tasks_oge_number_idx on public.tasks(oge_task_number);


-- Seed: sample tasks
insert into public.tasks (oge_task_number, topic, subtopic, difficulty, question_text, correct_answer, hint, solution) values
(
  1, 'numbers', 'fractions', 1,
  'Вычислите: 3/4 + 1/6',
  '11/12',
  'Приведите дроби к общему знаменателю 12',
  '3/4 + 1/6 = 9/12 + 2/12 = 11/12'
),
(
  7, 'equations', 'linear', 1,
  'Решите уравнение: 2x + 5 = 13',
  '4',
  'Перенесите 5 вправо, затем разделите на 2',
  '2x = 13 − 5 = 8; x = 4'
),
(
  14, 'geometry', 'triangles', 2,
  'В прямоугольном треугольнике катеты равны 3 и 4. Найдите гипотенузу.',
  '5',
  'Теорема Пифагора: c² = a² + b²',
  'c² = 3² + 4² = 9 + 16 = 25; c = 5'
);
