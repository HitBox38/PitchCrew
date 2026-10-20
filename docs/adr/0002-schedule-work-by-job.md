# Schedule work by job while retaining shared agent identities

Serializing all work by crew agent makes unrelated jobs and conversations wait for one another. Schedule board actions and attached chat requests through one queue per job, with an independent queue for each standalone conversation and a configurable workspace concurrency limit; the same crew agent can execute separate runs across jobs. Sharing the job queue across its conversations prevents conflicting application work while retaining separate histories, whereas scheduling each conversation independently would leave those conflicts unresolved.

See [Workspace and job queues](../board-action-queue.md) for the agreed behavior, background-routine exception and browser-session requirements. Implemented through shared queue admission, persisted ordering and per-job browser sessions.
