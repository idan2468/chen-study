import { Card, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { TopBar } from "../../components/TopBar/TopBar"
import classes from "./HubPage.module.css"

/** The two practice apps, as in the original `index.html`. */
const links = [
  {
    to: "/unseen",
    icon: "📖",
    titleKey: "hub.unseenTitle",
    descriptionKey: "hub.unseenDescription",
    ctaKey: "hub.unseenCta",
  },
  {
    to: "/modules",
    icon: "🩵",
    titleKey: "hub.modulesTitle",
    descriptionKey: "hub.modulesDescription",
    ctaKey: "hub.modulesCta",
  },
] as const

export const HubPage = () => {
  const { t } = useTranslation()

  return (
    <Container size="md" py="xl">
      <Stack gap="xl" align="center">
        <TopBar withHomeLink={false} />

        <Stack gap="xs" align="center" ta="center">
          <Title order={1} c="brand">
            {t("hub.title")}
          </Title>
          <Text c="dimmed" size="lg">
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
              padding="xl"
              shadow="md"
              className={classes.card}
            >
              <Stack gap="sm" h="100%">
                <Text className={classes.icon}>{link.icon}</Text>
                <Title order={3}>{t(link.titleKey)}</Title>
                <Text c="dimmed" size="sm" style={{ flex: 1 }}>
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
                  style={{ borderRadius: "var(--mantine-radius-md)" }}
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
