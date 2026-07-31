> **⚠️ SUPERSEDED IN PART (2026-06-26) — no `repo` package.** Services no longer wrap DB
> access in a `repo` package or a per-query `Repository` interface. The **service layer uses
> `gormClient` directly** (`s.gormClient.WithContext(ctx).Model(&X{})…`) and **owns
> transactions directly** (`s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error
> { … })`). See **`docs/db-rules.md`** for the endorsed GORM patterns and the **reservations
> service** (`services/alpha/modules/reservations/service/`) as the live reference template
> (NOT the decommissioning `novella` service). The migration-*type* guidance below (GORM
> tags, ULID prefixes, `BeforeCreate`, proto conversion, ID prefixes in `global.go`) **still
> applies** — but **AutoMigrate registration moves out of `repo/init.go` into a
> `func (s *ServiceImpl) doAutoMigrations(ctx context.Context) error` method in the service
> package** (see `reservations/service/repo_init.go`). Read every "repo package" /
> "`repo/init.go`" reference below as "the service layer's `service/repo_init.go` (package
> service)". (Lesson: `.opencode/lessons/06-26-2026-inspirations-refactor-01.md`.)
>
> **⚠️ ALSO (2026-06-27) — each service owns its domain types.** New/refactored services
> **define and maintain their own entity types inside the service directory** (`package
> service`, e.g. `models_*.go` mirroring the reservations service) and do **not** import
> domain entity types from `libs/go/postgres/migrations`. The shared-migrations pattern in
> this guide is the legacy approach services are migrating away from; do not add new domain
> types to `libs/go/postgres/migrations` for a service that can own them. When localizing,
> keep only the fields/methods the service uses and preserve any serialized (e.g.
> Meilisearch JSONB) shape. (Lesson: `.opencode/lessons/06-27-2026-inspirations-refactor-02.md`.)

# PostgreSQL Table Creation Guide for Jouvae

This guide explains how to create tables in PostgreSQL using GORM for the Jouvae platform.

## Overview

Jouvae uses GORM's AutoMigrate feature to automatically create and update database tables. The process involves:

1. **Define the migration type** in `libs/go/postgres/migrations/`
2. **Register the type** for auto-migration in the appropriate service's `repo/init.go`

## Step 1: Define Your Migration Type

### Location

Create or modify a file in `libs/go/postgres/migrations/`. Group types by domain (e.g., `identity.go`, `experiences.go`, `circles.go`).

### Type Definition Structure

```go
package migrations

import (
    "time"
    "github.com/jackc/pgtype"
    "gorm.io/datatypes"
    "gorm.io/gorm"
)

type YourType struct {
    // Primary key - always use ULID format with a prefix
    ID string `json:"id" gorm:"primaryKey"`

    // Foreign keys - use proper GORM tags
    RelatedID string `json:"related_id" gorm:"index"`

    // Standard fields
    Name        string    `json:"name" gorm:"not null"`
    Description string    `json:"description"`
    Status      string    `json:"status" gorm:"index;default:'active'"`

    // JSONB fields for flexible data
    Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb"`

    // Array fields (PostgreSQL text array)
    Tags pq.StringArray `json:"tags" gorm:"type:text[]"`

    // Timestamps
    CreatedAt time.Time `json:"created_at" gorm:"index"`
    UpdatedAt time.Time `json:"updated_at"`
    DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}
```

### Required GORM Tag Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `gorm:"primaryKey"` | Primary key field | `ID string `gorm:"primaryKey"` |
| `gorm:"index"` | Single column index | `Email string `gorm:"index"` |
| `gorm:"uniqueIndex"` | Unique index | `Slug string `gorm:"uniqueIndex"` |
| `gorm:"index:idx_name"` | Named index | `Name string `gorm:"index:idx_name"` |
| `gorm:"not null"` | Not null constraint | `Name string `gorm:"not null"` |
| `gorm:"default:'value'"` | Default value | `Status string `gorm:"default:'active'"` |
| `gorm:"type:text[]"` | Text array (PostgreSQL) | `Tags pq.StringArray `gorm:"type:text[]"` |
| `gorm:"type:jsonb"` | JSONB column | `Metadata datatypes.JSON `gorm:"type:jsonb"` |
| `gorm:"foreignKey:Field"` | Foreign key | `Related []*Type `gorm:"foreignKey:TypeID"` |
| `gorm:"-"` | Skip migration (not persisted) | `CalculatedField string `gorm:"-"` |

### BeforeCreate Hook

Every migration type should have a `BeforeCreate` hook to auto-generate the ID and set timestamps:

```go
func (t *YourType) BeforeCreate(tx *gorm.DB) error {
    if t.ID == "" {
        var err error
        t.ID, err = newULID(YourTypePrefix)
        if err != nil {
            return err
        }
    }
    t.CreatedAt = time.Now()
    return nil
}
```

### Using Existing Migration Types

Before creating a new type, check `libs/go/postgres/migrations/` for existing types. Common reusable types include:

- `Location` - geographic location data
- `Guest` - guest/user entity
- `File` - file upload metadata
- `AuthzRelation` - authorization relationships
- `Invitation` - invitation records

### Proto Conversion Methods (Optional but Recommended)

If your type corresponds to a protobuf message, implement conversion methods:

```go
func YourTypeFromProto(pb *global.YourType) *YourType {
    if pb == nil {
        return nil
    }

    // Marshal metadata to JSON if needed
    var metadataJSON json.RawMessage
    if len(pb.Metadata) > 0 {
        if data, err := json.Marshal(pb.Metadata); err == nil {
            metadataJSON = data
        }
    }

    return &YourType{
        ID:          pb.Id,
        Name:        pb.Name,
        Description: pb.Description,
        Status:      pb.Status.String(),
        Metadata:    metadataJSON,
        CreatedAt:   time.UnixMilli(pb.CreatedAt),
        UpdatedAt:   time.UnixMilli(pb.UpdatedAt),
    }
}

