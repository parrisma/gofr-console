# Client Daily Note from Top News -- Spec

## Status: DRAFT -- awaiting answers to open questions

## 1. WHAT

From the Client 360 view (`/gofr-iq/client-360`), the user can generate a
**Daily Note** document for a selected client, pre-populated from that client's
top news feed. The feature uses the existing `gofr-doc` MCP service with
template `daily_note` and adds one `data_event` fragment per news story.

## 2. WHY

Sales traders currently read the Client News Panel and mentally compose updates.
This feature automates the first draft: one click to create a structured daily
note containing the stories the platform already surfaced, saving time and
reducing the risk of missing material events.

## 3. USER FLOW

```
Client 360 View
  |
  +-- ClientNewsPanel shows top news (max 3 articles)
  |
  +-- User clicks "Create Daily Note" button
  |     (button visible only when >= 1 article is loaded)
  |
  +-- Confirmation / parameter dialog opens:
  |     Pre-filled fields:
  |       - company_name   <- selected client name
  |       - date           <- today (YYYY-MM-DD)
  |       - note_title     <- "Daily Update -- {client_name}"
  |       - author         <- current user display name (if available)
  |       - include_ai_notice <- true
  |     User-editable fields:
  |       - desk_name
  |       - recipient_type
  |       - contact_email
  |       - contact_phone
  |       - bloomberg_handle
  |     Article selection:
  |       - All loaded articles pre-selected (checkboxes)
  |       - User can deselect individual articles
  |
  +-- User confirms
  |
  +-- System executes (sequential MCP calls via gofr-doc):
  |     1. create_document_session(template_id="daily_note", alias=...)
  |     2. set_global_parameters(sessionId, { desk_name, author, date, ... })
  |     3. For each selected article:
  |          add_fragment(sessionId, fragment_id="data_event", {
  |            time:       article.published_at,
  |            event:      article.title,
  |            consensus:  ???,
  |            previous:   ???,
  |            importance: article.impact_tier or derived from impact_score,
  |            comment:    article.story_summary or article.why_it_matters
  |          })
  |     4. (Optional) validate_parameters
  |
  +-- On success:
  |     - Show success snackbar with link to open the session in GofrDocBuilder
  |       for further editing / rendering
  |     - OR navigate directly to GofrDocBuilder with sessionId pre-loaded
  |
  +-- On failure:
        - Show error snackbar with cause + recovery hint
```

## 4. DATA MAPPING

### 4.1 Global parameters (daily_note template)

| daily_note field    | Source                                      | Editable? |
|---------------------|---------------------------------------------|-----------|
| desk_name           | User input (or user profile if available)   | Yes       |
| author              | User display name / manual                  | Yes       |
| date                | Today, ISO 8601                             | Yes       |
| note_title          | Auto: "Daily Update -- {client_name}"       | Yes       |
| company_name        | Selected client name                        | Yes       |
| recipient_type      | User input                                  | Yes       |
| include_ai_notice   | Default `true`                              | Yes       |
| contact_email       | User input                                  | Yes       |
| contact_phone       | User input                                  | Yes       |
| bloomberg_handle    | User input                                  | Yes       |

### 4.2 Fragment parameters (data_event, one per article)

| data_event field | Source                                         | Editable? |
|------------------|------------------------------------------------|-----------|
| time             | `article.published_at`                         | Yes       |
| event            | `article.title`                                | Yes       |
| consensus        | ??? (see open questions)                       | Yes       |
| previous         | ??? (see open questions)                       | Yes       |
| importance       | `article.impact_tier` (PLATINUM/GOLD/SILVER/BRONZE) | Yes  |
| comment          | `article.story_summary` or `why_it_matters`    | Yes       |

## 5. COMPONENT CHANGES

| Component / File                          | Change                                          |
|-------------------------------------------|--------------------------------------------------|
| `src/components/common/ClientNewsPanel.tsx`| Add "Create Daily Note" action button            |
| NEW `src/components/client/DailyNoteDialog.tsx` | Parameter form + article selection dialog   |
| `src/services/api/index.ts`               | No new methods needed (existing gofr-doc API suffices) |
| `src/pages/GofrDocBuilder.tsx`             | Accept optional `sessionId` query param to open existing session |

## 6. CONSTRAINTS

- Must reuse existing `McpClient` + gofr-doc MCP tools. No new backend work.
- Must not block the Client 360 view while document is being created (async with progress indicator).
- Must handle gofr-doc service unavailability gracefully (error snackbar, no hang).
- Must respect the project auth pattern (pass `authToken` to all gofr-doc calls).

## 7. ASSUMPTIONS

- A1: The `daily_note` template and `data_event` fragment already exist in gofr-doc and match the schemas provided.
- A2: `consensus` and `previous` fields on `data_event` are optional (nullable) -- news articles do not carry these naturally.
- A3: The user has a valid auth token selected in the Client 360 view.
- A4: The maximum number of top news articles is 3 (current API cap), so the note will have at most 3 fragments.
- A5: After creation, the user will use GofrDocBuilder to render/export the document.

## 8. OPEN QUESTIONS

See questions below.

---

## OPEN QUESTIONS

**Q1 -- consensus / previous fields:**
The `data_event` fragment has `consensus` and `previous` fields. News articles
do not naturally carry consensus or previous-value data. Options:
  (a) Leave them null/empty -- user fills in manually if relevant.
  (b) Try to extract from article content via LLM (adds complexity + latency).
  (c) Only populate them for articles that relate to economic data releases.
Which approach?

**Q2 -- Article editing before creation:**
Should the user be able to edit fragment fields (event title, comment, etc.)
in the dialog before creating the note, or should we keep the dialog simple
(global params + article checkboxes) and let them edit in GofrDocBuilder after?

**Q3 -- Post-creation navigation:**
After the daily note session is created, should we:
  (a) Stay on Client 360, show a snackbar with a link to GofrDocBuilder.
  (b) Navigate directly to GofrDocBuilder with the new session loaded.
  (c) Open GofrDocBuilder in a new browser tab.

**Q4 -- Button placement:**
Where exactly should the "Create Daily Note" button live?
  (a) In the ClientNewsPanel header (alongside the existing filter controls).
  (b) In the ClientHeader "Vitals" bar.
  (c) As a floating action button (FAB) in the Client 360 view.

**Q5 -- User profile fields (desk_name, contact info, bloomberg_handle):**
These fields are unlikely to change between notes. Should we:
  (a) Persist them in localStorage so they auto-fill on subsequent uses.
  (b) Pull them from a user profile if one exists.
  (c) Require manual entry every time.

**Q6 -- recipient_type values:**
What are the valid values for `recipient_type`? Is this a free-text field or
an enum (e.g., "client", "internal", "compliance")?

**Q7 -- Who is the intended audience of the note?**
Is the daily note intended to be sent to the client, or is it an internal
document for the sales desk? This affects defaults for `include_ai_notice`
and `recipient_type`.

**Q8 -- Multiple clients:**
Should the user be able to create a single note covering multiple clients,
or is this strictly one note per client?
