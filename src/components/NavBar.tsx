'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavBarProps {
  role?: 'student' | 'tutor'
}

export default function NavBar({ role }: NavBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="bg-white border-b px-4 py-3 flex items-center justify-between mb-4 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-bold text-gray-900 shrink-0 text-sm sm:text-base">ОГЭ Математика</span>
        {role === 'tutor' ? (
          <>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 shrink-0">Ученики</Link>
            <Link href="/dashboard/tasks" className="text-sm text-gray-500 hover:text-gray-900 shrink-0 hidden sm:inline">Банк заданий</Link>
          </>
        ) : (
          <>
            <Link href="/practice" className="text-sm text-gray-500 hover:text-gray-900 shrink-0">Практика</Link>
            <Link href="/homework" className="text-sm text-gray-500 hover:text-gray-900 shrink-0">Домашнее</Link>
            <Link href="/exam" className="text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0 hidden sm:inline">Экзамен</Link>
            <Link href="/progress" className="text-sm text-gray-500 hover:text-gray-900 shrink-0 hidden sm:inline">Прогресс</Link>
          </>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-red-500 transition shrink-0 ml-4 py-1 px-2"
      >
        Выйти
      </button>
    </nav>
  )
}
