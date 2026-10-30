/**
 * Chart document store — the single source of truth for the talking chart.
 * Holds the persisted `ChartDoc` (title, grid preset, slots, attribution flag),
 * UI selection state, and debounced localStorage persistence
 * (`talking-chart-doc-v1`). Architecture contract: context bundle line 62.
 */

import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ChartDoc, GridPreset, SlotData } from '../types/chart'
import type { IconRef } from '../types/icons'

/** localStorage key — the persistence single source (contract line 62). */
const STORAGE_KEY = 'talking-chart-doc-v1'

/** Debounce window so per-keystroke edits don't hammer storage. */
const PERSIST_DELAY_MS = 300

const DEFAULT_TITLE = 'My talking chart'
const DEFAULT_GRID: GridPreset = '4x5'

/** Column/row geometry per preset ('CxR'); drives slot count and the CSS grid layout. */
const GRID_GEOMETRY: Record<GridPreset, { columns: number; rows: number }> = {
  '2x2': { columns: 2, rows: 2 },
  '3x3': { columns: 3, rows: 3 },
  '4x5': { columns: 4, rows: 5 },
  '5x4': { columns: 5, rows: 4 },
}

function gridSlotCount(preset: GridPreset): number {
  const { columns, rows } = GRID_GEOMETRY[preset]
  return columns * rows
}

/** Monotonic fallback counter for runtimes without `crypto.randomUUID`. */
let slotCounter = 0

function createSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  slotCounter += 1
  return `slot-${Date.now().toString(36)}-${slotCounter}`
}

function createEmptySlot(): SlotData {
  return { id: createSlotId(), icon: null, label: '', color: null }
}

function createSlots(count: number): SlotData[] {
  return Array.from({ length: count }, () => createEmptySlot())
}

function createDoc(): ChartDoc {
  return {
    title: DEFAULT_TITLE,
    grid: DEFAULT_GRID,
    slots: createSlots(gridSlotCount(DEFAULT_GRID)),
    usesArasaac: false,
    updatedAt: Date.now(),
  }
}

/**
 * Reconcile slot count with a preset: existing content is kept positionally,
 * overflow is trimmed, missing slots are filled fresh empties.
 */
function fitSlots(slots: SlotData[], count: number): SlotData[] {
  if (slots.length === count) return slots
  if (slots.length > count) return slots.slice(0, count)
  return [...slots, ...createSlots(count - slots.length)]
}

// --- Defensive restore helpers (localStorage content is untrusted) ---

function isGridPreset(value: string): value is GridPreset {
  return Object.prototype.hasOwnProperty.call(GRID_GEOMETRY, value)
}

function toIconRef(value: unknown): IconRef | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<IconRef>
  if (candidate.source !== 'bundle' && candidate.source !== 'arasaac') return null
  if (typeof candidate.set !== 'string' || candidate.set === '') return null
  if (typeof candidate.name !== 'string' || candidate.name === '') return null
  return { source: candidate.source, set: candidate.set, name: candidate.name }
}

function toSlotData(value: unknown): SlotData | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<SlotData>
  if (typeof candidate.id !== 'string' || candidate.id === '') return null
  return {
    id: candidate.id,
    icon: toIconRef(candidate.icon),
    label: typeof candidate.label === 'string' ? candidate.label : '',
    color: typeof candidate.color === 'string' ? candidate.color : null,
  }
}

/** Validate a parsed payload; `null` means corrupt — caller starts fresh. */
function toChartDoc(value: unknown): ChartDoc | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<ChartDoc>
  if (typeof candidate.title !== 'string') return null
  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) return null
  const grid = typeof candidate.grid === 'string' && isGridPreset(candidate.grid) ? candidate.grid : DEFAULT_GRID
  const rawSlots: unknown[] = Array.isArray(candidate.slots) ? candidate.slots : []
  const slots = fitSlots(
    rawSlots.map(toSlotData).filter((slot): slot is SlotData => slot !== null),
    gridSlotCount(grid),
  )
  return {
    title: candidate.title,
    grid,
    slots,
    // Recompute from the restored slots — never trust the stored flag.
    usesArasaac: slots.some((slot) => slot.icon?.source === 'arasaac'),
    updatedAt: candidate.updatedAt,
  }
}

