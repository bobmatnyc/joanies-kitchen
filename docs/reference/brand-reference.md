# Joanie's Kitchen - Quick Brand Reference

**One-page cheat sheet for developers**

---

## 🎨 Colors (CSS Variables)

```css
/* Brand Colors */
--jk-olive:    #5B6049  /* Header/Footer/Primary */
--jk-sage:     #A7BEA4  /* Borders/Accents */
--jk-linen:    #FAF5EE  /* Backgrounds */
--jk-tomato:   #E65F45  /* Primary CTAs */
--jk-clay:     #B46945  /* Links/Icons */
--jk-charcoal: #333333  /* Text */
```

## 🔤 Fonts

```css
font-heading: 'Playfair Display', serif  /* Headings */
font-body:    'Lora', serif              /* Body text */
font-ui:      'Inter', sans-serif        /* UI elements */
```

## 🎯 Quick Usage

### Buttons
```tsx
// Primary CTA
<Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui rounded-jk">

// Secondary
<Button className="bg-jk-clay hover:bg-jk-clay/90 text-white font-ui rounded-jk">

// Outline
<Button className="border-jk-clay text-jk-clay hover:bg-jk-clay hover:text-white">
```

### Cards
```tsx
<Card className="recipe-card border-jk-sage">
  <CardHeader>
    <CardTitle className="font-heading text-jk-olive">Title</CardTitle>
    <CardDescription className="font-body text-jk-charcoal/70">Description</CardDescription>
  </CardHeader>
</Card>
```

### Headings
```tsx
<h1 className="font-heading text-jk-olive">Joanie's Kitchen</h1>
<h2 className="font-heading text-jk-olive">Section Title</h2>
<p className="font-body text-jk-charcoal">Body content</p>
```

### Hero Section
```tsx
<section className="bg-jk-olive text-jk-linen py-20">
  <h1 className="font-heading text-6xl text-jk-linen">Joanie's Kitchen</h1>
  <p className="font-body text-2xl text-jk-sage italic">From Garden to Table</p>
</section>
```

## 📐 Utility Classes

```css
.recipe-card        /* Parchment-style card */
.jk-divider         /* Sage green divider */
.jk-container       /* Linen container */
.btn-primary        /* Tomato button */
.btn-secondary      /* Clay button */
rounded-jk          /* 8px border radius */
```

## 🎭 Brand Voice

**Garden Metaphors**: "Plant a Recipe", "Recipe Garden", "Seasonal Discovery"
**Tone**: Warm, grounded, nurturing, conversational
**Tagline**: "From Garden to Table — with Heart and Soil"

## 🔗 Files

- Logo: `/public/joanies-logo.svg`
- CSS: `/src/app/globals.css`
- Layout: `/src/app/layout.tsx`
- Homepage: `/src/app/page.tsx`

---

**Accessibility**: All colors meet WCAG AA standards
**Border Radius**: 8px throughout
**Package Name**: `joanies-kitchen`
