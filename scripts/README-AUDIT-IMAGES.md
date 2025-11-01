# Database Image Audit Script

## Overview

The `audit-missing-images.ts` script is a comprehensive database auditing tool that identifies recipes and meals with missing, invalid, or broken image references.

## Problem Statement

Production has broken images due to:
1. **Recipe records** with `image_url IS NULL` or empty `images` JSON arrays
2. **Meal records** with `image_url IS NULL`
3. **Invalid local paths** referencing non-existent files like `/images/recipes/...`
4. **External URLs** that may return 404 errors (optional check)

## Features

The audit script detects the following issues:

### Recipe Issues
- `no_images`: Both `image_url` and `images` array are null/empty
- `null_image_url`: Has images array but `image_url` is null/empty
- `empty_images_array`: Has `image_url` but images array is empty
- `invalid_local_path`: References local paths in `/images/` that don't exist
- `invalid_url_format`: Malformed URLs that don't follow http/https format
- `external_url_404`: External URLs that return 404 or network errors (optional)

### Meal Issues
- `no_image`: `image_url` is null or empty
- `invalid_local_path`: References local paths that don't exist
- `invalid_url_format`: Malformed URLs
- `external_url_404`: External URLs that are inaccessible (optional)

## Usage

### Basic Usage

```bash
# Run with default settings (both JSON and CSV output)
npx tsx scripts/audit-missing-images.ts

# Run with verbose logging
npx tsx scripts/audit-missing-images.ts --verbose
```

### Advanced Options

```bash
# Custom output directory
npx tsx scripts/audit-missing-images.ts --output-dir=./my-reports

# Check external URLs (HTTP HEAD requests - slower)
npx tsx scripts/audit-missing-images.ts --check-external-urls

# JSON output only
npx tsx scripts/audit-missing-images.ts --format=json

# CSV output only
npx tsx scripts/audit-missing-images.ts --format=csv

# Combined options
npx tsx scripts/audit-missing-images.ts --output-dir=./reports --format=json --verbose
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output-dir=<path>` | Output directory for reports | `./reports` |
| `--check-external-urls` | Validate external URLs with HTTP HEAD requests | `false` |
| `--format=<json\|csv\|both>` | Report format | `both` |
| `--verbose` | Show detailed progress information | `false` |

## Output Files

The script generates timestamped reports in the specified output directory:

- `image-audit-report-YYYY-MM-DD-HHmmss.json` - Structured JSON report
- `image-audit-report-YYYY-MM-DD-HHmmss.csv` - CSV report for Excel/spreadsheets

### JSON Report Structure

```json
{
  "generated_at": "2025-11-01T15:03:36.407Z",
  "summary": {
    "total_recipes": 4733,
    "total_meals": 10,
    "recipes_with_image_issues": 4530,
    "meals_with_image_issues": 0,
    "issue_breakdown": {
      "recipes": {
        "no_images": 4131,
        "null_image_url": 298,
        "invalid_local_path": 101
      },
      "meals": {}
    }
  },
  "recipe_issues": [
    {
      "id": "recipe-uuid",
      "name": "Recipe Name",
      "image_url": null,
      "images": "[\"url1\", \"url2\"]",
      "issue_type": "no_images",
      "issue_details": "Recipe has no images...",
      "user_id": "user-id",
      "created_at": "2025-10-28T21:35:14.270Z",
      "is_public": true,
      "moderation_status": "approved"
    }
  ],
  "meal_issues": []
}
```

### CSV Report Structure

The CSV report contains:
- Summary statistics
- Issue breakdown by type
- Detailed list of all affected recipes and meals
- Easily importable into Excel, Google Sheets, or SQL tools

## Sample Output

