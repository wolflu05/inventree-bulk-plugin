import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

type ButtonColorTypes = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";
type ButtonStyleTypes = "" | "outline-";
type ButtonType = `${ButtonStyleTypes}${ButtonColorTypes}`;

interface Action {
  label: string;
  type: ButtonType;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface DialogProps {
  title: string;
  children: ComponentChildren;
  show: boolean;
  scrollable?: boolean;
  onClose?: () => void;
  actions?: Action[];
  size?: "sm" | "lg" | "xl";
}

export const Dialog = ({ title, children, show, scrollable, onClose, actions = [], size }: DialogProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modalInstance = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    modalInstance.current = bootstrap.Modal.getOrCreateInstance(modalRef.current, { backdrop: "static" });
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

  useEffect(() => {
    // close modal on component unmount
    return () => modalInstance.current.hide();
  }, []);

  return (
    <div class={`modal fade ${size ? `modal-${size}` : ""}`} tabIndex={-1} ref={modalRef}>
      <div class={`modal-dialog ${scrollable ? "modal-dialog-scrollable" : ""}`}>
        <div class="modal-content" style={`${!scrollable ? "max-height: 92vh;" : ""}`}>
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
