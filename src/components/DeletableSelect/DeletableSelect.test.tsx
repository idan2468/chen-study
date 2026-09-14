import { screen } from "@testing-library/react"
import { renderWithProviders } from "@test/render"
import { DeletableSelect } from "./DeletableSelect"

const longLabel =
  "Advanced review exercise with a very long descriptive title for mobile"

describe("DeletableSelect", () => {
  test("keeps the full selected label and marks completed items", async () => {
    const { user } = renderWithProviders(
      <DeletableSelect
        data={[
          { value: "done", label: longLabel, completed: true },
          { value: "pending", label: "Pending exercise" },
        ]}
        value="done"
        onChange={vi.fn()}
        onDelete={vi.fn()}
        selectLabel="Choose an exercise"
        deleteLabel="Delete exercise"
        completedLabel="Completed"
        leftSection={null}
      />,
    )

    expect(screen.getByRole("combobox")).toHaveValue(longLabel)
    expect(
      screen.getByRole("img", { name: `${longLabel}: Completed` }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("combobox"))

    expect(
      screen.getAllByRole("img", { name: `${longLabel}: Completed` }),
    ).toHaveLength(2)
    expect(screen.getByText("Pending exercise")).toBeInTheDocument()
  })
})
