# Phase 3 Slice 4: Final delivery

Status: complete.

Workspace owners and administrators can upload a verified asset with the `FINAL_DELIVERABLE` purpose after the client approves the review. Publication is a separate, explicit action: it changes the file visibility to `PUBLISHED` and appends a client-visible activity record in the same database transaction.

Client download authorization is intentionally narrow. A client can download only a ready, published final deliverable on an associated project. Internal assets, source files, references, and unpublished finals are never exposed through the download endpoint.

The project can move from `FINAL_DELIVERY` to `COMPLETED` only after at least one published final deliverable exists. Completion and its activity record are atomic, and completed projects lock uploads and file removal while retaining the delivery record.

The flow uses the existing private R2 bucket and configured 8 GB storage guard. It adds no paid provider dependency and does not change `.env`.
