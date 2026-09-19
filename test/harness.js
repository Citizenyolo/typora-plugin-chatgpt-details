/**
 * harness.js
 *
 * JSDOM-based test harness for ChatGptDetailsPlugin.
 *
 * Simulates the minimum Typora / typora-community-plugin-core surface needed
 * to instantiate the plugin and exercise updateVisibility() and the new
 * updateVisibilityForPair() without a real browser or Typora process.
 *
 * DOM conventions the plugin relies on:
 *  - The editor root is <div id="write"> (editorRoot() fallback).
 *  - Every paragraph / block carries a [cid] attribute.
 *  - Opening <summary> lives inside .md-htmlblock[mdtype="html_block"] > details > summary.
 *  - Closing markers are <span class="md-tag md-raw-inline"> whose text is exactly </details>.
 *  - Leaves are [cid] elements that contain no nested [cid].
 *  - Structural wrappers that may become "empty" are: li, ul, ol, blockquote.
 */

import { JSDOM } from "jsdom"

// ─── minimal Plugin base class ────────────────────────────────────────────────

class Plugin {
  constructor() {
    this._registrations = []
  }
  register(cleanup) {
    if (typeof cleanup === "function") this._registrations.push(cleanup)
  }
  destroy() {
    this._registrations.forEach(fn => fn())
    if (typeof this.onunload === "function") this.onunload()
  }
}

// ─── minimal HtmlPostProcessor stub ──────────────────────────────────────────

const HtmlPostProcessor = {
  from({ process }) {
    // returns an opaque processor; the harness never calls process() itself
    return { process }
  },
}

// ─── minimal app stub ────────────────────────────────────────────────────────

const app = {
  features: {
    markdownEditor: {
      postProcessor: {
        register: () => () => {},   // no-op cleanup
      },
    },
  },
}

// ─── DOM builder helpers ──────────────────────────────────────────────────────

let _cidCounter = 0
function resetCid() { _cidCounter = 0 }

/**
 * Build a JSDOM window/document pair with a fresh #write root.
 * Returns { window, document, write }.
 */
function buildDom() {
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='write'></div></body></html>")
  resetCid()
  return {
    window: dom.window,
    document: dom.window.document,
    write: dom.window.document.querySelector("#write"),
  }
}

/**
 * Create a leaf block (a [cid] element with no nested [cid]).
 * tag defaults to "p".
 */
function leaf(document, innerHTML = "", tag = "p") {
  const el = document.createElement(tag)
  el.setAttribute("cid", `cid-${++_cidCounter}`)
  el.innerHTML = innerHTML
  return el
}

/**
 * Create the opening block for a <details> section.
 * Returns a [cid] element containing .md-htmlblock > details > summary.
 *
 * The summary text becomes the visible label (e.g. "7 previous messages").
 */
function openingBlock(document, summaryText = "Section") {
  const block = document.createElement("p")
  block.setAttribute("cid", `cid-${++_cidCounter}`)

  const htmlBlock = document.createElement("div")
  htmlBlock.className = "md-htmlblock"
  htmlBlock.setAttribute("mdtype", "html_block")

  const details = document.createElement("details")
  const summary = document.createElement("summary")
  summary.textContent = summaryText
  details.appendChild(summary)
  htmlBlock.appendChild(details)
  block.appendChild(htmlBlock)
  return block
}

/**
 * Create the closing block for a <details> section.
 * Returns a [cid] element containing a single span.md-tag.md-raw-inline
 * whose text is exactly </details>.
 */
function closingBlock(document, extra = "") {
  const block = document.createElement("p")
  block.setAttribute("cid", `cid-${++_cidCounter}`)
  const span = document.createElement("span")
  span.className = "md-tag md-raw-inline"
  span.textContent = extra ? `</details>${extra}` : "</details>"
  block.appendChild(span)
  return block
}

// ─── plugin factory ───────────────────────────────────────────────────────────

/**
 * Instantiate the plugin inside the provided window.
 *
 * The module under test is NOT an ES module in the harness context
 * (JSDOM can't import ES modules with top-level window references),
 * so we evaluate it as a function body instead.
 */
async function createPlugin(jsdomWindow, pluginSource) {
  const { createContext, Script } = await import("node:vm")

  // Inject stubs so the plugin source can reference them.
  jsdomWindow[Symbol.for("typora-plugin-core@v2")] = { app, HtmlPostProcessor, Plugin }

  // Strip ES-module keywords: vm.Script does not understand `export`.
  const stripped = pluginSource
    .replace(/^const core\s*=.*$/m, "")
    .replace(/^const \{ app[^}]*\}\s*=\s*core.*$/m, "")
    .replace(/^export\s+default\s+/m, "")
    .trim()

  // Run the plugin source inside the JSDOM window context.
  // This gives the script genuine access to window, document,
  // MutationObserver, Element, etc. — the same as running inside a browser.
  const context = createContext(jsdomWindow)
  const script = new Script(
    `(function(Plugin, HtmlPostProcessor, app) {
       ${stripped}
       return ChatGptDetailsPlugin;
     })(
       this[Symbol.for("typora-plugin-core@v2")].Plugin,
       this[Symbol.for("typora-plugin-core@v2")].HtmlPostProcessor,
       this[Symbol.for("typora-plugin-core@v2")].app
     )`
  )
  const ChatGptDetailsPlugin = script.runInContext(context)
  const plugin = new ChatGptDetailsPlugin()
  plugin.onload()
  return plugin
}

// ─── assertion helpers ────────────────────────────────────────────────────────

function isHidden(el) {
  return el.classList.contains("chatgpt-details-hidden")
}
function isCloser(el) {
  return el.classList.contains("chatgpt-details-closer")
}
function isEmptyWrapper(el) {
  return el.classList.contains("chatgpt-details-empty-wrapper")
}
function isVisible(el) {
  return !isHidden(el)
}

// ─── click simulation ─────────────────────────────────────────────────────────

/**
 * Simulate a user click on the summary of the nth <details> block (0-based).
 * The plugin attaches its handler to the <summary> element directly.
 */
function clickSummary(document, nth = 0) {
  const summaries = [...document.querySelectorAll(".chatgpt-details-summary")]
  if (!summaries[nth]) throw new Error(`No summary at index ${nth}`)
  summaries[nth].dispatchEvent(
    new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true })
  )
}

export {
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
}
