import type { DrawerProps } from "@mantine/core"
import { Drawer } from "@mantine/core"

/**
 * Wraps Mantine's `Drawer` with `removeScrollProps={{ gapMode: "padding" }}`,
 * mirroring `AppModal` -- see that component for why. `Drawer` is a separate
 * Mantine export from `Modal` (both extend the same `ModalBase` under the
 * hood), so it needs its own wrapper with the same fix.
 */
export const AppDrawer = ({ removeScrollProps, ...props }: DrawerProps) => (
  <Drawer
    removeScrollProps={{ gapMode: "padding", ...removeScrollProps }}
    {...props}
  />
)
