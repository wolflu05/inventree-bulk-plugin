import { ComponentChildren, createContext, createRef } from "preact";
import { useCallback, useContext, useRef, useState } from "preact/hooks";

type NotificationType = "info" | "danger" | "success";

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  autoHide?: boolean;
}

type UninitializedNotification = Omit<Notification, "id">;

interface NotificationContextType {
  showNotification: (notification: UninitializedNotification) => void;
}

export const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => 1,
});

export const useNotifications = () => {
  const { showNotification } = useContext(NotificationContext);
  return { showNotification };
};

interface NotificationWrapperProps {
  children: ComponentChildren;
}

export const NotificationWrapper = ({ children }: NotificationWrapperProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationRefs = useRef([]);
  notificationRefs.current = notifications.map((_element, i) => notificationRefs.current[i] ?? createRef());

  const showNotification = useCallback((options: UninitializedNotification) => {
    const id = Math.random().toString(36).substring(2);
    const notification: Notification = { id, autoHide: true, ...options };
    setNotifications((n) => [...n, notification]);
    setTimeout(() => {
      const idx = notificationRefs.current.length - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = (notificationRefs.current as any)[idx].current;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const toast = bootstrap.Toast.getOrCreateInstance(ref, { autohide: notification.autoHide });
      toast.show();

      ref.addEventListener("hidden.bs.toast", () => {
        setNotifications((notifications) => notifications.filter((n) => n.id !== id));
      });
    }, 0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
      }}
    >
      <div>
        {children}
        <div style="position: fixed; bottom: 6px; right: 6px; display: flex; flex-direction: column; gap: 6px; z-index: 999999;">
          {notifications.map(({ id, type, message }, i) => (
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              class="toast"
              key={id}
              style="border-radius: 5px;"
              ref={notificationRefs.current[i]}
            >
              <div class={`alert alert-${type}`} style="margin-bottom: 0; padding: 8px; opacity: 0.8;">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>{message}</div>
                  <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="toast"
                    aria-label="Close"
                    style={{ fontSize: "10px" }}
                  ></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};
