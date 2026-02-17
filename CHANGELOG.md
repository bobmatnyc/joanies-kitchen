# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.10] - 2026-02-17

### Added

- add Tavily integration and comprehensive documentation cleanup


## [0.7.9] - 2025-11-13

### Added

- implement complete tool functionality with images and detail views
- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct spice category from 'oz' to 'spice' for proper handling
- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.8] - 2025-11-06

### Added

- implement complete tool functionality with images and detail views
- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.7] - 2025-11-05

### Added

- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.4] - 2025-10-27

### Added

- enhance recipe extraction with local AI and image domain support


## [0.6.0] - 2025-10-19

### Added

- documentation consolidation and meal pairing system foundations
- v0.5.3 - Tag System v2, Admin Editing UI, and Meal Builder

### Fixed

- add meal pairing metadata fields to recipe-crawl embedding generation


## [0.4.1] - 2025-10-16

### Added

- add duplicate detection and database deduplication
- version 0.4.0 - scale, performance, and complete rebrand
- major UX and performance improvements for Joanie's Kitchen
- Implement dual-environment Clerk authentication setup
- Add user profile management and export functionality
- Add comprehensive environment configuration setup
- Add comprehensive image support for recipes
- Add tag-based filtering, UUID migration, shared recipes, and import/export
- Add Google OAuth setup scripts and documentation
- Add Clerk authentication with Google One Touch Sign-In
- Complete Recipe Manager application with AI-powered features

### Fixed

- resolve Select.Item empty value errors and improve filters
- remove onDelete prop from RecipeCard in RecipeList
- remove onDelete prop from RecipeCard in RecipeInfiniteList
- resolve nested anchor tag hydration error in RecipeCard
- Fix ClerkProvider initialization and build errors
- Correct onChange callback to pass value directly instead of updater function
- Add type annotation for onChange callback in ImageUploader
- Update to Next.js 15 searchParams Promise syntax
- Add missing @radix-ui/react-popover and fix auth bypass for recipe pages

### Changed

- simplify top rated badge to star icon only


## [0.4.0] - 2025-10-15

### Added
- Serious Eats recipe scraper (Top 50 pilot)
- Python recipe-scrapers integration
- Duplicate detection and database deduplication system
- Build tracking system with versioning
- Comprehensive version management script

### Changed
- Complete rebrand to "Joanie's Kitchen"
- Updated about page messaging and brand identity
- Improved SEO roadmap and metadata
- Major UX and performance improvements
- Enhanced recipe discovery and filtering

### Fixed
- JSON parse error for 44 recipes (PostgreSQL set notation)
- Image generation script (added JSON.stringify)
- Select.Item empty value errors in filters
- Nested anchor tag hydration error in RecipeCard
- OnDelete prop removal from RecipeCard components

## [0.3.0] - 2025-10-10

### Added
- Dual-environment Clerk authentication setup
- Development and production auth on localhost
- ClerkProvider initialization improvements

### Fixed
- ClerkProvider initialization errors
- Build errors related to authentication
- Authentication configuration issues

## [0.2.0] - 2025-10-01

### Added
- Initial recipe management system
- AI-powered recipe generation
- Meal planning features
- Shopping list generation

### Changed
- Improved database schema
- Enhanced UI components
- Better error handling

## [0.1.0] - 2025-09-15

### Added
- Initial project setup
- Next.js 15 with TypeScript
- Clerk authentication
- Neon PostgreSQL database
- Basic recipe CRUD operations
