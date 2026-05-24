# Запуск проекта

## 1. Установить зависимости

```bash
cd /Users/alena/oge-tutor/app
npm install
```

## 2. Создать проект в Supabase

1. Зайди на [supabase.com](https://supabase.com) → New project
2. Запомни **Project URL** и **anon public key** (Settings → API)

## 3. Применить миграцию базы данных

В Supabase Dashboard → SQL Editor → вставь содержимое файла:

```
supabase/migrations/001_initial.sql
```

Нажми **Run** — создадутся таблицы, политики, триггер, тестовые задачи.

## 4. Настроить переменные окружения

```bash
cp .env.example .env.local
```

Открой `.env.local` и вставь свои значения:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## 5. Запустить локально

```bash
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000)

---

## Роли

- **student** — регистрируется сам, видит практику и свой прогресс
- **tutor** — аккаунт создаётся через SQL вручную (см. ниже)

### Создать аккаунт репетитора

1. Зарегистрируйся в приложении как обычный пользователь
2. В Supabase Dashboard → Table Editor → `profiles`
3. Найди свою запись, измени `role` с `student` на `tutor`

---

## Деплой на Vercel

1. Залей проект на GitHub
2. На [vercel.com](https://vercel.com) → Import Git Repository
3. В Environment Variables добавь те же два ключа из `.env.local`
4. Deploy

---

## Структура файлов

```
app/
├── supabase/migrations/001_initial.sql   — схема БД
├── src/
│   ├── lib/
│   │   ├── supabase.ts    — клиент Supabase
│   │   └── types.ts       — типы, метки тем, логика рекомендаций
│   └── app/
│       ├── page.tsx                          — редирект (login / practice / dashboard)
│       ├── login/page.tsx                    — вход и регистрация
│       ├── practice/page.tsx                 — список тем (ученик)
│       ├── practice/topic/[topic]/page.tsx   — задачи по теме
│       ├── practice/task/[taskId]/page.tsx   — одна задача с вводом ответа
│       ├── progress/page.tsx                 — статистика и рекомендации ученика
│       ├── dashboard/page.tsx                — список учеников (репетитор)
│       └── dashboard/student/[id]/page.tsx   — детальная карточка ученика
```
