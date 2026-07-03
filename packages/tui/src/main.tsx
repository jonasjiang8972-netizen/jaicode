import { render } from "ink"
import { App } from "./App"

export function launchTUI() {
  const { waitUntilExit } = render(<App />)
  return waitUntilExit
}
