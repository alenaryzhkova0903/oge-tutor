-- Заметки репетитора на ученика
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- Таблица домашних заданий
CREATE TABLE IF NOT EXISTS public.assignments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id     UUID        NOT NULL REFERENCES public.tasks(id)    ON DELETE CASCADE,
  due_date    DATE,
  is_done     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Репетитор управляет своими заданиями
CREATE POLICY "Tutor manages own assignments"
  ON public.assignments FOR ALL
  USING (tutor_id = auth.uid());

-- Ученик видит свои задания
CREATE POLICY "Student sees own assignments"
  ON public.assignments FOR SELECT
  USING (student_id = auth.uid());

-- Ученик может отметить задание выполненным
CREATE POLICY "Student updates own assignments"
  ON public.assignments FOR UPDATE
  USING (student_id = auth.uid());
