import { Users, IdCard, Mail, LogOut, ShieldCheck } from 'lucide-react';
import type { User } from '../schemas/auth.schema';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';

interface InstructorDashboardPageProps {
  user: User;
  onLogout: () => void;
}

export const InstructorDashboardPage = ({ user, onLogout }: InstructorDashboardPageProps) => {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center p-4 sm:p-6 font-sans">
      <div
        className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-emerald-800 to-amber-700 z-0"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center py-10 sm:py-16">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 w-full border border-white/40 text-gray-900">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-indigo-100 border-4 border-indigo-400 shadow-xl flex items-center justify-center mb-3">
              <Users className="w-10 h-10 text-indigo-700" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              ¡Bienvenido, {user.name}!
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Panel del Instructor &middot; Sistema de Almuerzos SENA
            </p>
            <div className="mt-2">
              <Badge variant="blue">
                <ShieldCheck className="w-3.5 h-3.5" />
                {user.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
              <IdCard className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Documento</p>
                <p className="text-sm font-bold text-gray-800">{user.document}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Rol</p>
                <p className="text-sm font-bold text-gray-800 capitalize">{user.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 sm:col-span-2">
              <Mail className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Correo institucional</p>
                <p className="text-sm font-bold text-gray-800">{user.email}</p>
              </div>
            </div>
          </div>

          <Button variant="secondary" fullWidth onClick={onLogout} icon={<LogOut className="w-4 h-4" />}>
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </main>
  );
};
