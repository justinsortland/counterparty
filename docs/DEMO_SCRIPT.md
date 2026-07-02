# Counterparty Demo Script

Target duration: 90 to 150 seconds. Use this as a screen recording voiceover or a live walkthrough guide.

## Pre-Demo Checklist

- [ ] `npm run dev` is running at `http://localhost:3000`
- [ ] Logged in to the app
- [ ] `npm run db:seed` has been run (check that "1847 Castro St ADU" appears on the submissions list)
- [ ] Browser is open at `/dashboard` with the full dashboard visible
- [ ] Browser zoom is comfortable for recording (100 to 125 percent)

## Spoken Script

Counterparty is a permit review workflow tool. It helps homeowners and contractors pressure-test a permit application before submitting it to the real permitting authority.

Starting on the dashboard, I can see a summary of active submissions, how many need revision, and how many open critical issues exist across the workspace. Below that, recent submissions and recent reviews give a quick pulse on what is in progress.

If I go to the submissions list, I can see five submissions here, each with a permit type, a status, and a review count. I will open the ADU submission for 1847 Castro Street.

This submission has two review revisions. The first review came back as Likely Reject. The plan checker flagged a rear setback violation as a critical issue, along with two major issues around energy compliance and utility service documentation. After revising the submission to address those, a second review was requested. The second review came back as Conditional. The critical setback issue is resolved. One major issue remains on utility documentation. That progression is the core workflow: submit, review, revise, repeat.

From this detail page I can open the compare view to see both revisions side by side, which issues dropped off, and which are still open.

I can also pull up the printable report for any revision, which formats the review findings into a clean document suitable for reference or for attaching to a real submission packet.

Back on the main nav, the Templates section has three pre-loaded starting points for common project types. Clicking "Use template" pre-fills the new submission form so you are not starting from scratch every time.

That is the full workflow: create a submission, attach documents, request a review, track revision progress, and use the output to build a stronger real application.

## Click-by-Click Walkthrough

### 1. Dashboard

**Click:** Navigate to `/dashboard` (should already be open).

**Say:** "Starting on the dashboard, you can see a summary of what is active, what needs attention, and recent review activity."

**Emphasize:**
- The stat cards give an immediate sense of submission health (active count, needs revision, critical issues).
- The "Needs Attention" table surfaces submissions that require action.
- The layout is designed around the workflow, not just data display.

---

### 2. Submissions List

**Click:** Click "Submissions" in the sidebar.

**Say:** "The submissions list shows all five demo submissions, each with its permit type, current status, and review count."

**Emphasize:**
- Status badges (Draft, Needs Revision, Reviewed) make the pipeline state visible at a glance.
- The list includes a range of permit types: building, electrical, plumbing.

---

### 3. 1847 Castro St ADU

**Click:** Click on "1847 Castro St ADU" from the submissions list.

**Say:** "This is the ADU submission. It has two review revisions. The scope of work, attached artifacts, and full review history are all on this page."

**Emphasize:**
- Rev 1 verdict is Likely Reject. Four issues were flagged: one critical (rear setback), two major (energy compliance, utility docs), one minor.
- Rev 2 verdict is Conditional. The critical setback issue was resolved. One major issue on utility documentation remains, and one minor issue is still open.
- The verdict progression (Likely Reject to Conditional) is the intended revision loop in action.
- Each review is an immutable record. Reviews are never overwritten.

---

### 4. Compare Revisions

**Click:** Click "Compare" on any review in the review history.

**Say:** "The compare view shows two revisions side by side. You can see which issues were resolved between Rev 1 and Rev 2, and which are still open."

**Emphasize:**
- Resolved issues are clearly distinguished from remaining ones.
- This view makes it easy to confirm that a revision addressed the right problems before submitting again.
- Useful for explaining the revision to a real plan checker or client.

---

### 5. Printable Report

**Click:** Click "Report" on a review from the detail page (or navigate to the report from the compare page).

**Say:** "Each review revision has a printable report. This formats the verdict, summary, issue list, and missing documents into a clean page you can save or attach to a submission packet."

**Emphasize:**
- The report is formatted for print or PDF export via the browser.
- It gives a structured record of what the AI flagged and why.

---

### 6. Templates

**Click:** Click "Templates" in the sidebar.

**Say:** "The Templates section has three pre-loaded starting points: a standard ADU template, a kitchen and bath remodel template, and an electrical panel upgrade template."

**Emphasize:**
- Templates save time on repeat project types by pre-filling scope of work language, permit type, project type, and jurisdiction.
- Useful for contractors who file similar permits regularly.

---

### 7. New Submission from Template

**Click:** Click "Use template" on the Standard ADU template. Review the pre-filled form.

**Say:** "Clicking a template pre-fills the new submission form. From here, fill in the project-specific details, attach any plan documents, and request a review. That is the full loop."

**Emphasize:**
- The form is ready to fill in, not start from scratch.
- After creating the submission, you would attach artifacts and request a review.
- The full cycle (create, attach, review, revise, compare, report) is all in one place.

---

## Fallback Notes

Use these if something goes wrong during a live demo or recording session.

- **Seed data is missing or incomplete:** Exit to the terminal and run `npm run db:seed`. The script is idempotent and safe to re-run. It will detect partial data and reseed from scratch.
- **Live AI review is slow or fails:** Set `MOCK_REVIEWER=true` in `.env.local` and restart the dev server. The mock reviewer returns a realistic Likely Reject result instantly without calling the Anthropic API. Use this mode for any recording where review latency would hurt the pacing.
- **Login fails or session expires:** Have a second browser tab with the login page ready. Credentials for the demo account should be noted separately before the session.
- **A specific page breaks mid-demo:** The dashboard, submissions list, and ADU detail page are the safest recovery points. Any of them can restart the walkthrough naturally. The compare and report pages are optional flourishes; skip them if needed and move directly from the ADU detail to Templates.
- **Browser zoom or layout looks off during recording:** Stop the recording, reset zoom to 100 percent, and restart from the dashboard. A consistent zoom level matters more than recovering mid-take.
