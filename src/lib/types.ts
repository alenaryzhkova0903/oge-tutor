export type Role = 'student' | 'tutor'
export type Difficulty = 1 | 2 | 3

export interface Profile {
  id: string
  full_name: string
  role: Role
  notes: string | null
  created_at: string
}

export interface Assignment {
  id: string
  tutor_id: string
  student_id: string
  task_id: string
  due_date: string | null
  is_done: boolean
  created_at: string
  task?: Task
}

export interface Task {
  id: string
  oge_task_number: number
  topic: string
  subtopic: string | null
  difficulty: Difficulty
  question_text: string
  correct_answer: string
  hint: string | null
  solution: string | null
  image_url: string | null
  source: string | null
  created_at: string
}

export interface Attempt {
  id: string
  user_id: string
  task_id: string
  student_answer: string
  is_correct: boolean
  time_spent_seconds: number | null
  created_at: string
}

// Topic stats for a single student
export interface TopicStats {
  topic: string
  total: number
  correct: number
  percent: number
}

// Recommendation priority
export type Priority = 'high' | 'medium' | 'ok'

export interface Recommendation {
  topic: string
  priority: Priority
  percent: number
  message: string
}

// Supabase DB types (minimal — matches our schema)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at'>
        Update: Partial<Omit<Task, 'id' | 'created_at'>>
      }
      attempts: {
        Row: Attempt
        Insert: Omit<Attempt, 'id' | 'created_at'>
        Update: Partial<Omit<Attempt, 'id' | 'created_at'>>
      }
    }
  }
}

// Topic labels in Russian
export const TOPIC_LABELS: Record<string, string> = {
  numbers: 'Числа и вычисления',
  expressions: 'Алгебраические выражения',
  equations: 'Уравнения',
  inequalities: 'Неравенства',
  functions: 'Функции и графики',
  progressions: 'Прогрессии',
  geometry: 'Геометрия',
  statistics: 'Статистика и вероятность',
  'real-math': 'Реальная математика',
}

// OGE task numbers mapped to topics (approximate)
export const TASK_TOPICS: Record<number, string> = {
  1: 'numbers', 2: 'numbers', 3: 'numbers',
  4: 'expressions', 5: 'expressions',
  6: 'equations', 7: 'equations',
  8: 'inequalities',
  9: 'geometry', 10: 'geometry', 11: 'geometry', 12: 'geometry',
  13: 'geometry', 14: 'geometry', 15: 'geometry',
  16: 'statistics', 17: 'statistics',
  18: 'functions', 19: 'functions',
  20: 'real-math',
  21: 'equations', 22: 'geometry',
  23: 'real-math', 24: 'geometry', 25: 'equations',
}

export function computeRecommendations(stats: TopicStats[]): Recommendation[] {
  return stats
    .map((s) => {
      let priority: Priority
      let message: string
      if (s.total === 0) {
        priority = 'high'
        message = 'Тема ещё не решалась — начни с неё'
      } else if (s.percent < 60) {
        priority = 'high'
        message = `Менее 60% верных — нужна проработка (${s.correct}/${s.total})`
      } else if (s.percent < 80) {
        priority = 'medium'
        message = `Есть пробелы — повтори теорию (${s.correct}/${s.total})`
      } else {
        priority = 'ok'
        message = `Хороший результат (${s.correct}/${s.total})`
      }
      return { topic: s.topic, priority, percent: s.percent, message }
    })
    .sort((a, b) => {
      const order: Record<Priority, number> = { high: 0, medium: 1, ok: 2 }
      return order[a.priority] - order[b.priority]
    })
}
