'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { type Profile, type Attempt } from '@/lib/types'
import NavBar from '@/components/NavBar'

interface StudentRow {
  id: string
  full_name: string
  total: number
  correct: number
  percent: number
  last_active: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      // Verify tutor role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single() as { data: { role: string } | null }

      if (profile?.role !== 'tutor') {
        router.replace('/practice')
        return
      }

      // Load all student profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')

      if (!profiles) { setLoading(false); return }

      // Load all attempts
      const { data: attempts } = await supabase
        .from('attempts')
        .select('user_id, is_correct, created_at')
        .order('created_at', { ascending: false })

      const attemptsMap: Record<string, { total: number; correct: number; last: string | null }> = {}
      profiles.forEach((p: Pick<Profile, 'id'>) => {
        attemptsMap[p.id] = { total: 0, correct: 0, last: null }
      })

      ;(attempts ?? []).forEach((a: Pick<Attempt, 'user_id' | 'is_correct'> & { created_at: string }) => {
        if (attemptsMap[a.user_id]) {
          attemptsMap[a.user_id].total++
          if (a.is_correct) attemptsMap[a.user_id].correct++
          if (!attemptsMap[a.user_id].last) attemptsMap[a.user_id].last = a.created_at
        }
      })

      const rows: StudentRow[] = profiles.map((p: Pick<Profile, 'id' | 'full_name'>) => {
        const { total, correct, last } = attemptsMap[p.id] ?? { total: 0, correct: 0, last: null }
        return {
          id: p.id,
          full_name: p.full_name,
          total,
          correct,
          percent: total > 0 ? Math.round((correct / total) * 100) : 0,
          last_active: last,
        }
      })

      rows.sort((a, b) => (b.last_active ?? '').localeCompare(a.last_active ?? ''))
      setStudents(rows)
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar role="tutor" />
      <div className="px-4 pb-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Ученики</h1>

      {students.length === 0 ? (
        <p className="text-gray-500">Учеников пока нет. Они появятся после регистрации.</p>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">Ученик</th>
                <th className="px-4 py-3 font-medium text-right">Решено</th>
                <th className="px-4 py-3 font-medium text-right">%</th>
                <th className="px-4 py-3 font-medium text-right">Последняя активность</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className={i < students.length - 1 ? 'border-b' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {s.correct}/{s.total}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {s.total > 0 ? `${s.percent}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {s.last_active
                      ? new Date(s.last_active).toLocaleDateString('ru-RU')
                      : 'Ещё нет'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/student/${s.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Детали →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}
