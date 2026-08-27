import type { ModalProps } from "@mantine/core"
import { Modal } from "@mantine/core"

/**
 * Wraps Mantine's `Modal` with `removeScrollProps={{ gapMode: "padding" }}`
 * so every modal gets it automatically instead of relying on each call site
 * to remember the prop. Without it, react-remove-scroll's body scroll lock
 * defaults to compensating for the hidden scrollbar with `margin-right`,
 * which in this RTL app pushes body's box past the *left* edge instead of
 * the right, causing real horizontal overflow. `padding-right` doesn't shift
 * body's box, while still keeping the scroll lock itself intact.
 */
export const AppModal = ({ removeScrollProps, ...props }: ModalProps) => (
  <Modal
    removeScrollProps={{ gapMode: "padding", ...removeScrollProps }}
    {...props}
  />
)
