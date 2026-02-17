# Implementation Plan: Template Parameters + Fragments UX Rework

References: docs/template-parameters-ux-spec.md

## Pre-requisite

- [ ] Run full test suite to confirm green baseline (scripts/run_tests.sh or npx tsc --noEmit)

---

## Part 1: buildParamsFromSchema utility function

- [ ] 1.1 Create a helper function buildParamsFromSchema(params: unknown): Record<string, unknown>
  - Input: the global_parameters or fragment parameters array from template/fragment details
  - Output: a JSON-serialisable object with default values per type
  - Logic: iterate the array, for each {name, type, required?, default?} produce key:defaultValue
  - Defaults: string->"", integer/number->0, boolean->false, array->[], object->{}
  - If a default is provided, use it
  - If input is not an array or is empty, return {}
  - Place in src/utils/ (e.g. src/utils/buildParamsFromSchema.ts)
- [ ] 1.2 Verify with tsc --noEmit

## Part 2: Template Parameters card (merge Validate + Global Parameters)

- [ ] 2.1 Add template details auto-fetch
  - Add state: templateDetails, templateDetailsLoading, templateDetailsErr
  - Add useEffect that fires when templateId changes (debounced or on non-empty)
  - Calls api.docGetTemplateDetails(templateId, selectedToken?.token)
  - On success, extract global_parameters and call buildParamsFromSchema
  - Set parametersJson to the prettified result
  - Log fetch, don't block UI on error

- [ ] 2.2 Remove old Validate parameters card state
  - Remove: validateType state and setValidateType
  - Remove: validateFragmentId state and setValidateFragmentId
  - Rename: validateJson -> parametersJson, setValidateJson -> setParametersJson

- [ ] 2.3 Update runValidate to hardcode parameter_type: 'global'
  - Remove fragment_id from the API call
  - Remove fragment_id validation check

- [ ] 2.4 Build the merged "Template parameters" card JSX
  - Heading: "Template parameters"
  - Helper text: "Enter the parameter details required to set the template level detail."
  - Keep ExamplesPopupIcon and RawResponsePopupIcon (show both validate + set raw responses)
  - Single JSON text field (parametersJson)
  - Two buttons side by side:
    - "Validate" (outlined) - calls runValidate
    - "Set parameters" (contained) - calls runSetGlobals (reads from same parametersJson)
  - RequestPreview for both tools
  - Keep both success/failure alert sections

- [ ] 2.5 Remove the old "Global parameters" card
  - Remove the entire Card JSX block for "Global parameters"
  - Remove globalsJson state (replaced by parametersJson)
  - Keep globalsRes, globalsErr, globalsLoading (used by "Set parameters" button)
  - Update runSetGlobals to read from parametersJson instead of globalsJson

- [ ] 2.6 Verify with tsc --noEmit

## Part 3: Fragments card - Section A (current fragments table)

- [ ] 3.1 Add auto-refresh of session fragments
  - Add a refreshSessionFragments() helper that calls api.docListSessionFragments
  - Call it on mount and whenever sessionId changes (if non-empty and token available)
  - Reuse existing listRes, listLoading, listErr state

- [ ] 3.2 Build the fragments table
  - Replace the old flat text list with MUI Table
  - Columns: # (row index), fragment_id, type, fragment_instance_guid (truncated to ~12 chars), Actions
  - Data source: listRes?.fragments
  - Empty state: Alert "No fragments in this session yet."
  - Add Table, TableHead, TableBody, TableRow, TableCell imports (already imported in Discovery, add to Builder)

- [ ] 3.3 Add View action to table rows
  - Add an expand/collapse row or a dialog/popover
  - When clicked, show the parameters JSON for that fragment instance (from DocSessionFragmentRow.parameters)
  - Use JsonBlock or a simple pre-formatted display

- [ ] 3.4 Add Remove action to table rows
  - Red "Remove" button on each row
  - On click, call runRemove with f.fragment_instance_guid
  - After success, call refreshSessionFragments() to update the table
  - Remove the old manual guid TextField and separate "Remove fragment" section

- [ ] 3.5 Verify with tsc --noEmit

## Part 4: Fragments card - Section B (add fragment)

- [ ] 4.1 Fetch available fragment types
  - Add state: availableFragments (from list_template_fragments)
  - Add useEffect to fetch when templateId changes
  - Calls api.docListTemplateFragments(templateId, selectedToken?.token)
  - Stores the fragments array

- [ ] 4.2 Build the fragment type dropdown
  - Native select populated from availableFragments
  - Each option shows: name (if available) or fragment_id
  - Always append an "image" option at the end
  - Add state: selectedFragmentType (initially empty)

- [ ] 4.3 Build the regular fragment add form (conditional)
  - Shown when selectedFragmentType is a non-image fragment_id
  - On selection change, fetch fragment details via api.docGetFragmentDetails
  - Call buildParamsFromSchema on the parameters array
  - Pre-populate a JSON text field (fragmentParamsJson)
  - Position field (default "end")
  - "Add fragment" button calls runAddFragment
  - On success, call refreshSessionFragments(), clear form

- [ ] 4.4 Build the image fragment add form (conditional)
  - Shown when selectedFragmentType === 'image'
  - Reuse existing image form fields: url, title, alt_text, alignment, require_https, width, height
  - Position field (default "end")
  - "Add image" button calls runAddImage
  - On success, call refreshSessionFragments(), clear form

- [ ] 4.5 Remove old separate cards
  - Remove the old "Add fragment" card JSX
  - Remove the old "Add image fragment" card JSX
  - Remove the old "Fragments (review & remove)" card JSX
  - Clean up any now-unused state variables

- [ ] 4.6 Verify with tsc --noEmit

## Part 5: Final cleanup and testing

- [ ] 5.1 Remove unused imports (TextField select for parameter_type, etc.)
- [ ] 5.2 Review the full GofrDocBuilder.tsx for dead code, unused state, import hygiene
- [ ] 5.3 Run tsc --noEmit - must be clean
- [ ] 5.4 Visual test: start dev server, navigate to Builder page, verify:
  - Template parameters card renders with pre-populated JSON
  - Validate button works
  - Set parameters button works
  - Fragments table shows session fragments
  - Fragment type dropdown is populated
  - Regular fragment add form shows pre-populated JSON
  - Image fragment add form shows image fields
  - Remove button on table rows works
  - View button on table rows works
- [ ] 5.5 Run full test suite
