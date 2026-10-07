<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep the storefront presentation independent from the uploaded application's unconnected services; this visual redesign must not silently connect to or modify another project's live data.
- Define visual tokens and storefront layout styles centrally in src/styles.css so the reference-inspired appearance remains consistent.
- Treat sample catalog entries as preview data, not real inventory; account, stock, and payment flows require a separately authorized service connection.
