import { useMediaQuery } from "@mantine/hooks"
import { MOBILE_MAX_WIDTH_QUERY } from "@/constants/breakpoints"

/** True below the shared mobile breakpoint. */
export const useIsMobile = (): boolean => useMediaQuery(MOBILE_MAX_WIDTH_QUERY)
