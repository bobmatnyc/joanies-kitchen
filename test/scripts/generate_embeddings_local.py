#!/usr/bin/env python3
"""
Local Embedding Generation for Joanie's Kitchen
================================================

Uses BAAI/bge-small-en-v1.5 via sentence-transformers for offline embedding generation.
This script pre-calculates embeddings for all recipes to avoid HuggingFace API availability issues.

Model: BAAI/bge-small-en-v1.5 (exact parity with production HuggingFace API)
Dimensions: 384 (matches database schema)
Target: 4,644 recipes
Estimated Time: 8-10 hours for full batch

Usage:
    # Dry run (preview only)
    python scripts/generate_embeddings_local.py --dry-run

    # Test on 10 recipes
    python scripts/generate_embeddings_local.py --limit=10

    # Full execution
    python scripts/generate_embeddings_local.py --execute

    # Resume from checkpoint
    python scripts/generate_embeddings_local.py --execute --resume
"""

import os
import sys
import json
import argparse
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

try:
    from sentence_transformers import SentenceTransformer
    import psycopg2
    from psycopg2.extras import execute_values, RealDictCursor
    from dotenv import load_dotenv
    from tqdm import tqdm
    import numpy as np
except ImportError as e:
    print(f"❌ ERROR: Missing required dependency: {e}")
    print("\nInstall dependencies with:")
    print(
        "  pip install sentence-transformers psycopg2-binary python-dotenv tqdm numpy"
    )
    sys.exit(1)

# ====================
# CONSTANTS
# ====================

MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIMENSION = 384
DEFAULT_BATCH_SIZE = 100
CHECKPOINT_FILE = "tmp/embedding-generation-checkpoint.json"
ERROR_LOG = "tmp/embedding-generation-errors.log"
REPORT_FILE = "tmp/embedding-generation-report.json"

# ====================
# LOGGING SETUP
# ====================

# Ensure tmp/ directory exists
Path("tmp").mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(ERROR_LOG), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# ====================
# EMBEDDING GENERATOR CLASS
# ====================


