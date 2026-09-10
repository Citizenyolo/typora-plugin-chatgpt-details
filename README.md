# ChatGPT Details for Typora

Make long Codex conversation exports easier to navigate in Typora by restoring
clickable, nested `<details>` sections.

ChatGPT's Codex desktop experience can copy a complete task or conversation as
structured Markdown using **Copy as Markdown**. This is useful for keeping a
durable, searchable record of a long project outside the app.

Large conversation exports can contain many thousands of words. Earlier messages
and tool activity can overwhelm the document, making it difficult to find the
current answer, follow the heading structure, or move quickly between important
sections.

## The problem

Codex uses HTML `<details>` and `<summary>` elements in its Markdown output to
group content such as:

- earlier conversation history (`7 previous messages`);
- tool activity (`Searched the web`, `Explored a file`);
- nested activity inside those groups.

Typora does not currently render these exported blocks as working disclosure
controls. Their contents may appear fully expanded, and clicking a summary does
not reliably close it. Long exports therefore become unnecessarily cluttered.

This behavior was reproduced on 10 September 2026 with Typora 1.14.9 (build
7785) and the ChatGPT desktop app for macOS 26.901.51231 (build 8109), which
bundles Codex CLI 0.153.4. Codex is also available in the ChatGPT desktop app for
Windows, but OpenAI's public documentation does not currently publish an
equivalent Windows app or bundled Codex version number. The Windows export
workflow has therefore not yet been validated for this project.

## What this plugin does

ChatGPT Details restores those disclosure controls inside Typora:

- history and tool-activity groups are collapsed by default;
- summary rows can be clicked to expand or collapse their contents;
- nested groups remain independently controllable;
- open state is retained while Typora virtualizes and redraws the document;
- empty bullets and blockquote rails left by collapsed nested content are hidden;
- the original Markdown file is never modified.

The result is a compact document in which the current response and heading
structure remain visible, while earlier context is available on demand.

## Compatibility

| Component | Status |
| --- | --- |
| Typora on macOS | Supported; tested with 1.14.9 (build 7785) |
| Typora on Windows | Not yet tested or enabled in version 1.0.10 |
| Typora on Linux | Not yet tested or enabled in version 1.0.10 |
| Typora Community Plugin | Core version 2.0.0 or later |
| Chat export workflow on macOS | **Copy as Markdown** verified with ChatGPT desktop app 26.901.51231 (build 8109), bundled Codex CLI 0.153.4 |
| Chat export workflow on Windows | Desktop app available; numeric build and **Copy as Markdown** workflow not yet verified |

The plugin implementation uses browser DOM APIs and the Typora Community Plugin
API; it does not currently contain macOS-specific code. Windows and Linux support
may therefore be possible after platform testing and installation validation.

OpenAI provides a [ChatGPT desktop app for Windows](https://learn.chatgpt.com/docs/windows/windows-app),
but its public documentation does not currently specify whether **Copy as
Markdown** is available identically on every desktop platform. The export workflow
described here has been verified on macOS.

## Installation

### Requirements

- Typora
- [Typora Community Plugin](https://github.com/typora-community-plugin/typora-community-plugin)
- macOS for version 1.0.10

### Manual installation on macOS

1. Install Typora Community Plugin.
2. Download the latest release ZIP and extract it.
3. Quit Typora.
4. Copy the extracted `chatgpt-details` folder to:

   ```text
   ~/Library/Application Support/abnerworks.Typora/plugins/plugins/chatgpt-details/
   ```

5. Confirm that `manifest.json`, `main.js`, and `style.css` are directly inside
   that folder.
6. Start Typora.
7. Open **Settings → Installed Plugins** and enable **ChatGPT Details**.

Once the plugin is accepted into the Typora Community Plugin marketplace, the
marketplace installation will become the recommended method.

## Usage

1. In the Codex desktop app, open the menu for a task or conversation.
2. Choose **Copy → Copy as Markdown**.
3. Save the copied content as a `.md` file.
4. Open the file in Typora.
5. Click a row such as `7 previous messages` or `Searched the web` to reveal or
   hide that section.

No document conversion or configuration is required.

## Limitations

- Version 1.0.10 is currently tested only on macOS.
- The plugin recognizes the `<details>` structure produced by Codex Markdown
  exports. Other applications may generate different HTML structures.
- Folding improves readability and navigation. It does not reduce the Markdown
  file size or guarantee faster initial file loading.
- All folding is visual and runtime-only; the source Markdown remains unchanged.

## Privacy

The plugin works locally inside Typora. It does not send document content to a
server and does not write changes to the Markdown source.

## License

MIT License.

## Project status

Version 1.0.10 is the first release prepared for public distribution.

This is an independent community project and is not affiliated with OpenAI or
Typora.
