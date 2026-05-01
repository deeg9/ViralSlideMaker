# Explore + Remix: Architecture Research

**Date:** 2026-04-27
**Mode:** new-milestone (single focused researcher)
**Status:** Decisions LOCKED upstream — opt-in publish, hard-fork remix, recency + trending + tag/search discovery, standalone bookmarks page.
**Goal:** Recommend ONE concrete architecture per section. Cite sources. Keep it actionable.

Codebase context:
- Next.js 15 App Router, Supabase Postgres, RLS-enabled `public.projects` (private), `public.profiles` (public, just shipped 2026-04-27, ON CONFLICT-safe trigger, citext usernames, RLS public-read).
- `public.brand_kits` is one-row-per-user, currently used as a fully-described template.
- Slides live as `slide_data jsonb` directly inside `projects` — there is no separate `slides` table. The fork operation is therefore one Postgres row copy plus referenced asset handling.

---

## 0. TL;DR — Concrete Recommendation

| Layer | Pick | Why |
|---|---|---|
| Sharing model | `is_public` boolean on `public.projects` + new `public.published_carousels` row | Single source of truth; publish is a separate row so publish data (tags, view_count, slug, hero_image) doesn't bloat `projects`. |
| Remix model | HARD FORK via `fork_published_carousel(p_id)` SECURITY DEFINER RPC | Locked upstream. Single SQL function is auditable, atomic, and bypasses RLS for the deep-copy in one place. |
| Recency feed | `ORDER BY published_at DESC` on `published_carousels` with a covering index | Free; trivially correct. |
| Trending feed | `popularity_score numeric` column refreshed every 10 min via `pg_cron` running an UPDATE (no materialized view needed) | Easier than materialized views, pg_cron is GA on Supabase, and 10-minute lag is fine for a small platform. |
| Search | `tsvector` generated column + GIN index, `websearch_to_tsquery()` | Right-sized for "few thousand carousels"; do NOT reach for Typesense/Meili at this scale. |
| Tag taxonomy | Open vocabulary, normalized on the way in (lower, trim, dedupe) — store as `text[]` with a GIN index. Surface a curated 12-tag pillset in UI for cold start. | Matches every comparable platform (CodePen, Figma, v0). Pre-curated list = guardrail without locking the future. |
| Counters (`view_count`, `remix_count`, `bookmark_count`) | Async event-table pattern (`carousel_events`) flushed nightly by `pg_cron` to update denormalized counts. `bookmark_count` and `remix_count` use direct triggers (low frequency); `view_count` uses event table (high frequency). | Eliminates lock contention at launch; matches Timanovsky's pattern. |
| Bookmarks | Standalone `public.bookmarks` table (user_id, published_carousel_id, created_at) with composite PK | Locked upstream. Standard pattern. |
| Phase shape | 5 phases: schema → publish flow → discover feed → search/tags → trending+counters | Each phase is independently shippable and revertible. |

---

## 1. v0.dev's actual fork mechanics

**Source 1: Vercel's official Fork Chat API reference** ([v0.app/docs/api/platform/reference/chats/fork](https://v0.app/docs/api/platform/reference/chats/fork))

The official endpoint is `POST /chats/{chatId}/fork`. Body parameters:
- `versionId` (optional) — fork from a specific snapshot, defaults to latest.
- `privacy` (optional) — `'public' | 'private' | 'team' | 'team-edit' | 'unlisted'`.

What gets copied: messages, file contents/metadata, model configuration, the original prompt.

**Critical finding — no lineage tracking in the API response.** Quoting WebFetch of the Vercel docs:
> "The API documentation does not mention lineage or relationship tracking. The response includes no fields indicating the fork's parent chat, source version ID, or any hierarchical relationship. The forked chat appears as a standalone entity with its own ID, timestamps, and author attribution."

This validates the "hard fork" model — Vercel's own API explicitly does NOT carry `parent_chat_id` in the response payload.

