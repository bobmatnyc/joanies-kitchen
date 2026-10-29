"""#96 D57: reference vectors from the Python model the stored rows came from.

Mirrors test/scripts/generate_embeddings_local.py: SentenceTransformer(
"BAAI/bge-small-en-v1.5"), encode(normalize_embeddings=True), no prefix.
"""
import json
import sys

import sentence_transformers
import torch
import transformers
from sentence_transformers import SentenceTransformer

MODEL = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

long_ingredients = ", ".join(
    f"{i} cups ingredient number {i} finely chopped with extra virgin olive oil" for i in range(1, 80)
)
passages = [
    "Spaghetti Carbonara. Classic Roman pasta with eggs, pecorino and guanciale. Cuisine: Italian. "
    "Tags: pasta, quick, dinner. Ingredients: 400g spaghetti, 150g guanciale, 4 egg yolks, "
    "50g pecorino romano, black pepper. Difficulty: medium",
    "Chicken Tikka Masala. Cuisine: Indian. Tags: curry, spicy. Ingredients: chicken thighs, "
    "yogurt, garam masala, tomato puree, cream, ginger, garlic",
    "Vegan chocolate avocado mousse",
    "Banana Bread. Moist loaf using overripe bananas. Difficulty: easy",
    "Kitchen Sink Stew. Ingredients: " + long_ingredients,
]
queries = ["quick weeknight pasta with eggs"]

model = SentenceTransformer(MODEL)
p = model.encode(passages, normalize_embeddings=True, convert_to_numpy=True)
q = model.encode([QUERY_PREFIX + t for t in queries], normalize_embeddings=True, convert_to_numpy=True)

out = {
    "model": MODEL,
    "generator": "sentence-transformers encode(normalize_embeddings=True), no prefix for passages",
    "versions": {
        "sentence_transformers": sentence_transformers.__version__,
        "transformers": transformers.__version__,
        "torch": torch.__version__,
        "python": sys.version.split()[0],
    },
    "max_seq_length": model.max_seq_length,
    "queryPrefix": QUERY_PREFIX,
    "passages": [{"text": t, "embedding": [round(float(x), 7) for x in v]} for t, v in zip(passages, p)],
    "queries": [{"query": t, "embedding": [round(float(x), 7) for x in v]} for t, v in zip(queries, q)],
}
with open(sys.argv[1], "w") as f:
    json.dump(out, f, indent=1)
print("wrote", sys.argv[1], len(passages), "passages", len(queries), "queries", "dim", p.shape[1])
