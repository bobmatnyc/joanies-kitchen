# Image Generation Decision Log

**Date**: October 21, 2025
**Decision Maker**: Masa Matsuoka
**Context**: Phase 6 Launch Preparation (6 days to October 27 launch)

---

## Decision Summary

**Ingredient Image Generation**: **DEFERRED TO PHASE 7**
**Visual Style**: **Kitchen Counter Setting** (finalized)

---

## Rationale

### Why Defer to Phase 7?

1. **Launch Readiness**: Core platform is 95% ready without ingredient images
   - 4,644 recipes with 99.94% ingredient extraction coverage
   - All Phase 6 tasks (7.1-7.4) complete
   - Performance, SEO, analytics all operational

2. **Time Constraints**: 6 days to launch
   - Focus on launch logistics and final QA
   - Image generation is enhancement, not blocker

3. **Quality Over Speed**: Better to do it right post-launch
   - Current infrastructure allows batch generation anytime
   - Can iterate on prompt quality without launch pressure
   - Can gather user feedback on visual preferences

4. **Low Risk**: Platform functions excellently without images
   - Ingredients page works with text-based cards
   - Recipe search and matching unaffected
   - Can add images progressively post-launch

### Why Kitchen Counter Setting?

**Visual Decision**: Switched from white studio background to rustic wooden cutting board with kitchen counter context.

**Reasons**:
1. **Authenticity**: Joanie's Kitchen is about home cooking, not professional food photography
2. **Contextual Relevance**: Kitchen setting aligns with zero-waste, practical cooking ethos
3. **Warmth**: Wooden textures feel more inviting than sterile white backgrounds
4. **Differentiation**: Most stock food photos use white backgrounds - this stands out
5. **Natural Imperfections**: Kitchen context allows realistic presentation vs overly polished studio shots

**Technical Implementation**:
```python
# Before (Studio Style)
"pure white seamless background, "
"sharp focus on texture, "

# After (Kitchen Context)
"placed on rustic wooden cutting board, "
"kitchen counter setting, "
"sharp focus on ingredient, "
```

**Negative Prompts Updated**:
- Added: "white background, plain background, studio backdrop"
- Removed: "dark background, colored background"
- Result: Enforces kitchen context, prevents AI from reverting to studio style

---

## Phase 7 Image Generation Plan

### Scope
- **Target**: Top 100-200 ingredients by usage_count
- **Format**: 1024x1024 square (optimized for cards)
- **Style**: Kitchen counter setting (finalized prompt)
- **Storage**: `public/images/ingredients/{slug}.jpg`

### Batch Generation Process
1. Query ingredients by usage_count DESC LIMIT 200
2. Generate images using finalized prompts (4s per image = ~13 minutes total)
3. Review quality (sample 10-20 images)
4. Upload to public folder
5. Update database with image URLs
6. Deploy incrementally (can do 50 at a time)

### Success Metrics
- Visual consistency across all generated images
- Load time < 2s on ingredients page
- User engagement with ingredients directory increases
- No complaints about image quality/relevance

---

## Technical Notes

### Stable Diffusion XL Setup
- **Hardware**: Apple M4 Max (40-core GPU, 128GB RAM)
- **Model**: stabilityai/stable-diffusion-xl-base-1.0
- **Performance**: ~4 seconds per 1024x1024 image on MPS
- **Fix Applied**: float32 precision to avoid MPS black image bug

### Prompt Engineering Lessons
1. **Watermelon Exception**: Requires "fresh cut watermelon slice" to avoid whole watermelon rendering
2. **Camera Details Matter**: "Canon EOS R5, 100mm macro lens" significantly improves photorealism
3. **Lighting is Critical**: "soft natural lighting" prevents harsh shadows/artificial look
4. **Negative Prompts Essential**: Must explicitly exclude unwanted elements (plastic, CGI, etc.)

### Integration Status
- ✅ **Infrastructure**: Complete (generation scripts working)
- ❌ **Database Integration**: Not yet built (Phase 7 work)
- ❌ **Batch Processing**: Manual for now (can automate in Phase 7)
- ❌ **CDN Upload**: Using local public folder (can add Vercel/Cloudflare later)

---

## Lessons Learned

### What Worked
- **Local Generation**: M4 Max GPU fast enough for production use
- **Prompt Iteration**: 3 commits in 4 hours refined quality significantly
- **MPS Fix**: Switching to float32 resolved Apple Silicon black image bug

### What Didn't Work
- **White Background**: Too sterile for home cooking platform
- **Generic Prompts**: Needed ingredient-specific customization (e.g., watermelon)

### Process Improvements
- **Decision Framework**: "Launch-critical vs nice-to-have" lens prevented scope creep
- **Visual Direction Lock**: Committing to kitchen counter style enables future batch work
- **Documentation**: Recording decisions prevents re-litigating choices later

---

## Commitments

### Phase 6 (Current - Launch Week)
- ✅ Finalize visual direction (kitchen counter setting)
- ✅ Commit prompt engineering work
- ✅ Document decision rationale
- ✅ Focus on launch logistics

### Phase 7 (Post-Launch - November 2025)
- ⏳ Build database integration script
- ⏳ Batch generate top 100 ingredients
- ⏳ Review quality and iterate
- ⏳ Deploy images to production
- ⏳ Monitor user engagement metrics

---

## Sign-Off

**Decision Approved**: Masa Matsuoka
**Date**: October 21, 2025
**Next Review**: Phase 7 kickoff (post October 27 launch)

**Status**: ✅ DECISION FINAL - Image generation deferred to Phase 7, kitchen counter style locked in
