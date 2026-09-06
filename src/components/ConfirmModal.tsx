import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  LogOut, 
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

export type ModalType = 'danger' | 'warning' | 'info' | 'success' | 'delete' | 'logout';

export interface ConfirmModalProps {
  isOpen: boolean;
  type?: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  type = 'warning',
  title,
  message,
  confirmText,
  cancelText = 'বাতিল',
  isAlertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = type === 'danger' || type === 'delete';
  const isLogout = type === 'logout';
  const isSuccess = type === 'success';

  const defaultConfirmText = isAlertOnly 
    ? 'ঠিক আছে' 
    : isDanger 
      ? 'হ্যাঁ, মুছুন' 
      : isLogout 
        ? 'হ্যাঁ, লগআউট' 
        : 'নিশ্চিত করুন';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCancel}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-[92%] sm:max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 overflow-hidden text-center z-10 font-sans"
        >
          {/* Ambient top glow */}
          <div 
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isDanger 
                ? 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-600' 
                : isLogout 
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
                  : isSuccess
                    ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600'
                    : 'bg-gradient-to-r from-brand-green via-emerald-500 to-brand-green-dark'
            }`} 
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="flex justify-center mb-4 mt-1">
            <div 
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center relative shadow-inner ${
                isDanger
                  ? 'bg-rose-50 text-rose-600 ring-8 ring-rose-50/50'
                  : isLogout
                    ? 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/50'
                    : isSuccess
                      ? 'bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50'
                      : type === 'warning'
                        ? 'bg-amber-50 text-amber-600 ring-8 ring-amber-50/50'
                        : 'bg-brand-green/10 text-brand-green ring-8 ring-brand-green/5'
              }`}
            >
              {isDanger && <Trash2 className="w-7 h-7 sm:w-8 sm:h-8" />}
              {isLogout && <LogOut className="w-7 h-7 sm:w-8 sm:h-8" />}
              {isSuccess && <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />}
              {type === 'warning' && !isLogout && <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />}
              {type === 'info' && <Info className="w-7 h-7 sm:w-8 sm:h-8" />}
              {!isDanger && !isLogout && !isSuccess && type !== 'warning' && type !== 'info' && (
                <HelpCircle className="w-7 h-7 sm:w-8 sm:h-8" />
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-snug">
            {title}
          </h3>

          {/* Message description */}
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-2.5 max-w-sm mx-auto whitespace-pre-line">
            {message}
          </p>

          {/* Action buttons */}
          <div className={`mt-6 flex items-center gap-3 ${isAlertOnly ? 'justify-center' : 'justify-between'}`}>
            {!isAlertOnly && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200/90 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-50 active:scale-95 transition-all cursor-pointer bg-white"
              >
                {cancelText}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border-0 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                  : isLogout
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                    : 'bg-brand-green hover:bg-brand-green-dark shadow-brand-green/25'
              }`}
            >
              {confirmText || defaultConfirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
