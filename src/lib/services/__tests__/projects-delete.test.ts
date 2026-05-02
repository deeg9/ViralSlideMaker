// Phase 58 (PARITY-06, D-17): cascade-delete audit.
//
// Asserts deleteProjectService cleans up treated backgrounds + original-
// source uploads BEFORE the row delete; never throws on storage failure;
// no-op when admin arg is omitted.

import { describe, it, expect, vi, type Mock } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteProjectService, extractStoragePath } from '../projects'

interface FakeStorageBucket {
  remove: Mock
}

interface FakeStorage {
  from: Mock<(...args: unknown[]) => FakeStorageBucket>
  _buckets: Map<string, FakeStorageBucket>
}

interface FakeQueryBuilder {
  select: Mock
  eq: Mock
  maybeSingle: Mock
  delete: Mock
}

interface FakeSupabase {
  from: Mock<(...args: unknown[]) => FakeQueryBuilder>
  storage: FakeStorage
  _builders: Map<string, FakeQueryBuilder>
}

function makeFakeSupabase(opts: {
  slideData: Array<{ background_url?: string | null; original_source_url?: string | null }> | null
  storageRemoveError?: boolean
}): FakeSupabase {
  const builders = new Map<string, FakeQueryBuilder>()
  function builderFor(table: string): FakeQueryBuilder {
    if (builders.has(table)) return builders.get(table)!
    const b: FakeQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: opts.slideData === null ? null : { slide_data: opts.slideData },
      }),
      delete: vi.fn().mockReturnThis(),
    }
    // delete().eq().eq() chain returns null error
    b.delete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })) as Mock
    builders.set(table, b)
    return b
  }

  const storageBuckets = new Map<string, FakeStorageBucket>()
  function bucketFor(name: string): FakeStorageBucket {
    if (storageBuckets.has(name)) return storageBuckets.get(name)!
    const bucket: FakeStorageBucket = {
      remove: opts.storageRemoveError
        ? vi.fn().mockRejectedValue(new Error('storage gone'))
        : vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    storageBuckets.set(name, bucket)
    return bucket
  }

  const storage: FakeStorage = {
    from: vi.fn((name: string) => bucketFor(name)),
    _buckets: storageBuckets,
  }
  return {
    from: vi.fn((table: string) => builderFor(table)),
    storage,
    _builders: builders,
  }
}

describe('Phase 58 (PARITY-06): extractStoragePath', () => {
  it('extracts path from a Supabase public storage URL', () => {
    const url =
      'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds-treated/userid/projid/slide.png'
    expect(extractStoragePath(url, 'slide-backgrounds-treated')).toBe(
      'userid/projid/slide.png',
    )
  })

  it('returns null for non-Supabase URLs', () => {
    expect(extractStoragePath('https://images.pexels.com/p/1.jpg', 'any')).toBe(
      null,
    )
  })

  it('returns null for wrong-bucket URLs', () => {
    const url =
      'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds/userid/p.png'
    expect(extractStoragePath(url, 'slide-backgrounds-treated')).toBe(null)
  })

  it('returns null for empty input', () => {
    expect(extractStoragePath('', 'any')).toBe(null)
  })
})

describe('Phase 58 (PARITY-06, D-17): deleteProjectService cascade-delete', () => {
  it('removes BOTH treated + original storage paths before deleting the row', async () => {
    const slideData = [
      {
        background_url:
          'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds-treated/u/p/0.png',
        original_source_url:
          'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds/u/p/0-orig.jpg',
      },
      {
        background_url:
          'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds-treated/u/p/1.png',
        original_source_url:
          'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds/u/p/1-orig.jpg',
      },
    ]
    const fake = makeFakeSupabase({ slideData })
    await deleteProjectService(
      fake as unknown as SupabaseClient,
      'user-1',
      'project-1',
      fake as unknown as SupabaseClient,
    )

    const treatedBucket = fake.storage._buckets.get('slide-backgrounds-treated')
    const originalBucket = fake.storage._buckets.get('slide-backgrounds')

    expect(treatedBucket?.remove).toHaveBeenCalledOnce()
    expect(treatedBucket!.remove.mock.calls[0][0]).toEqual([
      'u/p/0.png',
      'u/p/1.png',
    ])
    expect(originalBucket?.remove).toHaveBeenCalledOnce()
    expect(originalBucket!.remove.mock.calls[0][0]).toEqual([
      'u/p/0-orig.jpg',
      'u/p/1-orig.jpg',
    ])
    // Row delete fired.
    const projBuilder = fake._builders.get('projects')
    expect(projBuilder?.delete).toHaveBeenCalled()
  })

  it('without admin arg, skips storage cleanup but still deletes row', async () => {
    const fake = makeFakeSupabase({
      slideData: [
        {
          background_url:
            'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds-treated/u/p/0.png',
        },
      ],
    })
    await deleteProjectService(
      fake as unknown as SupabaseClient,
      'user-1',
      'project-1',
      // admin omitted
    )

    expect(fake.storage.from).not.toHaveBeenCalled()
    const projBuilder = fake._builders.get('projects')
    expect(projBuilder?.delete).toHaveBeenCalled()
  })

  it('storage remove() failure does NOT prevent row delete (best-effort cleanup)', async () => {
    const slideData = [
      {
        background_url:
          'https://abc.supabase.co/storage/v1/object/public/slide-backgrounds-treated/u/p/0.png',
      },
    ]
    const fake = makeFakeSupabase({ slideData, storageRemoveError: true })
    await expect(
      deleteProjectService(
        fake as unknown as SupabaseClient,
        'user-1',
        'project-1',
        fake as unknown as SupabaseClient,
      ),
    ).resolves.not.toThrow()
    const projBuilder = fake._builders.get('projects')
    expect(projBuilder?.delete).toHaveBeenCalled()
  })

  it('empty slide_data: no storage calls, row delete still fires', async () => {
    const fake = makeFakeSupabase({ slideData: [] })
    await deleteProjectService(
      fake as unknown as SupabaseClient,
      'user-1',
      'project-1',
      fake as unknown as SupabaseClient,
    )

    expect(fake.storage.from).not.toHaveBeenCalled()
    const projBuilder = fake._builders.get('projects')
    expect(projBuilder?.delete).toHaveBeenCalled()
  })

  it('null project (not found): no storage calls, attempts row delete anyway', async () => {
    const fake = makeFakeSupabase({ slideData: null })
    await deleteProjectService(
      fake as unknown as SupabaseClient,
      'user-1',
      'project-1',
      fake as unknown as SupabaseClient,
    )

    expect(fake.storage.from).not.toHaveBeenCalled()
    const projBuilder = fake._builders.get('projects')
    expect(projBuilder?.delete).toHaveBeenCalled()
  })
})
