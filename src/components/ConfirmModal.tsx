import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'primary' | 'success';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmType = 'primary'
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const getIcon = () => {
    if (confirmType === 'danger') return <AlertTriangle size={32} color="var(--color-danger)" />;
    if (confirmType === 'success') return <CheckCircle2 size={32} color="var(--color-success)" />;
    return <Info size={32} color="var(--color-primary)" />;
  };

  const getIconBg = () => {
    if (confirmType === 'danger') return 'var(--color-danger-bg)';
    if (confirmType === 'success') return 'var(--color-success-bg)';
    return 'var(--color-primary-light)';
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.45)', // Ardósia profunda com transparência
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999,
      backdropFilter: 'blur(3px)'
    }}>
      <div className="card animate-scale-up" style={{ 
        width: '100%', 
        maxWidth: '440px', 
        backgroundColor: 'var(--color-bg-surface)',
        padding: '2.5rem',
        textAlign: 'center',
        border: 'none',
        boxShadow: 'var(--shadow-float)'
      }}>
        <div style={{ 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          backgroundColor: getIconBg(), 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 1.5rem' 
        }}>
          {getIcon()}
        </div>
        
        <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem', color: 'var(--color-text-main)' }}>
          {title}
        </h2>
        
        <div style={{ marginBottom: '2rem', color: 'var(--color-text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
          {message}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {onCancel && (
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button 
            type="button" 
            className={`btn btn-${confirmType === 'danger' ? 'danger' : 'primary'}`} 
            style={{ flex: 1, padding: '0.75rem' }} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
