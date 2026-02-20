# Specification: Template Parameters UX Rework

## Problem

The Builder page has two separate cards for global parameters that duplicate effort:

1. "Validate parameters" - dry-run schema check only, saves nothing, no description, confusing parameter_type dropdown, empty JSON field with no guidance
2. "Global parameters" - actually saves parameters to the session via set_global_parameters

The user must enter the same JSON twice. Neither card explains what it does or pre-populates parameters from the template schema.

## Proposed Changes

### 1. Merge into a single "Template parameters" card

- Remove the separate "Validate parameters" card
- Remove the separate "Global parameters" card
- Replace with one "Template parameters" card containing:
  - Pre-populated JSON editor (from template schema)
  - "Validate" button (dry-run check via validate_parameters)
  - "Set parameters" button (saves to session via set_global_parameters)

### 2. Add descriptive helper text

- Below the heading: "Enter the parameter details required to set the template level detail."

### 3. Remove the parameter_type dropdown

- Remove the global/fragment toggle
- Remove the fragment_id field
- Hardcode parameter_type to "global" in the validate API call
- Fragment parameter validation can be done inline in the "Add fragment" card (future improvement)

### 4. Auto-fetch template details and pre-populate JSON

- When Builder mounts (or when template_id changes), fetch template details via the existing api.docGetTemplateDetails()
- Extract global_parameters array (e.g. [{name: "title", type: "string", required: true}, ...])
- Build a JSON object from the parameter definitions using defaults where available, empty strings/values otherwise:
  - string -> "" (or default value)
  - integer/number -> 0 (or default value)
  - boolean -> false (or default value)
  - array -> [] (or default value)
  - object -> {} (or default value)
- Pre-populate the JSON text field with this object
- If template details have no global_parameters, show {}
- Log the fetch but don't block UI on error

### 5. Two action buttons sharing one JSON editor

- "Validate" button (outlined) - calls validate_parameters, shows valid/invalid alert
- "Set parameters" button (contained) - calls set_global_parameters, shows success/failure alert
- Both read from the same JSON text field
- User workflow: edit JSON, optionally validate, then set
- RequestPreview icons shown for both tools
- RawResponsePopupIcon shows raw responses for both (validate + set)
- ExamplesPopupIcon stays

## State Changes

### GofrDocBuilder.tsx

- Remove: validateType state, validateFragmentId state
- Remove: globalsJson state (merged into the shared parametersJson)
- Remove: separate Global parameters card JSX and its state variables
- Add: templateDetails fetched on mount/template_id change
- Rename: validateJson -> parametersJson (shared by both validate and set)
- Modify: runValidate always passes parameter_type: 'global'
- Keep: globalsRes, globalsErr, globalsLoading state for the set operation

### No store changes needed

- Builder fetches template details itself using the templateId already in the shared store

## Data Transformation

global_parameters array from template response:

```
[
  {name: "title", type: "string", required: true},
  {name: "author", type: "string", required: false, default: "Analyst"},
  {name: "as_of", type: "string", required: true}
]
```

Becomes pre-populated JSON:

```json
{
  "title": "",
  "author": "Analyst",
  "as_of": ""
}
```

---

## Fragments Card Redesign

### Problem

The Builder page has three separate cards for fragment management:

1. "Add fragment" - manual text entry for fragment_id, position, and raw JSON parameters
2. "Add image fragment" - separate dedicated form with image-specific fields
3. "Fragments (review & remove)" - list button, flat text list of guids, manual guid text field for removal

Issues:

- No visibility of current fragments until user clicks "List Session Fragments"
- Adding a fragment requires knowing the fragment_id and parameter shape from memory
- Image fragment is a completely separate card despite being just a fragment type
- Review list is a flat text dump, not a proper table
- Remove requires a manual guid text field

### Proposed Changes

#### 1. Merge into one card: "Fragments"

Replace all three cards with a single "Fragments" card that has two sections:

**Section A: Current fragments table (top)**

- Auto-refresh on mount and after any add/remove operation
- MUI Table with columns: position (row number), fragment_id, type, fragment_instance_guid (truncated), actions
- Actions column has: View (shows parameters in a popup/expand) and Remove (red button, confirms then removes)
- Empty state: "No fragments in this session yet."

**Section B: Add fragment (below table)**

- A dropdown pre-populated with available fragment types from the template (via list_template_fragments)
- Always include an "image" option in the dropdown
- When user selects a fragment type:
  - If regular fragment: expand a panel showing the JSON parameters pre-populated from fragment details (via get_fragment_details, same schema-to-JSON approach as template parameters)
  - If image: expand the image-specific form fields (url, title, alt_text, alignment, require_https, width, height)
  - Position field always shown (default: "end")
  - "Add fragment" button to submit
- After successful add: auto-refresh the table above, clear the add form

#### 2. Fragment type dropdown population

- On mount (or when template_id changes), fetch template fragments via api.docListTemplateFragments()
- Build dropdown options from fragments list: [{fragment_id, name}]
- Always append a special "image" option at the end
- Show name if available, otherwise fragment_id

#### 3. Pre-populate fragment parameters JSON

When a regular fragment type is selected:

- Fetch fragment details via api.docGetFragmentDetails(templateId, fragmentId)
- Extract parameters array (same shape as global_parameters: [{name, type, required, default?}])
- Build JSON object using same defaulting logic as template parameters
- Pre-populate the JSON editor
- User edits values and clicks "Add fragment"

#### 4. View action on table rows

- Clicking "View" on a fragment row shows an expandable section or dialog with the full parameters JSON for that instance
- Uses the parameters field from the list_session_fragments response (already returned per DocSessionFragmentRow)

#### 5. Remove action on table rows

- Clicking "Remove" on a fragment row calls remove_fragment with the fragment_instance_guid
- Auto-refreshes the table after removal
- No manual guid text field needed

### State Changes for Fragments

- Remove: addFragmentId, addFragmentJson, addFragmentPosition (free text) - replaced by dropdown-driven approach
- Remove: imgUrl, imgTitle, imgAlt, imgAlignment, imgRequireHttps, imgWidth, imgHeight, imgPosition - moved into conditional image form
- Remove: removeGuid text field - replaced by table row action
- Add: selectedFragmentType (dropdown selection)
- Add: availableFragments (from list_template_fragments)
- Add: fragmentParamsJson (pre-populated from fragment details)
- Keep: listRes, listLoading, listErr (session fragments table data)
- Keep: all API call functions, just triggered differently
