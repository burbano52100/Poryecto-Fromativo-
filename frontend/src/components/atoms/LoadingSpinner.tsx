interface LoadingSpinnerProps {
  label?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner = ({ label, fullScreen = false }: LoadingSpinnerProps) => (
  <div
    role="status"
    className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen bg-slate-100' : 'py-10'}`}
  >
    <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    {label && <p className="text-sm font-semibold text-gray-600">{label}</p>}
  </div>
);
