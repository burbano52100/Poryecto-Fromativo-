import { Award, ShieldCheck, GraduationCap, Users } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';

interface DevQuickLoginProps {
  onLoginSuccess?: (role: string, document: string) => void;
}

export const DevQuickLogin = ({ onLoginSuccess }: DevQuickLoginProps) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const triggerDevLogin = (user: User) => {
    localStorage.setItem('gastrosena_token', 'dev_session_token');
    localStorage.setItem('gastrosena_role', user.role);
    localStorage.setItem('gastrosena_user', JSON.stringify(user));
    if (onLoginSuccess) {
      onLoginSuccess(user.role, user.document);
    }
  };

  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 mb-2.5">
        <p className="text-[11px] font-bold text-amber-900 text-center uppercase tracking-wider">
          Herramientas de Desarrollo (Solo DEV)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            triggerDevLogin({
              id: 'usr_aprendiz_01',
              document: '1005678901',
              ficha: '2847251',
              name: 'Carlos Ruiz',
              role: 'aprendiz',
              email: 'carlos.ruiz@misena.edu.co',
              status: 'ACTIVE',
              es_beneficiario: true,
            });
          }}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-left cursor-pointer transition"
        >
          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Aprendiz Beneficiario ($0)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerDevLogin({
              id: 'usr_encargado',
              document: '123456789',
              name: 'Carlos Encargado',
              role: 'encargado',
              email: 'carlos.encargado@sena.edu.co',
              status: 'ACTIVE',
            });
          }}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-left cursor-pointer transition shadow-xs"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
          <span>Encargado (Admin)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerDevLogin({
              id: 'usr_aprendiz_02',
              document: '1005678902',
              ficha: '2847251',
              name: 'Ana María Torres',
              role: 'aprendiz',
              email: 'ana.torres@misena.edu.co',
              status: 'ACTIVE',
              es_beneficiario: false,
            });
          }}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-left cursor-pointer transition"
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Aprendiz Regular ($5k)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerDevLogin({
              id: 'usr_instructor',
              document: '1098765432',
              name: 'María Fernanda Gómez',
              role: 'instructor',
              email: 'mgomez@sena.edu.co',
              status: 'ACTIVE',
            });
          }}
          className="flex items-center gap-1.5 p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-left cursor-pointer transition"
        >
          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Instructor SENA</span>
        </button>
      </div>
    </div>
  );
};
