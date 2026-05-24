'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TOPIC_LABELS, type Task } from '@/lib/types'
import NavBar from '@/components/NavBar'

const EMPTY_FORM = {
  oge_task_number: 1,
  topic: 'numbers',
  subtopic: '',
  difficulty: 1,
  question_text: '',
  correct_answer: '',
  hint: '',
  solution: '',
  source: '',
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterTopic, setFilterTopic] = useState('all')

  useEffect(() => {
    checkAndLoad()
  }, [])

  async function checkAndLoad() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/login'); return }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single() as { data: { role: string } | null }
    if (profile?.role !== 'tutor') { router.replace('/practice'); return }

    const { data } = await supabase
      .from('tasks').select('*').order('topic').order('oge_task_number')
    setTasks(data ?? [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tasks') as any).insert({
      oge_task_number: form.oge_task_number,
      topic: form.topic,
      subtopic: form.subtopic || null,
      difficulty: form.difficulty,
      question_text: form.question_text.trim(),
      correct_answer: form.correct_answer.trim(),
      hint: form.hint.trim() || null,
      solution: form.solution.trim() || null,
      source: form.source.trim() || null,
    })

    if (error) {
      setError('Ошибка при сохранении: ' + error.message)
    } else {
      setForm(EMPTY_FORM)
      setShowForm(false)
      await checkAndLoad()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить задание?')) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const filtered = filterTopic === 'all'
    ? tasks
    : tasks.filter((t) => t.topic === filterTopic)

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="tutor" />
      <div className="px-4 pb-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Дашборд
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Банк заданий</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError('') }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
        >
          {showForm ? 'Отмена' : '+ Добавить задание'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border rounded-2xl p-6 mb-6 flex flex-col gap-4">
          <h2 className="font-semibold text-lg">Новое задание</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Номер задания ОГЭ (1–25)</label>
              <input
                type="number" min={1} max={25}
                value={form.oge_task_number}
                onChange={(e) => setForm({ ...form, oge_task_number: +e.target.value })}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Сложность</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: +e.target.value as 1|2|3 })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>★☆☆ Лёгкое</option>
                <option value={2}>★★☆ Среднее</option>
                <option value={3}>★★★ Сложное</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Тема</label>
              <select
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TOPIC_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Подтема (необязательно)</label>
              <input
                type="text"
                value={form.subtopic}
                onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                placeholder="напр. fractions"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Текст задачи *</label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              required
              rows={3}
              placeholder="Вычислите: 3/4 + 1/6"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Правильный ответ *</label>
            <input
              type="text"
              value={form.correct_answer}
              onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
              required
              placeholder="11/12"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Подсказка (необязательно)</label>
            <input
              type="text"
              value={form.hint}
              onChange={(e) => setForm({ ...form, hint: e.target.value })}
              placeholder="Приведите дроби к общему знаменателю"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Решение (необязательно)</label>
            <textarea
              value={form.solution}
              onChange={(e) => setForm({ ...form, solution: e.target.value })}
              rows={2}
              placeholder="3/4 + 1/6 = 9/12 + 2/12 = 11/12"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Источник (необязательно)</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="ФИПИ 2024"
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Сохраняю...' : 'Сохранить задание'}
          </button>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterTopic('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterTopic === 'all' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          Все ({tasks.length})
        </button>
        {Object.entries(TOPIC_LABELS).map(([key, label]) => {
          const count = tasks.filter((t) => t.topic === key).length
          if (count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setFilterTopic(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterTopic === key ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">Заданий пока нет. Добавь первое!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((task) => (
            <div key={task.id} className="bg-white border rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
                      №{task.oge_task_number}
                    </span>
                    <span className="text-xs text-gray-400">{TOPIC_LABELS[task.topic]}</span>
                    <span className="text-xs text-gray-300">
                      {'★'.repeat(task.difficulty)}{'☆'.repeat(3 - task.difficulty)}
                    </span>
                  </div>
                  <p className="text-gray-800 text-sm">{task.question_text}</p>
                  <p className="text-xs text-green-700 mt-1 font-mono">→ {task.correct_answer}</p>
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-gray-300 hover:text-red-500 transition text-lg shrink-0"
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
