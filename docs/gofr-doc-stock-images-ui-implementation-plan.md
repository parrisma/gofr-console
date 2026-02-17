# Implementation plan: GOFR-DOC Stock Images picker (use as Image fragments)

Purpose: implement the UI proposed in docs/gofr-doc-stock-images-ui-proposal.md with small, checkable steps.

Scope: GOFR Console UI only (no gofr-doc changes).

Definition of Done:
- In GOFR-DOC Builder → Fragments → Add Fragment → Image, the user can browse stock images from gofr-doc, pick one, and successfully add it via add_image_fragment.
- The user can choose URL source mode (Internal vs Console-proxied) and understands what will be sent to add_image_fragment.
- No new TypeScript errors, lint passes, and prod image build succeeds.


## Phase 0 — Baseline checks

- [ ] Confirm current branch builds locally: pnpm run build
- [ ] Confirm lint is clean: pnpm run lint
- [ ] Confirm unit tests are green (if present): pnpm run test:unit
- [ ] Confirm prod image build is green: bash docker/build-prod.sh


## Phase 1 — Validate routing assumptions (no UI yet)

Goal: ensure the console can reach gofr-doc’s stock image endpoints via the existing /api/gofr-doc proxy.

- [ ] Confirm gofr-doc serves /images on the same host:port as the MCP server in the current environment.
  - Expected: the existing nginx/vite proxy for /api/gofr-doc forwards to the same upstream that serves /images.
- [ ] From the console container/network, verify these return HTTP 200:
  - [ ] GET /api/gofr-doc/images
  - [ ] GET /api/gofr-doc/images/<known-image-path>
- [ ] If /images is not available on the MCP upstream port, stop and document the correct port/hostname needed.

Acceptance:
- /api/gofr-doc/images returns JSON with data.images[]


## Phase 2 — Add minimal fetch helper for stock images

Goal: add a small, safe fetch helper to retrieve the stock image list.

- [ ] Add a helper function (either local to the page or in a small util) that:
  - [ ] Calls GET /api/gofr-doc/images
  - [ ] Parses JSON and extracts a string[] of image paths
  - [ ] Validates shape defensively (treat inputs as untrusted)
  - [ ] Produces a user-facing error message on failure
- [ ] Ensure no auth headers are attached (endpoint is public)

Acceptance:
- Helper returns a stable list of image paths or a clear error


## Phase 3 — Builder UI: add stock image picker to Image fragment form

Location: src/pages/GofrDocBuilder.tsx (Image add section).

- [ ] Identify the existing “Image” add form fields (image_url, title, width/height, alt_text, alignment, require_https, position).
- [ ] Add UI state:
  - [ ] stockImagesLoading (boolean)
  - [ ] stockImagesErr (unknown or string)
  - [ ] stockImages (string[])
  - [ ] urlSourceMode ('internal' | 'proxy')
- [ ] Add a “Browse stock images” button next to image_url.
  - [ ] On click, call the helper and populate stockImages.
  - [ ] Show a loading indicator while fetching.
  - [ ] If error, show a ToolErrorAlert-style component.

Acceptance:
- Clicking “Browse stock images” visibly loads a list or shows a useful error


## Phase 4 — Builder UI: stock images table and selection behavior

- [ ] Render a table below the image_url input when stockImages has entries.
  - [ ] Columns:
    - [ ] path (relative path)
    - [ ] url (computed URL that will be used for add_image_fragment)
  - [ ] Add a URL source dropdown:
    - [ ] Internal (default)
    - [ ] Console-proxied
- [ ] Implement safe URL construction:
  - [ ] Always URL-encode path segments when building the URL
  - [ ] Avoid string concatenation that can create malformed URLs
- [ ] Row click behavior:
  - [ ] Sets the image_url field to the computed URL
  - [ ] Auto-sets require_https=false when urlSourceMode=internal
  - [ ] Clears previous add_image_fragment error state

Acceptance:
- A user can select an image row and the image_url field updates immediately


## Phase 5 — URL computation details

Goal: produce URLs that match environment constraints.

- [ ] Internal URL mode:
  - [ ] Compute base as http://<gofr-doc-host>:<port>/images/
  - [ ] Host/port should be derived from console config (useConfig mcpServices + getMcpPort) with fallback to gofr-doc-mcp:8040
  - [ ] Confirm it is reachable from gofr-doc for server-side HEAD validation
- [ ] Console-proxied URL mode:
  - [ ] Use /api/gofr-doc/images/<path> (relative path for display and request)
  - [ ] For copying, optionally show the absolute version using window.location.origin + that path

Acceptance:
- Both URL modes generate consistent, URL-encoded links for any path including subdirectories


## Phase 6 — Integrate with add_image_fragment submission

- [ ] Ensure existing add_image_fragment payload uses the current image_url input value.
- [ ] Confirm require_https is set appropriately based on the user’s choice and the auto-set rule.
- [ ] Confirm errors returned by add_image_fragment remain visible and actionable.

Acceptance:
- Selecting a stock image and pressing Add successfully inserts an image fragment (when gofr-doc can validate the URL)


## Phase 7 — Regression checks in related views

- [ ] Confirm no other GOFR-DOC Builder fragment flows were impacted:
  - [ ] Regular fragments add/remove table still works
  - [ ] Position dropdown still works
  - [ ] Template parameters Set still works
- [ ] Confirm GOFR-DOC Render & Proxy still renders and downloads correctly (proxy toggle and style dropdown)


## Phase 8 — Tests, lint, and prod build

- [ ] Run TypeScript compile: pnpm run build
- [ ] Run lint: pnpm run lint
- [ ] Run unit tests: pnpm run test:unit
- [ ] Build prod image: bash docker/build-prod.sh

Acceptance:
- No TS6133 unused-symbol errors
- Prod image build completes successfully


## Phase 9 — Manual acceptance walkthrough

Using a real session:
- [ ] Open GOFR-DOC Sessions, create or select a session
- [ ] Open GOFR-DOC Builder and select the same session
- [ ] In Fragments → Add Fragment → Image:
  - [ ] Click Browse stock images
  - [ ] Select a stock image row (Internal mode)
  - [ ] Confirm require_https auto-switches off
  - [ ] Click Add
  - [ ] Confirm the image fragment appears in the fragments table

Optional:
- [ ] Switch URL source mode to Console-proxied, repeat add, confirm behavior matches environment constraints
