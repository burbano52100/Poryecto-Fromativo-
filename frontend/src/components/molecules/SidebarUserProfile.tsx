import { GraduationCap, Users, ClipboardList, Heart, ShieldCheck } from 'lucide-react';
import type { User } from '../../schemas/auth.schema';

export interface SidebarUserProfileProps {
  user: User;
}

export const SidebarUserProfile = ({ user }: SidebarUserProfileProps) => {
  const isInstructor = user.role === 'instructor';
  const isEncargado = user.role === 'encargado';
  const isInvitado = user.role === 'invitado';

  const roleTitle = isInvitado
    ? 'Invitado Especial'
    : isEncargado
    ? 'Encargado del Comedor'
    : isInstructor
    ? 'Instructor SENA'
    : 'Aprendiz SENA';

  const avatarStyles = isInvitado
    ? 'bg-teal-100 border-teal-500 text-teal-700'
    : isEncargado
    ? 'bg-amber-100 border-amber-500 text-amber-700'
    : isInstructor
    ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
    : 'bg-emerald-100 border-emerald-500 text-emerald-700';

  const dotStyles = isInvitado
    ? 'bg-teal-500'
    : isEncargado
    ? 'bg-amber-500'
    : isInstructor
    ? 'bg-indigo-500'
    : 'bg-emerald-500';

  const roleBadgeStyles = isInvitado
    ? 'text-teal-700 font-bold'
    : isEncargado
    ? 'text-amber-700 font-bold'
    : isInstructor
    ? 'text-indigo-700 font-bold'
    : 'text-emerald-700 font-bold';

  const statusBadgeStyles = isInvitado
    ? 'bg-teal-50 border-teal-200 text-teal-800'
    : isEncargado
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : isInstructor
    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50/90 rounded-2xl border border-gray-200 text-gray-900 shadow-xs">
      <div className="relative mb-3">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-xs ${avatarStyles}`}>
          {isInvitado ? (
            <Heart className="w-8 h-8" />
          ) : isEncargado ? (
            <ClipboardList className="w-8 h-8" />
          ) : isInstructor ? (
            <Users className="w-8 h-8" />
          ) : (
            <GraduationCap className="w-8 h-8" />
          )}
        </div>
        <span
          className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full ${dotStyles}`}
          title="Usuario Activo"
        />
      </div>

      <h3 className="text-base font-bold text-gray-900 text-center leading-tight tracking-tight">
        {user.name}
      </h3>

      <p className={`text-xs mt-0.5 ${roleBadgeStyles}`}>
        {roleTitle}
      </p>

      <div className="mt-2.5 w-full pt-2.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-1 text-gray-500">
          <span className="font-semibold text-gray-600">
            {isInvitado ? 'ID:' : isEncargado ? 'ID:' : isInstructor ? 'Doc:' : 'Ficha:'}
          </span>
          <span className="font-bold text-gray-900">
            {isInvitado ? (user.id || 'INV-001') : isEncargado ? (user.id || user.document) : isInstructor ? user.document : (user.ficha || '1')}
          </span>
        </div>

        <div className={`flex items-center gap-1 border px-2 py-0.5 rounded-full font-semibold text-[11px] ${statusBadgeStyles}`}>
          <ShieldCheck className="w-3 h-3" />
          <span>{user.status || 'Activo'}</span>
        </div>
      </div>
    </div>
  );
};
