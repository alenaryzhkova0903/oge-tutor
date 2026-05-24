'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  TOPIC_LABELS,
  computeRecommendations,
  type Profile,
  type TopicStats,
  type Attempt,
  type Task,
  type Assignment,
} from '@/lib/types'
import NavBar from '@/components/NavBar'
import ProgressChart, { buildChartData } from '@/components/ProgressChart'
import TaskHeatmap, { buildHeatmapData } from '@/components/TaskHeatmap'

export default function StudentDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<Profile | null>(null)
  const [stats, setStats] = useState<TopicStats[]>([])
  const [recentAttempts, setRecentAttempts] = useState<(Attempt & { question_text: string })[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tutorId, setTutorId] = useState('')
  const [chartData, setChartData] = useState<ReturnType<typeof buildChartData>>([])
  const [heatmapData, setHeatmapData] = useState<ReturnType<typeof buildHeatmapData>>([])

  // Assign panel
  const [showAssign, setShowAssign] = useState(false)
  const [filterNum, setFilterNum] = useState<number | 'all'>('all')
  const [dueDate, setDueDate] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/login'); return }
    setTutorId(session.user.id)

    const { data: myProfile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single() as { data: { role: string } | null }
    if (myProfile?.role !== 'tutor') { router.replace('/practice'); return }

    const [{ data: profile }, { data: attempts }, { data: tasks }, { data: existingAssignments }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('attempts').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('oge_task_number'),
      supabase.from('assignments').select('*, task:tasks(*)').eq('student_id', id).order('created_at', { ascending: false }),
    ])

    if (!profile) { router.replace('/dashboard'); return }
    setStudent(profile as Profile)
    setNotes((profile as Profile).notes ?? '')
    setAllTasks((tasks as Task[]) ?? [])
    setAssignments((existingAssignments as unknown as Assignment[]) ?? [])

    if (!tasks || !attempts) { setLoading(false); return }

    const taskMap: Record<string, { topic: string; question_text: string }> = {}
    const numMap: Record<string, number> = {}
    ;(tasks as Task[]).forEach((t) => {
      taskMap[t.id] = { topic: t.topic, question_text: t.question_text }
      numMap[t.id] = t.oge_task_number
    })

    const acc: Record<string, { total: number; correct: number }> = {}
    Object.keys(TOPIC_LABELS).forEach((topic) => { acc[topic] = { total: 0, correct: 0 } })
    ;(attempts as Attempt[]).forEach((a) => {
      const info = taskMap[a.task_id]
      if (info && acc[info.topic]) {
        acc[info.topic].total++
        if (a.is_correct) acc[info.topic].correct++
      }
    })

    setStats(Object.entries(acc).map(([topic, { total, correct }]) => ({
      topic, total, correct,
      percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    })))

    setRecentAttempts(
      (attempts as Attempt[]).slice(0, 10).map((a) => ({
        ...a,
        question_text: taskMap[a.task_id]?.question_text ?? '—',
      }))
    )
    setChartData(buildChartData(attempts as { created_at: string; is_correct: boolean }[]))
    setHeatmapData(buildHeatmapData(attempts as { task_id: string; is_correct: boolean }[], numMap))
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function saveNotes() {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({ notes }).eq('id', id)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function assignTask(taskId: string) {
    setAssigning(taskId)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('assignments') as any).insert({
      tutor_id: tutorId,
      student_id: id,
      task_id: taskId,
      due_date: dueDate || null,
    })
    await load()
    setAssigning(null)
  }

  async function deleteAssignment(assignmentId: string) {
    const supabase = createClient()
    await supabase.from('assignments').delete().eq('id', assignmentId)
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  if (!student) return null

  const recommendations = computeRecommendations(stats)
  const assignedTaskIds = new Set(assignments.map((a) => a.task_id))
  const filteredTasks = allTasks.filter((t) =>
    (filterNum === 'all' || t.oge_task_number === filterNum) && !assignedTaskIds.has(t.id)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="tutor" />
      <div className="px-4 pb-10 max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-4 block">← Дашборд</Link>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">{student.full_name}</h1>
          <span className="text-xs text-gray-400">{student.id.slice(0, 8)}…</span>
        </div>

        {/* Notes */}
        <div className="bg-white border rounded-2xl p-5 mb-5">
          <h2 className="font-semibold text-base mb-2">Заметки</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Путается со знаком при делении на отрицательное число…"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs transition ${notesSaved ? 'text-green-500' : 'text-transparent'}`}>Сохранено ✓</span>
            <button
              onClick={saveNotes}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg transition"
            >
              Сохранить
            </button>
          </div>
        </div>

        {/* Homework assignments */}
        <div className="bg-white border rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Домашние задания</h2>
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
            >
              {showAssign ? 'Закрыть' : '+ Назначить'}
            </button>
          </div>

          {showAssign && (
            <div className="border rounded-xl p-4 mb-4 bg-gray-50">
              <div className="flex gap-2 mb-3 flex-wrap">
                <select
                  value={filterNum}
                  onChange={(e) => setFilterNum(e.target.value === 'all' ? 'all' : +e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все задания</option>
                  {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Задание №{n}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {filteredTasks.length === 0 && (
                  <p className="text-sm text-gray-400">Все задания этого номера уже назначены</p>
                )}
                {filteredTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-400 mr-2">№{task.oge_task_number}</span>
                      <span className="text-sm text-gray-700 line-clamp-1">{task.question_text}</span>
                    </div>
                    <button
                      onClick={() => assignTask(task.id)}
                      disabled={assigning === task.id}
                      className="shrink-0 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {assigning === task.id ? '…' : 'Назначить'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400">Заданий пока нет</p>
          ) : (
            <div className="flex flex-col gap-2">
              {assignments.map((a) => {
                const task = a.task as Task | undefined
                const overdue = a.due_date && !a.is_done && new Date(a.due_date) < new Date()
                return (
                  <div key={a.id} className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${
                    a.is_done ? 'border-green-200 bg-green-50' : overdue ? 'border-red-200 bg-red-50' : 'border-gray-100'
                  }`}>
                    <span className="text-lg">{a.is_done ? '✅' : overdue ? '⚠️' : '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{task?.question_text ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        №{task?.oge_task_number}
                        {a.due_date && ` · до ${new Date(a.due_date).toLocaleDateString('ru-RU')}`}
                        {a.is_done && ' · Выполнено'}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteAssignment(a.id)}
                      className="text-gray-300 hover:text-red-400 transition text-lg shrink-0"
                    >×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="bg-white border rounded-2xl p-5 mb-5">
          <h2 className="text-base font-semibold mb-3">Активность за 14 дней</h2>
          <ProgressChart data={chartData} />
        </div>
        <div className="bg-white border rounded-2xl p-5 mb-5">
          <h2 className="text-base font-semibold mb-3">Карта заданий (1–25)</h2>
          <TaskHeatmap stats={heatmapData} />
        </div>

        {/* Recommendations */}
        <h2 className="text-lg font-semibold mb-3">Рекомендации</h2>
        <div className="flex flex-col gap-2 mb-6">
          {recommendations.slice(0, 5).map((r) => {
            const color = r.priority === 'high'
              ? 'bg-red-50 border-red-200 text-red-700'
              : r.priority === 'medium'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
              : 'bg-green-50 border-green-200 text-green-700'
            return (
              <div key={r.topic} className={`border rounded-xl px-5 py-3 ${color}`}>
                <span className="font-medium">{TOPIC_LABELS[r.topic]}</span>
                <p className="text-sm mt-0.5 opacity-80">{r.message}</p>
              </div>
            )
          })}
        </div>

        {/* Recent attempts */}
        <h2 className="text-lg font-semibold mb-3">Последние попытки</h2>
        {recentAttempts.length === 0 ? (
          <p className="text-gray-500 text-sm">Ещё нет ни одной попытки.</p>
        ) : (
          <div className="bg-white border rounded-2xl overflow-hidden">
            {recentAttempts.map((a, i) => (
              <div key={a.id} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t' : ''}`}>
                <span className={`mt-0.5 text-lg ${a.is_correct ? 'text-green-500' : 'text-red-400'}`}>
                  {a.is_correct ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{a.question_text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Ответ: <span className="font-mono">{a.student_answer}</span>
                    {' · '}{new Date(a.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
