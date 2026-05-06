import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * A mobile-first bottom sheet for actions and menus.
 */
export default function ActionDrawer({ 
  isOpen, 
  onClose, 
  title, 
  children,
  showClose = true
}) {
  // Prevent scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[200]"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[201] bg-zinc-950 border-t border-zinc-800 rounded-t-[2rem] shadow-2xl safe-area-pb"
          >
            {/* Drag Handle Indicator */}
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mt-3 mb-1" />
            
            <div className="px-6 pb-8 pt-2">
              <div className="flex items-center justify-between mb-6">
                {title && <h3 className="text-lg font-bold text-zinc-100">{title}</h3>}
                {showClose && (
                  <button 
                    onClick={onClose}
                    className="p-2 -mr-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <div className="space-y-1">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * Standardized drawer item component
 */
export function DrawerItem({ icon: Icon, label, onClick, variant = 'default' }) {
  const baseClasses = "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.98]";
  const variants = {
    default: "text-zinc-300 hover:bg-zinc-900 active:bg-zinc-900",
    danger: "text-red-400 hover:bg-red-500/10 active:bg-red-500/15",
    primary: "text-primary hover:bg-primary/10 active:bg-primary/15"
  };

  return (
    <button onClick={onClick} className={`${baseClasses} ${variants[variant]}`}>
      {Icon && <Icon className="w-5 h-5" />}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
