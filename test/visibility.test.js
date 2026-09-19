/**
 * visibility.test.js
 *
 * Regression suite for updateVisibility() / updateVisibilityForPair().
 *
 * Covered scenarios
 * -----------------
 * 1  Flat single block: initial state (collapsed by default)
 * 2  Flat single block: expand on click, collapse again
 * 3  Nested blocks: outer collapsed → inner content hidden
 * 4  Nested blocks: outer expanded, inner collapsed independently
 * 5  Nested blocks: outer collapsed again after inner was expanded
 * 6  Closing </details> lines are hidden (CLOSER_CLASS)
 * 7  A closing block that contains ONLY </details> tokens is hidden
 * 8  Empty structural wrapper (li/ul/ol/blockquote) gets EMPTY_WRAPPER_CLASS
 *    when all its leaf children are hidden
 * 9  Structural wrapper is NOT marked empty when it still has a visible leaf
 * 10 Wrapper loses EMPTY_WRAPPER_CLASS when the section is expanded
 */

import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildDom,
  leaf,
  openingBlock,
  closingBlock,
  createPlugin,
  clickSummary,
  isHidden,
  isCloser,
  isEmptyWrapper,
  isVisible,
} from "./harness.js"

// Read plugin source once for all tests.
const SOURCE = readFileSync(
  new URL("../main.js", import.meta.url),
  "utf8"
)

// ─── helper: build plugin + write root in one call ────────────────────────────

async function setup(buildFn) {
  const { window, document, write } = buildDom()
  buildFn(document, write)
  const plugin = await createPlugin(window, SOURCE)
  // repair() runs via scheduleRepair (150 ms debounce) — call it synchronously
  plugin.repair()
  return { document, write, plugin }
}

// ─── 1. Initial state: single flat section is collapsed ───────────────────────

test("1. single flat section — collapsed by default", async () => {
  const contentLeaf = {}

  const { document, write } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "7 previous messages"))
    const c = leaf(doc, "Hidden content")
    contentLeaf.el = c
    root.appendChild(c)
    root.appendChild(closingBlock(doc))
  })

  assert.ok(isHidden(contentLeaf.el), "content leaf should be hidden initially")
})

// ─── 2. Expand then collapse ───────────────────────────────────────────────────

test("2. expand on click, collapse again", async () => {
  const contentLeaf = {}

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))
    const c = leaf(doc, "Body")
    contentLeaf.el = c
    root.appendChild(c)
    root.appendChild(closingBlock(doc))
  })

  // expand
  clickSummary(document, 0)
  assert.ok(isVisible(contentLeaf.el), "leaf should be visible after expand")

  // collapse again
  clickSummary(document, 0)
  assert.ok(isHidden(contentLeaf.el), "leaf should be hidden after collapse")
})

// ─── 3. Nested: outer collapsed → all inner content hidden ────────────────────

test("3. nested — outer collapsed hides all inner content", async () => {
  const refs = {}

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Outer"))           // outer open
      refs.inner = openingBlock(doc, "Inner")
      root.appendChild(refs.inner)                         // inner open
      refs.innerContent = leaf(doc, "Inner body")
      root.appendChild(refs.innerContent)
      root.appendChild(closingBlock(doc))                  // inner close
    refs.outerContent = leaf(doc, "Outer body")
    root.appendChild(refs.outerContent)
    root.appendChild(closingBlock(doc))                    // outer close
  })

  // Both are collapsed by default
  assert.ok(isHidden(refs.innerContent), "inner content hidden when outer collapsed")
  assert.ok(isHidden(refs.outerContent), "outer-only content hidden when outer collapsed")
})

// ─── 4. Nested: outer expanded, inner independently collapsed ─────────────────

test("4. nested — outer expanded, inner remains collapsed independently", async () => {
  const refs = {}

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Outer"))
      refs.innerOpen = openingBlock(doc, "Inner")
      root.appendChild(refs.innerOpen)
      refs.innerContent = leaf(doc, "Inner body")
      root.appendChild(refs.innerContent)
      root.appendChild(closingBlock(doc))
    refs.outerContent = leaf(doc, "Outer body")
    root.appendChild(refs.outerContent)
    root.appendChild(closingBlock(doc))
  })

  // Expand outer (index 0)
  clickSummary(document, 0)

  assert.ok(isVisible(refs.outerContent), "outer body visible after outer expand")
  assert.ok(isHidden(refs.innerContent),  "inner content still hidden (inner still collapsed)")
})

// ─── 5. Nested: outer collapse re-hides inner even if inner was expanded ──────

