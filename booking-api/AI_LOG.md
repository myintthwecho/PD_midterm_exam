# AI Log

This log records the important AI-assisted work used for this submission.

| Prompt or task | What I used | What I verified myself |
|---|---|---|
| Asked where the required error response format and status codes were defined in the exam brief. | Located the `Error Format` section and the 400/404/409 rules. | Compared the requirements with the implementation and API contract. |
| Asked how the error responses were implemented in the API. | Reviewed the `errorJson` helper, route validation, not-found handling, conflict detection, and global error handler. | Traced each route in `src/index.ts` and checked the corresponding test evidence. |
| Asked about deployment and deployed the API to Cloudflare Workers with D1. | Used Wrangler to create/configure `booking-db`, apply `schema.sql`, deploy the Worker, and document the production URL. | Verified the live equipment endpoint, created and deleted a live test booking, and confirmed the remote database contains two equipment records and no leftover bookings. |
| Asked for a Quality Gate review. | Reviewed the eight Quality Gate sections and identified a JSON-body validation edge case. | Added object validation for `POST` and `PATCH`, then ran the TypeScript/Wrangler validation and reviewed the relevant source and evidence files. |


