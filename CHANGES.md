# Premier Concrete - what was done

## Stage 1: the design as static pages (2026-10-24)
- Source: `Premier Concrete Template (7)/standalone-export/Premier Concrete Website.html` (a bundled "x-dc" design: one component, 9 screens). Unpacked to `_original/index.original.html` (gitignored working copy).
- `node tools/build-pages.js` runs the component logic + template in Node and writes one HTML file per page (same look, no framework at run time). Pages: `index`, `products`, `products-<category>` (pipe, box, drainage, utility, bridges, erosion, pipeline, masonry, hardscapes), `about`, `our-team`, `project-highlights`, `project-<id>`, `resources`, `lunch-learn`, `credit-application`, `contact`.
- State-driven parts of the design are done by `js/site.js`:
  - header menus (About dropdown, Products mega menu), mobile hamburger menu (<= 960 px)
  - home: product list with photo on hover, markets slider (auto + arrows)
  - products: group tabs (`?grp=2` opens a tab), photo gallery, product rows (accordion, rendered open and closed by the script), dimension tables, product search (`js/search-index.js`, generated)
  - project highlights: filter chips + search + count; project page: photo gallery, accordion
  - resources: 6 tabs (one rendered list per tab), product filters (each item knows its filters), clear
  - forms: validation + thank-you screen; credit application = 8-step wizard. **Not yet sent to the backend** (that is the "forms" step).
- Images: `images/<dir>/<name>.webp` (design `assets/<dir>/<name>.jpg`), `images/ext/` for pictures that were loaded from other sites; every file under 100 KB.
- Responsive: hamburger + stacked asides under 960 px; 4K scaling with `zoom` (1920 / 2400 / 3000 / 3600 px).
- Not done in this stage (next steps): footer replaced by `tools/footer.html`, login page, favicon, CMS login link (stage 2); backend login (3); live editor (4); lists from the CMS (5); template pages (6); dashboard (7); forms to `/api/contact` (8); loader + cache (9).

## Stage 4: live editor (2026-10-24)
- Sign in at `login.html` (test admin, see CHANGES_LOG.md). The site then shows the admin bar: SAVE (with the number of unsaved changes), DASHBOARD, SWITCH TO EDIT / PREVIEW, LOGOUT. In edit mode every text is clickable (text toolbar: bold, italic, align, case, font, size, colour, reset), every photo has "Change image" (upload -> confirm -> SAVE), every link / link button opens the "Edit link" dialog.
- Keys: `tools/cms-tag.js` writes `data-cms="txt-<words>-<hash>"` / `img-...` / `data-cms-link="lnk-..."` into the pages at build time (kind + default text / file, never the position); `tools/cms-keys.json` remembers every key ever given (commit it). Header and footer keys start with `g-` / `lnk-g-`: saved once (with the home page), shown on every page.
- Visitors get the saved content from `GET /api/v2/page-elements/<page>` (page = file name without .html) and the shared header / footer content from the home page.
- Not yet connected to the CMS lists: products, project highlights, resources (next stage); until then their texts are normal page texts of the pages.

## Stage 5-7: lists from the CMS, template pages, dashboard (2026-10-24)
- Products (= solutions), Project Highlights (= stories) and Resources are CMS lists: `js/pc-content.js` draws them on the pages (see CHANGES_LOG.md); admins edit them on the page in edit mode (`js/pc-edit.js`) or in the dashboard (`dashboard.html`).
- Formats shared by the website and the dashboard: solutions: `short_description` = text, `custom_link` = the page it opens (`products-<id>.html` for the 9 designed pages, `product-detail-<slug>.html` for new ones); stories: `result_text` = JSON `{year, prod, tag, excerpt, images[]}`; resources: `description` = `[product:slug,slug] short text` (+ `\n\n[page]\n\n` + page text for Blog Post / Webinar), `document_type` decides the tab; the groups / items of a solution page = page element `tpl-groups` of page `product-detail-<slug>` (JSON).
- Seed: `node tools/seed-content.js` (design content, through the backend API).
