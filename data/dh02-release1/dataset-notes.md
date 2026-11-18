# Dataset Notes

## Source interpretation

- `data/reference/` contains relatively stable campus and maintenance reference exports.
- `data/raw/` contains spreadsheet-like records from the fragmented current process.
- `data/scenarios/` identifies situations to analyze; scenarios do not prescribe solutions.
- `mocks/` describes the simulated authoritative Campus Location Directory.

## Known limitations

The source data intentionally contains:

- campus, building, room, category, status, and priority values with inconsistent names;
- a duplicate request pair that must remain traceable;
- a safety request whose priority is mixed with workflow status;
- a request with incomplete location information;
- an inactive location used by an active work order;
- an initial category corrected after technician inspection;
- a technician assignment that later required specialist reassignment;
- blocked work caused by access and by a related work order;
- one blocked record with a missing block reason;
- technical completion without final closure;
- a work order reopened after requester confirmation;
- an incomplete attachment MIME type;
- a related corrective task linked to an earlier water incident;
- one assignment record missing a reason.

Preserve the raw evidence and document normalization, validation, and migration decisions.
