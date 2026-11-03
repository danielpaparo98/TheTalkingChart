/**
 * useCellDrag unit tests — the card→card swap drag contract between GridCell
 * roots (encode/parse round-trip, rejection of malformed payloads, MIME
 * presence check, drag-source tracking, drop-kind classification, swap FLIP
 * math and scheduling, library-place hand-off). DataTransfer / DataTransfer +
 * element objects are structural stubs — no DOM environment needed.
 */

import { describe, expect, test, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'

import {
  CELL_DRAG_MIME,
  LIBRARY_PLACE_EVENT,
  SWAP_FLIP_MS,
  beginCellDrag,
  clearCellDragSource,
  cellDragSource,
  decideDragOver,
  emitLibraryPlace,
  encodeCellDragPayload,
  flipOffset,
  hasCellDragData,
  markCellDragSource,
  parseCellDragPayload,
  readCellDragData,
  scheduleSwapFlip,
  useCellDrop,
} from './useCellDrag'
import type { CellDropHooks, FlipElement, RectLike, SwapFlipOptions } from './useCellDrag'
import { LIBRARY_DRAG_MIME, encodeLibraryDragPayload } from './useLibraryDrag'

const PAYLOAD: { index: number; label: string } = { index: 3, label: 'dog face' }

describe('encode/parse round-trip', () => {
  test('a payload survives encode → parse unchanged', () => {
    expect(parseCellDragPayload(encodeCellDragPayload(PAYLOAD))).toEqual(PAYLOAD)
  })

  test('an empty label (icon-only card) survives unchanged', () => {
    const bare = { index: 0, label: '' }
    expect(parseCellDragPayload(encodeCellDragPayload(bare))).toEqual(bare)
  })

  test('a unicode label survives unchanged', () => {
    const labelled = { index: 11, label: 'dog face 🐕' }
    expect(parseCellDragPayload(encodeCellDragPayload(labelled))).toEqual(labelled)
  })
})

describe('parseCellDragPayload rejects junk', () => {
  test('rejects non-JSON text and non-object JSON', () => {
    expect(parseCellDragPayload('not json')).toBeNull()
    expect(parseCellDragPayload('"just a string"')).toBeNull()
    expect(parseCellDragPayload(null)).toBeNull()
    expect(parseCellDragPayload(undefined)).toBeNull()
    expect(parseCellDragPayload(42)).toBeNull()
  })

  test('rejects missing or invalid indexes', () => {
    expect(parseCellDragPayload({ label: 'dog' })).toBeNull()
    expect(parseCellDragPayload({ index: -1, label: 'dog' })).toBeNull()
    expect(parseCellDragPayload({ index: 1.5, label: 'dog' })).toBeNull()
    expect(parseCellDragPayload({ index: '3', label: 'dog' })).toBeNull()
  })

  test('rejects missing or non-string labels', () => {
    expect(parseCellDragPayload({ index: 3 })).toBeNull()
    expect(parseCellDragPayload({ index: 3, label: 7 })).toBeNull()
  })
})

describe('hasCellDragData', () => {
  const transferWith = (types: string[]) => ({ types }) as unknown as DataTransfer

  test('true when the cell MIME is present (dragover protected mode)', () => {
    expect(hasCellDragData(transferWith(['text/plain', CELL_DRAG_MIME]))).toBe(true)
  })

  test('false for library drags and plain text', () => {
    expect(hasCellDragData(transferWith(['text/plain']))).toBe(false)
    expect(hasCellDragData(transferWith([LIBRARY_DRAG_MIME]))).toBe(false)
  })

  test('false without a DataTransfer', () => {
    expect(hasCellDragData(null)).toBe(false)
  })
})

describe('beginCellDrag stages the transfer', () => {
  test('sets both MIME payloads and effectAllowed move', () => {
    const transfer = {
      effectAllowed: '',
      setData: vi.fn(),
    }
    beginCellDrag({ dataTransfer: transfer } as unknown as DragEvent, PAYLOAD)

    expect(transfer.effectAllowed).toBe('move')
    expect(transfer.setData).toHaveBeenCalledWith(CELL_DRAG_MIME, encodeCellDragPayload(PAYLOAD))
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', PAYLOAD.label)
  })

  test('no-ops without a DataTransfer', () => {
    expect(() => beginCellDrag({ dataTransfer: null } as unknown as DragEvent, PAYLOAD)).not.toThrow()
  })
})

describe('readCellDragData', () => {
  test('parses the staged payload on drop', () => {
    const transfer = {
      getData: (type: string) => (type === CELL_DRAG_MIME ? encodeCellDragPayload(PAYLOAD) : ''),
    }
    expect(readCellDragData(transfer as unknown as DataTransfer)).toEqual(PAYLOAD)
  })

  test('null for foreign drags and missing transfers', () => {
    const transfer = { getData: () => 'icon stuff' }
    expect(readCellDragData(transfer as unknown as DataTransfer)).toBeNull()
    expect(readCellDragData(null)).toBeNull()
  })
})

describe('drag-source tracking (HTML5 hides payload data in dragover)', () => {
  test('mark → read → clear round-trip', () => {
    expect(cellDragSource()).toBeNull()
    markCellDragSource(5)
    expect(cellDragSource()).toBe(5)
    clearCellDragSource()
    expect(cellDragSource()).toBeNull()
  })

  test('re-marking replaces the previous source', () => {
    markCellDragSource(2)
    markCellDragSource(7)
    expect(cellDragSource()).toBe(7)
    clearCellDragSource()
    expect(cellDragSource()).toBeNull()
  })
})

describe('decideDragOver', () => {
  const transferWith = (types: string[]) => ({ types }) as unknown as DataTransfer

  test('library drags always land copy', () => {
    clearCellDragSource()
    expect(decideDragOver(transferWith([LIBRARY_DRAG_MIME, 'text/plain']), 4)).toBe('copy')
    markCellDragSource(1)
    expect(decideDragOver(transferWith([LIBRARY_DRAG_MIME]), 1)).toBe('copy')
    clearCellDragSource()
  })

  test('foreign card drags land move', () => {
    markCellDragSource(2)
    expect(decideDragOver(transferWith([CELL_DRAG_MIME]), 5)).toBe('move')
    clearCellDragSource()
  })

  test('the dragged card own slot lands self (hover suppressed)', () => {
    markCellDragSource(3)
    expect(decideDragOver(transferWith([CELL_DRAG_MIME]), 3)).toBe('self')
    clearCellDragSource()
  })

  test('a card drag with no tracked source still lands move (drop re-validates)', () => {
    clearCellDragSource()
    expect(decideDragOver(transferWith([CELL_DRAG_MIME]), 0)).toBe('move')
  })

  test('everything without a known MIME lands none', () => {
    clearCellDragSource()
    expect(decideDragOver(transferWith(['text/plain']), 0)).toBe('none')
    expect(decideDragOver(null, 0)).toBe('none')
  })
})

describe('flipOffset', () => {
  test('measures how far a card must translate to sit at its old slot', () => {
    const from: RectLike = { left: 100, top: 50 }
    const to: RectLike = { left: 60, top: 20 }
    expect(flipOffset(from, to)).toEqual({ dx: 40, dy: 30 })
  })

  test('zero delta means no animation is staged', () => {
    const rect: RectLike = { left: 10, top: 10 }
    expect(flipOffset(rect, rect)).toEqual({ dx: 0, dy: 0 })
  })
})

describe('scheduleSwapFlip', () => {
  interface Stub extends FlipElement {
    rect: { left: number; top: number }
  }

  function stubEl(left: number, top: number): Stub {
    return {
      style: { transition: '', transform: '' },
      getBoundingClientRect: () => ({ left, top }),
      addEventListener: vi.fn(),
      rect: { left, top },
    }
  }

  function run(options: Omit<SwapFlipOptions, 'resolveEl' | 'raf'>, slotA: Stub, slotB: Stub): string[][] {
    const queue: Array<() => void> = []
    scheduleSwapFlip({
      ...options,
      resolveEl: (index) => (index === options.fromIndex ? slotA : slotB),
      raf: (callback: () => void) => {
        queue.push(callback)
      },
    })
    const recorded: string[][] = []
    // rAF #1: pins both cards at their old slots; rAF #2: releases them.
    while (queue.length > 0) {
      const step = queue.shift()
      if (step !== undefined) step()
      recorded.push([slotA.style.transition, slotA.style.transform, slotB.style.transition, slotB.style.transform])
    }
    return recorded
  }

  test('pins both moved cards, then releases over a 160ms transform ease', () => {
    // Post-swap homes: the card arriving at slot 3 came from slot 5's old seat
    // (preToRect) and vice versa (preFromRect = the dragged card's old seat).
    const slotFrom = stubEl(200, 300) // card arriving at slot 3
    const slotTo = stubEl(40, 10) // card arriving at slot 5
    const frames = run(
      {
        fromIndex: 3,
        toIndex: 5,
        preFromRect: { left: 200, top: 300 },
        preToRect: { left: 40, top: 10 },
      },
      slotFrom,
      slotTo,
    )

    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual([
      'none',
      'translate(-160px, -290px)',
      'none',
      'translate(160px, 290px)',
    ])
    expect(frames[1]).toEqual([
      `transform ${SWAP_FLIP_MS}ms ease`,
      '',
      `transform ${SWAP_FLIP_MS}ms ease`,
      '',
    ])
  })

  test('skips cards that did not actually move', () => {
    // The card arriving at slot 3 (fromIndex) took no move: its pin pinches
    // zero offset and is excluded — only the other card stages a translate.
    const stationaryCard = stubEl(40, 10) // resolving slot fromIndex (3)
    const movedCard = stubEl(0, 0) // resolving slot toIndex (5)
    const frames = run(
      {
        fromIndex: 3,
        toIndex: 5,
        preFromRect: { left: 50, top: 20 },
        preToRect: { left: 40, top: 10 },
      },
      stationaryCard,
      movedCard,
    )

    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual(['', '', 'none', 'translate(50px, 20px)'])
    expect(frames[1]).toEqual(['', '', `transform ${SWAP_FLIP_MS}ms ease`, ''])
  })

  test('no-ops under reduced motion', () => {
    const queue: Array<() => void> = []
    scheduleSwapFlip({
      fromIndex: 0,
      toIndex: 1,
      preFromRect: { left: 0, top: 0 },
      preToRect: { left: 100, top: 100 },
      reduced: true,
      resolveEl: () => stubEl(0, 0),
      raf: (callback: () => void) => {
        queue.push(callback)
      },
    })
    expect(queue).toHaveLength(0)
  })

  test('no-ops outside a scheduling context (SSR)', () => {
    expect(() =>
      scheduleSwapFlip({
        fromIndex: 0,
        toIndex: 1,
        preFromRect: { left: 0, top: 0 },
        preToRect: { left: 100, top: 100 },
        reduced: false,
        raf: undefined,
        resolveEl: undefined,
      }),
    ).not.toThrow()
  })
})

describe('emitLibraryPlace', () => {
  const PLACE_PAYLOAD = { icon: { source: 'bundle', set: 'openmoji', name: 'dog-face' }, label: 'dog face' } as const

  test('dispatches a bubbling custom event with index + payload detail', { skip: typeof CustomEvent === 'undefined' }, () => {
    const events: CustomEvent[] = []
    const stub = { dispatchEvent: (event: CustomEvent) => events.push(event) }
    emitLibraryPlace(stub, { index: 4, payload: PLACE_PAYLOAD })

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe(LIBRARY_PLACE_EVENT)
    expect(events[0]?.bubbles).toBe(true)
    expect(events[0]?.detail).toEqual({ index: 4, payload: PLACE_PAYLOAD })
  })

  test('no-ops for non-dispatching sources', () => {
    expect(() => emitLibraryPlace(null, { index: 0, payload: PLACE_PAYLOAD })).not.toThrow()
    expect(() => emitLibraryPlace(undefined, { index: 0, payload: PLACE_PAYLOAD })).not.toThrow()
    expect(() => emitLibraryPlace({}, { index: 0, payload: PLACE_PAYLOAD })).not.toThrow()
  })
})

// --- useCellDrop: per-cell drop-target state machine ------------------------
// Node-safe stub style (same as the suites above): structural DataTransfer /
// element stubs, plus scoped global stubs (`window` for the FLIP scheduler,
// `Node` for relatedTarget instanceof checks) that never leak between tests.

describe('useCellDrop (drop/target side)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearCellDragSource()
  })

  /** Structural event stub — only what the handlers touch. */
  function eventData(transfer: Partial<DataTransfer> | null, currentTarget: unknown = null, relatedTarget: Node | null = null): DragEvent {
    return {
      dataTransfer: (transfer ?? null) as DataTransfer | null,
      preventDefault: vi.fn(),
      currentTarget,
      relatedTarget,
    } as unknown as DragEvent
  }

  interface Harness {
    root: { getBoundingClientRect: ReturnType<typeof vi.fn>; contains: ReturnType<typeof vi.fn> }
    onSwap: ReturnType<typeof vi.fn>
    hooks: CellDropHooks
  }

  /** Hooks whose root/onSwap log into shared spies so order is assertable. */
  function makeHarness(index: number): Harness {
    const root = {
      getBoundingClientRect: vi.fn(() => ({ left: 40, top: 10 })),
      contains: vi.fn(() => false),
    }
    const onSwap = vi.fn()
    return {
      root,
      onSwap,
      hooks: {
        index: () => index,
        label: () => 'dog face',
        root: () => root as unknown as HTMLElement,
        onSwap,
      },
    }
  }

  /** Transfer carrying a card→cell swap payload (source index + label). */
  function cellTransfer(from: number): Partial<DataTransfer> {
    return {
      types: [CELL_DRAG_MIME],
      getData: (type: string) => (type === CELL_DRAG_MIME ? encodeCellDragPayload({ index: from, label: 'dog face' }) : ''),
    }
  }

  /** Stub `window` so a (hypothetical) flip schedule is observable via rAF. */
  function stubWindowForFlip(): Array<() => void> {
    const rafQueue: Array<() => void> = []
    vi.stubGlobal('window', {
      requestAnimationFrame: (callback: () => void) => {
        rafQueue.push(callback)
        return rafQueue.length
      },
      matchMedia: () => ({ matches: false }),
    })
    return rafQueue
  }

  function dragStartEvent(): DragEvent {
    return eventData({ effectAllowed: '', setData: vi.fn() } as unknown as Partial<DataTransfer>) as DragEvent
  }

  test('drop with a malformed cell payload: no swap, no FLIP, hover reset', () => {
    const harness = makeHarness(2)
    const drop = useCellDrop(harness.hooks)
    const rafQueue = stubWindowForFlip()

    // Hover first so the reset is observable.
    drop.onDragOver(eventData({ types: [CELL_DRAG_MIME] } as Partial<DataTransfer>) as DragEvent)
    expect(drop.dropHover.value).toBe(true)

    const malformed = { types: [CELL_DRAG_MIME], getData: () => 'not json' } as Partial<DataTransfer>
    drop.onDrop(eventData(malformed) as DragEvent)

    expect(drop.dropHover.value).toBe(false)
    expect(harness.onSwap).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(0) // scheduleSwapFlip never ran
  })

  test('drop onto its own slot (from === to): no swap, no FLIP, no rect capture', () => {
    const harness = makeHarness(3)
    const drop = useCellDrop(harness.hooks)
    const rafQueue = stubWindowForFlip()

    drop.onDrop(eventData(cellTransfer(3)) as DragEvent)

    expect(harness.onSwap).not.toHaveBeenCalled()
    expect(harness.root.getBoundingClientRect).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(0)
  })

  test('pre-swap rect capture happens BEFORE hooks.onSwap (ordering spies)', () => {
    const harness = makeHarness(1)
    const drop = useCellDrop(harness.hooks)
    const log: string[] = []
    harness.root.getBoundingClientRect.mockImplementation(() => {
      log.push('rect')
      return { left: 40, top: 10 }
    })
    harness.onSwap.mockImplementation(() => {
      log.push('swap')
    })

    drop.onDrop(eventData(cellTransfer(4)) as DragEvent)

    expect(harness.onSwap).toHaveBeenCalledWith(4, 1)
    expect(log).toEqual(['rect', 'swap'])
    // Node has no `document`, so no FLIP schedule (the from-rect resolver
    // yields null there) — the ordering guarantee is what these spies pin.
  })

  test('library drop hands (index, validated payload) up via emitLibraryPlace', { skip: typeof CustomEvent === 'undefined' }, () => {
    const harness = makeHarness(5)
    const drop = useCellDrop(harness.hooks)
    const dispatched: CustomEvent[] = []
    const currentTarget = { dispatchEvent: (event: CustomEvent) => dispatched.push(event) }
    const payload = {
      icon: { source: 'bundle', set: 'openmoji', name: 'dog-face' },
      label: 'dog face',
    } as const

    const transfer = {
      types: [LIBRARY_DRAG_MIME],
      getData: (type: string) => (type === LIBRARY_DRAG_MIME ? encodeLibraryDragPayload(payload) : ''),
    }
    drop.onDrop(eventData(transfer, currentTarget) as DragEvent)

    expect(drop.dropHover.value).toBe(false)
    expect(harness.onSwap).not.toHaveBeenCalled()
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]?.type).toBe(LIBRARY_PLACE_EVENT)
    expect(dispatched[0]?.detail).toEqual({ index: 5, payload })
  })

  test('malformed library payload is ignored but preventDefault still fires', () => {
    const harness = makeHarness(5)
    const drop = useCellDrop(harness.hooks)
    const dispatched: CustomEvent[] = []
    const currentTarget = { dispatchEvent: (event: CustomEvent) => dispatched.push(event) }

    const event = eventData({ types: [LIBRARY_DRAG_MIME], getData: () => '{ broken' } as Partial<DataTransfer>, currentTarget) as DragEvent
    drop.onDrop(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(dispatched).toHaveLength(0)
    expect(harness.onSwap).not.toHaveBeenCalled()
  })

  test('onDragEnd clears the marker only when this instance staged it', () => {
    // dragstart claims the single active-drag marker — after MY dragstart it
    // is mine, so my dragend clears it correctly.
    const mine = makeHarness(3)
    const drop = useCellDrop(mine.hooks)
    drop.onDragStart(dragStartEvent())
    expect(cellDragSource()).toBe(3)
    drop.onDragEnd()
    expect(cellDragSource()).toBeNull()

    // …but a source re-staged by another card after my dragstart survives
    // my dragend — my staged value (3) no longer matches the marker (9).
    const other = makeHarness(9)
    const drop2 = useCellDrop(other.hooks)
    drop.onDragStart(dragStartEvent())
    drop2.onDragStart(dragStartEvent()) // steals the active-drag staging
    expect(cellDragSource()).toBe(9)
    drop.onDragEnd()
    expect(cellDragSource()).toBe(9) // untouched — drop2 owns the marker now
    drop2.onDragEnd()
    expect(cellDragSource()).toBeNull()
  })

  test('unmount mid-drag (scope dispose) clears the staged marker', () => {
    const harness = makeHarness(6)
    const scope = effectScope()
    const drop = scope.run(() => useCellDrop(harness.hooks))
    drop?.onDragStart(dragStartEvent())
    expect(cellDragSource()).toBe(6)

    scope.stop() // the card unmounts mid-drag (grid shrink)
    expect(cellDragSource()).toBeNull()
  })

  test('dragleave into a child keeps hover; leaving to the grid clears it', () => {
    class FakeNode {}
    vi.stubGlobal('Node', FakeNode)
    const harness = makeHarness(2)
    const drop = useCellDrop(harness.hooks)

    // Hover via dragover of a different card.
    drop.onDragOver(eventData({ types: [CELL_DRAG_MIME] } as Partial<DataTransfer>) as DragEvent)
    expect(drop.dropHover.value).toBe(true)

    // Cross INTO a child: root.contains(related) → true → hover lives on.
    const child = new FakeNode()
    harness.root.contains.mockImplementation(() => true)
    drop.onDragLeave(eventData(null, harness.root, child as unknown as Node) as DragEvent)
    expect(harness.root.contains).toHaveBeenCalledWith(child)
    expect(drop.dropHover.value).toBe(true)

    // Leave to the grid background: contains → false → hover clears.
    harness.root.contains.mockImplementation(() => false)
    drop.onDragLeave(eventData(null, harness.root, child as unknown as Node) as DragEvent)
    expect(drop.dropHover.value).toBe(false)
  })
})