```
=================================================
DATABASE IMAGE AUDIT SCRIPT
=================================================

Configuration:
  Output Directory: ./reports
  Check External URLs: false
  Report Format: both
  Verbose: false

[2025-11-01T15:03:36.093Z] Starting recipe image audit...
[2025-11-01T15:03:36.336Z] Found 4530 recipe image issues
[2025-11-01T15:03:36.336Z] Starting meal image audit...
[2025-11-01T15:03:36.406Z] Found 0 meal image issues

=================================================
IMAGE AUDIT SUMMARY
=================================================
Generated: 2025-11-01T15:03:36.407Z

Total Recipes: 4733
Total Meals: 10

Recipes with Issues: 4530 (95.7%)
Meals with Issues: 0 (0.0%)

Recipe Issue Breakdown:
  - no_images: 4131
  - null_image_url: 298
  - invalid_local_path: 101

Meal Issue Breakdown:
=================================================

✓ JSON report saved: ./reports/image-audit-report-2025-11-01-110336.json
✓ CSV report saved: ./reports/image-audit-report-2025-11-01-110336.csv

✓ Audit completed successfully!

Next steps:
  1. Review the generated report(s) in ./reports
  2. Fix image issues using admin tools or SQL updates
  3. Re-run this script to verify fixes
```

## Typical Workflow

1. **Run Initial Audit**
   ```bash
   npx tsx scripts/audit-missing-images.ts
   ```

2. **Review Reports**
   - Open JSON report for programmatic processing
   - Open CSV report in Excel/Google Sheets for manual review

3. **Fix Issues**
   - Use admin UI to upload missing images
   - Run SQL updates to fix invalid paths
   - Use image regeneration scripts for bulk fixes

4. **Verify Fixes**
   ```bash
   npx tsx scripts/audit-missing-images.ts
   ```

5. **Compare Results**
   - Compare issue counts before and after fixes
   - Ensure affected recipes/meals have been resolved

## Performance Considerations

- **External URL Checking**: Using `--check-external-urls` will make HTTP HEAD requests to every external URL, which can be slow for large datasets. Use sparingly or for targeted audits.
- **Database Load**: The script performs full table scans on `recipes` and `meals` tables. Run during off-peak hours for production databases.
- **Report Size**: For large datasets (thousands of issues), JSON and CSV files can be several MB. Ensure adequate disk space.

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```
   Error: DATABASE_URL must be a valid PostgreSQL connection string
   ```
   **Solution**: Ensure `.env.local` has valid `DATABASE_URL` set

2. **Permission Denied (Output Directory)**
   ```
   Error: EACCES: permission denied, mkdir './reports'
   ```
   **Solution**: Use `--output-dir=~/reports` or ensure write permissions

3. **Script Timeout**
   ```
   Error: Script execution timeout
   ```
   **Solution**: For very large databases, consider filtering by date range or user_id

## Integration with Other Tools

### SQL Fix Examples

Based on audit results, you can create targeted SQL fixes:

```sql
-- Fix recipes with images array but no image_url
UPDATE recipes
SET image_url = (images::json->>0)
WHERE image_url IS NULL
  AND images IS NOT NULL
  AND images != '[]'
  AND images != 'null';

-- Remove invalid local paths
UPDATE recipes
SET image_url = NULL
WHERE image_url LIKE '/images/%'
  AND id IN (SELECT id FROM recipes WHERE ...);
```

### Admin UI Integration

1. Export CSV report
2. Filter by `issue_type`
3. Import IDs into admin UI for batch processing
4. Use bulk image upload/regeneration tools

## Future Enhancements

Potential improvements to the audit script:

- [ ] Add date range filtering (`--from-date`, `--to-date`)
- [ ] Add user filtering (`--user-id`)
- [ ] Add auto-fix mode for simple issues
- [ ] Add progress bar for large datasets
- [ ] Add email notification support
- [ ] Add Slack/Discord webhook notifications
- [ ] Add historical trend analysis (compare with previous audits)

## Related Documentation

- `/docs/api/IMAGE_UPLOADER_INTEGRATION.md` - Image upload API
- `/scripts/migrations/add-moderation-fields.ts` - Recipe moderation migration
- `/src/lib/db/schema.ts` - Database schema definitions

## Support

For issues or questions:
1. Check this README
2. Review generated reports for detailed error messages
3. Check database connection and permissions
4. Contact development team with report files attached