class EmbeddingGenerator:
    """Generates recipe embeddings using local sentence-transformers model"""

    def __init__(self, database_url: str, batch_size: int = DEFAULT_BATCH_SIZE):
        self.database_url = database_url
        self.batch_size = batch_size
        self.model: Optional[SentenceTransformer] = None
        self.conn = None

        # Statistics
        self.stats = {
            "total_recipes": 0,
            "already_embedded": 0,
            "to_process": 0,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "start_time": None,
            "end_time": None,
        }

    def load_model(self) -> None:
        """Load sentence-transformers model"""
        logger.info(f"📦 Loading model: {MODEL_NAME}")
        logger.info(
            "   This may take a few minutes on first run (downloading ~133MB model)..."
        )

        try:
            self.model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Model loaded successfully")
            logger.info(f"   Embedding dimension: {EMBEDDING_DIMENSION}")
            logger.info(f"   Max sequence length: {self.model.max_seq_length}")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise

    def connect_db(self) -> None:
        """Connect to PostgreSQL database"""
        logger.info("🔌 Connecting to database...")

        try:
            self.conn = psycopg2.connect(self.database_url)
            logger.info("✅ Database connected")

            # Test pgvector extension
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector')"
                )
                has_vector = cur.fetchone()[0]
                if not has_vector:
                    logger.warning(
                        "⚠️  pgvector extension not found - vector operations may fail"
                    )
                else:
                    logger.info("   pgvector extension: ✓")
        except Exception as e:
            logger.error(f"❌ Failed to connect to database: {e}")
            raise

    def build_recipe_embedding_text(self, recipe: Dict[str, Any]) -> str:
        """
        Build embedding text from recipe (matches TypeScript implementation)

        This function replicates the exact logic from:
        src/lib/ai/embeddings.ts :: buildRecipeEmbeddingText()

        Args:
            recipe: Dictionary with recipe fields

        Returns:
            Combined text string for embedding
        """
        parts = []

        # Add name (most important)
        if recipe.get("name"):
            parts.append(recipe["name"])

        # Add description
        if recipe.get("description"):
            parts.append(recipe["description"])

        # Add cuisine
        if recipe.get("cuisine"):
            parts.append(f"Cuisine: {recipe['cuisine']}")

        # Add tags (parse JSON)
        if recipe.get("tags"):
            try:
                tags = (
                    json.loads(recipe["tags"])
                    if isinstance(recipe["tags"], str)
                    else recipe["tags"]
                )
                if tags and len(tags) > 0:
                    parts.append(f"Tags: {', '.join(tags)}")
            except (json.JSONDecodeError, TypeError):
                logger.debug(f"Failed to parse tags for recipe {recipe.get('id')}")

        # Add ingredients (parse JSON)
        if recipe.get("ingredients"):
            try:
                ingredients = (
                    json.loads(recipe["ingredients"])
                    if isinstance(recipe["ingredients"], str)
                    else recipe["ingredients"]
                )
                if ingredients and len(ingredients) > 0:
                    parts.append(f"Ingredients: {', '.join(ingredients)}")
            except (json.JSONDecodeError, TypeError):
                logger.debug(
                    f"Failed to parse ingredients for recipe {recipe.get('id')}"
                )

        # Add difficulty
        if recipe.get("difficulty"):
            parts.append(f"Difficulty: {recipe['difficulty']}")

        # Join all parts with '. ' separator
        return ". ".join(filter(None, parts)).strip()

    def fetch_recipes_needing_embeddings(
        self, limit: Optional[int] = None, resume_from: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch recipes that don't have embeddings yet

        Args:
            limit: Maximum number of recipes to fetch
            resume_from: Recipe ID to resume from (for checkpoint recovery)

        Returns:
            List of recipe dictionaries
        """
        logger.info("🔍 Querying recipes needing embeddings...")

        query = """
        SELECT
            r.id,
            r.name,
            r.description,
            r.cuisine,
            r.tags,
            r.ingredients,
            r.difficulty
        FROM recipes r
        LEFT JOIN recipe_embeddings e ON r.id = e.recipe_id
        WHERE e.id IS NULL
        """

        # Add resume condition
        if resume_from:
            query += f" AND r.id > '{resume_from}'"

        # Add ordering for consistent processing
        query += " ORDER BY r.id ASC"

        # Add limit
        if limit:
            query += f" LIMIT {limit}"

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query)
                recipes = cur.fetchall()

                # Convert to list of dicts
                recipes_list = [dict(recipe) for recipe in recipes]

                logger.info(f"   Found {len(recipes_list)} recipes needing embeddings")
                return recipes_list
        except Exception as e:
            logger.error(f"❌ Failed to fetch recipes: {e}")
            raise

    def get_embedding_stats(self) -> Tuple[int, int]:
        """
        Get statistics on recipe embeddings

        Returns:
            Tuple of (total_recipes, embedded_recipes)
        """
        try:
            with self.conn.cursor() as cur:
                # Total recipes
                cur.execute("SELECT COUNT(*) FROM recipes")
                total = cur.fetchone()[0]

                # Already embedded
                cur.execute("SELECT COUNT(*) FROM recipe_embeddings")
                embedded = cur.fetchone()[0]

                return total, embedded
        except Exception as e:
            logger.error(f"Failed to get embedding stats: {e}")
            return 0, 0

    def generate_embeddings_batch(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for batch of texts

        Args:
            texts: List of text strings to embed

        Returns:
            NumPy array of embeddings (batch_size x 384)
        """
        if not self.model:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        # Generate embeddings with normalization (important for cosine similarity)
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,  # Critical for cosine similarity matching
            convert_to_numpy=True,
        )

        # Validate dimensions
        if embeddings.shape[1] != EMBEDDING_DIMENSION:
            raise ValueError(
                f"Embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, "
                f"got {embeddings.shape[1]}"
            )

        return embeddings

    def save_embeddings(
        self, recipe_ids: List[str], embeddings: np.ndarray, texts: List[str]
    ) -> int:
        """
        Save embeddings to database

        Args:
            recipe_ids: List of recipe IDs
            embeddings: NumPy array of embeddings
            texts: List of embedding texts

        Returns:
            Number of embeddings saved
        """
        if len(recipe_ids) != len(embeddings) != len(texts):
            raise ValueError(
                "Mismatched lengths: recipe_ids, embeddings, and texts must be same length"
            )

        # Prepare data for batch insert
        now = datetime.now()
        data = []

        for recipe_id, embedding, text in zip(recipe_ids, embeddings, texts):
            # Convert embedding to pgvector format: "[0.1,0.2,0.3]"
            embedding_str = "[" + ",".join(map(str, embedding.tolist())) + "]"

            data.append((recipe_id, embedding_str, text, MODEL_NAME, now, now))

        # Batch insert with ON CONFLICT handling
        # Note: Requires UNIQUE constraint on recipe_id
        insert_query = """
        INSERT INTO recipe_embeddings
            (recipe_id, embedding, embedding_text, model_name, created_at, updated_at)
        VALUES %s
        ON CONFLICT (recipe_id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            embedding_text = EXCLUDED.embedding_text,
            model_name = EXCLUDED.model_name,
            updated_at = EXCLUDED.updated_at
        """

        try:
            with self.conn.cursor() as cur:
                execute_values(cur, insert_query, data)
                self.conn.commit()
                return len(data)
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Failed to save embeddings batch: {e}")
            raise

    def save_checkpoint(self, last_recipe_id: str, processed: int) -> None:
        """Save checkpoint for resume capability"""
        checkpoint = {
            "last_recipe_id": last_recipe_id,
            "processed": processed,
            "timestamp": datetime.now().isoformat(),
        }

        try:
            with open(CHECKPOINT_FILE, "w") as f:
                json.dump(checkpoint, f, indent=2)
            logger.debug(f"Checkpoint saved: {last_recipe_id} ({processed} processed)")
        except Exception as e:
            logger.warning(f"Failed to save checkpoint: {e}")

    def load_checkpoint(self) -> Optional[Dict[str, Any]]:
        """Load checkpoint if it exists"""
        if not os.path.exists(CHECKPOINT_FILE):
            return None

        try:
            with open(CHECKPOINT_FILE, "r") as f:
                checkpoint = json.load(f)
            logger.info(
                f"📂 Loaded checkpoint: {checkpoint['processed']} recipes processed"
            )
            return checkpoint
        except Exception as e:
            logger.warning(f"Failed to load checkpoint: {e}")
            return None

    def save_report(self) -> None:
        """Save final execution report"""
        report = {
            **self.stats,
            "model_name": MODEL_NAME,
            "embedding_dimension": EMBEDDING_DIMENSION,
            "batch_size": self.batch_size,
        }

        # Calculate performance metrics
        if self.stats["start_time"] and self.stats["end_time"]:
            duration = (
                self.stats["end_time"] - self.stats["start_time"]
            ).total_seconds()
            report["duration_seconds"] = duration
            report["duration_formatted"] = str(
                self.stats["end_time"] - self.stats["start_time"]
            )

            if self.stats["successful"] > 0 and duration > 0:
                report["recipes_per_minute"] = round(
                    self.stats["successful"] / (duration / 60), 2
                )

        # Save to JSON
        try:
            with open(REPORT_FILE, "w") as f:
                json.dump(report, f, indent=2, default=str)
            logger.info(f"📄 Report saved to: {REPORT_FILE}")
        except Exception as e:
            logger.warning(f"Failed to save report: {e}")

    def run(
        self, dry_run: bool = True, limit: Optional[int] = None, resume: bool = False
    ) -> None:
        """
        Main execution function

        Args:
            dry_run: If True, preview only (no database changes)
            limit: Limit number of recipes to process
            resume: Resume from checkpoint if available
        """
        self.stats["start_time"] = datetime.now()

        try:
            # Load model
            self.load_model()

            # Connect to database
            self.connect_db()

            # Get embedding statistics
            total_recipes, already_embedded = self.get_embedding_stats()
            self.stats["total_recipes"] = total_recipes
            self.stats["already_embedded"] = already_embedded

            logger.info("\n" + "=" * 60)
            logger.info("📊 EMBEDDING GENERATION STATISTICS")
            logger.info("=" * 60)
            logger.info(f"Total recipes in database: {total_recipes:,}")
            logger.info(f"Already embedded: {already_embedded:,}")
            logger.info(f"Remaining to embed: {total_recipes - already_embedded:,}")

            if dry_run:
                logger.info("\n⚠️  DRY RUN MODE - No database changes will be made")

            if limit:
                logger.info(f"Limit: {limit} recipes")

            logger.info("=" * 60 + "\n")

            # Load checkpoint if resuming
            resume_from_id = None
            if resume:
                checkpoint = self.load_checkpoint()
                if checkpoint:
                    resume_from_id = checkpoint["last_recipe_id"]
                    logger.info(f"🔄 Resuming from recipe ID: {resume_from_id}")

            # Fetch recipes needing embeddings
            recipes = self.fetch_recipes_needing_embeddings(
                limit=limit, resume_from=resume_from_id
            )

            if not recipes:
                logger.info("✅ All recipes already have embeddings!")
                return

            self.stats["to_process"] = len(recipes)

            # Process in batches with progress bar
            logger.info(
                f"\n🚀 Processing {len(recipes)} recipes in batches of {self.batch_size}...\n"
            )

            failed_recipes = []

            with tqdm(
                total=len(recipes), desc="Generating embeddings", unit="recipe"
            ) as pbar:
                for i in range(0, len(recipes), self.batch_size):
                    batch = recipes[i : i + self.batch_size]
                    batch_ids = [r["id"] for r in batch]

                    try:
                        # Build embedding texts
                        texts = [self.build_recipe_embedding_text(r) for r in batch]

                        # Validate texts
                        if any(not text.strip() for text in texts):
                            logger.warning(
                                f"Batch contains empty text - skipping {len([t for t in texts if not t.strip()])} recipes"
                            )
                            failed_recipes.extend(
                                [
                                    (batch[idx]["id"], "Empty embedding text")
                                    for idx, text in enumerate(texts)
                                    if not text.strip()
                                ]
                            )
                            # Filter out empty texts
                            valid_indices = [
                                idx for idx, text in enumerate(texts) if text.strip()
                            ]
                            batch = [batch[idx] for idx in valid_indices]
                            batch_ids = [batch_ids[idx] for idx in valid_indices]
                            texts = [texts[idx] for idx in valid_indices]

                            if not texts:
                                pbar.update(len(batch))
                                continue

                        # Generate embeddings
                        embeddings = self.generate_embeddings_batch(texts)

                        # Save to database (unless dry run)
                        if not dry_run:
                            saved = self.save_embeddings(batch_ids, embeddings, texts)
                            self.stats["successful"] += saved

                            # Save checkpoint every 10 batches
                            if (i // self.batch_size) % 10 == 0:
                                self.save_checkpoint(
                                    batch_ids[-1], self.stats["successful"]
                                )
                        else:
                            self.stats["successful"] += len(batch_ids)

                        self.stats["processed"] += len(batch)
                        pbar.update(len(batch))

                    except Exception as e:
                        logger.error(f"❌ Batch processing error: {e}")
                        self.stats["failed"] += len(batch)
                        failed_recipes.extend(
                            [(recipe_id, str(e)) for recipe_id in batch_ids]
                        )
                        pbar.update(len(batch))

            # Log failed recipes
            if failed_recipes:
                logger.warning(f"\n⚠️  {len(failed_recipes)} recipes failed:")
                with open(ERROR_LOG, "a") as f:
                    f.write(f"\n\n{'='*60}\n")
                    f.write(f"Failed recipes ({datetime.now()}):\n")
                    f.write(f"{'='*60}\n")
                    for recipe_id, error in failed_recipes:
                        f.write(f"{recipe_id}: {error}\n")
                        logger.warning(f"  - {recipe_id}: {error}")

            # Final statistics
            self.stats["end_time"] = datetime.now()
            duration = self.stats["end_time"] - self.stats["start_time"]

            logger.info("\n" + "=" * 60)
            logger.info("✅ EMBEDDING GENERATION COMPLETE")
            logger.info("=" * 60)
            logger.info(f"Recipes processed: {self.stats['processed']:,}")
            logger.info(f"Successful: {self.stats['successful']:,}")
            logger.info(f"Failed: {self.stats['failed']:,}")
            logger.info(f"Duration: {duration}")

            if self.stats["successful"] > 0 and duration.total_seconds() > 0:
                recipes_per_min = self.stats["successful"] / (
                    duration.total_seconds() / 60
                )
                logger.info(f"Performance: {recipes_per_min:.2f} recipes/minute")

            if dry_run:
                logger.info("\n⚠️  DRY RUN - No changes were made to database")

            logger.info("=" * 60 + "\n")

            # Save report
            self.save_report()

        except KeyboardInterrupt:
            logger.warning("\n\n⚠️  Interrupted by user")
            self.stats["end_time"] = datetime.now()
            self.save_report()
            if self.stats["successful"] > 0:
                logger.info(
                    f"Partial progress saved: {self.stats['successful']} embeddings"
                )
                logger.info("Resume with: --execute --resume")

        except Exception as e:
            logger.error(f"\n❌ Fatal error: {e}", exc_info=True)
            self.stats["end_time"] = datetime.now()
            self.save_report()
            raise

        finally:
            # Cleanup
            if self.conn:
                self.conn.close()
                logger.info("Database connection closed")


# ====================
# MAIN ENTRY POINT
# ====================


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Generate recipe embeddings locally using BAAI/bge-small-en-v1.5",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview only)
  python scripts/generate_embeddings_local.py --dry-run

  # Test on 10 recipes
  python scripts/generate_embeddings_local.py --limit=10

  # Full execution
  python scripts/generate_embeddings_local.py --execute

  # Resume from checkpoint
  python scripts/generate_embeddings_local.py --execute --resume
        """,
    )

    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute embedding generation (default is dry-run)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview mode - no database changes (default)",
    )
    parser.add_argument("--limit", type=int, help="Limit number of recipes to process")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Batch size for processing (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--resume", action="store_true", help="Resume from last checkpoint"
    )

    args = parser.parse_args()

    # Default to dry-run unless --execute is specified
    dry_run = not args.execute

    # Load environment variables
    load_dotenv(".env.local")
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        logger.error("❌ ERROR: DATABASE_URL not found in .env.local")
        logger.error("   Please ensure DATABASE_URL is set in your .env.local file")
        return 1

    logger.info("=" * 60)
    logger.info("🍳 Joanie's Kitchen - Local Embedding Generation")
    logger.info("=" * 60)
    logger.info(f"Model: {MODEL_NAME}")
    logger.info(f"Embedding dimension: {EMBEDDING_DIMENSION}")
    logger.info(f"Batch size: {args.batch_size}")
    logger.info("=" * 60 + "\n")

    # Run generator
    generator = EmbeddingGenerator(database_url, args.batch_size)
    generator.run(dry_run=dry_run, limit=args.limit, resume=args.resume)

    return 0


if __name__ == "__main__":
    sys.exit(main())
