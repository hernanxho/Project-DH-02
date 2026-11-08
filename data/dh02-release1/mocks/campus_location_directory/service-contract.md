# Simulated Campus Location Directory

The Campus Location Directory is the authoritative source for:

- campus code;
- building code and name;
- floor;
- room or area;
- location type;
- active status;
- restricted-access indicator.

Suggested operation:

```http
GET /mock/campus-locations/{location_code}
```

The maintenance application should reference location information and preserve relevant
history, but it should not silently become the authoritative campus-location directory.
