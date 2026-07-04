# API Contract

The cloud side should primarily provide authentication, backup, restore, and sync transport. Business calculations remain in the mobile app.

## Backend Direction

Use Firebase for MVP:

- Firebase Authentication with phone OTP
- Firestore or Firebase-backed API for synchronized data storage
- Firebase Cloud Functions if validation or idempotency needs server execution

## Authentication

### Send OTP

Request:

```json
{
  "mobileNumber": "+919999999999"
}
```

Response:

```json
{
  "verificationId": "firebase-verification-id"
}
```

### Verify OTP

Handled through Firebase Auth SDK. After success, the app requests or creates the salon profile.

## Cloud Data Model

Cloud collections should be partitioned by salon:

```text
salons/{salonId}
salons/{salonId}/services/{serviceId}
salons/{salonId}/employees/{employeeId}
salons/{salonId}/commissionRules/{ruleId}
salons/{salonId}/incomeTransactions/{transactionId}
salons/{salonId}/incomeTransactionItems/{itemId}
salons/{salonId}/expenseCategories/{categoryId}
salons/{salonId}/expenses/{expenseId}
salons/{salonId}/auditLogs/{auditLogId}
salons/{salonId}/syncOperations/{operationId}
```

## Shared Cloud Fields

Every synced entity should include:

- `id`
- `salonId`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `deviceId`
- `revision`

## Push Operation

Endpoint shape if implemented through Cloud Functions:

```text
POST /sync/push
```

Request:

```json
{
  "operationId": "queue-item-uuid",
  "salonId": "salon-uuid",
  "deviceId": "device-uuid",
  "entityType": "service",
  "entityId": "service-uuid",
  "operation": "update",
  "payload": {},
  "clientUpdatedAt": "2026-07-04T10:00:00.000Z"
}
```

Response:

```json
{
  "accepted": true,
  "entityId": "service-uuid",
  "revision": 12,
  "serverUpdatedAt": "2026-07-04T10:00:01.000Z",
  "conflict": null
}
```

Conflict response:

```json
{
  "accepted": true,
  "entityId": "service-uuid",
  "revision": 13,
  "serverUpdatedAt": "2026-07-04T10:05:00.000Z",
  "conflict": {
    "policy": "last_write_wins",
    "winner": "cloud",
    "auditLogId": "audit-uuid"
  }
}
```

## Pull Operation

Endpoint shape:

```text
GET /sync/pull?salonId={salonId}&after={cursor}
```

Response:

```json
{
  "cursor": "2026-07-04T10:05:00.000Z",
  "changes": [
    {
      "entityType": "service",
      "entityId": "service-uuid",
      "operation": "update",
      "revision": 13,
      "payload": {}
    }
  ]
}
```

## Idempotency

- `operationId` must be unique and stable.
- Replaying the same push operation returns the same accepted result.
- Restore and pull use upsert by UUID.

## Error Categories

- `auth_required`
- `permission_denied`
- `invalid_payload`
- `stale_operation`
- `rate_limited`
- `temporary_unavailable`

## Security Rules

- Authenticated user can access only their salon.
- One mobile number maps to one salon in MVP.
- Client cannot write to another `salonId`.
- Cloud validates required shared fields.

## Versioning

Include app and schema version in sync headers or payload:

```json
{
  "appVersion": "1.0.0",
  "schemaVersion": 1
}
```

Breaking sync changes require a migration plan before release.
