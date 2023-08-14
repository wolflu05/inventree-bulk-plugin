import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface Action {
  label: string;
  type: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface DialogProps {
  title: string;
  children: ComponentChildren;
  show: boolean;
  onClose?: () => void;
  actions?: Action[];
}

export const Dialog = ({ title, children, show, onClose, actions = [] }: DialogProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modalInstance = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    modalInstance.current = bootstrap.Modal.getOrCreateInstance(modalRef.current);
  }, []);

  useEffect(() => {
    if (show) {
      modalInstance.current.show();
    } else {
      modalInstance.current.hide();
    }
  }, [show]);

  useEffect(() => {
    const el = modalRef?.current;
    if (!el) return;
    const handleClose = () => onClose?.();
    el.addEventListener("hidden.bs.modal", handleClose);
    return () => el.removeEventListener("hidden.bs.modal", handleClose);
  }, [onClose]);

  return (
    <div class="modal fade" tabIndex={-1} ref={modalRef}>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">{children}</div>
          <div class="modal-footer">
            {onClose && (
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
            )}
            {actions.map(({ label, type, onClick, disabled = false, loading }) => (
              <button type="button" class={`btn btn-${type}`} onClick={onClick} disabled={disabled}>
                {loading && <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
