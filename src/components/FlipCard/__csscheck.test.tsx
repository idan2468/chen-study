import { render } from "@testing-library/react"
import classes from "@/components/FlipCard/FlipCard.module.css"

test("css module proxy", () => {
  console.log("statusKnown =", JSON.stringify(classes.statusKnown))
  console.log("face =", JSON.stringify(classes.face))
})
