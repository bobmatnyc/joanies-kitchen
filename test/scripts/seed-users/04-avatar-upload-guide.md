# Avatar Upload Guide for Synthetic Users

## Overview

This guide explains how to source, prepare, and upload avatar photos for the 2000 synthetic users. The goal is to create a realistic, diverse user base with authentic-looking profile photos.

---

## 📋 Requirements

### Photo Specifications
- **Format**: JPG (optimized for web)
- **Size**: 512x512px (square)
- **File size**: < 200KB per image
- **Quality**: Professional headshot quality
- **Diversity**: Wide range of ages (18-85), races, genders, ethnicities

### Directory Structure
```
public/avatars/synthetic/
├── user-001.jpg
├── user-002.jpg
├── user-003.jpg
├── ...
└── user-100.jpg
```

**Note**: We only need 100 unique avatars since the system cycles through them (2000 users ÷ 100 avatars = 20 users per avatar).

---

## 🎨 Photo Sources

### Option 1: AI-Generated Faces (RECOMMENDED)
**Source**: [ThisPersonDoesNotExist.com](https://thispersondoesnotexist.com/)

**Pros**:
- Free, unlimited use
- No copyright issues
- Photorealistic quality
- Can refresh for different faces

**Cons**:
- Cannot control demographics precisely
- May take time to get diverse set

**Process**:
1. Visit https://thispersondoesnotexist.com/
2. Refresh page to generate new face
3. Right-click and "Save Image As..."
4. Repeat until you have diverse set of 100 images
5. Rename to `user-001.jpg`, `user-002.jpg`, etc.

---

### Option 2: Stock Photo Sites (FREE)
**Sources**:
- [Unsplash](https://unsplash.com/) - Free, high-quality photos
- [Pexels](https://www.pexels.com/) - Free stock photos
- [Pixabay](https://pixabay.com/) - Free images

**Pros**:
- Professional quality
- Can search by demographics
- Diverse selection

**Cons**:
- Need to check license for each image
- May require attribution
- Time-consuming to find diverse set

**Process**:
1. Search terms: "headshot", "portrait", "person", "professional"
2. Filter for free-to-use images
3. Download high-quality version
4. Ensure diverse representation (age, race, gender)

---

### Option 3: Diverse Face Generator
**Source**: [Generated Photos](https://generated.photos/)

**Pros**:
- Can filter by age, ethnicity, emotion
- AI-generated (no copyright issues)
- High quality

**Cons**:
- Free tier limited to 100 images
- May require account

---

## 🛠️ Image Preparation

### Batch Processing with ImageMagick

Install ImageMagick:
```bash
# macOS
brew install imagemagick

# Ubuntu/Debian
sudo apt-get install imagemagick

# Windows (via Chocolatey)
choco install imagemagick
```

Resize and optimize all images:
```bash
cd public/avatars/synthetic/

# Resize to 512x512 and optimize
for file in *.{jpg,jpeg,png}; do
  convert "$file" -resize 512x512^ -gravity center -extent 512x512 -quality 85 "optimized_${file%.png}.jpg"
done

# Remove originals and rename
rm -f *.png  # Remove PNG originals if converting
rename 's/optimized_//' *.jpg  # Remove 'optimized_' prefix
```

### Manual Preparation (Photoshop/GIMP)

1. Open image in editor
2. Crop to square aspect ratio
3. Resize to 512x512px
4. Save as JPG with quality 85%
5. Ensure file size < 200KB

---

## 📊 Diversity Checklist

Ensure your 100 avatars represent:

### Age Distribution
- [ ] 10-15 images: 18-24 years old
- [ ] 25-30 images: 25-39 years old
- [ ] 25-30 images: 40-59 years old
- [ ] 10-15 images: 60+ years old

### Gender Distribution
- [ ] ~50 images: Male-presenting
- [ ] ~50 images: Female-presenting
- [ ] Consider including non-binary representation

### Ethnicity/Race Distribution (approximate US/Canada demographics)
- [ ] ~50 images: White/Caucasian
- [ ] ~20 images: Hispanic/Latino
- [ ] ~13 images: Black/African American
- [ ] ~10 images: Asian/Pacific Islander
- [ ] ~5 images: Middle Eastern
- [ ] ~2 images: Indigenous/Native American

### Other Considerations
- [ ] Variety of hairstyles
- [ ] Variety of clothing styles (casual, professional)
- [ ] Variety of backgrounds (neutral, blurred)
- [ ] Natural expressions (smiles, neutral, thoughtful)
- [ ] Include people with glasses

---

## 📁 File Naming Convention

**Format**: `user-XXX.jpg`

- `XXX` = Three-digit number with leading zeros (001-100)
- Examples: `user-001.jpg`, `user-042.jpg`, `user-100.jpg`

**Important**: The generation script expects this exact format!

---

## ✅ Upload Process

### Step 1: Create Directory
```bash
mkdir -p public/avatars/synthetic
```

### Step 2: Add Images
Place all 100 prepared images in `public/avatars/synthetic/`

### Step 3: Verify Structure
```bash
ls -la public/avatars/synthetic/

# Should show:
# user-001.jpg
# user-002.jpg
# ...
# user-100.jpg
```

### Step 4: Test Image Access
Start dev server and visit:
```
http://localhost:3002/avatars/synthetic/user-001.jpg
```

Image should load successfully.

---

## 🔒 Legal & Ethical Considerations

### Copyright
- ✅ Use AI-generated faces (no copyright)
- ✅ Use stock photos with CC0 or similar free license
- ❌ Do NOT use photos scraped from social media
- ❌ Do NOT use photos of real people without permission

### Privacy
- ✅ AI-generated faces are ethically sound
- ✅ Stock photos with model release
- ❌ Never use photos that could identify real individuals

### Attribution
If using stock photos that require attribution:
- Create `public/avatars/synthetic/ATTRIBUTIONS.md`
- List source and photographer for each image requiring credit

---

## 🚀 Quick Start Script

Automated download and preparation (using ThisPersonDoesNotExist):

```bash
#!/bin/bash
# Download 100 AI-generated faces

mkdir -p public/avatars/synthetic
cd public/avatars/synthetic

for i in {1..100}; do
  # Pad number with zeros
  num=$(printf "%03d" $i)

  # Download AI-generated face
  curl -o "user-${num}.jpg" https://thispersondoesnotexist.com/image

  # Wait 2 seconds between requests (be respectful)
  sleep 2

  echo "Downloaded user-${num}.jpg"
done

echo "✨ Downloaded 100 avatars!"
```

**Note**: This script may take ~3 minutes to complete (2 second delay × 100 images).

---

## 🎯 Alternative: Placeholder Until Upload

If you want to test the system before uploading real avatars, use placeholder service:

**Option 1: UI Avatars** (initials-based)
```typescript
// In profile generation script, use:
profile_image_url: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&size=512&background=random`
```

**Option 2: DiceBear Avatars** (abstract/illustrated)
```typescript
profile_image_url: `https://api.dicebear.com/7.x/avataaars/jpg?seed=${username}`
```

**Option 3: Boring Avatars** (geometric patterns)
```typescript
profile_image_url: `https://source.boringavatars.com/beam/512/${username}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`
```

---

## 📊 Verification Checklist

Before considering upload complete:

- [ ] All 100 images in `public/avatars/synthetic/` directory
- [ ] Files named `user-001.jpg` through `user-100.jpg`
- [ ] All images are 512x512px
- [ ] All files < 200KB
- [ ] Diverse representation across age, race, gender
- [ ] Images load successfully in browser
- [ ] No copyright or privacy issues

---

## 🆘 Troubleshooting

### Images Not Loading
- Check file permissions: `chmod 644 public/avatars/synthetic/*.jpg`
- Verify Next.js public directory structure
- Clear browser cache
- Restart dev server

### Images Too Large
```bash
# Optimize all JPGs to reduce file size
cd public/avatars/synthetic
mogrify -quality 85 -resize 512x512 *.jpg
```

### Missing Images
```bash
# Count files
ls public/avatars/synthetic/*.jpg | wc -l
# Should output: 100
```

---

## 📚 Additional Resources

- [ImageMagick Documentation](https://imagemagick.org/index.php)
- [Unsplash License](https://unsplash.com/license)
- [This Person Does Not Exist](https://thispersondoesnotexist.com/)
- [Generated Photos](https://generated.photos/)

---

**Last Updated**: 2025-10-17
**Maintainer**: Recipe Manager Team
