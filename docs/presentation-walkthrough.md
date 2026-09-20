# Presentation walkthrough

Open the app and select **Presentation guide**. Allow about eight minutes.

1. **My leave:** show Sarah's leave balances and next fortnight's roster.
2. **Request leave:** the guide selects 21 September, annual leave. Select Start booking to show balance, roster and policy checks. Explain the blockers and inspect a swap option.
3. **Assistant:** ask it to explain the blockers and find shift options. Submit only one request; calendar and assistant share the same saved queue.
4. **Manager requests:** review the proposed cover and checks. The supervisor retains the decision; clinical verification is required for approval.
5. **Leave calendar:** show department overlaps and an employee's recorded history. Missing history is unknown, not zero leave taken.
6. **Staffing requirements:** set the RN minimum to 11 for 21 September, Day. Show the before/after comparison. Save the staffing plan. These shared operating floors now inform chatbot checks, alternative dates and the approval guard. Unset minima remain unknown.
7. **Leave planning:** open Sarah's long-service plan, select dates and send an in-app invitation. The shortlist starts with five largest flagged annual/long-service balances; View all reveals the others.
8. **Employee view:** open the compact message, review dates or discuss. Invitations do not book or approve leave.

## Clean starting state

The September 20 walkthrough uses fresh request/invitation Azure partitions (`requests-walkthrough20260920-*`, `invitations-walkthrough20260920-*`) and fresh browser state. Previous records are retained in their original partitions. Source rosters, balances, booked leave and audit/usage records remain intact. New requests persist normally across reloads.

For swaps, select a chat option and confirm it for review. The manager can send an in-app invitation, inspect the recipient inbox preview, and record acceptance/decline after speaking with the colleague. There is no colleague authentication or external messaging connection.

The cancellation watch is a visual preview; it does not send scheduled notifications. Colleague agreement previews are not actual outreach. Staffing and policy detail remains available in expandable sections.

## Teams-style colleague response

From a manager request, send a swap invitation and select **Open Teams preview**. The separate page reads the saved invitation and shows the colleague's proposed duties, fortnight hours, and recorded rest gaps. Accept returns the request to manager review; Decline requires a reason. In manager view, use or edit the suggested response and review alternatives before deciding. The clinician sees the manager's reason and suggested dates in My requests.

This is an interactive simulation of a Teams message. No Microsoft Teams account, notification, or external message is involved. Replies are scoped to the current invitation and recorded as simulated colleague responses.

In chat, choose **Try different dates** to see the fortnight calendar. Green means all affected configured staffing floors pass; amber means staffing review is still required. Select a suggested block and choose **Check these dates** to recheck it. Green never means automatically approved.
