// Shared state for all fakes, reset by each test.
export const env = {
  storage: new Map(),
  settings: new Map(),
  bleConnected: true,
  widgets: [],
  vibrations: 0,
  pushes: [],
  nowMs: Date.UTC(2026, 0, 15, 17, 30, 5),
  offsetMinutes: -180,
  sideService: null,
  watchPage: null,
  calls: []
}

export function resetEnv() {
  env.storage = new Map()
  env.settings = new Map()
  env.bleConnected = true
  env.widgets = []
  env.vibrations = 0
  env.pushes = []
  env.calls = []
}
