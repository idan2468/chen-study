import { Stack, Text } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { CopyDebugInfoButton } from "@/components/CopyDebugInfoButton/CopyDebugInfoButton"

export const notifyErrorWithDebugInfo = (
  message: string,
  debugInfo: string,
) => {
  notifications.show({
    color: "red",
    // Stays open until dismissed, so there's time to copy the debug info.
    autoClose: false,
    message: (
      <Stack gap="xs" align="flex-start">
        <Text size="sm">{message}</Text>
        <CopyDebugInfoButton debugInfo={debugInfo} />
      </Stack>
    ),
  })
}
