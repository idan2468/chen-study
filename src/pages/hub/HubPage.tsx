import { Card, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconBook2, IconCards } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { TopBar } from "@/components/TopBar/TopBar"
import { APP_ROUTES } from "@/constants/routes"
import { useIsMobile } from "@/hooks/useIsMobile"
import classes from "./HubPage.module.css"

/** The two practice apps, as in the original `index.html`. */
const links = [
  {
    to: APP_ROUTES.unseen,
    Icon: IconBook2,
    titleKey: "hub.unseenTitle",
    descriptionKey: "hub.unseenDescription",
    ctaKey: "hub.unseenCta",
  },
  {
    to: APP_ROUTES.modules,
    Icon: IconCards,
    titleKey: "hub.modulesTitle",
    descriptionKey: "hub.modulesDescription",
    ctaKey: "hub.modulesCta",
  },
] as const

export const HubPage = () => {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  return (
    <Container
      size="md"
      py={{ base: "md", sm: "xl" }}
      px={{ base: "xs", sm: "md" }}
    >
      <Stack gap="xl" align="center">
        <TopBar withHomeLink={false} />

        <Stack gap="xs" align="center" ta="center">
          <Title order={1} c="brand" fz={{ base: 22, sm: 34 }}>
            {t("hub.title")}
          </Title>
          <Text c="dimmed" size={isMobile ? "sm" : "lg"}>
            {t("hub.subtitle")}
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" w="100%">
          {links.map(link => (
            <Card
              key={link.to}
              component={Link}
              to={link.to}
              withBorder
              radius="lg"
              padding={isMobile ? "md" : "xl"}
              shadow="md"
              className={classes.card}
            >
              <Stack gap="sm" h="100%">
                <link.Icon className={classes.icon} size={40} />
                <Title order={3}>{t(link.titleKey)}</Title>
                <Text c="dimmed" size="sm" className={classes.description}>
                  {t(link.descriptionKey)}
                </Text>
                <Text
                  className={classes.cta}
                  fw={700}
                  ta="center"
                  py="sm"
                  px="md"
                  bg="brand.7"
                  c="white"
                >
                  {t(link.ctaKey)}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Text c="dimmed" size="xs" ta="center">
          {t("hub.footer")}
        </Text>
      </Stack>
    </Container>
  )
}