**Source 2: The URL pattern** ([v0.dev/chat/fork-of-chat-app-ORI6x3KOEaZ](https://v0.dev/chat/fork-of-chat-app-ORI6x3KOEaZ), confirmed across multiple example URLs)

URL shape: `v0.dev/chat/fork-of-{kebab-case-original-name}-{nanoid-style-slug}`
- ~15-20 char base64-ish slug at the end
- The "fork-of-" prefix is purely cosmetic — there's no actual server-side join via the URL

**Source 3: Community discussion** ([Improve v0 quality with strategic forking](https://community.vercel.com/t/improve-v0-quality-with-strategic-forking/16487))

Forks are described as creating a **"new snapshot"** independent of the source. The community uses forking explicitly to *avoid* polluting the original — confirms hard-fork semantics.

**Caveat from community** ([Changes in the fork project affect the main project](https://community.vercel.com/t/changes-in-the-fork-project-affect-the-main-project-envoriments/20470)): some users report environment variables / project linkage leaking between fork and original. **This is the v0-specific bug we want to avoid** — when we fork, the new project must have ZERO foreign keys to the parent's `brand_kit_id`, asset URLs in the source's storage path, etc. (See pitfall §7.5.)

**Implications for us:**
- The "hard fork, no lineage" decision is exactly what v0 actually ships. Good.
- URL: copy v0's pattern: `/c/{slug}-{shortid}` for published, or just `/c/{shortid}` is fine. Putting the title in the slug is SEO-positive and identical to v0/CodePen.

---

## 2. Comparable creator-template platforms in 2026

| Platform | Publish model | Remix model | URL shape | DB-ish concept |
|---|---|---|---|---|
| **v0.dev** | Privacy enum on the chat itself (`public/private/team/unlisted`) | Hard fork via API; no lineage in response | `/chat/fork-of-{name}-{shortid}` | One table (`chats`), `is_public` flag |
| **CodePen** | Pen-level public/private | Hard fork; **does** keep one-level parent link in description | `/{username}/pen/{slug}` | `pens` table with optional `forked_from_id` |
| **Figma Community** | Separate "publish to community" action that creates a Community Page entity | Hard duplicate to drafts ("Open in Figma" → copy to your drafts; new file, no comments/version history carried) | `/community/file/{id}` and `/file/{id}` | Two-table: `files` + `community_publications` |
| **Replit** | Project-level public flag | Hard fork with own URL ("each fork comes with its own unique URL") | `/{username}/{slug}` | `repls` table with `parent_id` for git-backed history |
| **Notion templates** | Duplicate to workspace; can include or exclude content | Hard duplicate (template stamp) | Page URL with workspace prefix | `pages` table, structural copy |
| **Hugging Face Spaces** | Repo-level public | `duplicate_repo()` API; secrets explicitly NOT carried; public env vars carried | `/spaces/{user}/{name}` | Git-backed; `spaces` registry table |

**Key pattern across all of them:**
1. **URL shape** — every comparable platform uses `/{username}/{slug}` OR `/{namespace}/{shortid}`. Username is *load-bearing* for SEO and creator branding.
2. **Schema shape** — Figma's two-table pattern (file + publication) is the most relevant for us, because publishing carries metadata (tags, hero image, description) that doesn't belong on the private project.
3. **What's NOT carried on duplicate** — secrets/env vars (HF Spaces), comments/version history (Figma), past chat after the fork point (v0). **For us: brand_kit foreign key and any private asset URLs.**

**Sources:**
- v0: [Fork Chat API](https://v0.app/docs/api/platform/reference/chats/fork) · [Featured Gallery](https://v0.app/t/3uvdq4RfcJc) · [Community discussion](https://community.vercel.com/t/improve-v0-quality-with-strategic-forking/16487)
- CodePen: [Forks documentation](https://blog.codepen.io/documentation/forks/) · [Forking docs](https://blog.codepen.io/docs/pens/forking/) · [URL/slug Hashids post](https://blog.codepen.io/2014/11/14/hash-ids-ls/)
- Figma: [Duplicate Community files](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files) · [Duplicate or copy files](https://help.figma.com/hc/en-us/articles/360038511533-Duplicate-or-copy-files)
- Replit: [Replit Projects](https://blog.replit.com/introducing-replit-projects) · [Forking Q&A](https://ask.replit.com/t/help-with-how-forking-works/14364/)
- HuggingFace: [Manage your Space](https://huggingface.co/docs/huggingface_hub/en/guides/manage-spaces) · [Spaces Overview](https://huggingface.co/docs/hub/spaces-overview)
- Notion: [Database templates](https://www.notion.com/help/database-templates)

**Recommendation:** **Figma's two-table pattern.**
- `public.projects` stays the private workspace source-of-truth (slide_data, brand_kit_id, drafts).
- New `public.published_carousels` row is created on Publish — carries denormalized slide_data snapshot, hero_image_url, tags, description, view_count, remix_count, bookmark_count, popularity_score.
- URL: `/c/{slug}` where slug is `{kebab-title}-{nanoid(8)}` (CodePen + v0 style). User profile pages stay at `/{username}` so there's no collision (see pitfall §7.4).

---

## 3. Engagement-ranked trending feeds in 2026

**Recommendation: Hacker News gravity formula, computed in Postgres, persisted on `published_carousels.popularity_score`, refreshed every 10 minutes via `pg_cron`.**

### Why HN gravity over Reddit hot:

- **Reddit hot** ([Reddit's empire no longer founded on a flawed algorithm](https://www.outofscope.com/reddits-empire-no-longer-founded-on-a-flawed-algorithm/)): `sign(s) * log10(max(abs(s),1)) + (date - 1134028003) / 45000`. The original implementation had a known bug; the formula assumes downvotes (we don't have them yet). Logarithmic vote scaling is overkill at our scale where median post will have 0-50 engagements.
- **HN gravity** ([Righto.com — How HN ranking really works](http://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html), [Amir Salihefendic — How HN ranking algorithm works](https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d)): `(P - 1) / (T + 2)^G` where P = points, T = age in hours, G = 1.8. Simple, well-understood, and our engagement signals (forks + bookmarks) are positive-only — perfect fit.

### Postgres SQL (drop-in):

```sql
-- Engagement weight: a remix is worth ~5 bookmarks is worth ~25 views
-- Tune these constants from analytics later.
UPDATE published_carousels SET popularity_score =
  (
    (remix_count * 5.0)
    + (bookmark_count * 1.0)
    + (view_count * 0.04)
  )
  / POWER(
      EXTRACT(EPOCH FROM (now() - published_at)) / 3600.0 + 2.0,
      1.8
    );

CREATE INDEX published_carousels_pop_idx
  ON published_carousels (popularity_score DESC NULLS LAST)
  WHERE is_public = true;
```

### Why a column, NOT a materialized view:

A materialized view (e.g., `trending_view`) requires `REFRESH MATERIALIZED VIEW CONCURRENTLY` and a unique index on the view. For a single ordered list of `(id, popularity_score)`, that's overkill — you can't easily JOIN it back into the main query, and concurrent refresh has its own write amplification issues. A scheduled UPDATE on a column is simpler, queryable directly, and JOIN-friendly.

[Optimize Read Performance in Supabase with Postgres Materialized Views](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5) supports the materialized view route, but explicitly notes: "Vanilla PostgreSQL does not allow partial refreshes on materialized views." For our trending feed where every row's score changes every minute (because of `T + 2` denominator), full refresh = recompute = same cost as updating a column.

### pg_cron schedule:

```sql
SELECT cron.schedule(
  'refresh-popularity',
  '*/10 * * * *',
  $$
    UPDATE published_carousels
       SET popularity_score = ...  -- formula above
     WHERE is_public = true
       AND published_at > now() - interval '14 days';  -- old posts settle
  $$
);
```

`pg_cron` is officially supported on Supabase ([Supabase pg_cron docs](https://supabase.com/docs/guides/database/extensions/pg_cron), [Supabase Cron blog](https://supabase.com/blog/supabase-cron)). Edge Functions are NOT needed for this — it runs in-database.

**Bound the working set** with `published_at > now() - interval '14 days'` so we only update recent rows. Older posts get `popularity_score` set once and stay there.

**Sources:**
- [How HN ranking really works](http://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html)
- [Amir Salihefendic — HN algorithm](https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d)
- [How are popular ranking algorithms working — Itchishiki Satoshi](https://medium.com/jp-tech/how-are-popular-ranking-algorithms-such-as-reddit-and-hacker-news-working-724e639ed9f7)
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Optimize Read Performance with Materialized Views](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)
- [decay — Famous sorting algorithms (clux)](https://github.com/clux/decay)

---

## 4. Postgres FTS for a creator platform in 2026

**Recommendation: Postgres `tsvector` generated column + GIN index + `websearch_to_tsquery()`. Do NOT reach for Typesense/Meili.**

### Sizing math

User's stated scale: "few thousand carousels with 5-15 slides each." Even at 10,000 carousels with 15 slides averaging 200 chars text = ~30 MB of searchable text. A GIN index over this fits comfortably in shared_buffers on every Supabase tier.

Empirical benchmark from [Speeding Up PostgreSQL Full-Text Search with Persistent TSVectors (danielabaron.me)](https://danielabaron.me/blog/speed-up-pg-fts-with-persistent-ts-vectors/): **"A GIN index can reduce query times from over 200ms to about 4ms"** — at exactly the dataset size we're targeting.

### When you'd actually need Typesense/Meili

Per [Postgres FTS as alternative to Elasticsearch (Miftahul Huda, Medium)](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0): Postgres FTS handles small-to-medium platforms cleanly. You move to a dedicated engine when you need:
- Typo tolerance / fuzzy matching at scale (Postgres has `pg_trgm` but it's slower than Meili's bk-tree)
- Aggregation/faceting at scale (Postgres can do this but query plans get hairy past ~100k rows with multi-facet)
- Sub-50ms p99 with complex multi-field rank tuning

We hit none of those at "few thousand."

### The exact Supabase pattern

Per [Supabase Full Text Search docs](https://supabase.com/docs/guides/database/full-text-search):

```sql
ALTER TABLE published_carousels
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', array_to_string(coalesce(tags, '{}'), ' ')), 'C') ||
  setweight(to_tsvector('english', coalesce(slide_text_concat, '')), 'D')
) STORED;

CREATE INDEX published_carousels_search_idx
  ON published_carousels USING GIN (search_vector);
```

Then in the API:

```sql
SELECT id, title, slug, hero_image_url, ts_rank(search_vector, q) AS rank
FROM published_carousels, websearch_to_tsquery('english', $1) q
WHERE search_vector @@ q AND is_public = true
ORDER BY rank DESC, popularity_score DESC NULLS LAST
LIMIT 24;
```

`slide_text_concat` is a denormalized concatenation of slide hook+body texts written at publish time (we already snapshot slide_data into the publish row, so building this is one `string_agg`).

`websearch_to_tsquery()` (NOT `plainto_tsquery`) supports natural-language operators like quoted phrases and minus-signs — what users actually type.

### When pg_trgm becomes worthwhile

Per [PostgreSQL pg_trgm docs](https://www.postgresql.org/docs/current/pgtrgm.html) and [When to use Full Text Search and Trigram Indexes (Medium)](https://medium.com/@sukorenomw/when-to-use-postgresql-full-text-search-and-trigram-indexes-4c7c36223421): trigram is for typo tolerance and middle-of-string matching. **Add it as a separate GIN index on `title` only, gated behind a "did you mean..." UI.** Don't replace the FTS index with it.

```sql
CREATE INDEX published_carousels_title_trgm_idx
  ON published_carousels USING GIN (title gin_trgm_ops);
```

**Sources:**
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [Speeding Up PostgreSQL FTS with Persistent TSVectors](https://danielabaron.me/blog/speed-up-pg-fts-with-persistent-ts-vectors/)
- [PostgreSQL FTS: Alternative to Elasticsearch](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0)
- [Create an advanced search engine with PostgreSQL — Tudor Golubenco / Xata](https://xata.io/blog/postgres-full-text-search-engine)
- [PostgreSQL Tables and Indexes for FTS](https://www.postgresql.org/docs/current/textsearch-tables.html)
- [pg_trgm docs](https://www.postgresql.org/docs/current/pgtrgm.html)
- [When to use FTS and Trigram Indexes](https://medium.com/@sukorenomw/when-to-use-postgresql-full-text-search-and-trigram-indexes-4c7c36223421)

---

## 5. Tag taxonomy patterns

**Recommendation: Open vocabulary, normalized aggressively at write time, surfaced through a curated 12-tag pillar set in the UI for cold-start.**

### What comparable platforms do

- **CodePen / v0 / Replit:** open vocabulary, free-form tags. CodePen explicitly preserves original tags on forks ([CodePen Forks docs](https://blog.codepen.io/documentation/forks/)).
- **Figma Community:** open vocabulary plus a fixed top-level "Category" enum (Design Systems, Templates, Plugins, etc.). The category is curated, the tags are free.
- **Canva:** essentially fully curated — they index everything by user-typed tags but the *discovery surface* is curated category navigation ([Canva: Add tags](https://www.canva.com/help/add-edit-tags/)). This is enabled by their massive editorial team; we don't have that.

### Why not pure curated:

We don't yet know what users will publish — locking the vocabulary at v1 means having to ship migrations every time a new content category emerges (memes, list-format, product-launch, etc.).

### Why not pure open:

Pure open vocabulary suffers consistency rot — `gym`, `fitness`, `Fitness`, `working-out` all coexist, none rank well. Every taxonomy guide agrees on this ([Picturepark — Best Practices for DAM Taxonomy](https://picturepark.com/content-management-blog/best-practices-for-dam-taxonomy-metadata-tags-and-controlled-vocabularies), [Actian — Metadata Tagging Best Practices](https://www.actian.com/metadata-tagging-best-practices/), [NN/g — Taxonomy 101](https://www.nngroup.com/articles/taxonomy-101/)).

### The hybrid:

Schema:

```sql
ALTER TABLE published_carousels ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX published_carousels_tags_gin ON published_carousels USING GIN (tags);
```

Server-side tag normalization function (run at publish):

```typescript
function normalizeTag(raw: string): string | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')   // anything weird → hyphen
    .replace(/-+/g, '-')             // collapse hyphens
    .replace(/^-|-$/g, '');          // trim hyphens
  if (t.length < 2 || t.length > 24) return null;
  return t;
}
// Per-carousel: max 6 tags, dedupe.
```

Curated pillar tags shown as buttons under the publish form's tag input (cold-start guidance):
`tutorial`, `motivation`, `business`, `tech`, `fitness`, `food`, `travel`, `lifestyle`, `productivity`, `marketing`, `finance`, `humor`.

These exist in the *UI* only — they're not enforced by the schema. Users can type anything, but we make these tags one-click to drive consistency on day 1.

### Tag landing pages

`/c/tag/{tag}` — a per-tag listing page. SEO juice. Postgres query:

```sql
SELECT * FROM published_carousels
WHERE is_public = true AND tags @> ARRAY[$1]
ORDER BY popularity_score DESC NULLS LAST
LIMIT 24 OFFSET $2;
```

The `@>` array contains operator uses the GIN index we already created. No tag table needed.

**Sources:**
- [CodePen Forks documentation](https://blog.codepen.io/documentation/forks/)
- [Figma Community files duplicate](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files)
- [Canva — Add edit tags](https://www.canva.com/help/add-edit-tags/)
- [Picturepark — Taxonomy best practices](https://picturepark.com/content-management-blog/best-practices-for-dam-taxonomy-metadata-tags-and-controlled-vocabularies)
- [Actian — Metadata tagging best practices](https://www.actian.com/metadata-tagging-best-practices/)
- [NN/g — Taxonomy 101](https://www.nngroup.com/articles/taxonomy-101/)
- [Stanford Sites — Taxonomy best practices](https://sitesuserguide.stanford.edu/build/taxonomy/taxonomy-best-practices)

---

## 6. Schema sketch — publish + remix + bookmark with RLS

```sql
-- ─────────────────────────────────────────────────────────────
-- 1. published_carousels — the public, immutable-ish snapshot
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.published_carousels (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Provenance: which private project this was published from.
  -- Owner can unpublish, edit, re-publish; on re-publish we UPDATE this row,
  -- not INSERT a new one (so URLs stay stable and counters survive).
  source_project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Public identity
  slug              text NOT NULL UNIQUE,         -- {kebab-title}-{nanoid(8)}
  title             text NOT NULL,
  description       text,
  hero_image_url    text,                         -- pre-rendered slide 1 PNG, public bucket
  tags              text[] NOT NULL DEFAULT '{}', -- normalized at write time, max 6

  -- The actual carousel content. SNAPSHOT, not reference. Hard fork friendly.
  slide_data        jsonb NOT NULL,               -- copied from projects.slide_data at publish
  template_id       text NOT NULL,                -- snapshotted, NOT a FK to brand_kits

  -- Engagement counters (denormalized; see §7.3 for write strategy)
  view_count        bigint NOT NULL DEFAULT 0,
  remix_count       integer NOT NULL DEFAULT 0,
  bookmark_count    integer NOT NULL DEFAULT 0,
  popularity_score  double precision,             -- nullable — refreshed by pg_cron

  -- Search
  search_vector     tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(tags, '{}'), ' ')), 'C')
  ) STORED,

  -- Moderation
  is_public         boolean NOT NULL DEFAULT true,  -- owner toggle (unpublish)
  is_flagged        boolean NOT NULL DEFAULT false, -- moderation queue
  takedown_at       timestamptz,                    -- admin action; null = active

  published_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX published_carousels_user_idx     ON published_carousels(user_id);
CREATE INDEX published_carousels_published_idx ON published_carousels(published_at DESC) WHERE is_public AND NOT is_flagged AND takedown_at IS NULL;
CREATE INDEX published_carousels_pop_idx       ON published_carousels(popularity_score DESC NULLS LAST) WHERE is_public AND NOT is_flagged AND takedown_at IS NULL;
CREATE INDEX published_carousels_search_idx    ON published_carousels USING GIN (search_vector);
CREATE INDEX published_carousels_tags_idx      ON published_carousels USING GIN (tags);

ALTER TABLE published_carousels ENABLE ROW LEVEL SECURITY;

-- Public can read non-flagged, non-taken-down, public rows
CREATE POLICY "Anyone reads live published carousels"
  ON published_carousels FOR SELECT
  USING (is_public = true AND is_flagged = false AND takedown_at IS NULL);

-- Owner can read their own (even unpublished/flagged) rows
CREATE POLICY "Owner reads own published carousels"
  ON published_carousels FOR SELECT
  USING (auth.uid() = user_id);

-- Owner can update their own rows (unpublish, edit metadata)
CREATE POLICY "Owner updates own published carousels"
  ON published_carousels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts go through publish_carousel() RPC only, no direct INSERT policy
-- (Inserting from client is blocked entirely — server action -> RPC.)

-- ─────────────────────────────────────────────────────────────
-- 2. bookmarks — per-user, owner-only
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.bookmarks (
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  published_carousel_id uuid NOT NULL REFERENCES public.published_carousels(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, published_carousel_id)
);
CREATE INDEX bookmarks_user_created_idx ON bookmarks(user_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own bookmarks"   ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner inserts own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- bookmark_count denormalization: trigger (low frequency, owner-action, no contention)
CREATE OR REPLACE FUNCTION bump_bookmark_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE published_carousels SET bookmark_count = bookmark_count + 1 WHERE id = NEW.published_carousel_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE published_carousels SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.published_carousel_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER bookmarks_count_trg
  AFTER INSERT OR DELETE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION bump_bookmark_count();

-- ─────────────────────────────────────────────────────────────
-- 3. carousel_events — async event-table for view_count (anti-contention)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.carousel_events (
  id                   bigserial PRIMARY KEY,
  published_carousel_id uuid NOT NULL,        -- intentionally NO FK — keep inserts cheap
  event_type           text NOT NULL,         -- 'view' (others later)
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- No index by id (PK already); add index by carousel_id only at flush time if needed.

ALTER TABLE carousel_events ENABLE ROW LEVEL SECURITY;
-- Anyone (including anon) can insert a view event:
CREATE POLICY "Anyone records view events" ON carousel_events FOR INSERT WITH CHECK (event_type = 'view');
-- Nobody reads from client; aggregation is server-side only.

-- pg_cron flush job (every 10 min): aggregate + delete events
SELECT cron.schedule('flush-view-events', '*/10 * * * *', $$
  WITH agg AS (
    DELETE FROM carousel_events
     WHERE event_type = 'view'
       AND id < (SELECT COALESCE(MIN(id), 0) FROM carousel_events) + 100000
    RETURNING published_carousel_id
  ),
  counts AS (
    SELECT published_carousel_id, COUNT(*)::bigint AS n
    FROM agg GROUP BY published_carousel_id
  )
  UPDATE published_carousels p
     SET view_count = view_count + c.n
    FROM counts c
   WHERE p.id = c.published_carousel_id;
$$);
```

### The fork RPC

```sql
CREATE OR REPLACE FUNCTION public.fork_published_carousel(p_carousel_id uuid)
RETURNS uuid                                      -- returns the new private project id
LANGUAGE plpgsql
SECURITY DEFINER                                   -- bypass RLS to read public + write user's project
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_src public.published_carousels%ROWTYPE;
  v_new_project_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_src
    FROM public.published_carousels
   WHERE id = p_carousel_id
     AND is_public = true
     AND is_flagged = false
     AND takedown_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'carousel not available';
  END IF;

  -- Create a new private project for the forker.
  -- IMPORTANT: do NOT copy brand_kit_id — that's a private FK to the original creator.
  -- Title is prefixed so the user knows it's a copy in their dashboard.
  INSERT INTO public.projects (user_id, title, slide_data, template_id, generation_status)
  VALUES (
    v_uid,
    'Remix of: ' || v_src.title,
    v_src.slide_data,           -- snapshot copy
    v_src.template_id,           -- string id, no FK
    'draft'
  )
  RETURNING id INTO v_new_project_id;

  -- Bump remix_count on the source
  UPDATE public.published_carousels
     SET remix_count = remix_count + 1
   WHERE id = p_carousel_id;

  RETURN v_new_project_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fork_published_carousel(uuid) TO authenticated;
```

### Why one RPC, not N inserts:

- **Atomic.** Either the project is created and the counter bumps, or neither happens.
- **RLS bypass for the read.** The SECURITY DEFINER pattern means we can read the `published_carousels` row even when bypassing RLS — and we re-validate the `is_public AND NOT is_flagged AND takedown_at IS NULL` check inside the function. The user can never accidentally fork a row they shouldn't see.
- **No `forked_from_id` written.** Hard fork. Locked upstream.
- **Server action wraps it.** The Next.js server action calls `supabase.rpc('fork_published_carousel', { p_carousel_id })` and redirects to `/projects/{returned_id}`.

### Counter strategy summary

| Counter | Frequency | Strategy | Why |
|---|---|---|---|
| `view_count` | Every page load (high) | Async event table flushed every 10 min | Lock-free insert beats UPDATE contention |
| `bookmark_count` | User toggle (low) | Direct trigger on bookmarks INSERT/DELETE | Simple, low contention, immediate UX feedback |
| `remix_count` | Fork action (low-med) | Direct UPDATE inside the fork RPC | Already in a transaction with the project insert |
| `popularity_score` | N/A — derived | pg_cron UPDATE every 10 min over recent rows | Decouples from request path |

The async-events approach is exactly the pattern from [Ultra fast asynchronous counters in Postgres (Timanovsky)](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3) — 24,000 TPS achieved using `DELETE ... RETURNING *` with PK range. The slotted counter pattern from [PlanetScale](https://planetscale.com/blog/the-slotted-counter-pattern) (100 slots × per-record) is the alternative; we don't need it because event-table is simpler in Postgres and the FK-free events table sidesteps the referential-integrity cost the slotted pattern introduces.

**Sources:**
- [Ultra fast asynchronous counters in Postgres — Timanovsky](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3)
- [The Slotted Counter Pattern — PlanetScale](https://planetscale.com/blog/the-slotted-counter-pattern)
- [PostgreSQL Lock Contention For Frequently Updated Rows](https://outof.pizza/posts/locks/)
- [How to count hits on a website — Cybertec](https://www.cybertec-postgresql.com/en/how-to-count-hits-on-a-website-in-postgresql/)
- [Counter Analytics in PostgreSQL — Tiger Data](https://www.tigerdata.com/blog/counter-analytics-in-postgresql-beyond-simple-data-denormalization)
- [Supabase RLS Best Practices — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RPC discussion — bypass RLS in postgres function](https://github.com/orgs/supabase/discussions/3563)

---

## 7. Pitfalls — what specifically goes wrong

### 7.1 Day-1 cold start (empty Explore is dead)

**What goes wrong:** First user lands on `/explore`, sees nothing, leaves. No content → no creators → no content. v0/Figma dodge this with editorial seeding ("Featured" rails, paid creator partnerships, internal team posts).

**Mitigation for us:** Before launching the Discover surface, populate it with 30-50 high-quality template carousels generated and published *as the founder's account* (or a `@viralslidemaker` system account). Every Explore view shows: a "Featured" rail (curated by us, hand-picked), a "Trending" rail (popularity_score), a "Fresh" rail (recency). Featured starts as 100% of the visible feed; trending/fresh fade in over time.

**Detection:** If `published_carousels` count < 30 on launch day, the feed will look bare. Track it; gate launch on a content threshold.

[Cold Start Channel Strategy — Autonolab Blog](https://blog.autonolab.com/blog/2025-07-20-cold-start-channel-strategy-publishing-cadence-series-design-and-feedback-loops/) confirms the deliberate-cadence + curated-seed approach.

### 7.2 Spam / low-effort / duplicate content

**What goes wrong:** Bots create 10 accounts and publish 1000 templates that say "follow me on insta." The Trending feed becomes a sewer.

**Mitigation:** Three layers, in order of cheapness:
1. **Rate limit publishes per user.** `INSERT INTO published_carousels` server action checks: max 3 publishes/24h for free tier, max 10 for paid. (Reuse Upstash from API key rate limiting.)
2. **`is_flagged` boolean + admin UI.** RLS already excludes flagged rows from public read. Add a `report_published_carousel(p_id, reason)` RPC that any auth'd user can call → inserts into `published_carousel_reports` table. Three reports auto-flag.
3. **Heuristic at publish time.** Block publishes where slide_data text fails simple checks — duplicate slides, fewer than 2 distinct words across all slides, < 30 chars total content. Cheap and catches 80% of bot output.

We do NOT need ML moderation at this scale.

### 7.3 Counter contention

**Already addressed in §6.** Recap: view_count via async event table, bookmark/remix via triggers/RPCs that touch the row inside an existing transaction. We never have the production-killer pattern of "every page view does `UPDATE ... SET view_count = view_count + 1` directly on the hot row."

[10 Postgres Lock-Contention Fixes That Free Throughput](https://medium.com/@npavfan2facts/10-postgres-lock-contention-fixes-that-free-throughput-462513bd5e54) and [The Slotted Counter Pattern](https://planetscale.com/blog/the-slotted-counter-pattern) both call out hot-row counter UPDATE as the canonical anti-pattern.

### 7.4 SEO collision with `/[username]` profile pages

**What goes wrong:** We just shipped `public.profiles` with usernames at `/{username}` (260427-nxd). If we now want carousels at `/c/{slug}`, that's fine. **But** if we later want `/{username}/{slug}` for canonical creator-attributed URLs (CodePen-style), we collide with reserved next.js routes if usernames like `api`, `auth`, `_next`, `discover`, `bookmarks`, `c`, `explore`, `settings`, `dashboard`, `create`, `projects` are claimable.

**Mitigation:**
- Reserve a denylist of usernames at the `claim_username` RPC level. Add to the existing migration: a constant array `('api','auth','admin','dashboard','explore','discover','c','settings','bookmarks','onboarding','docs','help','privacy','terms','create','projects','templates','tag','search')` and reject claims that match.
- v1 URLs: `/c/{slug}` for carousels, `/{username}` for profiles, `/bookmarks` for bookmarks. No `/{username}/{slug}` collision yet.
- Future v2 (`/{username}/{slug}`) can always be added because slug is unique globally.

The existing `public.profiles` migration does NOT have a denylist — this is a gap to close in the publish-flow phase.

### 7.5 Permission bugs in fork (the load-bearing pitfall)

**What goes wrong on a naive fork:**
- Forked `slide_data` JSONB embeds image URLs pointing at the original creator's `slide-backgrounds/{their_user_id}/...` private storage path. The forker can't see them. Carousel renders broken.
- Forked project gets `brand_kit_id` copied as FK → forker now has a project pointing at someone else's brand kit. Either (a) RLS blocks rendering, or (b) we set the FK to NULL but render-time logic still tries to resolve it — bug.
- Forked project copies `template_id` text — that's fine, it's a public string identifier of a built-in template. *Unless* the original was a "brand-kit" template (260427-bkt) — in which case we need to re-resolve to the forker's brand-kit at render, not the original's.

**Mitigation — enforced inside `fork_published_carousel`:**
1. Image URLs in `slide_data` must be **either public bucket URLs (slide-backgrounds is public per migration 006) or rewritten to public**. Verify by reading migration 006 — confirm slide-backgrounds is public. If yes: the URLs work. If user-uploaded images live in a private bucket: at *publish* time we copy assets to a public `published-assets/` bucket and rewrite slide_data URLs to point there.
2. **Never copy `brand_kit_id`.** The fork RPC explicitly omits it (sketch above).
3. **Resolve `template_id = 'brand-kit'` at render time against the forker's brand kit, not the snapshotted one.** This is already how the brand-kit-as-template feature works (see commit a8c81f9 — "resolve 'brand-kit' template id at render"). Confirmed safe.
4. **Snapshot, never reference.** `published_carousels.slide_data` is a JSONB *copy*, not a foreign key to the source project. If the source project is deleted, the published carousel survives (we control via `ON DELETE` — actually, sketch says `ON DELETE CASCADE` from projects → published_carousels, which is wrong; should be `ON DELETE SET NULL` on `source_project_id`. **Schema fix:**

```sql
source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
-- and remove the NOT NULL constraint
```

That way deleting the original project doesn't take down the live published carousels (and remixes that already happened).

### 7.6 Username squatters claim Explore-relevant names

User claims `featured`, `trending`, `bookmarks`, `discover` as their username. Mitigated by denylist in §7.4.

**Sources for §7:**
- [Cold Start Channel Strategy](https://blog.autonolab.com/blog/2025-07-20-cold-start-channel-strategy-publishing-cadence-series-design-and-feedback-loops/)
- [10 Postgres Lock-Contention Fixes](https://medium.com/@npavfan2facts/10-postgres-lock-contention-fixes-that-free-throughput-462513bd5e54)
- [Building an Intelligent AI Agent for Content Moderation](https://lablab.ai/t/building-an-intelligent-ai-agent-for-content-moderation-with-structured-output)
- [Best Practices for Supabase — Leanware](https://www.leanware.co/insights/supabase-best-practices)
- v0 community on fork-leakage: [Changes in the fork project affect the main project](https://community.vercel.com/t/changes-in-the-fork-project-affect-the-main-project-envoriments/20470) — exact pitfall we're avoiding via §7.5.

---

## 8. Suggested phase shape (5 phases)

Don't write the actual ROADMAP — that's downstream. Just the seams. Each phase is independently shippable and revertible.

### Phase 1 — Schema + RPCs (no UI yet)
**What ships:** `published_carousels`, `bookmarks`, `carousel_events` tables. RLS policies. `publish_carousel(project_id)`, `unpublish_carousel(carousel_id)`, `fork_published_carousel(carousel_id)`, `report_published_carousel(carousel_id, reason)` RPCs. Username denylist patch on `claim_username`. pg_cron jobs for view-event flush and popularity refresh (running but irrelevant — no rows yet).

**Risk:** Migration order, RLS correctness. **Test gate:** SQL test file proves you can fork as user B and the new project belongs to B with no FKs to A's brand_kit.

### Phase 2 — Publish flow (creator-facing)
**What ships:** "Publish to Explore" button in the editor. Publish modal: title, description, tags input (with curated chips), opt-in checkbox. Server action calls `publish_carousel`. Hero image generation at publish (server-render slide 1 → upload to `published-assets/` public bucket). Profile page lists user's published carousels. Unpublish toggle.

**Risk:** Asset migration from private to public bucket on publish. **Test gate:** Publish a carousel, copy URL into incognito, see it render fully.

### Phase 3 — Discover feed (consumer-facing, no search yet)
**What ships:** `/explore` page with three rails — Featured (admin-curated via `is_featured` boolean), Trending (popularity_score DESC), Fresh (published_at DESC). Carousel detail page at `/c/{slug}` with Fork button (calls `fork_published_carousel`, redirects to `/projects/{new_id}`). View_count event insertion on detail page render. Bookmark toggle (heart icon).

**Risk:** Nothing technically; entirely UX-driven. **Test gate:** Publish 5 carousels, see them in all three rails. Fork one as another user, verify counter went up.

### Phase 4 — Search + tags
**What ships:** Search bar in the Explore header. Tag landing pages (`/c/tag/{tag}`). FTS query with rank ordering. Optional: "did you mean" via pg_trgm.

**Risk:** Search relevance tuning. **Test gate:** Publish 20 carousels with varied content, run 10 representative queries, manually rate top-5 relevance.

### Phase 5 — Bookmarks page + moderation polish
**What ships:** `/bookmarks` page (locked upstream as standalone). Admin-only `/admin/moderation` queue showing flagged rows. Auto-flag at 3 reports. Rate-limit publishes via Upstash.

**Risk:** Admin auth (we have profile gate, no admin role yet — could be a JSONB flag on profile or a separate `admins` table; recommend the latter for clarity).

**Why this ordering?**
- Schema first → all subsequent phases have something to write against.
- Publish flow before Discover → can't browse what hasn't been written.
- Discover before search → search is sugar on top of feed; feed needs to work standalone.
- Search before bookmarks polish → search is more user-visible value than bookmarks.
- Moderation last → only matters once there's content + traffic to abuse.

**Cross-phase concerns**
- Phase 1 also lands the username denylist (§7.4) — small but blocks future URL flexibility.
- Phase 2 is the highest-risk phase because of asset bucket logic.
- Phase 3 is the highest-value phase (this is what users see).
- Trending tuning is iterative — ship the formula in Phase 3, calibrate constants in production over weeks.

---

## 9. Confidence assessment

| Area | Confidence | Why |
|---|---|---|
| v0/CodePen/Figma fork mechanics | HIGH | Direct quotes from official docs (Vercel API ref, CodePen docs, Figma help center). |
| Hard-fork vs lineage decision | HIGH | Vercel's own API ships with no lineage in response; this validates the locked decision. |
| HN gravity formula | HIGH | Multiple sources, well-documented, simple SQL. |
| Postgres FTS sufficiency at our scale | HIGH | Empirical benchmark (200ms→4ms after GIN), Supabase official guide, multiple cross-validating articles. |
| Tag taxonomy hybrid recommendation | MEDIUM | No single authoritative source; synthesis from 4 taxonomy guides + observed comparable platforms. |
| Counter strategy (event table) | HIGH | Timanovsky's article shows 133x speedup with measurable methodology; PlanetScale confirms class of solution. |
| Schema sketch (RLS, RPCs) | MEDIUM | Patterns are well-known; the *specific* combination has not been shipped before. Will need testing in Phase 1. |
| Phase shape | MEDIUM | Opinionated based on dependency graph; user/founder may legitimately re-order. |

---

## 10. Open questions for the user

1. **Hero image strategy** — pre-render at publish time (server cost +1 Satori call per publish), or lazy-render on first view (more complex caching, but cheaper at publish)? Recommend pre-render for v1; first view is the SEO-critical view.
2. **Free tier publish quota** — locked at 3/day or different? Ties to existing free-tier caps.
3. **Featured rail editorial process** — admin UI inside the app, or just `is_featured boolean` you toggle via Supabase studio for v1? Recommend the latter for v1.
4. **Brand-kit-as-template on a remix** — when a fork's `template_id = 'brand-kit'`, do we (a) auto-snapshot the original creator's brand-kit at publish so the fork renders identically by default, or (b) re-resolve to the forker's brand-kit and let the fork "look different"? This is a UX call. Recommend (b) — matches "make it your own" intent of remix.

---

## Sources (consolidated)

### v0 / Vercel
- [v0 Fork Chat API reference](https://v0.app/docs/api/platform/reference/chats/fork)
- [v0 FAQs](https://v0.app/docs/faqs)
- [v0 community: Improve quality with strategic forking](https://community.vercel.com/t/improve-v0-quality-with-strategic-forking/16487)
- [v0 community: Changes in fork affect main project](https://community.vercel.com/t/changes-in-the-fork-project-affect-the-main-project-envoriments/20470)
- [v0 community: How do I fork a chat without losing context](https://community.vercel.com/t/how-do-i-fork-a-chat-in-a-v0-project-without-losing-repo-environment-context/29240)
- Example fork URLs: [chat-app](https://v0.dev/chat/fork-of-chat-app-ORI6x3KOEaZ), [v0-interface](https://v0.dev/chat/fork-of-v0-interface-6uwYgDOSbo8)

### CodePen
- [Forks documentation](https://blog.codepen.io/documentation/forks/)
- [Forking docs](https://blog.codepen.io/docs/pens/forking/)
- [Hashids URL slugs](https://blog.codepen.io/2014/11/14/hash-ids-ls/)
- [Forks in a New Tab (release note)](https://blog.codepen.io/2022/03/30/361-forks-in-a-new-tab/)

### Figma
- [Duplicate Community files](https://help.figma.com/hc/en-us/articles/360038510873-Duplicate-Community-files)
- [Duplicate or copy files](https://help.figma.com/hc/en-us/articles/360038511533-Duplicate-or-copy-files)

### Replit
- [Replit Projects](https://blog.replit.com/introducing-replit-projects)
- [Forking help](https://ask.replit.com/t/help-with-how-forking-works/14364/)

### Hugging Face
- [Manage your Space](https://huggingface.co/docs/huggingface_hub/en/guides/manage-spaces)
- [Spaces Overview](https://huggingface.co/docs/hub/spaces-overview)
- [More ways to create Spaces](https://huggingface.co/docs/hub/spaces-more-ways-to-create)

### Notion / Canva
- [Notion Database templates](https://www.notion.com/help/database-templates)
- [Canva Add edit tags](https://www.canva.com/help/add-edit-tags/)

### Trending / ranking
- [How HN ranking really works — Righto.com](http://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html)
- [How HN ranking algorithm works — Salihefendic / Medium](https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d)
- [How are popular ranking algorithms working — Itchishiki Satoshi / Medium](https://medium.com/jp-tech/how-are-popular-ranking-algorithms-such-as-reddit-and-hacker-news-working-724e639ed9f7)
- [Reddit ranking — Out Of Scope](https://www.outofscope.com/reddits-empire-no-longer-founded-on-a-flawed-algorithm/)
- [decay library — clux/decay](https://github.com/clux/decay)
- [Reddit's Ranking Algorithm — HN thread](https://news.ycombinator.com/item?id=231168)

### Supabase / Postgres
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase Cron blog](https://supabase.com/blog/supabase-cron)
- [Supabase Views](https://supabase.com/docs/guides/graphql/views)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Best Practices — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase RPC bypass RLS discussion](https://github.com/orgs/supabase/discussions/3563)
- [Optimize Read Performance with Materialized Views — Kovidr](https://dev.to/kovidr/optimize-read-performance-in-supabase-with-postgres-materialized-views-12k5)
- [Best Practices for Supabase — Leanware](https://www.leanware.co/insights/supabase-best-practices)

### Postgres FTS / trigrams
- [PostgreSQL Tables and Indexes for FTS](https://www.postgresql.org/docs/current/textsearch-tables.html)
- [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)
- [PostgreSQL FTS as alternative to Elasticsearch — Miftahul Huda](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0)
- [Speeding Up PostgreSQL FTS with Persistent TSVectors — Daniela Baron](https://danielabaron.me/blog/speed-up-pg-fts-with-persistent-ts-vectors/)
- [Create an advanced search engine with PostgreSQL — Tudor Golubenco / Xata](https://xata.io/blog/postgres-full-text-search-engine)
- [When to use FTS and Trigram Indexes — Sukoreno Mukti](https://medium.com/@sukorenomw/when-to-use-postgresql-full-text-search-and-trigram-indexes-4c7c36223421)
- [Performant text searching in PSQL — Daniel Tooke](https://medium.com/@daniel.tooke/performant-text-searching-and-indexes-in-psql-trigrams-like-and-full-text-search-784c000efaa6)

### Counters / lock contention
- [Ultra fast asynchronous counters in Postgres — Timanovsky](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3)
- [The Slotted Counter Pattern — PlanetScale](https://planetscale.com/blog/the-slotted-counter-pattern)
- [PostgreSQL Lock Contention For Frequently Updated Rows — outof.pizza](https://outof.pizza/posts/locks/)
- [How to count hits on a website — Cybertec](https://www.cybertec-postgresql.com/en/how-to-count-hits-on-a-website-in-postgresql/)
- [10 Postgres Lock-Contention Fixes — Quellin / Medium](https://medium.com/@npavfan2facts/10-postgres-lock-contention-fixes-that-free-throughput-462513bd5e54)
- [Counter Analytics in PostgreSQL — Tiger Data](https://www.tigerdata.com/blog/counter-analytics-in-postgresql-beyond-simple-data-denormalization)
- [Incrementing counters in database — depesz](https://www.depesz.com/2016/06/14/incrementing-counters-in-database/)

### Taxonomy / tags
- [Picturepark — Best Practices for DAM Taxonomy](https://picturepark.com/content-management-blog/best-practices-for-dam-taxonomy-metadata-tags-and-controlled-vocabularies)
- [Actian — Metadata Tagging Best Practices](https://www.actian.com/metadata-tagging-best-practices/)
- [NN/g — Taxonomy 101](https://www.nngroup.com/articles/taxonomy-101/)
- [Stanford Sites — Taxonomy best practices](https://sitesuserguide.stanford.edu/build/taxonomy/taxonomy-best-practices)
- [Taxonomies and controlled vocabularies — Springer](https://link.springer.com/article/10.1057/dam.2010.29)

### Cold start / launch strategy
- [Cold Start Channel Strategy — Autonolab Blog](https://blog.autonolab.com/blog/2025-07-20-cold-start-channel-strategy-publishing-cadence-series-design-and-feedback-loops/)

### Moderation
- [Building an Intelligent AI Agent for Content Moderation — lablab.ai](https://lablab.ai/t/building-an-intelligent-ai-agent-for-content-moderation-with-structured-output)
- [Schema Design with Supabase: Partitioning and Normalization — pipipi-dev](https://dev.to/pipipi-dev/schema-design-with-supabase-partitioning-and-normalization-4b7i)
