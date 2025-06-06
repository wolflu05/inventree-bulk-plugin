import { ReactNode } from "preact/compat";
import { useEffect } from "preact/hooks";

import { Button, ButtonVariant, Group, MantineColor, Modal, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

interface Action {
  label: string;
  color?: MantineColor;
  variant?: ButtonVariant;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface DialogProps {
  title: string;
  children: ReactNode;
  show: boolean;
  scrollable?: boolean;
  onClose?: () => void;
  actions?: Action[];
  size?: "sm" | "lg" | "xl";
}

export const Dialog = ({ title, children, show, scrollable, onClose, actions = [], size }: DialogProps) => {
  const [opened, { close, open }] = useDisclosure(false, { onClose });

  useEffect(() => {
    if (show) {
      open();
    } else {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  return (
    <Modal
      opened={opened}
      onClose={close}
      withCloseButton
      size={size}
      title={title}
      scrollAreaComponent={scrollable ? ScrollArea.Autosize : undefined}
    >
      {children}

      <Group justify="flex-end" gap="xs" mt={12}>
        {onClose && (
          <Button variant="outline" onClick={close}>
            Close
          </Button>
        )}
        {actions.map(({ label, variant, color, onClick, disabled = false, loading }) => (
          <Button onClick={onClick} disabled={disabled} variant={variant} color={color} loading={loading}>
            {label}
          </Button>
        ))}
      </Group>
    </Modal>
  );
};
