# Release Artifacts Directory

This directory contains deployment and rollback artifacts for Edgar's Mobile Auto Shop.

## File Types

### rollback.json
- **Purpose**: Current rollback information for latest deployment
- **Updated**: On every successful deployment via `./scripts/release.sh`
- **Used by**: `./scripts/rollback.sh` for rollback operations

### release-YYYYMMDD-HHMMSS.json
- **Purpose**: Timestamped backup of release information
- **Created**: On every deployment for audit trail
- **Format**: Same as rollback.json but with timestamp

### rollback-YYYYMMDD-HHMMSS.json
- **Purpose**: Record of rollback operations performed
- **Created**: When `./scripts/rollback.sh` is executed
- **Contains**: What was rolled back from/to and when

## File Retention

- Keep latest `rollback.json` (required for rollbacks)
- Keep timestamped files for 30 days for audit trail
- Archive older files to long-term storage if needed

## Manual Cleanup

```bash
# Remove files older than 30 days
find releases/ -name "*.json" -mtime +30 -not -name "rollback.json" -delete

# Archive old files
tar -czf releases-archive-$(date +%Y%m).tar.gz releases/release-* releases/rollback-*
```

## Security Notes

- These files contain deployment metadata but no secrets
- Safe to include in backups and version control
- Contains image URIs and SHA256 hashes for verification
