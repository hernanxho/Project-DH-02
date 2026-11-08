# DH-02 Campus Maintenance — Release 1: Discovery Data Pack

This pack contains synthetic exports from Horizon University's current maintenance
environment. It is evidence for discovery and modeling, not a final application schema.

## Use with the Common Horizon Starter

Copy this pack's `data/` contents into the starter repository's `data/` directory,
or set `DATA_ROOT` to this pack's `data` directory.

Then run:

```bash
python scripts/validate_data.py
python scripts/load_seed_data.py --replace
```

## Student responsibilities

Teams should:

- inspect the records and data-quality limitations;
- distinguish maintenance requests from authorized work orders;
- identify ambiguities and prepare stakeholder questions;
- preserve raw files;
- place transformations in `data/generated/`;
- avoid treating the export structure as the required final domain model.

The pack intentionally contains inconsistent identifiers, missing values, possible
duplicates, priority ambiguity, stale assignments, blocked work, restricted locations,
related work orders, and incomplete completion evidence.