test("5. nested — collapsing outer hides inner content even if inner was expanded", async () => {
  const refs = {}

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Outer"))
      root.appendChild(openingBlock(doc, "Inner"))
      refs.innerContent = leaf(doc, "Inner body")
      root.appendChild(refs.innerContent)
      root.appendChild(closingBlock(doc))
    root.appendChild(closingBlock(doc))
  })

  // Expand outer, then inner
  clickSummary(document, 0)   // expand outer
  clickSummary(document, 1)   // expand inner
  assert.ok(isVisible(refs.innerContent), "inner visible after both expanded")

  // Collapse outer again
  clickSummary(document, 0)
  assert.ok(isHidden(refs.innerContent), "inner hidden again after outer collapses")
})

// ─── 6. Closing </details> span gets CLOSER_CLASS ─────────────────────────────

test("6. closing </details> block gets chatgpt-details-closer class", async () => {
  let closerBlock

  const { document, write } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))
    root.appendChild(leaf(doc, "Body"))
    closerBlock = closingBlock(doc)
    root.appendChild(closerBlock)
  })

  assert.ok(isCloser(closerBlock), "closing block should have chatgpt-details-closer class")
  assert.ok(isHidden(closerBlock), "closing block should also be hidden")
})

// ─── 7. Block that is ONLY </details> text (possibly with whitespace) is a closer

test("7. block with only </details> text gets chatgpt-details-closer class", async () => {
  let closerBlock

  // Build: one section, content, and a closing block whose span text is
  // exactly "</details>" (the simplest isCloserOnlyBlock case).
  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))
    root.appendChild(leaf(doc, "Content"))
    closerBlock = closingBlock(doc)   // span textContent === "</details>"
    root.appendChild(closerBlock)
  })

  // isCloserOnlyBlock matches; the block should carry both classes.
  assert.ok(isCloser(closerBlock), "closer-only block should have chatgpt-details-closer class")
  assert.ok(isHidden(closerBlock), "closer-only block should be hidden")
})

// ─── 8. Structural wrapper becomes empty-wrapper when all its leaves hidden ───

test("8. li wrapper gets empty-wrapper class when all its leaves are hidden", async () => {
  let li

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))

    const ul = doc.createElement("ul")
    li = doc.createElement("li")
    const innerLeaf = leaf(doc, "List item content")
    li.appendChild(innerLeaf)
    ul.appendChild(li)
    root.appendChild(ul)

    root.appendChild(closingBlock(doc))
  })

  // Section is collapsed by default → leaf inside li is hidden → li should be empty-wrapper
  assert.ok(isEmptyWrapper(li), "li should be marked as empty-wrapper when leaf is hidden")
})

// ─── 9. Structural wrapper NOT empty when it has a visible sibling leaf ────────

test("9. blockquote NOT marked empty when it still has a visible leaf", async () => {
  let bqInside   // all leaves inside pair range → should become empty-wrapper
  let bqOutside  // all leaves outside pair range → should NOT become empty-wrapper
  let leafIn
  let leafOut

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))

    bqInside = doc.createElement("blockquote")
    leafIn = leaf(doc, "Inside pair")
    bqInside.appendChild(leafIn)
    root.appendChild(bqInside)

    root.appendChild(closingBlock(doc))

    bqOutside = doc.createElement("blockquote")
    leafOut = leaf(doc, "Outside pair")
    bqOutside.appendChild(leafOut)
    root.appendChild(bqOutside)
  })

  assert.ok(isHidden(leafIn),          "leafIn (inside pair) should be hidden")
  assert.ok(isEmptyWrapper(bqInside),  "bqInside should be empty-wrapper (all its leaves are hidden)")
  assert.ok(isVisible(leafOut),        "leafOut (outside pair) should be visible")
  assert.ok(!isEmptyWrapper(bqOutside),"bqOutside should NOT be empty-wrapper (its leaf is visible)")
})




// ─── 10. Empty-wrapper cleared when section is expanded ──────────────────────

test("10. li loses empty-wrapper class when section is expanded", async () => {
  let li
  let innerLeaf

  const { document } = await setup((doc, root) => {
    root.appendChild(openingBlock(doc, "Section"))

    const ul = doc.createElement("ul")
    li = doc.createElement("li")
    innerLeaf = leaf(doc, "List item content")
    li.appendChild(innerLeaf)
    ul.appendChild(li)
    root.appendChild(ul)

    root.appendChild(closingBlock(doc))
  })

  assert.ok(isEmptyWrapper(li), "li starts as empty-wrapper")

  // Expand the section
  clickSummary(document, 0)

  assert.ok(!isEmptyWrapper(li), "li no longer empty-wrapper after section expanded")
  assert.ok(isVisible(innerLeaf),  "inner leaf is now visible")
})
