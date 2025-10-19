# Fridge/Pantry Feature Design

**Last Updated**: 2025-10-19  
**Version**: 0.1.0  
**Status**: Design Phase  
**Priority**: 🟡 HIGH - Aligns with core "cook what you have" philosophy

---

## Executive Summary

The Fridge/Pantry feature transforms Joanie's Kitchen from a recipe app into a **complete kitchen management system**. By tracking what users have in their kitchen and suggesting recipes based on available ingredients, we address the core problem of food waste while making cooking more spontaneous and stress-free.

**Core Value Proposition**: "Cook with what you have, waste nothing, and make it simple."

---

## Feature Philosophy

### Joanie's Kitchen Principles

The Fridge/Pantry feature embodies Joanie's core philosophy of practical, authentic home cooking:

**The Real-World Problem**:
- Average household wastes 30-40% of food purchased
- People forget about ingredients until they spoil  
- "What's for dinner?" paralysis when staring at a full fridge
- Recipe apps suggest dishes requiring specialty ingredients you don't have
- Busy weeknights need solutions NOW, not shopping trips

**Joanie's Solution**:
- Know what you have at a glance
- Get recipe suggestions that use your actual inventory
- Reduce waste by cooking ingredients before they expire
- Turn "random fridge items" into real meals
- Make cooking spontaneous and stress-free

### Design Principles

1. **Practical Over Perfect**: Track what matters, ignore what doesn't
2. **Mobile-First Reality**: Check while standing in your kitchen
3. **Quick Capture**: Adding items takes 5 seconds, not 5 minutes
4. **Smart Defaults**: Auto-calculate expiration dates
5. **Forgiving System**: Partial matches OK, flexible quantities
6. **Waste Reduction Focus**: Surface expiring items prominently
7. **Action-Oriented**: Every view leads to "what can I cook?"

---

## MVP Features (Phase 1 - v0.6.0)

### 1. Inventory Management
- Add/edit/remove items from fridge/freezer/pantry
- Quick add with search autocomplete
- Category-based organization (Proteins, Produce, Dairy, Pantry)
- Expiration date tracking with visual indicators

### 2. "What Can I Cook?" Engine
- Recipe matching based on available ingredients
- Match score (100% = all ingredients available)
- Filter by match strictness (90%+, 80%+, etc.)
- Show missing ingredients with "Add to Shopping List" button

### 3. Expiration Alerts
- Visual status indicators (Fresh 🟢, Use Soon 🟡, Expiring 🔴)
- Daily notification digest for expiring items
- Link to recipes using expiring ingredients

### 4. Basic Integration
- Shopping list sync (add missing ingredients)
- Recipe detail shows which ingredients you have
- Post-cooking: "Mark ingredients as used"

---

## Implementation Plan

See full technical specification in the complete design document.

**Phase 1 Timeline**: 3-4 weeks  
**Database Tables**: inventoryItems, inventoryUsageLog, foodDatabase, wasteTracking  
**Key Server Actions**: addInventoryItem, getInventory, matchRecipesToInventory, useInventoryItem

---

## Success Metrics

1. **Food Waste Reduction**: Target 90%+ usage rate
2. **"Cook What You Have" Rate**: 60% of meals use 80%+ fridge ingredients
3. **Shopping Trip Reduction**: 30% fewer trips
4. **User Engagement**: 50% weekly active inventory users

---

**Next Steps**: Database schema design, MVP implementation (3-4 weeks), user testing

For complete details including user stories, technical architecture, UI mockups, and implementation phases, see the full design document.