func (t *YourType) ToProto() *global.YourType {
    if t == nil {
        return nil
    }

    // Unmarshal metadata from JSON if needed
    var metadata map[string]string
    if len(t.Metadata) > 0 {
        json.Unmarshal(t.Metadata, &metadata)
    }

    return &global.YourType{
        Id:          t.ID,
        Name:        t.Name,
        Description: t.Description,
        Status:      global.YourTypeStatus(global.YourTypeStatus_value[t.Status]),
        Metadata:    metadata,
        CreatedAt:   t.CreatedAt.UnixMilli(),
        UpdatedAt:   t.UpdatedAt.UnixMilli(),
    }
}
```

## Step 2: Register for Auto-Migration

### Location

Find the appropriate service directory: `services/alpha/modules/{service-name}/repo/init.go`

Services:
- `identity` - guest, workspace, auth data
- `experiences` - experiences, reservations, resources
- `finance` - payments, invoices
- `circles` - messaging, conversations, journeys
- `content` - file uploads, CDN

### Add to doAutoMigrations Function

Add your type to the `doAutoMigrations` function in the service's `repo/init.go`:

```go
func (r *repoImpl) doAutoMigrations(ctx context.Context) (err error) {
    _, span := r.tracer.StartWithInfo(ctx)
    defer span.End()

    if r.db == nil {
        return errors.New("the postgres connection was not initialized")
    }

    // Add your migration here
    if err = r.db.AutoMigrate(&migrations.YourType{}); err != nil {
        if utils.ErrorAlreadyExists(err) {
            r.logger.Warn().Msg("your_types table already exists")
        } else {
            return fmt.Errorf("failed to migrate YourType table: %v", err)
        }
    }

    // Existing migrations...
    if err = r.db.AutoMigrate(&migrations.Reservation{}); err != nil {
        // ...
    }

    return nil
}
```

### Error Handling Pattern

Use the standard error handling pattern:

```go
if err = r.db.AutoMigrate(&migrations.YourType{}); err != nil {
    if utils.ErrorAlreadyExists(err) {
        r.logger.Warn().Msg("your_types table already exists")
    } else {
        return fmt.Errorf("failed to migrate YourType table: %v", err)
    }
}
```

## ID Prefix Conventions

Add your type's prefix to `libs/go/postgres/migrations/global.go`:

```go
type Prefix string

const (
    // Existing prefixes...
    YourTypePrefix Prefix = "yrt"
)
```

Use descriptive prefixes (typically 3 letters):
- `exp` - Experience
- `rsv` - Reservation
- `gst` - Guest
- `wks` - Workspace
- `msg` - Message

## Common Field Patterns

### Soft Deletes

```go
DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
```

### Composite Indexes

```go
// For query performance on multiple fields
Status     string `gorm:"index:idx_status_owner,priority:1;default:'active'"`
OwnerID    string `gorm:"index:idx_status_owner,priority:2"`
RetryCount int    `gorm:"index:idx_status_retry,priority:2;default:0"`
```

### Foreign Keys

```go
// Explicit foreign key
RelatedID string `json:"related_id" gorm:"index;not null"`

// Or define relationship
Related []RelatedType `json:"related" gorm:"foreignKey:YourTypeID"`
```

### Time Bounds

```go
StartTime time.Time `json:"start_time"`
EndTime   time.Time `json:"end_time"`
ExpiresAt time.Time `json:"expires_at" gorm:"index"`
```

### Idempotency

```go
IdempotencyKey string `json:"idempotency_key" gorm:"uniqueIndex:idx_idempotency"`
```

## Complex Data Types

### JSONB (Flexible Schema)

```go
import "gorm.io/datatypes"

Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb"`
```

### Text Arrays (PostgreSQL)

```go
import "github.com/lib/pq"

Tags pq.StringArray `json:"tags" gorm:"type:text[]"`
Emails pq.StringArray `json:"emails" gorm:"type:text[]"`
```

### Geographic Data (Point)

```go
import "github.com/jackc/pgtype"

type Geo struct {
    pgtype.Point
    Latitude  float64 `json:"lat"`
    Longitude float64 `json:"lng"`
}

