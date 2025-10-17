# Chef Avatar Images

This directory contains avatar images for featured chefs in Joanie's Kitchen.

## Required Images

Please save the uploaded chef images with the following exact filenames:

1. `yotam-ottolenghi.jpg` - Yotam Ottolenghi
2. `nigella-lawson.jpg` - Nigella Lawson
3. `samin-nosrat.jpg` - Samin Nosrat
4. `lidia-bastianich.jpg` - Lidia Bastianich
5. `nancy-silverton.jpg` - Nancy Silverton
6. `kenji-lopez-alt.jpg` - Kenji López-Alt
7. `madhur-jaffrey.jpg` - Madhur Jaffrey
8. `jacques-pepin.jpg` - Jacques Pépin
9. `alton-brown.jpg` - Alton Brown

## After Adding Images

Once all images are saved to this directory, run:

```bash
tsx scripts/save-chef-avatars.ts
```

This will update the database records to point to these local avatar images.

## Image Specifications

- **Format**: JPG preferred (PNG also supported)
- **Recommended Size**: 400x400px minimum
- **Aspect Ratio**: Square (1:1) for consistent display
- **File Size**: Keep under 200KB for performance

## Verification

After running the update script, verify avatars appear correctly on:
- `/discover/chefs` - Chef listing page
- Individual chef pages
- Recipe cards showing chef attribution