export const useChartStore = defineStore('chart', () => {
  // --- State ---
  const doc = ref<ChartDoc>(createDoc())
  /** UI-only selection; intentionally not part of ChartDoc (never persisted). */
  const selectedSlotId = ref<string | null>(null)
  /**
   * The empty card that is currently "asking" for its word (the grown
   * word picker). UI-only, never persisted, never set for filled cards.
   */
  const askingSlotId = ref<string | null>(null)
  const dirty = ref(false)
  const saved = ref(false)

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  // --- Derived ---
  const columns = computed(() => GRID_GEOMETRY[doc.value.grid].columns)
  const rows = computed(() => GRID_GEOMETRY[doc.value.grid].rows)
  const gridSize = computed(() => doc.value.slots.length)
  const selectedSlot = computed<SlotData | null>(() => {
    if (selectedSlotId.value === null) return null
    return doc.value.slots.find((slot) => slot.id === selectedSlotId.value) ?? null
  })
  /** Asking card (empty slot with its word picker open), or null. */
  const askingSlot = computed<SlotData | null>(() => {
    if (askingSlotId.value === null) return null
    return doc.value.slots.find((slot) => slot.id === askingSlotId.value) ?? null
  })
  /** How many cards hold a picture — drives the top-bar progress. */
  const placedCount = computed(
    () => doc.value.slots.filter((slot) => slot.icon !== null).length,
  )

  // --- Persistence ---

  function persistNow(): void {
    persistTimer = null
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc.value))
      dirty.value = false
      saved.value = true
    } catch {
      // Storage blocked/full — stay dirty so the status pill stays honest.
    }
  }

  /** Write immediately if a debounced persist is still pending (tab closing). */
  function flushPendingPersist(): void {
    if (persistTimer === null) return
    clearTimeout(persistTimer)
    persistNow()
  }

  function schedulePersist(): void {
    if (typeof window === 'undefined') return
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(persistNow, PERSIST_DELAY_MS)
  }

  /**
   * Stamp every document mutation. `usesArasaac` is recomputed so it always
   * reflects reality (true iff any placed icon is arasaac-sourced) — the
   * attribution notice must not outlive the pictograms it credits.
   */
  function touch(): void {
    doc.value.updatedAt = Date.now()
    doc.value.usesArasaac = doc.value.slots.some((slot) => slot.icon?.source === 'arasaac')
    dirty.value = true
    saved.value = false
  }

  /** Restore from storage on first store access; corrupt payloads start fresh. */
  function restore(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) {
        // First run — seed storage so it is the single source from the start.
        persistNow()
        return
      }
      const restored = toChartDoc(JSON.parse(raw) as unknown)
      if (restored === null) {
        // Corrupt payload — overwrite it with a fresh doc.
        persistNow()
        return
      }
      doc.value = restored
      dirty.value = false
      saved.value = true
    } catch {
      // Storage access denied — keep the fresh default doc, degrade quietly.
    }
  }

  // --- Actions ---

  function findSlot(slotId: string): SlotData | undefined {
    return doc.value.slots.find((slot) => slot.id === slotId)
  }

  function setTitle(title: string): void {
    doc.value.title = title
    touch()
  }

  /** Switch preset, preserving placed content positionally; trim/pad the rest. */
  function setGrid(preset: GridPreset): void {
    if (doc.value.grid === preset) return
    doc.value.slots = fitSlots(doc.value.slots, gridSlotCount(preset))
    doc.value.grid = preset
    // Selection is meaningless if its slot was trimmed away.
    if (selectedSlotId.value !== null && findSlot(selectedSlotId.value) === undefined) {
      selectedSlotId.value = null
    }
    touch()
  }

  function setSlotIcon(slotId: string, icon: IconRef): void {
    const slot = findSlot(slotId)
    if (slot === undefined) return
    // Copy the ref so callers can't mutate persisted state through their object.
    slot.icon = { source: icon.source, set: icon.set, name: icon.name }
    touch()
  }

  function setSlotLabel(slotId: string, label: string): void {
    const slot = findSlot(slotId)
    if (slot === undefined) return
    slot.label = label
    touch()
  }

  function setSlotColor(slotId: string, color: string | null): void {
    const slot = findSlot(slotId)
    if (slot === undefined) return
    slot.color = color
    touch()
  }

  function clearSlot(slotId: string): void {
    const slot = findSlot(slotId)
    if (slot === undefined) return
    slot.icon = null
    slot.label = ''
    slot.color = null
    if (askingSlotId.value === slotId) askingSlotId.value = null
    touch()
  }

  /** UI-only; never stamps updatedAt/dirty — selection is not document state. */
  function selectSlot(slotId: string | null): void {
    if (slotId !== null && findSlot(slotId) === undefined) return
    selectedSlotId.value = slotId
  }

  /**
   * Open (or close) the word picker on an empty card. Only truly empty,
   * existing slots may ask; asking also clears the filled-card selection —
   * the two edit surfaces never open at once.
   */
  function askSlot(slotId: string | null): void {
    if (slotId === null) {
      askingSlotId.value = null
      return
    }
    const slot = findSlot(slotId)
    if (slot === undefined || slot.icon !== null) return
    selectedSlotId.value = null
    askingSlotId.value = slotId
  }

  /**
   * Auto-advance: after placing into a card, the next empty card asks.
   * Returns the id it advanced to (null when the chart is complete).
   */
  function askNextAfter(slotId: string): string | null {
    const index = doc.value.slots.findIndex((slot) => slot.id === slotId)
    for (let step = 1; step <= doc.value.slots.length; step += 1) {
      const slot = doc.value.slots[(index + step) % doc.value.slots.length]
      if (slot !== undefined && slot.icon === null) {
        askingSlotId.value = slot.id
        return slot.id
      }
    }
    askingSlotId.value = null
    return null
  }

  function reset(): void {
    doc.value = createDoc()
    selectedSlotId.value = null
    askingSlotId.value = null
    dirty.value = true
    saved.value = false
  }

  // --- Wiring (registered after restore so restoring never triggers a re-save) ---

  if (typeof window !== 'undefined') {
    restore()

    // A tab closed inside the debounce window must not lose the last change.
    window.addEventListener('pagehide', flushPendingPersist)
    onScopeDispose(() => {
      window.removeEventListener('pagehide', flushPendingPersist)
      if (persistTimer !== null) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
    })

    // Single persistence path: every doc mutation (incl. updatedAt stamps) lands here.
    watch(doc, schedulePersist, { deep: true })
  }

  return {
    // state
    doc,
    selectedSlotId,
    askingSlotId,
    dirty,
    saved,
    // derived
    columns,
    rows,
    gridSize,
    selectedSlot,
    askingSlot,
    placedCount,
    // actions
    setTitle,
    setGrid,
    setSlotIcon,
    setSlotLabel,
    setSlotColor,
    clearSlot,
    selectSlot,
    askSlot,
    askNextAfter,
    reset,
  }
})