type YourType struct {
    Geo *Geo `json:"_geo"`
}
```

## Testing Your Migration

1. Start the development environment:
   ```bash
   make up
   ```

2. Build and run the service:
   ```bash
   make build
   ```

3. Verify the table was created in PostgreSQL:
   ```bash
   psql -h localhost -U jouvae -d jouvae -c "\dt your_types"
   ```

4. Check the schema:
   ```bash
   psql -h localhost -U jouvae -d jouvae -c "\d your_types"
   ```

## Troubleshooting

### Migration Already Exists

If you see "table already exists" warnings, this is normal. GORM handles this gracefully.

### Foreign Key Issues

Ensure foreign key fields match the referenced table's primary key type and name.

### Index Not Creating

Check that index names are unique across the entire database, not just the table.

### Type Conversion Errors

When converting from proto, handle nil pointers and optional fields:
```go
if pb.OptionalField != nil {
    y.OptionalField = pb.OptionalField.Value
}
```

## Best Practices

1. **Use ULIDs with prefixes** for all IDs - defined in `global.go`
2. **Always include timestamps** (`CreatedAt`, `UpdatedAt`, `DeletedAt`)
3. **Use JSONB for flexible metadata** rather than adding many optional columns
4. **Add indexes to foreign keys** and frequently queried fields
5. **Set sensible defaults** for status fields and counters
6. **Handle errors gracefully** in `BeforeCreate` hooks
7. **Implement proto conversion** if the type has a protobuf definition
8. **Check for existing types** before creating new ones
9. **Group related fields** in the same migration file
10. **Use descriptive prefixes** (3 characters) for readability

## Complete Example

```go
package migrations

import (
    "encoding/json"
    "time"
    "github.com/jouvae/core/apis/pb/go/global"
    "gorm.io/datatypes"
    "gorm.io/gorm"
)

type Event struct {
    ID          string         `json:"id" gorm:"primaryKey"`
    Name        string         `json:"name" gorm:"not null"`
    Description string         `json:"description"`
    Status      string         `json:"status" gorm:"index;default:'draft'"`
    OwnerID     string         `json:"owner_id" gorm:"index:idx_event_owner"`

    LocationID  string         `json:"location_id" gorm:"index"`
    StartDate   time.Time      `json:"start_date" gorm:"index"`
    EndDate     time.Time      `json:"end_date"`
    MaxAttendees int           `json:"max_attendees" gorm:"default:100"`

    Metadata datatypes.JSON `json:"metadata" gorm:"type:jsonb"`

    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (e *Event) BeforeCreate(tx *gorm.DB) error {
    if e.ID == "" {
        var err error
        e.ID, err = newULID(EventPrefix)
        if err != nil {
            return err
        }
    }
    e.CreatedAt = time.Now()
    return nil
}

func EventFromProto(pb *global.Event) *Event {
    if pb == nil {
        return nil
    }

    var metadataJSON json.RawMessage
    if len(pb.Metadata) > 0 {
        json.Marshal(pb.Metadata)
    }

    return &Event{
        ID:          pb.Id,
        Name:        pb.Name,
        Description: pb.Description,
        Status:      pb.Status.String(),
        OwnerID:     pb.OwnerId,
        LocationID:  pb.LocationId,
        StartDate:   time.UnixMilli(pb.StartDate),
        EndDate:     time.UnixMilli(pb.EndDate),
        MaxAttendees: int(pb.MaxAttendees),
        Metadata:    metadataJSON,
        CreatedAt:   time.UnixMilli(pb.CreatedAt),
        UpdatedAt:   time.UnixMilli(pb.UpdatedAt),
    }
}

func (e *Event) ToProto() *global.Event {
    if e == nil {
        return nil
    }

    var metadata map[string]string
    json.Unmarshal(e.Metadata, &metadata)

    return &global.Event{
        Id:          e.ID,
        Name:        e.Name,
        Description: e.Description,
        Status:      global.EventStatus(global.EventStatus_value[e.Status]),
        OwnerId:     e.OwnerID,
        LocationId:  e.LocationID,
        StartDate:   e.StartDate.UnixMilli(),
        EndDate:     e.EndDate.UnixMilli(),
        MaxAttendees: int32(e.MaxAttendees),
        Metadata:    metadata,
        CreatedAt:   e.CreatedAt.UnixMilli(),
        UpdatedAt:   e.UpdatedAt.UnixMilli(),
    }
}
```

Then register it in your service's `repo/init.go`:

```go
func (r *repoImpl) doAutoMigrations(ctx context.Context) (err error) {
    // ... existing migrations ...

    if err = r.db.AutoMigrate(&migrations.Event{}); err != nil {
        if utils.ErrorAlreadyExists(err) {
            r.logger.Warn().Msg("events table already exists")
        } else {
            return fmt.Errorf("failed to migrate Events table: %v", err)
        }
    }

    return nil
}
```

Don't forget to add the prefix to `global.go`:

```go
const (
    // ...
    EventPrefix Prefix = "evt"
)
```
