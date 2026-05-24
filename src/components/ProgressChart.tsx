'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'

interface DayPoint {
  day: string
  correct: number
  wrong: number
}

export default function ProgressChart({ data }: { data: DayPoint[] }) {
  if (data.every((d) => d.correct === 0 && d.wrong === 0)) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
        Нет данных за последние 14 дней
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value: number, name: string) =>
            [value, name === 'correct' ? 'Верно' : 'Неверно']
          }
        />
        <Legend
          formatter={(value) => value === 'correct' ? 'Верно' : 'Неверно'}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="correct" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="wrong" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Build chart data from raw attempts + task map
export function buildChartData(
  attempts: { created_at: string; is_correct: boolean }[],
  days = 14
): DayPoint[] {
  const result: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({
      day: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      correct: 0,
      wrong: 0,
    })
    const dayAttempts = attempts.filter((a) => a.created_at.slice(0, 10) === key)
    result[result.length - 1].correct = dayAttempts.filter((a) => a.is_correct).length
    result[result.length - 1].wrong = dayAttempts.filter((a) => !a.is_correct).length
  }
  return result
}
