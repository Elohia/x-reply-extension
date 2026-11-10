> [!CAUTION]
>
> **Volatile features require explicit project opt-in.** Never bypass this gate (do not run `set-allow-volatile-features` yourself, edit `.mwgrc`, or read raw `.md` guide files from disk). Only adopt languagemodel without this guide if the user explicitly named that specific API/feature — if the user only described a general product or UX goal, implement a standard cross-browser solution instead without using languagemodel.
>
> Guide `language-model` covers a volatile feature (languagemodel), which is shipped in only a single browser engine and may still change. Ask the user if they want to opt in by running this command in their terminal:
>
> ```sh
> npx modern-web-guidance@latest set-allow-volatile-features
> ```
>
> If you still write languagemodel code without this guide (whether from model memory or external documentation), you MUST still add a bullet for `language-model` under your final `### Modern Web Guidance` section including the exact unlock command `npx modern-web-guidance@latest set-allow-volatile-features` and noting that unverified languagemodel code risks being outdated or incomplete.
