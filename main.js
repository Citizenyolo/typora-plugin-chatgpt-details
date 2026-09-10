const core = window[Symbol.for("typora-plugin-core@v2")]
const { app, HtmlPostProcessor, Plugin } = core

const OPENING_SELECTOR = ".md-htmlblock[mdtype='html_block'] details > summary"
const CLOSING_SELECTOR = "span.md-tag.md-raw-inline"
const HIDDEN_CLASS = "chatgpt-details-hidden"
const CLOSER_CLASS = "chatgpt-details-closer"
const SUMMARY_CLASS = "chatgpt-details-summary"
const EMPTY_WRAPPER_CLASS = "chatgpt-details-empty-wrapper"
const STRUCTURAL_WRAPPER_SELECTOR = "li, ul, ol, blockquote"

function normalizedText(element) {
  return (element?.textContent || "").trim()
}

function isClosingToken(element) {
  return element.matches(CLOSING_SELECTOR) && normalizedText(element) === "</details>"
}

function isCloserOnlyBlock(element) {
  const text = normalizedText(element)
  return text.length > 0 && /^(?:<\/details>\s*)+$/.test(text)
}

function leafBlocks(root) {
  return [...root.querySelectorAll("[cid]")].filter(element => !element.querySelector("[cid]"))
}

function editorRoot() {
  return window.editor?.writingArea || document.querySelector("#write")
}

function mutationTouchesEditor(mutation) {
  const root = editorRoot()
  const nodes = [mutation.target, ...mutation.addedNodes, ...mutation.removedNodes]

  return nodes.some(node => {
    if (!(node instanceof Element)) return false
    if (root && (node === root || node.contains(root) || root.contains(node))) return true
    return node.matches("#write, [cid]") || Boolean(node.querySelector("#write, [cid]"))
  })
}

export default class ChatGptDetailsPlugin extends Plugin {
  onload() {
    this._timer = null
    this._observer = new MutationObserver(mutations => {
      if (mutations.some(mutationTouchesEditor)) this.scheduleRepair()
    })
    this._summaries = new Map()
    this._leaves = []
    this._leafOwners = new Map()
    this._closerLeaves = new Set()
    this._emptyWrappers = new Set()

    const processor = HtmlPostProcessor.from({
      selector: `${OPENING_SELECTOR}, ${CLOSING_SELECTOR}`,
      process: () => this.scheduleRepair()
    })

    this.register(app.features.markdownEditor.postProcessor.register(processor))
    this._observer.observe(document.body, { childList: true, subtree: true })
    this.scheduleRepair()
  }

  onunload() {
    if (this._timer !== null) clearTimeout(this._timer)
    this._observer.disconnect()
    this.cleanup()
  }

  scheduleRepair() {
    if (this._timer !== null) clearTimeout(this._timer)
    this._timer = setTimeout(() => {
      this._timer = null
      this.repair()
    }, 150)
  }

  cleanup() {
    for (const [summary, handler] of this._summaries) {
      summary.removeEventListener("click", handler)
      summary.classList.remove(SUMMARY_CLASS)
      summary.removeAttribute("aria-expanded")
      summary.closest("details")?.removeAttribute("open")
    }

    for (const leaf of this._leaves) {
      leaf.classList.remove(HIDDEN_CLASS, CLOSER_CLASS)
    }

    for (const wrapper of this._emptyWrappers) {
      wrapper.classList.remove(EMPTY_WRAPPER_CLASS)
    }

    this._summaries.clear()
    this._leaves = []
    this._leafOwners.clear()
    this._closerLeaves.clear()
    this._emptyWrappers.clear()
  }

  repair() {
    const root = editorRoot()
    if (!root?.isConnected) return

    const previousStates = new Map(
      [...this._summaries.keys()].map(summary => [summary, summary.getAttribute("aria-expanded") !== "true"])
    )
    this.cleanup()

    const leaves = leafBlocks(root)
    const leafIndex = new Map(leaves.map((leaf, index) => [leaf, index]))
    const tokens = [...root.querySelectorAll(`${OPENING_SELECTOR}, ${CLOSING_SELECTOR}`)]
      .filter(element => element.matches("summary") || isClosingToken(element))

    const stack = []
    const pairs = []

    for (const token of tokens) {
      const leaf = token.closest("[cid]")
      const index = leafIndex.get(leaf)
      if (index === undefined) continue

      if (token.matches("summary")) {
        stack.push({ summary: token, details: token.closest("details"), openIndex: index })
        continue
      }

      const opening = stack.pop()
      if (!opening || index <= opening.openIndex) continue
      pairs.push({
        ...opening,
        closeIndex: index,
        collapsed: previousStates.get(opening.summary) ?? true
      })
    }

    if (!pairs.length) return

    this._leaves = leaves

    pairs.forEach((pair, pairIndex) => {
      pair.id = pairIndex
      pair.details.toggleAttribute("open", !pair.collapsed)
      pair.summary.classList.add(SUMMARY_CLASS)
      pair.summary.setAttribute("aria-expanded", String(!pair.collapsed))

      for (let index = pair.openIndex + 1; index < pair.closeIndex; index += 1) {
        const leaf = leaves[index]
        let owners = this._leafOwners.get(leaf)
        if (!owners) {
          owners = new Set()
          this._leafOwners.set(leaf, owners)
        }
        owners.add(pair)
      }

      const handler = event => {
        event.preventDefault()
        event.stopPropagation()
        pair.collapsed = !pair.collapsed
        pair.details.toggleAttribute("open", !pair.collapsed)
        pair.summary.setAttribute("aria-expanded", String(!pair.collapsed))
        this.updateVisibility()
      }

      pair.summary.addEventListener("click", handler)
      this._summaries.set(pair.summary, handler)
    })

    for (const token of tokens.filter(isClosingToken)) {
      const leaf = token.closest("[cid]")
      if (leaf && isCloserOnlyBlock(leaf)) this._closerLeaves.add(leaf)
    }

    this.updateVisibility()
  }

  updateVisibility() {
    for (const wrapper of this._emptyWrappers) {
      wrapper.classList.remove(EMPTY_WRAPPER_CLASS)
    }
    this._emptyWrappers.clear()

    for (const leaf of this._leaves) {
      const owners = this._leafOwners.get(leaf)
      const hiddenByCollapsedPair = owners && [...owners].some(pair => pair.collapsed)
      const isCloser = this._closerLeaves.has(leaf)
      leaf.classList.toggle(HIDDEN_CLASS, Boolean(hiddenByCollapsedPair || isCloser))
      leaf.classList.toggle(CLOSER_CLASS, isCloser)
    }

    const candidates = new Set()
    const visibleWrappers = new Set()
    const root = editorRoot()

    for (const leaf of this._leaves) {
      const isHidden = leaf.classList.contains(HIDDEN_CLASS)

      for (let wrapper = leaf.parentElement; wrapper; wrapper = wrapper.parentElement) {
        if (wrapper.matches(STRUCTURAL_WRAPPER_SELECTOR)) {
          if (isHidden) candidates.add(wrapper)
          else visibleWrappers.add(wrapper)
        }
        if (wrapper === root) break
      }
    }

    for (const wrapper of candidates) {
      if (!visibleWrappers.has(wrapper)) {
        wrapper.classList.add(EMPTY_WRAPPER_CLASS)
        this._emptyWrappers.add(wrapper)
      }
    }
  }
}
