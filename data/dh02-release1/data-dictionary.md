# Data Dictionary

The fields describe supplied exports. They do not define the required final schema.

## Reference files

### `campuses.csv`, `buildings.csv`, and `locations.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| campus_code | Canonical campus identifier | Raw requests may use names instead of codes |
| building_code | Canonical building identifier | Raw requests contain aliases |
| location_code | Canonical room or area identifier | Some requests omit or misstate the location |
| restricted_access | Whether access requires additional control | Does not define the complete access process |
| active | Whether the location is active | An inactive location appears in current work |

### `technicians.csv` and `technician_skills.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| technician_id | Technician identifier | Does not by itself authorize access to every work order |
| availability_status | Current availability label | Historical availability requires separate modeling |
| skill_code | Maintenance skill category | Skills are not complete certification records |
| authorized_for_restricted_locations | Simplified access indicator | Local supervision may still be required |

## Raw files

### `maintenance_requests.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| request_id | Report identifier | A request does not automatically become a work order |
| campus/building/location | User-entered location information | Names and aliases are inconsistent |
| reported_category | Requester's initial category | May be incorrect |
| requester_priority | Urgency reported at intake | Must not become the final priority automatically |
| validated_priority | Facilities priority | Blank for unvalidated or redirected requests |
| request_status | Current source label | Priority and workflow are mixed in one record |
| duplicate_of | Principal related request | Current duplicate rule is incomplete |

### `work_orders.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| source_request_id | Request that led to the work order | Preventive work later has a different origin |
| original_category/current_category | Initial and corrected categories | Current export is not a complete category-history model |
| primary_technician | Current exported assignee | Assignment history must be consulted |
| status | Current source-system state | Labels are inconsistent |
| parent_work_order_id | Related earlier work order | Relationship semantics need clarification |
| completed_at/closed_at | Technical completion and final closure | These are not equivalent |

### `assignments.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| from_assignee/to_assignee | Previous and new assignee | Blank first assignee means initial assignment |
| reason | Assignment explanation | One record is missing a reason |
| active_flag | Current assignment indicator | Source rows may become stale |

### `work_updates.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| update_type | Type of work action | Taxonomy is not final |
| visibility | Intended audience | One row is blank |
| summary | Synthetic operational note | May contain internal information |

### `blocked_work.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| block_reason | Why work cannot continue | One row is missing the reason |
| responsible_party | Party expected to unblock the work | May be a unit or person |
| expected_next_action | Next operational action | Does not define a workflow automatically |

### `completion_confirmations.csv`

| Field | Meaning | Known limitation |
|---|---|---|
| response | Confirmation outcome | Confirmation rules may vary by category |
| requested_from | Person or role asked to confirm | Not every work order uses the same confirmer |
