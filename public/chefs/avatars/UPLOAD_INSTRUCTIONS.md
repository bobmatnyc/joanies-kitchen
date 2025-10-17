# Chef Avatar Upload Instructions

## Required Images

Please save the 10 chef images you uploaded in chat to this directory with these exact filenames:

### Order of Images Uploaded:
1. **Image #1** (first) → `yotam-ottolenghi.jpg` - Yotam Ottolenghi (yellow apron, kitchen background)
2. **Image #2** → `nigella-lawson.jpg` - Nigella Lawson (black top, holding green olives)
3. **Image #3** → `samin-nosrat.jpg` - Samin Nosrat (pink shirt, black apron, laughing)
4. **Image #4** → `lidia-bastianich.jpg` - Lidia Bastianich (navy blue top, orange beads, glasses)
5. **Image #5** → `nancy-silverton.jpg` - Nancy Silverton (white shirt, yellow apron, glasses)
6. **Image #6** → `kenji-lopez-alt.jpg` - Kenji López-Alt (blue striped shirt, yellow apron)
7. **Image #7** → `madhur-jaffrey.jpg` - Madhur Jaffrey (traditional dress with floral print)
8. **Image #8** → `jacques-pepin.jpg` - Jacques Pépin (blue apron, kitchen background)
9. **Image #9** → `alton-brown.jpg` - Alton Brown (black apron, glasses, grey beard)
10. **Image #10** (Gordon) → `gordon-ramsay.jpg` - Gordon Ramsay

## Steps:

1. **Save each image** from the chat to this directory (`/Users/masa/Projects/recipe-manager/public/chefs/avatars/`)
2. **Use the exact filenames** listed above (all lowercase, with hyphens)
3. **Run the update script**:
   ```bash
   cd /Users/masa/Projects/recipe-manager
   tsx scripts/update-chef-avatars.ts
   ```
4. **Verify the images** appear on http://localhost:3002/discover/chefs

## Image Specifications:
- Format: JPG or PNG
- Recommended size: 400x400px minimum
- Aspect ratio: Square (1:1) for best display
- File size: Keep under 200KB for performance

## After Upload:
The script will update the database to point all chef records to use these local avatar images.
